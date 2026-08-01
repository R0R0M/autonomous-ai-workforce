import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/logger";
import { billingEnabled, stripe, creditPurchase, getBalanceUsd } from "@/lib/billing";

const ACTIVE_PHASES = [
  "IDEATING", "CODING", "TESTING", "FIXING", "SAFETY_CHECK",
  "PUSHING", "AWAITING_APPROVAL", "MERGING", "DEPLOYING", "VERIFYING",
] as const;

/** Perform the action the user was attempting when checkout interrupted them. */
async function runPurchaseIntent(userId: string, repoId: string, action: string) {
  const repo = await db.repository.findUnique({ where: { id: repoId } });
  if (!repo || repo.userId !== userId) return false;

  await db.repository.update({ where: { id: repoId }, data: { status: "RUNNING" } });
  const active = await db.cycleRun.findFirst({
    where: { repositoryId: repoId, phase: { in: [...ACTIVE_PHASES] } },
  });
  if (!active && (action === "run-once" || action === "start")) {
    await db.cycleRun.create({ data: { repositoryId: repoId, phase: "IDEATING" } });
  }
  await logActivity(repoId, "info", "Credits added — starting cycle");
  return true;
}

export const dynamic = "force-dynamic";

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { session_id: sessionId } = await searchParams;
  if (!sessionId || !billingEnabled()) redirect("/");

  // Verify with Stripe directly — works locally without webhook forwarding.
  const checkout = await stripe().checkout.sessions.retrieve(sessionId);
  const paid =
    checkout.payment_status === "paid" && checkout.metadata?.userId === session.user.id;
  const amountUsd = Number(checkout.metadata?.amountUsd);

  if (paid && amountUsd > 0) {
    await creditPurchase(session.user.id, amountUsd, checkout.id);

    // If checkout was triggered by a "run cycle" click, run it now and land
    // the user back on their repo to watch the agents work.
    const repoId = checkout.metadata?.repoId;
    const action = checkout.metadata?.action;
    if (repoId && action) {
      const ran = await runPurchaseIntent(session.user.id, repoId, action);
      if (ran) redirect(`/repos/${repoId}`);
    }
  }

  const balance = await getBalanceUsd(session.user.id);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      {paid ? (
        <>
          <h1 className="text-3xl font-bold text-white">
            ${amountUsd.toFixed(2)} in credits added
          </h1>
          <p className="text-gray-400">
            Your balance is now{" "}
            <span className="font-semibold text-emerald-400">${balance.toFixed(2)}</span>. Your AI
            team only spends it on actual work — metered to the token.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-white">Payment not confirmed</h1>
          <p className="text-gray-400">
            We couldn&apos;t verify this checkout session. If you were charged, the credit will
            arrive via webhook shortly.
          </p>
        </>
      )}
      <Link href="/" className="btn-primary">
        Back to dashboard
      </Link>
    </main>
  );
}
