import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/logger";
import { billingEnabled, hasCredit } from "@/lib/billing";

const ControlSchema = z.object({
  action: z.enum(["start", "pause", "run-once", "approve", "reject"]),
});

const ACTIVE_PHASES = [
  "IDEATING", "CODING", "TESTING", "FIXING", "SAFETY_CHECK",
  "PUSHING", "AWAITING_APPROVAL", "MERGING", "DEPLOYING", "VERIFYING",
] as const;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  const repo = await db.repository.findUnique({ where: { id } });
  if (!repo || repo.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = ControlSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Starting work requires credits — the client turns a 402 into a billing prompt.
  if (
    (body.data.action === "start" || body.data.action === "run-once") &&
    billingEnabled() &&
    !(await hasCredit(userId))
  ) {
    return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
  }

  switch (body.data.action) {
    case "start": {
      await db.repository.update({ where: { id }, data: { status: "RUNNING" } });
      await logActivity(id, "info", "Autonomous mode started");
      break;
    }
    case "pause": {
      await db.repository.update({ where: { id }, data: { status: "PAUSED" } });
      await logActivity(id, "info", "Autonomous mode paused");
      break;
    }
    case "run-once": {
      const active = await db.cycleRun.findFirst({
        where: { repositoryId: id, phase: { in: [...ACTIVE_PHASES] } },
      });
      if (active) {
        return NextResponse.json({ error: "A cycle is already in progress" }, { status: 409 });
      }
      // The worker only drives RUNNING repos; a one-off cycle turns the repo on
      // and the MANUAL schedule prevents further automatic cycles.
      await db.repository.update({ where: { id }, data: { status: "RUNNING" } });
      await db.cycleRun.create({ data: { repositoryId: id, phase: "IDEATING" } });
      await logActivity(id, "info", "Manual cycle queued");
      break;
    }
    case "approve": {
      const waiting = await db.cycleRun.findFirst({
        where: { repositoryId: id, phase: "AWAITING_APPROVAL" },
        orderBy: { startedAt: "desc" },
      });
      if (!waiting) {
        return NextResponse.json({ error: "Nothing awaiting approval" }, { status: 409 });
      }
      await db.cycleRun.update({ where: { id: waiting.id }, data: { phase: "MERGING" } });
      await logActivity(id, "info", "Human approved — merging", { runId: waiting.id });
      break;
    }
    case "reject": {
      const waiting = await db.cycleRun.findFirst({
        where: { repositoryId: id, phase: "AWAITING_APPROVAL" },
        orderBy: { startedAt: "desc" },
      });
      if (!waiting) {
        return NextResponse.json({ error: "Nothing awaiting approval" }, { status: 409 });
      }
      await db.cycleRun.update({
        where: { id: waiting.id },
        data: { phase: "FAILED", error: "Rejected by human reviewer", finishedAt: new Date() },
      });
      if (waiting.ideaId) {
        await db.idea.update({ where: { id: waiting.ideaId }, data: { status: "REJECTED" } });
      }
      await logActivity(id, "warn", "Human rejected the change", { runId: waiting.id });
      break;
    }
  }

  return NextResponse.json({ ok: true });
}
