import { anthropic, model, reasoningParams, usageOf, type TokenUsage } from "./client";
import { CODER_SYSTEM } from "./prompts";
import { makeWorkspaceTools, type ToolEventSink } from "./tools";
import { config } from "@/lib/config";
import { runSdkAgent } from "./sdk";

export interface CoderInput {
  workspaceDir: string;
  taskBrief: string;
  mode: "implement" | "fix";
  bugReports?: string;
  onToolEvent?: ToolEventSink;
}

export interface CoderResult {
  report: string;
  usage: TokenUsage;
}

/**
 * Run the Coder agent: an agentic tool loop inside the workspace.
 * Returns the Coder's implementation report (final text output).
 */
export async function runCoder(input: CoderInput): Promise<CoderResult> {
  const kickoff =
    input.mode === "implement"
      ? [
          `Implement the following task from the Ideator. Explore the codebase first, then implement, then verify with the repo's own checks.`,
          ``,
          input.taskBrief,
        ].join("\n")
      : [
          `The Tester rejected your implementation. Fix ALL of the reported bugs below, then re-verify with the repo's own checks. The original task brief follows the bug reports for context.`,
          ``,
          `# Bug reports from the Tester`,
          input.bugReports ?? "(none provided)",
          ``,
          `# Original task brief`,
          input.taskBrief,
        ].join("\n");

  if (config.agentBackend === "sdk") {
    const { text, usage } = await runSdkAgent({
      prompt: kickoff,
      systemPrompt: CODER_SYSTEM,
      cwd: input.workspaceDir,
      mode: "readwrite",
      maxTurns: 100,
      onToolEvent: input.onToolEvent,
    });
    return { report: text || "(the Coder produced no final report)", usage };
  }

  const client = anthropic();
  const tools = makeWorkspaceTools(input.workspaceDir, {
    allowWrite: true,
    onEvent: input.onToolEvent,
  });

  const runner = client.beta.messages.toolRunner({
    model: model(),
    max_tokens: 16000,
    ...reasoningParams("xhigh"),
    system: CODER_SYSTEM,
    tools,
    messages: [{ role: "user", content: kickoff }],
    max_iterations: 80,
  });

  const total: TokenUsage = { input: 0, output: 0 };
  let finalMessage = null as Awaited<typeof runner> | null;
  for await (const message of runner) {
    finalMessage = message;
    const u = usageOf(message);
    total.input += u.input;
    total.output += u.output;
    try {
      await input.onToolEvent?.({
        tool: "usage",
        summary: `tokens — in ${u.input.toLocaleString()} / out ${u.output.toLocaleString()} (phase total: ${total.input.toLocaleString()} in / ${total.output.toLocaleString()} out)`,
      });
    } catch {
      // never break the loop over feed errors
    }
    // Server-side pause: resume by echoing the paused assistant turn.
    if (message.stop_reason === "pause_turn") {
      runner.pushMessages({ role: "assistant", content: message.content });
    }
  }

  const report =
    finalMessage?.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim() || "(the Coder produced no final report)";

  return { report, usage: total };
}
