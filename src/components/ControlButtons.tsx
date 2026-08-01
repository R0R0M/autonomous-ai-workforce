"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ControlButtons({
  repoId,
  status,
  hasActiveRun,
  awaitingApproval,
  billingActive,
  hasCredit,
  packs,
}: {
  repoId: string;
  status: string;
  hasActiveRun: boolean;
  awaitingApproval: boolean;
  billingActive: boolean;
  hasCredit: boolean;
  packs: number[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [billingIntent, setBillingIntent] = useState<"start" | "run-once" | null>(null);
  const [buying, setBuying] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: string) {
    // Known-empty balance: skip the round trip and ask for billing directly.
    if (
      billingActive &&
      !hasCredit &&
      (action === "start" || action === "run-once")
    ) {
      setBillingIntent(action);
      return;
    }
    setPending(action);
    const res = await fetch(`/api/repositories/${repoId}/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setPending(null);
    if (res.status === 402 && (action === "start" || action === "run-once")) {
      setBillingIntent(action);
      return;
    }
    router.refresh();
  }

  async function buyAndRun(amountUsd: number) {
    setBuying(amountUsd);
    setError(null);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountUsd, repoId, action: billingIntent }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.url) {
      setError(typeof body.error === "string" ? body.error : "Could not start checkout");
      setBuying(null);
      return;
    }
    window.location.href = body.url;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "RUNNING" ? (
        <button className="btn-primary" disabled={!!pending} onClick={() => act("start")}>
          {pending === "start" ? "Starting..." : "Start autonomous mode"}
        </button>
      ) : (
        <button className="btn-secondary" disabled={!!pending} onClick={() => act("pause")}>
          {pending === "pause" ? "Pausing..." : "Pause"}
        </button>
      )}
      {!hasActiveRun && (
        <button className="btn-secondary" disabled={!!pending} onClick={() => act("run-once")}>
          {pending === "run-once" ? "Queuing..." : "Run one cycle"}
        </button>
      )}
      {awaitingApproval && (
        <>
          <button className="btn-primary" disabled={!!pending} onClick={() => act("approve")}>
            {pending === "approve" ? "Approving..." : "Approve & merge"}
          </button>
          <button className="btn-danger" disabled={!!pending} onClick={() => act("reject")}>
            {pending === "reject" ? "Rejecting..." : "Reject"}
          </button>
        </>
      )}

      {/* Billing prompt: shown when starting work with an empty balance. */}
      {billingIntent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="card w-full max-w-md space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Add credits to run your AI team</h3>
              <p className="mt-1 text-sm text-gray-400">
                Your balance is empty. Pick a credit pack — you&apos;ll check out securely with
                Stripe, and your cycle starts automatically the moment payment completes. Credits
                are only spent on actual work, metered to the token.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {packs.map((amount) => (
                <button
                  key={amount}
                  onClick={() => buyAndRun(amount)}
                  disabled={buying !== null}
                  className="btn-primary"
                >
                  {buying === amount ? "Redirecting..." : `$${amount}`}
                </button>
              ))}
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              className="btn-secondary"
              onClick={() => {
                setBillingIntent(null);
                setError(null);
              }}
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
