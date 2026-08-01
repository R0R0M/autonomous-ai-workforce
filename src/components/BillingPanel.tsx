"use client";

import { useState } from "react";

export default function BillingPanel({
  balanceUsd,
  enabled,
  packs,
}: {
  balanceUsd: number;
  enabled: boolean;
  packs: number[];
}) {
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(amountUsd: number) {
    setPending(amountUsd);
    setError(null);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountUsd }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.url) {
      setError(typeof body.error === "string" ? body.error : "Could not start checkout");
      setPending(null);
      return;
    }
    window.location.href = body.url;
  }

  const low = balanceUsd <= 0.1;

  return (
    <div className={`card flex flex-wrap items-center gap-x-6 gap-y-3 ${low ? "border-amber-600/50" : ""}`}>
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-500">Credit balance</p>
        <p
          className={`font-mono text-2xl font-bold ${
            balanceUsd > 0 ? "text-emerald-400" : "text-red-400"
          }`}
        >
          ${balanceUsd.toFixed(2)}
        </p>
      </div>
      {enabled ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-400">Add credits:</span>
          {packs.map((amount) => (
            <button
              key={amount}
              onClick={() => buy(amount)}
              disabled={pending !== null}
              className="btn-secondary hover:border-emerald-600"
            >
              {pending === amount ? "Redirecting..." : `$${amount}`}
            </button>
          ))}
          <span className="text-xs text-gray-600">via Stripe · metered at cost, no markup</span>
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Billing not configured — set STRIPE_SECRET_KEY to enable credit purchases.
        </p>
      )}
      {low && (
        <p className="w-full text-xs text-amber-300">
          Your balance is empty — agents pause until you add credits.
        </p>
      )}
      {error && <p className="w-full text-xs text-red-400">{error}</p>}
    </div>
  );
}
