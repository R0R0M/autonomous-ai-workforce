/** Rough per-model pricing (USD per million tokens) for dashboard estimates. */
const PRICE_TABLE: [pattern: RegExp, input: number, output: number][] = [
  [/haiku/, 1, 5],
  [/sonnet/, 3, 15],
  [/opus/, 5, 25],
  [/fable|mythos/, 10, 50],
];

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const match = PRICE_TABLE.find(([p]) => p.test(model));
  const [, inPrice, outPrice] = match ?? [/./, 5, 25];
  return (inputTokens * inPrice + outputTokens * outPrice) / 1_000_000;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
