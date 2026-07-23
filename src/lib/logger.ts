import { db } from "./db";

type Level = "info" | "warn" | "error";

export async function logActivity(
  repositoryId: string,
  level: Level,
  message: string,
  opts?: { runId?: string; meta?: Record<string, unknown> },
) {
  console.log(`[${level}] [repo:${repositoryId}] ${message}`);
  try {
    await db.activityLog.create({
      data: {
        repositoryId,
        runId: opts?.runId,
        level,
        message,
        meta: opts?.meta as object | undefined,
      },
    });
  } catch (err) {
    // Logging must never take down the orchestrator.
    console.error("Failed to persist activity log:", err);
  }
}
