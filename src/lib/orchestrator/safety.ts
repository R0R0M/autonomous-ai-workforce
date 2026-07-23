export interface SecretFinding {
  rule: string;
  line: string;
}

const SECRET_PATTERNS: { rule: string; pattern: RegExp }[] = [
  { rule: "Anthropic API key", pattern: /sk-ant-[a-zA-Z0-9_-]{10,}/ },
  { rule: "OpenAI API key", pattern: /sk-[a-zA-Z0-9]{20}T3BlbkFJ[a-zA-Z0-9]{20}/ },
  { rule: "GitHub token", pattern: /gh[pousr]_[A-Za-z0-9_]{30,}/ },
  { rule: "GitHub fine-grained token", pattern: /github_pat_[A-Za-z0-9_]{30,}/ },
  { rule: "AWS access key", pattern: /AKIA[0-9A-Z]{16}/ },
  { rule: "Slack token", pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { rule: "Stripe key", pattern: /(sk|rk)_(live|test)_[A-Za-z0-9]{20,}/ },
  { rule: "Private key block", pattern: /-----BEGIN\s+(RSA|EC|DSA|OPENSSH|PGP)?\s*PRIVATE KEY/ },
  { rule: "Google API key", pattern: /AIza[0-9A-Za-z_-]{35}/ },
  {
    rule: "Hardcoded password assignment",
    pattern: /(password|passwd|secret|api_key|apikey|auth_token)\s*[:=]\s*["'][^"'\s]{12,}["']/i,
  },
  { rule: "Connection string with credentials", pattern: /[a-z+]+:\/\/[^\s/:]+:[^\s@/]+@[^\s]+/ },
];

const ALLOWLIST = [
  /example/i,
  /placeholder/i,
  /your[-_]?(api[-_]?key|token|secret|password)/i,
  /xxx+/i,
  /<[^>]+>/, // template placeholders like <YOUR_KEY>
];

/**
 * Scan a unified diff for secrets in ADDED lines only.
 * Returns findings; an empty array means the diff is clean.
 */
export function scanDiffForSecrets(diff: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const rawLine of diff.split("\n")) {
    if (!rawLine.startsWith("+") || rawLine.startsWith("+++")) continue;
    const line = rawLine.slice(1);
    if (ALLOWLIST.some((p) => p.test(line))) continue;
    for (const { rule, pattern } of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({ rule, line: line.trim().slice(0, 200) });
        break;
      }
    }
  }
  return findings;
}
