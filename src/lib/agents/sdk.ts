/**
 * Claude Agent SDK backend — runs the agents through Claude Code, so usage
 * bills the machine's Claude subscription (Max/Pro) instead of API credits.
 * Selected with AGENT_BACKEND="sdk".
 */
import { query } from "@anthropic-ai/claude-agent-sdk";
import { config } from "@/lib/config";
import type { TokenUsage } from "./client";
import type { ToolEventSink } from "./tools";

/**
 * Subprocess env: a minimal whitelist. Nothing else from our environment may
 * leak into agent sessions — no ANTHROPIC_API_KEY (it would bill API credits
 * instead of the plan), and no platform secrets (DATABASE_URL, AUTH_*,
 * STRIPE_*, APP_ENCRYPTION_KEY, ...): an agent running a repo's tooling with
 * our DATABASE_URL once executed that repo's migrations against OUR database.
 */
const SDK_ENV_WHITELIST = ["PATH", "HOME", "SHELL", "LANG", "LC_ALL", "TMPDIR", "USER", "TERM"];

function sdkEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of SDK_ENV_WHITELIST) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  env.CI = "true";
  env.NO_COLOR = "1";
  return env;
}

export type SdkToolMode = "readwrite" | "readonly" | "none";

export interface SdkAgentInput {
  prompt: string;
  systemPrompt: string;
  cwd?: string;
  mode: SdkToolMode;
  maxTurns?: number;
  model?: string;
  onToolEvent?: ToolEventSink;
}

export interface SdkAgentResult {
  text: string;
  usage: TokenUsage;
}

const WRITE_TOOLS = ["Write", "Edit", "NotebookEdit"];
const OFF_LIMITS = ["WebSearch", "WebFetch", "Task", "TodoWrite", "KillShell"];

function disallowedFor(mode: SdkToolMode): string[] {
  switch (mode) {
    case "readwrite":
      return OFF_LIMITS;
    case "readonly":
      return [...OFF_LIMITS, ...WRITE_TOOLS];
    case "none":
      return [...OFF_LIMITS, ...WRITE_TOOLS, "Bash", "Read", "Glob", "Grep", "BashOutput"];
  }
}

function toolEventFor(name: string, input: Record<string, unknown>) {
  const p = (key: string) => String(input[key] ?? "");
  switch (name) {
    case "Bash":
      return { tool: "bash", summary: `$ ${p("command").slice(0, 200)}` };
    case "Write":
      return { tool: "write_file", summary: `wrote ${p("file_path")}` };
    case "Edit":
      return { tool: "write_file", summary: `edited ${p("file_path")}` };
    case "NotebookEdit":
      return { tool: "write_file", summary: `edited ${p("notebook_path")}` };
    case "Read":
      return { tool: "read_file", summary: `read ${p("file_path")}` };
    case "Glob":
      return { tool: "list_files", summary: `glob ${p("pattern")}` };
    case "Grep":
      return { tool: "list_files", summary: `grep ${p("pattern")}` };
    default:
      return { tool: name.toLowerCase(), summary: name };
  }
}

/** Run one agent session through the Claude Agent SDK and collect the result. */
export async function runSdkAgent(input: SdkAgentInput): Promise<SdkAgentResult> {
  const emit = async (event: { tool: string; summary: string; detail?: string }) => {
    try {
      await input.onToolEvent?.(event);
    } catch {
      // feed errors never break the agent loop
    }
  };

  let resultText = "";
  let usage: TokenUsage = { input: 0, output: 0 };
  const running: TokenUsage = { input: 0, output: 0 };

  const session = query({
    prompt: input.prompt,
    options: {
      cwd: input.cwd,
      model: input.model ?? config.anthropicModel,
      systemPrompt: input.systemPrompt,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      disallowedTools: disallowedFor(input.mode),
      maxTurns: input.maxTurns ?? 80,
      env: sdkEnv(),
    },
  });

  for await (const message of session) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "tool_use") {
          await emit(toolEventFor(block.name, (block.input ?? {}) as Record<string, unknown>));
        }
      }
      const u = message.message.usage;
      const inTok =
        (u?.input_tokens ?? 0) +
        (u?.cache_creation_input_tokens ?? 0) +
        (u?.cache_read_input_tokens ?? 0);
      const outTok = u?.output_tokens ?? 0;
      if (inTok + outTok > 0) {
        running.input += inTok;
        running.output += outTok;
        await emit({
          tool: "usage",
          summary: `tokens — in ${inTok.toLocaleString()} / out ${outTok.toLocaleString()} (phase total: ${running.input.toLocaleString()} in / ${running.output.toLocaleString()} out)`,
        });
      }
    } else if (message.type === "result") {
      const u = message.usage;
      usage = {
        input:
          (u.input_tokens ?? 0) +
          (u.cache_creation_input_tokens ?? 0) +
          (u.cache_read_input_tokens ?? 0),
        output: u.output_tokens ?? 0,
      };
      if (message.subtype === "success") {
        resultText = message.result;
      } else {
        resultText = "";
      }
    }
  }

  return { text: resultText, usage };
}

/** Pull a JSON object out of an agent's final text (fenced or bare). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return JSON.parse(fenced[1]);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object found in agent output");
  return JSON.parse(text.slice(start, end + 1));
}
