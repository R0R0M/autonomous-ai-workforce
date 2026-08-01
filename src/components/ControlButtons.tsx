"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ControlButtons({
  repoId,
  status,
  hasActiveRun,
  awaitingApproval,
}: {
  repoId: string;
  status: string;
  hasActiveRun: boolean;
  awaitingApproval: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function act(action: string) {
    setPending(action);
    await fetch(`/api/repositories/${repoId}/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setPending(null);
    router.refresh();
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
    </div>
  );
}
