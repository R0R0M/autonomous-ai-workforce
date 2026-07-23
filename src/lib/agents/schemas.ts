import { z } from "zod";

export const ScoresSchema = z.object({
  userImpact: z.number(),
  businessValue: z.number(),
  technicalDifficulty: z.number(),
  developmentTime: z.number(),
  risk: z.number(),
  performanceGain: z.number(),
  maintainability: z.number(),
  securityImprovement: z.number(),
  accessibilityImprovement: z.number(),
  novelty: z.number(),
  expectedUserSatisfaction: z.number(),
});

export const IdeaSchema = z.object({
  title: z.string().describe("Short imperative title, e.g. 'Improve mobile navigation'"),
  description: z.string().describe("What should change, concretely"),
  reasoning: z.string().describe("Why this matters now, grounded in the codebase analysis"),
  expectedOutcome: z.string(),
  acceptanceCriteria: z.array(z.string()).describe("Verifiable pass/fail criteria"),
  filesLikelyAffected: z.array(z.string()),
  dependencies: z.array(z.string()),
  risks: z.array(z.string()),
  successMetrics: z.array(z.string()),
  scores: ScoresSchema.describe("Each dimension scored 1-100"),
});

export const IdeaBatchSchema = z.object({
  analysisSummary: z
    .string()
    .describe("2-4 sentence summary of the repository's current state and biggest gaps"),
  ideas: z.array(IdeaSchema).describe("3-8 improvement ideas, most valuable first"),
});

export const AgentBugReportSchema = z.object({
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
  title: z.string(),
  description: z.string(),
  stepsToReproduce: z.string(),
  expectedBehavior: z.string(),
  actualBehavior: z.string(),
  logs: z.string().describe("Relevant command output, stack traces, or logs; empty if none"),
  likelyFiles: z.array(z.string()),
  suggestedFixes: z.string(),
});

export const VerdictSchema = z.object({
  approved: z.boolean().describe("true ONLY if every acceptance criterion passes and no CRITICAL/HIGH issues remain"),
  summary: z.string().describe("What was tested and the overall result"),
  checksRun: z.array(z.string()).describe("Commands/checks executed, e.g. 'npm test', 'npm run build'"),
  bugs: z.array(AgentBugReportSchema).describe("Empty when approved"),
});

export type IdeaBatch = z.infer<typeof IdeaBatchSchema>;
export type ParsedIdea = z.infer<typeof IdeaSchema>;
export type Verdict = z.infer<typeof VerdictSchema>;
export type AgentBugReport = z.infer<typeof AgentBugReportSchema>;

/** The structured brief the Ideator hands to the Coder. */
export interface TaskBrief {
  title: string;
  description: string;
  reasoning: string;
  expectedOutcome: string;
  acceptanceCriteria: string[];
  filesLikelyAffected: string[];
  dependencies: string[];
  risks: string[];
  successMetrics: string[];
}

export function formatTaskBrief(brief: TaskBrief): string {
  const list = (items: string[]) =>
    items.length ? items.map((i) => `- ${i}`).join("\n") : "- (none identified)";
  return [
    `# Task: ${brief.title}`,
    ``,
    `## Problem description`,
    brief.description,
    ``,
    `## Reasoning`,
    brief.reasoning,
    ``,
    `## Expected outcome`,
    brief.expectedOutcome,
    ``,
    `## Acceptance criteria`,
    list(brief.acceptanceCriteria),
    ``,
    `## Files likely affected`,
    list(brief.filesLikelyAffected),
    ``,
    `## Dependencies`,
    list(brief.dependencies),
    ``,
    `## Potential risks`,
    list(brief.risks),
    ``,
    `## Success metrics`,
    list(brief.successMetrics),
  ].join("\n");
}
