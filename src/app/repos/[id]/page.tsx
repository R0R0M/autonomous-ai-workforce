import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import AutoRefresh from "@/components/AutoRefresh";
import PhaseBadge from "@/components/PhaseBadge";
import ControlButtons from "@/components/ControlButtons";
import AgentFeed from "@/components/AgentFeed";
import BacklogTable from "@/components/BacklogTable";
import LiveActivityFeed from "@/components/LiveActivityFeed";
import ChangesShelf from "@/components/ChangesShelf";
import { formatTokens } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const ACTIVE_PHASES = [
  "IDEATING", "CODING", "TESTING", "FIXING", "SAFETY_CHECK",
  "PUSHING", "AWAITING_APPROVAL", "MERGING", "DEPLOYING", "VERIFYING",
] as const;

export default async function RepoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;

  const repo = await db.repository.findUnique({ where: { id } });
  if (!repo || repo.userId !== session.user.id) notFound();

  const [activeRun, ideas, messages, runs, deployments, logs, toolEvents] = await Promise.all([
    db.cycleRun.findFirst({
      where: { repositoryId: id, phase: { in: [...ACTIVE_PHASES] } },
      orderBy: { startedAt: "desc" },
      include: { idea: true },
    }),
    db.idea.findMany({
      where: { repositoryId: id },
      orderBy: [{ status: "asc" }, { priority: "desc" }],
      take: 30,
    }),
    db.agentMessage.findMany({
      where: { repositoryId: id },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    db.cycleRun.findMany({
      where: { repositoryId: id },
      orderBy: { startedAt: "desc" },
      take: 15,
      include: { idea: true, _count: { select: { bugs: true } } },
    }),
    db.deployment.findMany({
      where: { repositoryId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.activityLog.findMany({
      where: { repositoryId: id },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    db.toolEvent.findMany({
      where: { repositoryId: id },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
  ]);

  const shipped = ideas.filter((i) => i.status === "DONE").length;

  // The run the Changes shelf describes: the active one, else the most recent.
  const displayRun = activeRun ?? runs[0] ?? null;

  // All commit explanations across the repository's history (newest first),
  // plus all-time token totals.
  const [changeSummaryMsgs, tokenTotals] = await Promise.all([
    db.agentMessage.findMany({
      where: { repositoryId: id, type: "CHANGE_SUMMARY" },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { run: { include: { idea: true } } },
    }),
    db.cycleRun.aggregate({
      where: { repositoryId: id },
      _sum: { inputTokens: true, outputTokens: true },
    }),
  ]);

  // One shelf entry per commit (each coding phase commits once and explains it).
  const commits = changeSummaryMsgs.map((m) => {
    const c = m.content as {
      commitSha?: string;
      commitMessage?: string;
      overall?: string;
      changes?: { file: string; whatChanged: string; purpose: string }[];
    };
    return {
      sha: c.commitSha ?? null,
      message: c.commitMessage ?? "(commit)",
      overall: c.overall ?? "",
      files: c.changes ?? [],
      createdAt: m.createdAt,
      taskTitle: m.run.idea?.title ?? null,
      isCurrentCycle: displayRun ? m.runId === displayRun.id : false,
    };
  });

  const coderBusy = activeRun ? ["CODING", "FIXING"].includes(activeRun.phase) : false;
  const displayIdeaTitle =
    displayRun && "idea" in displayRun ? (displayRun.idea?.title ?? null) : null;
  const modelName = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

  return (
    <main className="space-y-8">
      <AutoRefresh intervalMs={5000} />

      <header className="space-y-4">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300">
          ← All repositories
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">
              {repo.owner}/{repo.name}
            </h1>
            <PhaseBadge phase={repo.status} />
          </div>
          <ControlButtons
            repoId={repo.id}
            status={repo.status}
            hasActiveRun={!!activeRun}
            awaitingApproval={activeRun?.phase === "AWAITING_APPROVAL"}
          />
        </div>
      </header>

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-8">

      {/* Current status */}
      <section className="card">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
          Current cycle
        </h2>
        {activeRun ? (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <PhaseBadge phase={activeRun.phase} />
              <span className="text-white">{activeRun.idea?.title ?? "Analyzing repository..."}</span>
            </div>
            {activeRun.branchName && (
              <span className="font-mono text-gray-400">{activeRun.branchName}</span>
            )}
            {activeRun.prNumber && <span className="text-gray-400">PR #{activeRun.prNumber}</span>}
            {activeRun.fixIteration > 0 && (
              <span className="text-orange-300">fix iteration {activeRun.fixIteration}</span>
            )}
            <span className="text-gray-500">
              started {new Date(activeRun.startedAt).toLocaleTimeString()}
            </span>
            {activeRun.inputTokens + activeRun.outputTokens > 0 && (
              <span className="text-violet-300">
                🎟 {formatTokens(activeRun.inputTokens)} in / {formatTokens(activeRun.outputTokens)} out
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            {repo.status === "RUNNING"
              ? "Waiting for the next scheduled cycle."
              : "Paused — start autonomous mode or run a single cycle."}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-xs text-gray-500">
          <span>{shipped} improvements shipped</span>
          <span>schedule: {repo.schedule.toLowerCase()}</span>
          <span>merge: {repo.mergeMode === "PULL_REQUEST" ? "pull requests" : "direct"}</span>
          <span>approval gate: {repo.requireHumanApproval ? "on" : "off"}</span>
          <span>deploy hook: {repo.deployHookUrl ? "configured" : "—"}</span>
        </div>
      </section>

      {/* Live coding activity */}
      <section className="card">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
          Live coding activity
          {activeRun && ["CODING", "TESTING", "FIXING"].includes(activeRun.phase) && (
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          )}
        </h2>
        <LiveActivityFeed events={toolEvents} />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Agent conversation */}
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Agent conversation
          </h2>
          <AgentFeed messages={messages} />
        </section>

        <div className="space-y-8">
          {/* Backlog */}
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Idea backlog
            </h2>
            <BacklogTable ideas={ideas} />
          </section>

          {/* Run history */}
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Cycle history
            </h2>
            {runs.length === 0 ? (
              <p className="text-sm text-gray-500">No cycles yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {runs.map((run) => (
                  <li key={run.id} className="flex items-center gap-3">
                    <PhaseBadge phase={run.phase} />
                    <span className="truncate text-gray-300">
                      {run.idea?.title ?? "(no idea selected)"}
                    </span>
                    {run._count.bugs > 0 && (
                      <span className="text-xs text-orange-300">{run._count.bugs} bugs</span>
                    )}
                    <span className="ml-auto whitespace-nowrap text-xs text-gray-500">
                      {new Date(run.startedAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Deployments */}
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Deployments
            </h2>
            {deployments.length === 0 ? (
              <p className="text-sm text-gray-500">No deployments yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {deployments.map((d) => (
                  <li key={d.id} className="flex items-center gap-3">
                    <PhaseBadge phase={d.status} />
                    {d.commitSha && (
                      <span className="font-mono text-gray-400">{d.commitSha.slice(0, 8)}</span>
                    )}
                    {d.error && <span className="truncate text-xs text-red-400">{d.error}</span>}
                    <span className="ml-auto whitespace-nowrap text-xs text-gray-500">
                      {new Date(d.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

        </div>

        {/* Right shelf: what changed, why, and what it cost */}
        <div className="xl:w-80 xl:shrink-0">
          <ChangesShelf
            ideaTitle={displayIdeaTitle}
            commits={commits}
            coderBusy={coderBusy}
            inputTokens={displayRun?.inputTokens ?? 0}
            outputTokens={displayRun?.outputTokens ?? 0}
            totalInputTokens={tokenTotals._sum.inputTokens ?? 0}
            totalOutputTokens={tokenTotals._sum.outputTokens ?? 0}
            modelName={modelName}
            logs={logs}
          />
        </div>
      </div>
    </main>
  );
}
