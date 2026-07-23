/**
 * Minimal line-based diff for the live activity feed. Trims the common
 * prefix/suffix and renders the changed middle as -/+ lines with a little
 * context. Not a full LCS diff — optimized for readability, not minimality.
 */

const MAX_DIFF_LINES = 160;
const CONTEXT = 2;

export interface DiffResult {
  text: string;
  added: number;
  removed: number;
}

export function simpleDiff(before: string, after: string): DiffResult {
  const a = before.split("\n");
  const b = after.split("\n");

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;

  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const removed = a.slice(start, endA);
  const added = b.slice(start, endB);

  if (removed.length === 0 && added.length === 0) {
    return { text: "(no changes)", added: 0, removed: 0 };
  }

  const lines: string[] = [];
  lines.push(`@@ line ${start + 1} @@`);
  for (const line of a.slice(Math.max(0, start - CONTEXT), start)) lines.push(`  ${line}`);
  for (const line of removed) lines.push(`- ${line}`);
  for (const line of added) lines.push(`+ ${line}`);
  for (const line of a.slice(endA, Math.min(a.length, endA + CONTEXT))) lines.push(`  ${line}`);

  let text = lines.slice(0, MAX_DIFF_LINES).join("\n");
  if (lines.length > MAX_DIFF_LINES) {
    text += `\n... [${lines.length - MAX_DIFF_LINES} more lines]`;
  }
  return { text, added: added.length, removed: removed.length };
}

/** Diff for a brand-new file: everything is an addition. */
export function newFileDiff(content: string): DiffResult {
  const lines = content.split("\n");
  const shown = lines.slice(0, MAX_DIFF_LINES).map((l) => `+ ${l}`);
  let text = shown.join("\n");
  if (lines.length > MAX_DIFF_LINES) {
    text += `\n... [${lines.length - MAX_DIFF_LINES} more lines]`;
  }
  return { text, added: lines.length, removed: 0 };
}
