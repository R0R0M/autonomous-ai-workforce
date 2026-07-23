import { describe, expect, it } from "vitest";
import { clampScore, computePriority, SCORE_DIMENSIONS, type Scores } from "@/lib/scoring";

function scores(overrides: Partial<Scores> = {}): Scores {
  const base = Object.fromEntries(SCORE_DIMENSIONS.map((d) => [d, 50])) as Scores;
  return { ...base, ...overrides };
}

describe("clampScore", () => {
  it("clamps into 1-100", () => {
    expect(clampScore(0)).toBe(1);
    expect(clampScore(-10)).toBe(1);
    expect(clampScore(150)).toBe(100);
    expect(clampScore(72.4)).toBe(72);
  });

  it("handles non-finite input", () => {
    expect(clampScore(NaN)).toBe(50);
    expect(clampScore(Infinity)).toBe(50);
  });
});

describe("computePriority", () => {
  it("stays within 1-100", () => {
    expect(computePriority(scores())).toBeGreaterThanOrEqual(1);
    expect(computePriority(scores())).toBeLessThanOrEqual(100);
  });

  it("rewards high impact", () => {
    const low = computePriority(scores({ userImpact: 10, businessValue: 10 }));
    const high = computePriority(scores({ userImpact: 95, businessValue: 95 }));
    expect(high).toBeGreaterThan(low);
  });

  it("penalizes high risk and difficulty", () => {
    const safe = computePriority(scores({ risk: 5, technicalDifficulty: 5 }));
    const risky = computePriority(scores({ risk: 95, technicalDifficulty: 95 }));
    expect(safe).toBeGreaterThan(risky);
  });

  it("best case beats worst case decisively", () => {
    const best = computePriority(
      scores({
        userImpact: 100, businessValue: 100, performanceGain: 100, maintainability: 100,
        securityImprovement: 100, accessibilityImprovement: 100, novelty: 100,
        expectedUserSatisfaction: 100, technicalDifficulty: 1, developmentTime: 1, risk: 1,
      }),
    );
    const worst = computePriority(
      scores({
        userImpact: 1, businessValue: 1, performanceGain: 1, maintainability: 1,
        securityImprovement: 1, accessibilityImprovement: 1, novelty: 1,
        expectedUserSatisfaction: 1, technicalDifficulty: 100, developmentTime: 100, risk: 100,
      }),
    );
    expect(best).toBe(100);
    expect(worst).toBe(1);
  });
});
