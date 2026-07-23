import { describe, expect, it } from "vitest";
import { scanDiffForSecrets } from "@/lib/orchestrator/safety";

function asDiff(addedLines: string[]): string {
  return ["--- a/file.ts", "+++ b/file.ts", ...addedLines.map((l) => `+${l}`)].join("\n");
}

describe("scanDiffForSecrets", () => {
  it("passes a clean diff", () => {
    expect(
      scanDiffForSecrets(asDiff(["const x = 1;", 'console.log("hello");'])),
    ).toHaveLength(0);
  });

  it("catches GitHub tokens", () => {
    const findings = scanDiffForSecrets(
      asDiff([`const token = "ghp_${"a".repeat(36)}";`]),
    );
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].rule).toContain("GitHub");
  });

  it("catches AWS access keys", () => {
    expect(scanDiffForSecrets(asDiff(['key = "AKIAIOSFODNN7EXAMPL0"']))).not.toHaveLength(0);
  });

  it("catches private key blocks", () => {
    expect(
      scanDiffForSecrets(asDiff(["-----BEGIN RSA PRIVATE KEY-----"])),
    ).not.toHaveLength(0);
  });

  it("catches hardcoded password assignments", () => {
    expect(
      scanDiffForSecrets(asDiff([`password = "supersecretvalue123"`])),
    ).not.toHaveLength(0);
  });

  it("ignores removed lines", () => {
    const diff = ["--- a/f", "+++ b/f", `-const t = "ghp_${"a".repeat(36)}";`].join("\n");
    expect(scanDiffForSecrets(diff)).toHaveLength(0);
  });

  it("allows obvious placeholders", () => {
    expect(
      scanDiffForSecrets(asDiff([`apiKey = "YOUR_API_KEY_placeholder_value"`])),
    ).toHaveLength(0);
  });
});
