import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, model, reasoningParams, usageOf, type TokenUsage } from "./client";
import { config } from "@/lib/config";
import { runSdkAgent, extractJson } from "./sdk";

export const ChangeSummarySchema = z.object({
  overall: z
    .string()
    .describe("2-3 plain-English sentences: what this change does for the user/product"),
  changes: z.array(
    z.object({
      file: z.string().describe("Repo-relative file path"),
      whatChanged: z.string().describe("One sentence: what was modified in this file"),
      purpose: z.string().describe("One sentence: why — what this change is for"),
    }),
  ),
});

export type ChangeSummary = z.infer<typeof ChangeSummarySchema>;

/**
 * Produce a human-readable per-file explanation of a coding phase's changes —
 * powers the "Changes" shelf in the dashboard.
 */
export async function summarizeChanges(input: {
  model?: string;
  taskTitle: string;
  taskDescription: string;
  coderReport: string;
  diffStat: string;
  diff: string;
}): Promise<{ summary: ChangeSummary; usage: TokenUsage }> {
  const userContent = [
    `# Task that was implemented`,
    `${input.taskTitle}: ${input.taskDescription}`,
    ``,
    `# Engineer's report`,
    input.coderReport.slice(0, 4000),
    ``,
    `# Files changed (diffstat)`,
    input.diffStat.slice(0, 2000),
    ``,
    `# Diff`,
    input.diff.slice(0, 30_000),
  ].join("\n");

  if (config.agentBackend === "sdk") {
    const { text, usage } = await runSdkAgent({
      prompt:
        userContent +
        `\n\nRespond with ONLY a JSON object of this exact shape (no markdown fences, no prose): {"overall": string, "changes": [{"file": string, "whatChanged": string, "purpose": string}]}`,
      systemPrompt:
        "You summarize code changes for a non-technical dashboard. Explain plainly what changed in each file and why it matters. Cover every file in the diffstat. No jargon, no code in your output.",
      mode: "none",
      maxTurns: 2,
      model: input.model,
    });
    return { summary: ChangeSummarySchema.parse(extractJson(text)), usage };
  }

  const client = anthropic();
  const reasoning = reasoningParams("low", input.model);

  const response = await client.messages.parse({
    model: input.model ?? model(),
    max_tokens: 4000,
    ...(reasoning.thinking ? { thinking: reasoning.thinking } : {}),
    output_config: {
      format: zodOutputFormat(ChangeSummarySchema),
      ...(reasoning.output_config ?? {}),
    },
    system:
      "You summarize code changes for a non-technical dashboard. Explain plainly what changed in each file and why it matters. Cover every file in the diffstat. No jargon, no code in your output.",
    messages: [{ role: "user", content: userContent }],
  });

  if (!response.parsed_output) throw new Error("Change summarizer returned no parseable output");
  return { summary: response.parsed_output, usage: usageOf(response) };
}
