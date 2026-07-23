import { describe, expect, it } from "vitest";
import { simpleDiff, newFileDiff } from "@/lib/agents/diff";

describe("simpleDiff", () => {
  it("reports no changes for identical content", () => {
    const d = simpleDiff("a\nb\nc", "a\nb\nc");
    expect(d.added).toBe(0);
    expect(d.removed).toBe(0);
  });

  it("detects a single line change", () => {
    const d = simpleDiff("a\nb\nc", "a\nX\nc");
    expect(d.added).toBe(1);
    expect(d.removed).toBe(1);
    expect(d.text).toContain("- b");
    expect(d.text).toContain("+ X");
  });

  it("detects additions", () => {
    const d = simpleDiff("a\nb", "a\nb\nc\nd");
    expect(d.added).toBe(2);
    expect(d.removed).toBe(0);
    expect(d.text).toContain("+ c");
    expect(d.text).toContain("+ d");
  });

  it("detects removals", () => {
    const d = simpleDiff("a\nb\nc", "a");
    expect(d.removed).toBe(2);
    expect(d.added).toBe(0);
  });

  it("caps very large diffs", () => {
    const before = "x";
    const after = Array.from({ length: 500 }, (_, i) => `line ${i}`).join("\n");
    const d = simpleDiff(before, after);
    expect(d.text).toContain("more lines]");
  });
});

describe("newFileDiff", () => {
  it("marks every line as added", () => {
    const d = newFileDiff("one\ntwo\nthree");
    expect(d.added).toBe(3);
    expect(d.removed).toBe(0);
    expect(d.text).toContain("+ one");
  });
});
