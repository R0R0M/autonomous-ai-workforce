import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import type { AgentName, CycleRun, Idea, Prisma, Repository } from "@prisma/client";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { logActivity } from "@/lib/logger";
import { config } from "@/lib/config";
import { computePriority, clampScore, type Scores } from "@/lib/scoring";
import {
  ensureWorkspace,
  workspacePath,
  createBranch,
  checkoutBranch,
  commitAll,
  push,
  diffAgainst,
  diffOfCommit,
  diffStatOfCommit,
  changedFiles,
  revertMergeOnDefault,
  type RepoRef,
} from "@/lib/github/git";
import { createPullRequest, mergePullRequest, mergeBranch, createIssue } from "@/lib/github/api";
import { buildRepoSnapshot, runIdeator } from "@/lib/agents/ideator";
import { runCoder } from "@/lib/agents/coder";
import { runTester } from "@/lib/agents/tester";
import { addMemory, getMemories, formatMemories } from "@/lib/agents/memory";
import { summarizeChanges } from "@/lib/agents/summarizer";
import type { TokenUsage } from "@/lib/agents/client";
import { formatTaskBrief, type TaskBrief } from "@/lib/agents/schemas";

export type AdvanceResult = "continue" | "blocked" | "done";

type RunWithRelations = CycleRun & { repository: Repository; idea: Idea | null };

function repoRef(repo: Repository): RepoRef {
  return { id: repo.id, owner: repo.owner, name: repo.name, defaultBranch: repo.defaultBranch };
}

function token(repo: Repository): string {
  return decrypt(repo.githubTokenEnc);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function briefFromIdea(idea: Idea): TaskBrief {
  return {
    title: idea.title,
    description: idea.description,
    reasoning: idea.reasoning,
    expectedOutcome: idea.expectedOutcome,
    acceptanceCriteria: idea.acceptanceCriteria as string[],
    filesLikelyAffected: idea.filesLikelyAffected as string[],
    dependencies: idea.dependencies as string[],
    risks: idea.risks as string[],
    successMetrics: idea.successMetrics as string[],
  };
}

async function say(
  run: RunWithRelations,
  fromAgent: AgentName,
  toAgent: AgentName,
  type: string,
  content: Record<string, unknown>,
) {
  await db.agentMessage.create({
    data: {
      runId: run.id,
      repositoryId: run.repositoryId,
      fromAgent,
      toAgent,
      type,
      content: content as Prisma.InputJsonValue,
    },
  });
}

const execFileAsync = promisify(execFile);

import { billingEnabled, chargeUsage } from "@/lib/billing";
import { estimateCostUsd } from "@/lib/pricing";

/**
 * Kill anything an agent left running in the workspace (dev servers, watchers).
 * Matches processes whose command line references the workspace directory.
 */
async function killWorkspaceProcesses(repoId: string) {
  const dir = workspacePath(repoId);
  await execFileAsync("pkill", ["-f", dir]).catch(() => undefined); // no matches → non-zero exit, fine
}

async function addRunTokens(run: RunWithRelations, usage: TokenUsage) {
  await db.cycleRun.update({
    where: { id: run.id },
    data: {
      inputTokens: { increment: usage.input },
      outputTokens: { increment: usage.output },
    },
  });
  // Meter the usage against the owner's credit balance — at cost, no markup.
  if (billingEnabled()) {
    const costUsd = estimateCostUsd(run.repository.model, usage.input, usage.output);
    await chargeUsage(
      run.repository.userId,
      costUsd,
      `Agent usage — ${run.idea?.title ?? "repository analysis"} (${run.phase})`,
      run.id,
    ).catch((err) => console.error("Failed to meter usage:", err));
  }
}

/**
 * Explain one commit for the dashboard's Changes shelf (one summary per commit).
 * Best-effort — a summarizer failure never fails the cycle.
 */
async function recordChangeSummary(
  run: RunWithRelations,
  dir: string,
  coderReport: string,
  commit: { sha: string; message: string },
) {
  try {
    const idea = run.idea!;
    const [diff, diffStat] = await Promise.all([
      diffOfCommit(dir, commit.sha),
      diffStatOfCommit(dir, commit.sha),
    ]);
    const { summary, usage } = await summarizeChanges({
      model: run.repository.model,
      taskTitle: idea.title,
      taskDescription: idea.description,
      coderReport,
      diffStat,
      diff,
    });
    await say(run, "CODER", "SYSTEM", "CHANGE_SUMMARY", {
      commitSha: commit.sha,
      commitMessage: commit.message,
      ...summary,
    } as unknown as Record<string, unknown>);
    await addRunTokens(run, usage);
  } catch (err) {
    await logActivity(run.repositoryId, "warn", "Change summary failed (non-fatal)", {
      runId: run.id,
      meta: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}

/** Persist every tool action an agent takes so the dashboard can show it live. */
function toolEventRecorder(run: RunWithRelations, agent: AgentName) {
  return async (event: { tool: string; summary: string; detail?: string }) => {
    try {
      await db.toolEvent.create({
        data: {
          runId: run.id,
          repositoryId: run.repositoryId,
          agent,
          tool: event.tool,
          summary: event.summary.slice(0, 300),
          detail: event.detail?.slice(0, 12_000) ?? null,
        },
      });
    } catch (err) {
      console.error("Failed to record tool event:", err);
    }
  };
}

async function setPhase(runId: string, phase: CycleRun["phase"], extra?: Partial<CycleRun>) {
  await db.cycleRun.update({
    where: { id: runId },
    data: { phase, ...(extra as object) },
  });
}

async function failRun(run: RunWithRelations, reason: string) {
  await db.cycleRun.update({
    where: { id: run.id },
    data: { phase: "FAILED", error: reason.slice(0, 2000), finishedAt: new Date() },
  });
  if (run.ideaId) {
    await db.idea.update({ where: { id: run.ideaId }, data: { status: "FAILED" } });
    await addMemory(
      run.repositoryId,
      "SYSTEM",
      "FAILED_IDEA",
      `"${run.idea?.title ?? run.ideaId}" failed: ${reason.slice(0, 500)}`,
    );
  }
  await logActivity(run.repositoryId, "error", `Run failed: ${reason}`, { runId: run.id });
}

async function completeRun(run: RunWithRelations, note: string) {
  await db.cycleRun.update({
    where: { id: run.id },
    data: { phase: "COMPLETED", finishedAt: new Date() },
  });
  if (run.ideaId) {
    await db.idea.update({ where: { id: run.ideaId }, data: { status: "DONE" } });
    await addMemory(
      run.repositoryId,
      "SYSTEM",
      "SUCCESS",
      `Shipped "${run.idea?.title}". ${note}`.slice(0, 500),
    );
  }
  await db.repository.update({
    where: { id: run.repositoryId },
    data: { lastCycleAt: new Date() },
  });
  await logActivity(run.repositoryId, "info", `Cycle completed: ${note}`, { runId: run.id });
}

/** Make sure the workspace exists and is on the run's branch (create it if new). */
async function ensureOnBranch(run: RunWithRelations): Promise<string> {
  const repo = run.repository;
  const branch = run.branchName!;
  const dir = workspacePath(repo.id);

  if (!fs.existsSync(path.join(dir, ".git"))) {
    await ensureWorkspace(repoRef(repo), token(repo));
  }
  try {
    await checkoutBranch(dir, branch);
  } catch {
    await ensureWorkspace(repoRef(repo), token(repo));
    await createBranch(dir, branch);
  }
  return dir;
}

async function latestMessage(runId: string, type: string) {
  return db.agentMessage.findFirst({
    where: { runId, type },
    orderBy: { createdAt: "desc" },
  });
}

function formatBugsForCoder(
  bugs: { severity: string; title: string; description: string; stepsToReproduce: string; expectedBehavior: string; actualBehavior: string; logs: string | null; suggestedFixes: string }[],
): string {
  return bugs
    .map(
      (b, i) =>
        `## Bug ${i + 1} [${b.severity}] ${b.title}\n` +
        `${b.description}\n\n` +
        `Steps to reproduce: ${b.stepsToReproduce}\n` +
        `Expected: ${b.expectedBehavior}\n` +
        `Actual: ${b.actualBehavior}\n` +
        (b.logs ? `Logs:\n${b.logs}\n` : "") +
        `Suggested fix: ${b.suggestedFixes}`,
    )
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Phase handlers
// ---------------------------------------------------------------------------

async function phaseIdeating(run: RunWithRelations): Promise<AdvanceResult> {
  const repo = run.repository;
  await logActivity(repo.id, "info", "Ideator: analyzing repository", { runId: run.id });

  const dir = await ensureWorkspace(repoRef(repo), token(repo));
  const snapshot = await buildRepoSnapshot(dir);

  const [memories, failed, done, backlog] = await Promise.all([
    getMemories(repo.id, { limit: 30 }),
    db.idea.findMany({ where: { repositoryId: repo.id, status: { in: ["FAILED", "REJECTED"] } } }),
    db.idea.findMany({ where: { repositoryId: repo.id, status: "DONE" } }),
    db.idea.findMany({ where: { repositoryId: repo.id, status: "BACKLOG" } }),
  ]);

  const { batch, usage: ideatorUsage } = await runIdeator({
    model: repo.model,
    snapshot,
    memory: formatMemories(memories),
    failedIdeas: failed.map((i) => i.title),
    completedIdeas: done.map((i) => i.title),
    backlogTitles: backlog.map((i) => i.title),
  });
  await addRunTokens(run, ideatorUsage);

  await say(run, "IDEATOR", "SYSTEM", "ANALYSIS", { summary: batch.analysisSummary });

  for (const idea of batch.ideas) {
    const scores = Object.fromEntries(
      Object.entries(idea.scores).map(([k, v]) => [k, clampScore(v as number)]),
    ) as unknown as Scores;
    await db.idea.create({
      data: {
        repositoryId: repo.id,
        title: idea.title,
        description: idea.description,
        reasoning: idea.reasoning,
        expectedOutcome: idea.expectedOutcome,
        acceptanceCriteria: idea.acceptanceCriteria,
        filesLikelyAffected: idea.filesLikelyAffected,
        dependencies: idea.dependencies,
        risks: idea.risks,
        successMetrics: idea.successMetrics,
        scores: scores as object,
        priority: computePriority(scores),
      },
    });
  }

  const top = await db.idea.findFirst({
    where: { repositoryId: repo.id, status: "BACKLOG" },
    orderBy: { priority: "desc" },
  });
  if (!top) {
    await failRun(run, "Ideator produced no actionable ideas");
    return "done";
  }

  await db.idea.update({ where: { id: top.id }, data: { status: "ACTIVE" } });
  const branchName = `ai/${slugify(top.title)}-${run.id.slice(-6)}`;

  await say(run, "IDEATOR", "CODER", "TASK_BRIEF", { ideaId: top.id, ...briefFromIdea(top) });
  await logActivity(repo.id, "info", `Ideator selected: "${top.title}" (priority ${top.priority})`, {
    runId: run.id,
  });

  if (repo.requireIdeaApproval) {
    await setPhase(run.id, "AWAITING_IDEA_APPROVAL", { ideaId: top.id, branchName });
    await logActivity(repo.id, "info", "Awaiting your approval of the selected idea", {
      runId: run.id,
    });
    return "blocked";
  }
  await setPhase(run.id, "CODING", { ideaId: top.id, branchName });
  return "continue";
}

async function phaseCoding(run: RunWithRelations): Promise<AdvanceResult> {
  const repo = run.repository;
  const idea = run.idea!;
  await logActivity(repo.id, "info", `Coder: implementing "${idea.title}"`, { runId: run.id });

  const dir = await ensureOnBranch(run);
  const { report, usage } = await runCoder({
    model: repo.model,
    workspaceDir: dir,
    taskBrief: formatTaskBrief(briefFromIdea(idea)),
    mode: "implement",
    onToolEvent: toolEventRecorder(run, "CODER"),
  });
  await addRunTokens(run, usage);

  const sha = await commitAll(dir, `feat: ${idea.title}\n\nImplemented by the Coder agent.`);
  if (!sha) {
    await failRun(run, "Coder finished without making any changes");
    return "done";
  }

  await say(run, "CODER", "TESTER", "IMPLEMENTATION_REPORT", { report, commitSha: sha });
  await recordChangeSummary(run, dir, report, { sha, message: `feat: ${idea.title}` });
  await killWorkspaceProcesses(repo.id);
  await setPhase(run.id, "TESTING");
  return "continue";
}

async function phaseTesting(run: RunWithRelations): Promise<AdvanceResult> {
  const repo = run.repository;
  const idea = run.idea!;
  await logActivity(repo.id, "info", `Tester: verifying "${idea.title}"`, { runId: run.id });

  const dir = await ensureOnBranch(run);
  const implMsg = await latestMessage(run.id, "IMPLEMENTATION_REPORT");
  const files = await changedFiles(dir, repo.defaultBranch);

  const { verdict, usage } = await runTester({
    model: repo.model,
    workspaceDir: dir,
    taskBrief: formatTaskBrief(briefFromIdea(idea)),
    implementationReport:
      ((implMsg?.content as Record<string, unknown>)?.report as string) ?? "(no report found)",
    changedFiles: files,
    onToolEvent: toolEventRecorder(run, "TESTER"),
  });
  await addRunTokens(run, usage);

  await say(run, "TESTER", "CODER", "VERDICT", verdict as unknown as Record<string, unknown>);
  await killWorkspaceProcesses(repo.id);

  if (verdict.approved) {
    await db.bugReport.updateMany({
      where: { runId: run.id, status: "OPEN" },
      data: { status: "FIXED" },
    });
    await logActivity(repo.id, "info", `Tester approved: ${verdict.summary}`, { runId: run.id });
    await setPhase(run.id, "SAFETY_CHECK");
    return "continue";
  }

  for (const bug of verdict.bugs) {
    await db.bugReport.create({
      data: {
        runId: run.id,
        severity: bug.severity,
        title: bug.title,
        description: bug.description,
        stepsToReproduce: bug.stepsToReproduce,
        expectedBehavior: bug.expectedBehavior,
        actualBehavior: bug.actualBehavior,
        logs: bug.logs || null,
        likelyFiles: bug.likelyFiles,
        suggestedFixes: bug.suggestedFixes,
      },
    });
    await addMemory(repo.id, "TESTER", "BUG", `[${bug.severity}] ${bug.title}: ${bug.description}`.slice(0, 500));
  }

  const nextIteration = run.fixIteration + 1;
  if (nextIteration > config.maxFixIterations) {
    await failRun(
      run,
      `Tester rejected after ${config.maxFixIterations} fix iterations: ${verdict.summary}`,
    );
    return "done";
  }

  await logActivity(
    repo.id,
    "warn",
    `Tester rejected (${verdict.bugs.length} bugs) — fix iteration ${nextIteration}`,
    { runId: run.id },
  );
  await setPhase(run.id, "FIXING", { fixIteration: nextIteration });
  return "continue";
}

async function phaseFixing(run: RunWithRelations): Promise<AdvanceResult> {
  const repo = run.repository;
  const idea = run.idea!;
  await logActivity(repo.id, "info", `Coder: fixing bugs (iteration ${run.fixIteration})`, {
    runId: run.id,
  });

  const dir = await ensureOnBranch(run);
  const openBugs = await db.bugReport.findMany({ where: { runId: run.id, status: "OPEN" } });

  const { report, usage } = await runCoder({
    model: repo.model,
    workspaceDir: dir,
    taskBrief: formatTaskBrief(briefFromIdea(idea)),
    mode: "fix",
    bugReports: formatBugsForCoder(openBugs),
    onToolEvent: toolEventRecorder(run, "CODER"),
  });
  await addRunTokens(run, usage);

  const fixMessage = `fix: address tester feedback (iteration ${run.fixIteration})`;
  const fixSha = await commitAll(dir, fixMessage);
  await say(run, "CODER", "TESTER", "IMPLEMENTATION_REPORT", { report, fixIteration: run.fixIteration });
  if (fixSha) {
    await recordChangeSummary(run, dir, report, { sha: fixSha, message: fixMessage });
  }
  await killWorkspaceProcesses(repo.id);
  await setPhase(run.id, "TESTING");
  return "continue";
}

async function phaseSafetyCheck(run: RunWithRelations): Promise<AdvanceResult> {
  const repo = run.repository;
  const dir = await ensureOnBranch(run);

  const { scanDiffForSecrets } = await import("./safety");
  const diff = await diffAgainst(dir, repo.defaultBranch);
  const findings = scanDiffForSecrets(diff);

  if (findings.length > 0) {
    const detail = findings.map((f) => f.rule).join(", ");
    await failRun(run, `Safety check blocked the push — potential secrets in diff: ${detail}`);
    return "done";
  }

  await logActivity(repo.id, "info", "Safety check passed — no secrets in diff", { runId: run.id });
  await setPhase(run.id, "PUSHING");
  return "continue";
}

async function phasePushing(run: RunWithRelations): Promise<AdvanceResult> {
  const repo = run.repository;
  const idea = run.idea!;
  const dir = await ensureOnBranch(run);

  await push(dir, run.branchName!, repoRef(repo), token(repo));
  await logActivity(repo.id, "info", `Pushed branch ${run.branchName}`, { runId: run.id });

  let prNumber = run.prNumber;
  if (repo.mergeMode === "PULL_REQUEST" && !prNumber) {
    const verdictMsg = await latestMessage(run.id, "VERDICT");
    const verdictSummary =
      ((verdictMsg?.content as Record<string, unknown>)?.summary as string) ?? "";
    const pr = await createPullRequest(token(repo), {
      owner: repo.owner,
      repo: repo.name,
      head: run.branchName!,
      base: repo.defaultBranch,
      title: `[AI] ${idea.title}`,
      body:
        `${formatTaskBrief(briefFromIdea(idea))}\n\n---\n\n` +
        `**Tester verdict:** approved\n\n${verdictSummary}\n\n` +
        `_Opened automatically by the Autonomous AI Workforce._`,
    });
    prNumber = pr.number;
    await db.cycleRun.update({ where: { id: run.id }, data: { prNumber } });
    await logActivity(repo.id, "info", `Opened PR #${prNumber}: ${pr.url}`, { runId: run.id });
  }

  await setPhase(run.id, repo.requireHumanApproval ? "AWAITING_APPROVAL" : "MERGING");
  if (repo.requireHumanApproval) {
    await logActivity(repo.id, "info", "Awaiting human approval", { runId: run.id });
  }
  return "continue";
}

async function phaseMerging(run: RunWithRelations): Promise<AdvanceResult> {
  const repo = run.repository;
  const idea = run.idea!;

  let mergeSha: string | null = null;

  if (repo.mergeMode === "PULL_REQUEST") {
    if (!repo.autoMergePr && !repo.requireHumanApproval) {
      // PR stays open for a human to merge on GitHub; the cycle is done.
      await completeRun(run, `PR #${run.prNumber} opened and left for manual merge.`);
      return "done";
    }
    const result = await mergePullRequest(token(repo), {
      owner: repo.owner,
      repo: repo.name,
      pullNumber: run.prNumber!,
    });
    if (!result.merged) {
      await failRun(run, `GitHub refused to merge PR #${run.prNumber}`);
      return "done";
    }
    mergeSha = result.sha;
  } else {
    const result = await mergeBranch(token(repo), {
      owner: repo.owner,
      repo: repo.name,
      base: repo.defaultBranch,
      head: run.branchName!,
      message: `merge: ${idea.title} (autonomous workforce)`,
    });
    mergeSha = result.sha;
  }

  await db.cycleRun.update({ where: { id: run.id }, data: { mergeCommitSha: mergeSha } });
  await logActivity(repo.id, "info", `Merged into ${repo.defaultBranch} (${mergeSha?.slice(0, 8)})`, {
    runId: run.id,
  });

  if (repo.deployHookUrl) {
    await setPhase(run.id, "DEPLOYING");
    return "continue";
  }
  await completeRun(run, "Merged. No deploy hook configured — relying on the repo's own CI/CD.");
  return "done";
}

async function phaseDeploying(run: RunWithRelations): Promise<AdvanceResult> {
  const repo = run.repository;
  const { triggerDeployHook } = await import("./deploy");

  await db.deployment.create({
    data: {
      runId: run.id,
      repositoryId: repo.id,
      status: "TRIGGERED",
      commitSha: run.mergeCommitSha,
    },
  });
  await triggerDeployHook(repo.deployHookUrl!);
  await logActivity(repo.id, "info", "Deploy hook triggered", { runId: run.id });
  await setPhase(run.id, "VERIFYING");
  return "continue";
}

async function phaseVerifying(run: RunWithRelations): Promise<AdvanceResult> {
  const repo = run.repository;
  const { verifyHealth } = await import("./deploy");

  const deployment = await db.deployment.findFirst({
    where: { runId: run.id },
    orderBy: { createdAt: "desc" },
  });

  if (!repo.healthCheckUrl) {
    if (deployment) {
      await db.deployment.update({
        where: { id: deployment.id },
        data: { status: "SUCCEEDED", finishedAt: new Date() },
      });
    }
    await completeRun(run, "Deployed (no health check configured).");
    return "done";
  }

  if (deployment) {
    await db.deployment.update({ where: { id: deployment.id }, data: { status: "VERIFYING" } });
  }
  const health = await verifyHealth(repo.healthCheckUrl);

  if (health.healthy) {
    if (deployment) {
      await db.deployment.update({
        where: { id: deployment.id },
        data: { status: "SUCCEEDED", finishedAt: new Date() },
      });
    }
    await completeRun(run, `Deployed and verified healthy (${health.detail}).`);
    return "done";
  }

  // Unhealthy production — roll back.
  await logActivity(repo.id, "error", `Health check failed: ${health.detail} — rolling back`, {
    runId: run.id,
  });

  let rollbackNote = "rollback skipped (no merge commit recorded)";
  if (run.mergeCommitSha) {
    try {
      const revertSha = await revertMergeOnDefault(repoRef(repo), token(repo), run.mergeCommitSha);
      rollbackNote = `reverted in ${revertSha.slice(0, 8)}`;
      if (repo.deployHookUrl) {
        const { triggerDeployHook } = await import("./deploy");
        await triggerDeployHook(repo.deployHookUrl).catch(() => undefined);
      }
    } catch (err) {
      rollbackNote = `rollback FAILED: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  if (deployment) {
    await db.deployment.update({
      where: { id: deployment.id },
      data: { status: "ROLLED_BACK", error: health.detail, finishedAt: new Date() },
    });
  }

  try {
    await createIssue(token(repo), {
      owner: repo.owner,
      repo: repo.name,
      title: `[AI Workforce] Deployment rolled back: ${run.idea?.title ?? run.id}`,
      body:
        `The deployment for "${run.idea?.title}" failed its production health check and was rolled back.\n\n` +
        `- Health check: ${health.detail}\n- Merge commit: ${run.mergeCommitSha}\n- ${rollbackNote}\n`,
      labels: ["ai-workforce", "rollback"],
    });
  } catch {
    // Issue creation is best-effort.
  }

  await db.cycleRun.update({
    where: { id: run.id },
    data: { phase: "ROLLED_BACK", error: health.detail, finishedAt: new Date() },
  });
  if (run.ideaId) {
    await db.idea.update({ where: { id: run.ideaId }, data: { status: "FAILED" } });
  }
  await addMemory(
    repo.id,
    "SYSTEM",
    "DEPLOYMENT",
    `Deployment of "${run.idea?.title}" failed health check and was rolled back (${health.detail})`.slice(0, 500),
  );
  return "done";
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const TERMINAL_PHASES = new Set(["COMPLETED", "FAILED", "ROLLED_BACK"]);

/**
 * Advance a cycle run by exactly one phase transition.
 * Safe to call repeatedly; each transition is persisted before returning.
 */
export async function advance(runId: string): Promise<AdvanceResult> {
  const run = await db.cycleRun.findUnique({
    where: { id: runId },
    include: { repository: true, idea: true },
  });
  if (!run) return "done";
  if (TERMINAL_PHASES.has(run.phase)) return "done";

  try {
    switch (run.phase) {
      case "IDEATING":
        return await phaseIdeating(run);
      case "CODING":
        return await phaseCoding(run);
      case "TESTING":
        return await phaseTesting(run);
      case "FIXING":
        return await phaseFixing(run);
      case "SAFETY_CHECK":
        return await phaseSafetyCheck(run);
      case "PUSHING":
        return await phasePushing(run);
      case "AWAITING_IDEA_APPROVAL":
      case "AWAITING_APPROVAL":
        return "blocked";
      case "MERGING":
        return await phaseMerging(run);
      case "DEPLOYING":
        return await phaseDeploying(run);
      case "VERIFYING":
        return await phaseVerifying(run);
      default:
        return "done";
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failRun(run, `Unhandled error in phase ${run.phase}: ${message}`);
    return "done";
  }
}
