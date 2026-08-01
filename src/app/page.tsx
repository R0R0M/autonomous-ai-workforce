import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import AddRepoForm from "@/components/AddRepoForm";
import PhaseBadge from "@/components/PhaseBadge";
import AutoRefresh from "@/components/AutoRefresh";
import AppHeader from "@/components/AppHeader";
import Landing from "@/components/Landing";
import BillingPanel from "@/components/BillingPanel";
import { billingEnabled, getBalanceUsd, CREDIT_PACKS_USD } from "@/lib/billing";

export const dynamic = "force-dynamic";

const ACTIVE_PHASES = [
  "IDEATING", "AWAITING_IDEA_APPROVAL", "CODING", "TESTING", "FIXING", "SAFETY_CHECK",
  "PUSHING", "AWAITING_APPROVAL", "MERGING", "DEPLOYING", "VERIFYING",
] as const;

const STATUS_ACCENT: Record<string, string> = {
  RUNNING: "from-emerald-500/70 to-sky-500/70",
  PAUSED: "from-gray-600/60 to-gray-700/60",
  IDLE: "from-gray-600/60 to-gray-700/60",
  ERROR: "from-red-500/70 to-orange-500/70",
};

export default async function HomePage() {
  const session = await auth();
  // Logged-out visitors get the marketing landing page.
  if (!session?.user?.id) return <Landing />;
  const userId = session.user.id;

  const balanceUsd = await getBalanceUsd(userId);
  const [repos, shippedCount, completedCycles, activeCycles] = await Promise.all([
    db.repository.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        runs: {
          where: { phase: { in: [...ACTIVE_PHASES] } },
          orderBy: { startedAt: "desc" },
          take: 1,
          include: { idea: true },
        },
        _count: { select: { ideas: { where: { status: "DONE" } } } },
      },
    }),
    db.idea.count({ where: { status: "DONE", repository: { userId } } }),
    db.cycleRun.count({ where: { phase: "COMPLETED", repository: { userId } } }),
    db.cycleRun.count({
      where: { phase: { in: [...ACTIVE_PHASES] }, repository: { userId } },
    }),
  ]);

  const stats = [
    { label: "Repositories", value: repos.length, color: "from-fuchsia-300 to-purple-300" },
    { label: "Improvements shipped", value: shippedCount, color: "from-emerald-300 to-teal-300" },
    { label: "Cycles completed", value: completedCycles, color: "from-sky-300 to-indigo-300" },
    { label: "Working right now", value: activeCycles, color: "from-amber-300 to-orange-300" },
  ];

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <AutoRefresh intervalMs={8000} />
      <AppHeader user={session.user} />

      {/* Stats */}
      <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card py-4 text-center">
            <p className={`bg-gradient-to-r ${s.color} bg-clip-text text-3xl font-extrabold text-transparent`}>
              {s.value}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">{s.label}</p>
          </div>
        ))}
      </section>

      <div className="mb-8">
        <BillingPanel
          balanceUsd={balanceUsd}
          enabled={billingEnabled()}
          packs={[...CREDIT_PACKS_USD]}
        />
      </div>

      <div className="mb-8">
        <AddRepoForm />
      </div>

      {repos.length === 0 ? (
        <div className="card border-fuchsia-500/20 bg-gradient-to-br from-surface-raised to-fuchsia-950/30 py-14 text-center">
          <p className="text-xl font-semibold text-white">Your AI team is ready to work.</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
            Connect a GitHub repository above and the Ideator, Coder, and Tester start improving
            it within minutes — tested pull requests, delivered around the clock.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {repos.map((repo) => {
            const activeRun = repo.runs[0];
            return (
              <Link
                key={repo.id}
                href={`/repos/${repo.id}`}
                className="card group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:border-fuchsia-700/50"
              >
                <span
                  className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${STATUS_ACCENT[repo.status] ?? STATUS_ACCENT.IDLE}`}
                />
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-white">
                    <span className="text-gray-500">{repo.owner}/</span>
                    {repo.name}
                  </h2>
                  <PhaseBadge phase={repo.status} />
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  {activeRun ? (
                    <p className="flex items-center gap-2">
                      <PhaseBadge phase={activeRun.phase} />
                      <span className="truncate text-gray-300">
                        {activeRun.idea?.title ?? "Analyzing repository..."}
                      </span>
                    </p>
                  ) : (
                    <p className="text-gray-500">No cycle in progress</p>
                  )}
                  <p className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="text-emerald-400/90">
                      ✓ {repo._count.ideas} shipped
                    </span>
                    <span>{repo.schedule.toLowerCase()} schedule</span>
                    <span className="ml-auto text-gray-600 transition-colors group-hover:text-fuchsia-400">
                      open →
                    </span>
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
