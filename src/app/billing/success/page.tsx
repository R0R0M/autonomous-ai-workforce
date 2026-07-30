import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { billingEnabled, stripe, creditPurchase, getBalanceUsd } from "@/lib/billing";

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
  }

  const balance = await getBalanceUsd(session.user.id);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
      {paid ? (
        <>
          <p className="text-5xl">🎉</p>
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
          <p className="text-5xl">🤔</p>
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
