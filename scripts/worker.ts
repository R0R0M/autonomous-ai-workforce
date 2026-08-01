/**
 * Background worker: the beating heart of the autonomous workforce.
 *
 * Every tick it looks at all RUNNING repositories, advances any active cycle
 * run phase-by-phase, and starts new cycles when a repository's schedule says
 * one is due. Run alongside the Next.js app:  npm run worker
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { advance } from "../src/lib/orchestrator/engine";
import { logActivity } from "../src/lib/logger";
import { config } from "../src/lib/config";
import { billingEnabled, hasCredit } from "../src/lib/billing";
import type { Repository } from "@prisma/client";

const TICK_MS = 15_000;
const ACTIVE_PHASES = [
  "IDEATING",
  "AWAITING_IDEA_APPROVAL",
  "CODING",
  "TESTING",
  "FIXING",
  "SAFETY_CHECK",
  "PUSHING",
  "AWAITING_APPROVAL",
  "MERGING",
  "DEPLOYING",
  "VERIFYING",
] as const;

const busy = new Set<string>();
let shuttingDown = false;

function cycleIsDue(repo: Repository): boolean {
  const now = new Date();
  switch (repo.schedule) {
    case "MANUAL":
      return false; // cycles are started explicitly from the dashboard
    case "NIGHTLY": {
      const hour = now.getHours();
      const { startHour, endHour } = config.nightlyWindow;
      if (hour < startHour || hour >= endHour) return false;
      // At most one cycle per night.
      if (repo.lastCycleAt && now.getTime() - repo.lastCycleAt.getTime() < 12 * 60 * 60 * 1000) {
        return false;
      }
      return true;
    }
    case "CONTINUOUS": {
      if (!repo.lastCycleAt) return true;
      const cooldownMs = config.continuousCooldownMinutes * 60 * 1000;
      return now.getTime() - repo.lastCycleAt.getTime() >= cooldownMs;
    }
    default:
      return false;
  }
}

async function driveRepository(repo: Repository): Promise<void> {
  // One active run per repository at a time (avoids conflicting changes).
  let run = await db.cycleRun.findFirst({
    where: { repositoryId: repo.id, phase: { in: [...ACTIVE_PHASES] } },
    orderBy: { startedAt: "desc" },
  });

  if (!run) {
    if (!cycleIsDue(repo)) return;

    // Billing gate: no credits, no new cycles (log at most once per 30 min).
    if (billingEnabled() && !(await hasCredit(repo.userId))) {
      const recent = await db.activityLog.findFirst({
        where: {
          repositoryId: repo.id,
          message: { startsWith: "Out of credits" },
          createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
        },
      });
      if (!recent) {
        await logActivity(repo.id, "warn", "Out of credits — cycles paused until you add more");
      }
      return;
    }

    run = await db.cycleRun.create({ data: { repositoryId: repo.id, phase: "IDEATING" } });
    await logActivity(repo.id, "info", "Starting new improvement cycle", { runId: run.id });
  }

  // Advance until the run blocks (human approval) or reaches a terminal phase.
  for (;;) {
    if (shuttingDown) return;
    const result = await advance(run.id);
    if (result !== "continue") return;
  }
}

async function tick(): Promise<void> {
  const repos = await db.repository.findMany({ where: { status: "RUNNING" } });
  for (const repo of repos) {
    if (busy.has(repo.id)) continue;
    busy.add(repo.id);
    driveRepository(repo)
      .catch((err) => {
        console.error(`[worker] repo ${repo.owner}/${repo.name} errored:`, err);
      })
      .finally(() => busy.delete(repo.id));
  }
}

async function main() {
  console.log("[worker] Autonomous AI Workforce worker started");
  console.log(`[worker] model: ${config.anthropicModel}, tick: ${TICK_MS / 1000}s`);

  process.on("SIGINT", () => {
    console.log("[worker] shutting down after current phases finish...");
    shuttingDown = true;
  });
  process.on("SIGTERM", () => {
    shuttingDown = true;
  });

  for (;;) {
    if (shuttingDown && busy.size === 0) break;
    if (!shuttingDown) {
      try {
        await tick();
      } catch (err) {
        console.error("[worker] tick failed:", err);
      }
    }
    await new Promise((r) => setTimeout(r, TICK_MS));
  }
  await db.$disconnect();
  console.log("[worker] stopped");
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
