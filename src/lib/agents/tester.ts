import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { anthropic, model, reasoningParams, usageOf, type TokenUsage } from "./client";
import { config } from "@/lib/config";
import { runSdkAgent, extractJson } from "./sdk";
import { TESTER_SYSTEM } from "./prompts";
import { makeWorkspaceTools, type ToolEventSink } from "./tools";
import { VerdictSchema, type Verdict } from "./schemas";

export interface TesterInput {
  model?: string;
  workspaceDir: string;
  taskBrief: string;
  implementationReport: string;
  changedFiles: string[];
  onToolEvent?: ToolEventSink;
}

export interface TesterResult {
  verdict: Verdict;
  usage: TokenUsage;
}

/**
 * Run the Tester agent: read-only tool loop that must end by calling
 * submit_verdict with a structured pass/fail result.
 */
export async function runTester(input: TesterInput): Promise<TesterResult> {
  const kickoff = [
    `Verify the Coder's implementation of the task below. Run every automated check the repository provides, validate each acceptance criterion, and probe for regressions and edge cases in the changed code.`,
    ``,
    `# Task brief`,
    input.taskBrief,
    ``,
    `# Coder's implementation report`,
    input.implementationReport,
    ``,
    `# Files changed on this branch`,
    input.changedFiles.length ? input.changedFiles.map((f) => `- ${f}`).join("\n") : "(none reported)",
  ].join("\n");

  if (config.agentBackend === "sdk") {
    return runTesterViaSdk(input, kickoff);
  }

  const client = anthropic();

  let verdict: Verdict | null = null;

  const submitVerdict = betaZodTool({
    name: "submit_verdict",
    description:
      "Submit your final structured verdict. Call exactly once, as your last action, after all checks are complete.",
    inputSchema: VerdictSchema,
    run: async (input) => {
      verdict = input;
      return "Verdict recorded. You are done — do not call any more tools.";
    },
  });

  const tools = [
    ...makeWorkspaceTools(input.workspaceDir, { allowWrite: false, onEvent: input.onToolEvent }),
    submitVerdict,
  ];

  const runner = client.beta.messages.toolRunner({
    model: input.model ?? model(),
    max_tokens: 16000,
    ...reasoningParams("high", input.model),
    system: TESTER_SYSTEM,
    tools,
    messages: [{ role: "user", content: `${kickoff}\n\nFinish by calling submit_verdict.` }],
    max_iterations: 60,
  });

  const total: TokenUsage = { input: 0, output: 0 };
  for await (const message of runner) {
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
    if (message.stop_reason === "pause_turn") {
      runner.pushMessages({ role: "assistant", content: message.content });
    }
  }

  if (!verdict) {
    // The Tester never submitted — treat as rejection so nothing unverified ships.
    return {
      usage: total,
      verdict: {
      approved: false,
      summary:
        "Tester finished without submitting a structured verdict. Treating as rejection for safety.",
      checksRun: [],
      bugs: [
        {
          severity: "HIGH",
          title: "Tester did not produce a verdict",
          description:
            "The testing session ended without a submit_verdict call, so the implementation is unverified.",
          stepsToReproduce: "Re-run the test phase.",
          expectedBehavior: "A structured verdict is submitted.",
          actualBehavior: "No verdict was submitted.",
          logs: "",
          likelyFiles: [],
          suggestedFixes: "Re-run testing; if this persists, review the changes manually.",
          },
        ],
      },
    };
  }
  return { verdict, usage: total };
}

function rejectionVerdict(reason: string): Verdict {
  return {
    approved: false,
    summary: reason,
    checksRun: [],
    bugs: [
      {
        severity: "HIGH",
        title: "Tester did not produce a verdict",
        description: reason,
        stepsToReproduce: "Re-run the test phase.",
        expectedBehavior: "A structured verdict is produced.",
        actualBehavior: "No parseable verdict was produced.",
        logs: "",
        likelyFiles: [],
        suggestedFixes: "Re-run testing; if this persists, review the changes manually.",
      },
    ],
  };
}

/** SDK backend: the Tester ends its final message with a JSON verdict. */
async function runTesterViaSdk(input: TesterInput, kickoff: string): Promise<TesterResult> {
  const verdictInstruction = [
    ``,
    `You do not have a submit_verdict tool in this environment. Instead, END your final message with ONLY a JSON object (no prose after it) of this exact shape:`,
    `{"approved": boolean, "summary": string, "checksRun": string[], "bugs": [{"severity": "CRITICAL"|"HIGH"|"MEDIUM"|"LOW", "title": string, "description": string, "stepsToReproduce": string, "expectedBehavior": string, "actualBehavior": string, "logs": string, "likelyFiles": string[], "suggestedFixes": string}]}`,
    `"bugs" must be empty when approved. Approve ONLY when all tests pass, the build succeeds, and every acceptance criterion is met.`,
  ].join("\n");

  const { text, usage } = await runSdkAgent({
    prompt: kickoff + verdictInstruction,
    systemPrompt: TESTER_SYSTEM,
    cwd: input.workspaceDir,
    mode: "readonly",
    maxTurns: 60,
    model: input.model,
    onToolEvent: input.onToolEvent,
  });

  try {
    const verdict = VerdictSchema.parse(extractJson(text));
    return { verdict, usage };
  } catch {
    return {
      verdict: rejectionVerdict(
        "Tester finished without a parseable JSON verdict. Treating as rejection for safety.",
      ),
      usage,
    };
  }
}
