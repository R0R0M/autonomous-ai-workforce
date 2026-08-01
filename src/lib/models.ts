/** Models users can pick per repository. */
export const AVAILABLE_MODELS = [
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    tagline: "Fastest & cheapest — great for trying things out",
    pricing: "$1 in / $5 out per 1M tokens",
  },
  {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    tagline: "Best quality-per-dollar for serious work",
    pricing: "$3 in / $15 out per 1M tokens",
  },
  {
    id: "claude-opus-4-8",
    label: "Claude Opus 4.8",
    tagline: "Highest quality for the hardest codebases",
    pricing: "$5 in / $25 out per 1M tokens",
  },
] as const;

export const MODEL_IDS = ["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-4-8"] as const;
export type ModelId = (typeof MODEL_IDS)[number];
