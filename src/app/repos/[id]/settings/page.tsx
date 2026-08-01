import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import AppHeader from "@/components/AppHeader";
import PhaseBadge from "@/components/PhaseBadge";
import RepoSettingsForm from "@/components/RepoSettingsForm";
import { AVAILABLE_MODELS } from "@/lib/models";
import { estimateCostUsd, formatTokens } from "@/lib/pricing";

export const dynamic = "force-dynamic";

function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}

export default async function RepoSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;

  const repo = await db.repository.findUnique({ where: { id } });
  if (!repo || repo.userId !== session.user.id) notFound();

  const [tokenAgg, completed, failed, shipped, bugsTotal, bugsFixed, prsOpened, recentRuns, doneRuns] =
    await Promise.all([
      db.cycleRun.aggregate({
        where: { repositoryId: id },
        _sum: { inputTokens: true, outputTokens: true },
        _count: true,
      }),
      db.cycleRun.count({ where: { repositoryId: id, phase: "COMPLETED" } }),
      db.cycleRun.count({ where: { repositoryId: id, phase: { in: ["FAILED", "ROLLED_BACK"] } } }),
      db.idea.count({ where: { repositoryId: id, status: "DONE" } }),
      db.bugReport.count({ where: { run: { repositoryId: id } } }),
      db.bugReport.count({ where: { run: { repositoryId: id }, status: "FIXED" } }),
      db.cycleRun.count({ where: { repositoryId: id, prNumber: { not: null } } }),
      db.cycleRun.findMany({
        where: { repositoryId: id },
        orderBy: { startedAt: "desc" },
        take: 10,
        include: { idea: true },
      }),
      db.cycleRun.findMany({
        where: { repositoryId: id, phase: "COMPLETED", finishedAt: { not: null } },
        select: { startedAt: true, finishedAt: true },
        take: 50,
        orderBy: { startedAt: "desc" },
      }),
    ]);

  const totalIn = tokenAgg._sum.inputTokens ?? 0;
  const totalOut = tokenAgg._sum.outputTokens ?? 0;
  const totalCost = estimateCostUsd(repo.model, totalIn, totalOut);
  const finished = completed + failed;
  const successRate = finished > 0 ? Math.round((completed / finished) * 100) : null;
  const avgMinutes =
    doneRuns.length > 0
      ? Math.round(
          doneRuns.reduce((acc, r) => acc + minutesBetween(r.startedAt, r.finishedAt!), 0) /
            doneRuns.length,
        )
      : null;

  const tiles = [
    { label: "Improvements shipped", value: String(shipped), color: "from-emerald-300 to-teal-300" },
    {
      label: "Success rate",
      value: successRate === null ? "—" : `${successRate}%`,
      color: "from-sky-300 to-indigo-300",
    },
    {
      label: "Avg cycle time",
      value: avgMinutes === null ? "—" : `${avgMinutes} min`,
      color: "from-fuchsia-300 to-purple-300",
    },
    { label: "Pull requests opened", value: String(prsOpened), color: "from-violet-300 to-fuchsia-300" },
    { label: "Bugs caught by Tester", value: String(bugsTotal), color: "from-amber-300 to-orange-300" },
    { label: "Bugs fixed", value: String(bugsFixed), color: "from-emerald-300 to-teal-300" },
    {
      label: "Tokens used",
      value: `${formatTokens(totalIn)} / ${formatTokens(totalOut)}`,
      color: "from-violet-300 to-sky-300",
    },
    { label: "Estimated spend", value: `$${totalCost.toFixed(2)}`, color: "from-emerald-300 to-sky-300" },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <AppHeader user={session.user} />

      <div className="mb-6 space-y-3">
        <Link
          href={`/repos/${repo.id}`}
          className="text-sm text-gray-500 transition-colors hover:text-fuchsia-300"
        >
          ← Back to {repo.owner}/{repo.name}
        </Link>
        <h1 className="text-2xl font-bold text-white">
          <span className="text-gray-500">{repo.owner}/</span>
          {repo.name} <span className="text-gray-500">settings</span>
        </h1>
      </div>

      {/* Analytics */}
      <section className="card mb-6">
        <h2 className="section-heading">
          <span className="section-dot bg-sky-400" />
          Analytics
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-lg border border-surface-border/60 bg-surface p-3 text-center">
              <p className={`bg-gradient-to-r ${t.color} bg-clip-text text-xl font-extrabold text-transparent`}>
                {t.value}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-gray-500">{t.label}</p>
            </div>
          ))}
        </div>

        <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Recent cycles
        </h3>
        {recentRuns.length === 0 ? (
          <p className="text-sm text-gray-500">No cycles yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-4">Idea</th>
                  <th className="py-2 pr-4">Result</th>
                  <th className="py-2 pr-4">Tokens</th>
                  <th className="py-2 pr-4">Cost</th>
                  <th className="py-2 pr-4">Duration</th>
                  <th className="py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id} className="border-b border-surface-border/50">
                    <td className="max-w-64 truncate py-2 pr-4 text-gray-300">
                      {run.idea?.title ?? "(analysis)"}
                    </td>
                    <td className="py-2 pr-4">
                      <PhaseBadge phase={run.phase} />
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 font-mono text-gray-400">
                      {formatTokens(run.inputTokens)} / {formatTokens(run.outputTokens)}
                    </td>
                    <td className="py-2 pr-4 font-mono text-gray-400">
                      ${estimateCostUsd(repo.model, run.inputTokens, run.outputTokens).toFixed(3)}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 text-gray-400">
                      {run.finishedAt ? `${minutesBetween(run.startedAt, run.finishedAt)} min` : "—"}
                    </td>
                    <td className="whitespace-nowrap py-2 text-gray-500">
                      {new Date(run.startedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Settings */}
      <section className="card">
        <h2 className="section-heading">
          <span className="section-dot bg-fuchsia-400" />
          Project settings
        </h2>
        <RepoSettingsForm
          repo={{
            id: repo.id,
            schedule: repo.schedule,
            mergeMode: repo.mergeMode,
            autoMergePr: repo.autoMergePr,
            requireHumanApproval: repo.requireHumanApproval,
            requireIdeaApproval: repo.requireIdeaApproval,
            model: repo.model,
            deployHookUrl: repo.deployHookUrl,
            healthCheckUrl: repo.healthCheckUrl,
          }}
          models={[...AVAILABLE_MODELS]}
        />
      </section>
    </main>
  );
}
