import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import AddRepoForm from "@/components/AddRepoForm";
import PhaseBadge from "@/components/PhaseBadge";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

const ACTIVE_PHASES = [
  "IDEATING", "CODING", "TESTING", "FIXING", "SAFETY_CHECK",
  "PUSHING", "AWAITING_APPROVAL", "MERGING", "DEPLOYING", "VERIFYING",
] as const;

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const repos = await db.repository.findMany({
    where: { userId: session.user.id },
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
  });

  return (
    <main className="space-y-8">
      <AutoRefresh intervalMs={8000} />
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Autonomous AI Workforce</h1>
          <p className="text-sm text-gray-400">
            Signed in as {session.user.name ?? session.user.email}
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button className="btn-secondary" type="submit">
            Sign out
          </button>
        </form>
      </header>

      <AddRepoForm />

      {repos.length === 0 ? (
        <div className="card text-center text-gray-400">
          <p className="text-lg">No repositories connected yet.</p>
          <p className="mt-1 text-sm">
            Connect a GitHub repository and your AI team starts working immediately.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {repos.map((repo) => {
            const activeRun = repo.runs[0];
            return (
              <Link key={repo.id} href={`/repos/${repo.id}`} className="card block transition-colors hover:border-emerald-700">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-white">
                    {repo.owner}/{repo.name}
                  </h2>
                  <PhaseBadge phase={repo.status} />
                </div>
                <div className="mt-3 space-y-1 text-sm text-gray-400">
                  {activeRun ? (
                    <p className="flex items-center gap-2">
                      <PhaseBadge phase={activeRun.phase} />
                      <span className="truncate">{activeRun.idea?.title ?? "Analyzing repository..."}</span>
                    </p>
                  ) : (
                    <p>No cycle in progress</p>
                  )}
                  <p>
                    {repo._count.ideas} improvement{repo._count.ideas === 1 ? "" : "s"} shipped ·{" "}
                    {repo.schedule.toLowerCase()} schedule
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
