import Anthropic from "@anthropic-ai/sdk";
import { config } from "@/lib/config";

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: config.anthropicApiKey });
  return client;
}

export function model(): string {
  return config.anthropicModel;
}

/**
 * Models that support adaptive thinking + the `effort` parameter
 * (Claude 4.6+ generation). Older models (Haiku 4.5, Sonnet 4.5, ...)
 * reject both, so we omit them there.
 */
const MODERN_MODEL = /(fable-5|mythos-5|opus-4-[678]|sonnet-5|sonnet-4-6)/;

export function supportsAdaptiveThinking(modelName?: string): boolean {
  return MODERN_MODEL.test(modelName ?? model());
}

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface TokenUsage {
  input: number;
  output: number;
}

/** Total billable-ish input (incl. cache reads/writes) + output for one API response. */
export function usageOf(message: {
  usage?: {
    input_tokens?: number | null;
    output_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  } | null;
}): TokenUsage {
  const u = message.usage;
  return {
    input:
      (u?.input_tokens ?? 0) +
      (u?.cache_creation_input_tokens ?? 0) +
      (u?.cache_read_input_tokens ?? 0),
    output: u?.output_tokens ?? 0,
  };
}

/**
 * Thinking/effort request params appropriate for the given model
 * (falls back to the globally configured one).
 * Spread into messages.create / parse / toolRunner calls.
 */
export function reasoningParams(
  effort: Effort,
  modelName?: string,
): {
  thinking?: { type: "adaptive" };
  output_config?: { effort: Effort };
} {
  if (!supportsAdaptiveThinking(modelName)) return {};
  return { thinking: { type: "adaptive" }, output_config: { effort } };
}
