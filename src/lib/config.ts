import path from "path";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  get anthropicApiKey() {
    return required("ANTHROPIC_API_KEY");
  },
  get anthropicModel() {
    return process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
  },
  /**
   * "api" = direct Anthropic API (bills API credits).
   * "sdk" = Claude Agent SDK / Claude Code (bills the machine's Claude plan).
   */
  get agentBackend(): "api" | "sdk" {
    return (process.env.AGENT_BACKEND ?? "api").toLowerCase() === "sdk" ? "sdk" : "api";
  },
  get encryptionKey() {
    return required("APP_ENCRYPTION_KEY");
  },
  get workspacesDir() {
    const dir = process.env.WORKSPACES_DIR ?? "./workspaces";
    return path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
  },
  get maxFixIterations() {
    return Number(process.env.MAX_FIX_ITERATIONS ?? 3);
  },
  /** Local time window (hours) during which NIGHTLY-scheduled repos run. */
  nightlyWindow: { startHour: 1, endHour: 6 },
  /** Minimum minutes between cycles for a CONTINUOUS repo (cooldown). */
  continuousCooldownMinutes: 5,
};
