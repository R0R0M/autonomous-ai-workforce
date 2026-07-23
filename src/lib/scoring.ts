/**
 * Idea scoring. Every dimension is 1-100 (higher = better for the product,
 * except difficulty/time/risk which are inverted when computing priority).
 */

export const SCORE_DIMENSIONS = [
  "userImpact",
  "businessValue",
  "technicalDifficulty",
  "developmentTime",
  "risk",
  "performanceGain",
  "maintainability",
  "securityImprovement",
  "accessibilityImprovement",
  "novelty",
  "expectedUserSatisfaction",
] as const;

export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];
export type Scores = Record<ScoreDimension, number>;

const WEIGHTS: Record<ScoreDimension, number> = {
  userImpact: 0.2,
  businessValue: 0.15,
  technicalDifficulty: -0.1,
  developmentTime: -0.1,
  risk: -0.15,
  performanceGain: 0.1,
  maintainability: 0.08,
  securityImprovement: 0.12,
  accessibilityImprovement: 0.08,
  novelty: 0.02,
  expectedUserSatisfaction: 0.15,
};

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(1, Math.round(n)));
}

/**
 * Weighted overall priority, normalized to 1-100. Negative-weight dimensions
 * (difficulty, time, risk) reduce priority as they grow.
 */
export function computePriority(scores: Scores): number {
  let total = 0;
  let positive = 0;
  let negative = 0;
  for (const dim of SCORE_DIMENSIONS) {
    const weight = WEIGHTS[dim];
    const value = clampScore(scores[dim]);
    total += weight * value;
    if (weight > 0) positive += weight * 100;
    else negative += weight * 1; // best case: negative dims at minimum
  }
  // Normalize from [worst, best] to [1, 100]
  const worst = SCORE_DIMENSIONS.reduce(
    (acc, dim) => acc + (WEIGHTS[dim] > 0 ? WEIGHTS[dim] * 1 : WEIGHTS[dim] * 100),
    0,
  );
  const best = positive + negative;
  const normalized = ((total - worst) / (best - worst)) * 99 + 1;
  return clampScore(normalized);
}
