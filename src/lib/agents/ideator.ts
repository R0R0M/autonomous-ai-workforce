import fs from "fs";
import path from "path";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, model, reasoningParams, usageOf, type TokenUsage } from "./client";
import { IDEATOR_SYSTEM } from "./prompts";
import { IdeaBatchSchema, type IdeaBatch } from "./schemas";
import { runBash } from "./tools";
import { config } from "@/lib/config";
import { runSdkAgent, extractJson } from "./sdk";

const IDEA_JSON_SHAPE = `{"analysisSummary": string, "ideas": [{"title": string, "description": string, "reasoning": string, "expectedOutcome": string, "acceptanceCriteria": string[], "filesLikelyAffected": string[], "dependencies": string[], "risks": string[], "successMetrics": string[], "scores": {"userImpact": number, "businessValue": number, "technicalDifficulty": number, "developmentTime": number, "risk": number, "performanceGain": number, "maintainability": number, "securityImprovement": number, "accessibilityImprovement": number, "novelty": number, "expectedUserSatisfaction": number}}]}`;

const KEY_FILES = [
  "README.md",
  "package.json",
  "next.config.js",
  "next.config.ts",
  "tsconfig.json",
  "requirements.txt",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "docker-compose.yml",
  "Makefile",
];

/** Build a compact snapshot of the repository for the Ideator's analysis. */
export async function buildRepoSnapshot(workspaceDir: string): Promise<string> {
  const { output: tree } = await runBash(workspaceDir, "git ls-files | head -400");

  const sections: string[] = [`## File tree (git-tracked, first 400)\n${tree}`];

  for (const file of KEY_FILES) {
    const full = path.join(workspaceDir, file);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      const content = fs.readFileSync(full, "utf8").slice(0, 6_000);
      sections.push(`## ${file}\n\`\`\`\n${content}\n\`\`\``);
    }
  }

  const { output: recentLog } = await runBash(
    workspaceDir,
    "git log --oneline -15 2>/dev/null || true",
  );
  sections.push(`## Recent commits\n${recentLog}`);

  return sections.join("\n\n");
}

export interface IdeatorContext {
  model?: string;
  snapshot: string;
  memory: string;
  failedIdeas: string[];
  completedIdeas: string[];
  backlogTitles: string[];
}

/** Ask the Ideator for a fresh, ranked batch of improvement ideas. */
export async function runIdeator(
  ctx: IdeatorContext,
): Promise<{ batch: IdeaBatch; usage: TokenUsage }> {
  const client = anthropic();

  const userMessage = [
    `Analyze this repository and produce your improvement backlog.`,
    ``,
    `# Repository snapshot`,
    ctx.snapshot,
    ``,
    `# Team memory (bugs, outcomes, architecture notes)`,
    ctx.memory,
    ``,
    `# Previously FAILED ideas — do NOT re-propose these`,
    ctx.failedIdeas.length ? ctx.failedIdeas.map((t) => `- ${t}`).join("\n") : "(none)",
    ``,
    `# Already COMPLETED improvements — do NOT re-propose these`,
    ctx.completedIdeas.length ? ctx.completedIdeas.map((t) => `- ${t}`).join("\n") : "(none)",
    ``,
    `# Ideas already in the backlog (propose different ones, or better ones)`,
    ctx.backlogTitles.length ? ctx.backlogTitles.map((t) => `- ${t}`).join("\n") : "(none)",
  ].join("\n");

  if (config.agentBackend === "sdk") {
    const { text, usage } = await runSdkAgent({
      prompt:
        userMessage +
        `\n\nRespond with ONLY a JSON object of this exact shape (all scores 1-100, no markdown fences, no prose):\n${IDEA_JSON_SHAPE}`,
      systemPrompt: IDEATOR_SYSTEM,
      mode: "none",
      maxTurns: 4,
      model: ctx.model,
    });
    const batch = IdeaBatchSchema.parse(extractJson(text));
    return { batch, usage };
  }

  const reasoning = reasoningParams("high", ctx.model);
  const response = await client.messages.parse({
    model: ctx.model ?? model(),
    max_tokens: 16000,
    ...(reasoning.thinking ? { thinking: reasoning.thinking } : {}),
    output_config: {
      format: zodOutputFormat(IdeaBatchSchema),
      ...(reasoning.output_config ?? {}),
    },
    system: IDEATOR_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
  });

  if (!response.parsed_output) {
    throw new Error("Ideator returned no parseable output");
  }
  return { batch: response.parsed_output, usage: usageOf(response) };
}
