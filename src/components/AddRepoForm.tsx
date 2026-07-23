"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddRepoForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/repositories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: form.get("url"),
        githubToken: form.get("githubToken"),
        schedule: form.get("schedule"),
        mergeMode: form.get("mergeMode"),
        autoMergePr: form.get("autoMergePr") === "on",
        requireHumanApproval: form.get("requireHumanApproval") === "on",
        deployHookUrl: form.get("deployHookUrl") || "",
        healthCheckUrl: form.get("healthCheckUrl") || "",
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === "string" ? body.error : "Failed to connect repository");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + Connect repository
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <h2 className="text-lg font-semibold text-white">Connect a repository</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Repository (owner/name or URL)</label>
          <input name="url" required className="input" placeholder="acme/website" />
        </div>
        <div>
          <label className="label">GitHub token (repo scope)</label>
          <input name="githubToken" required type="password" className="input" placeholder="ghp_..." />
        </div>
        <div>
          <label className="label">Schedule</label>
          <select name="schedule" className="input" defaultValue="CONTINUOUS">
            <option value="CONTINUOUS">Continuous (24/7)</option>
            <option value="NIGHTLY">Nightly</option>
            <option value="MANUAL">Manual only</option>
          </select>
        </div>
        <div>
          <label className="label">Merge mode</label>
          <select name="mergeMode" className="input" defaultValue="PULL_REQUEST">
            <option value="PULL_REQUEST">Pull requests</option>
            <option value="DIRECT_MERGE">Direct merge to default branch</option>
          </select>
        </div>
        <div>
          <label className="label">Deploy hook URL (optional)</label>
          <input name="deployHookUrl" className="input" placeholder="https://api.vercel.com/v1/integrations/deploy/..." />
        </div>
        <div>
          <label className="label">Health check URL (optional)</label>
          <input name="healthCheckUrl" className="input" placeholder="https://myapp.com/api/health" />
        </div>
      </div>
      <div className="flex flex-wrap gap-6 text-sm text-gray-300">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="autoMergePr" defaultChecked /> Auto-merge approved PRs
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="requireHumanApproval" /> Require my approval before merging
        </label>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Validating..." : "Connect"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
