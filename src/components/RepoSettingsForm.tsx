"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ModelOption {
  id: string;
  label: string;
  tagline: string;
  pricing: string;
}

export default function RepoSettingsForm({
  repo,
  models,
}: {
  repo: {
    id: string;
    schedule: string;
    mergeMode: string;
    autoMergePr: boolean;
    requireHumanApproval: boolean;
    requireIdeaApproval: boolean;
    model: string;
    deployHookUrl: string | null;
    healthCheckUrl: string | null;
  };
  models: ModelOption[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/repositories/${repo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schedule: form.get("schedule"),
        mergeMode: form.get("mergeMode"),
        model: form.get("model"),
        autoMergePr: form.get("autoMergePr") === "on",
        requireHumanApproval: form.get("requireHumanApproval") === "on",
        requireIdeaApproval: form.get("requireIdeaApproval") === "on",
        deployHookUrl: (form.get("deployHookUrl") as string) || "",
        healthCheckUrl: (form.get("healthCheckUrl") as string) || "",
        ...(form.get("githubToken") ? { githubToken: form.get("githubToken") } : {}),
      }),
    });
    setSaving(false);
    setMessage(res.ok ? "Settings saved." : "Could not save settings.");
    if (res.ok) router.refresh();
  }

  async function onDelete() {
    if (
      !confirm(
        "Disconnect this repository? Its history, analytics, and backlog in Foundry will be deleted. The GitHub repository itself is untouched.",
      )
    ) {
      return;
    }
    setDeleting(true);
    const res = await fetch(`/api/repositories/${repo.id}`, { method: "DELETE" });
    if (res.ok) {
      window.location.href = "/";
      return;
    }
    setDeleting(false);
    setMessage("Could not disconnect the repository.");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Model */}
      <div>
        <label className="label">AI model</label>
        <div className="grid gap-3 sm:grid-cols-3">
          {models.map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer flex-col gap-1 rounded-lg border border-surface-border bg-surface p-3 text-sm has-[:checked]:border-fuchsia-500"
            >
              <span className="flex items-center gap-2">
                <input type="radio" name="model" value={m.id} defaultChecked={repo.model === m.id} />
                <span className="font-semibold text-white">{m.label}</span>
              </span>
              <span className="text-xs text-gray-400">{m.tagline}</span>
              <span className="text-xs text-gray-500">{m.pricing}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Schedule</label>
          <select name="schedule" className="input" defaultValue={repo.schedule}>
            <option value="CONTINUOUS">Continuous (24/7)</option>
            <option value="NIGHTLY">Nightly</option>
            <option value="MANUAL">Manual only</option>
          </select>
        </div>
        <div>
          <label className="label">Merge mode</label>
          <select name="mergeMode" className="input" defaultValue={repo.mergeMode}>
            <option value="PULL_REQUEST">Pull requests</option>
            <option value="DIRECT_MERGE">Direct merge to default branch</option>
          </select>
        </div>
        <div>
          <label className="label">Deploy hook URL (optional)</label>
          <input
            name="deployHookUrl"
            className="input"
            defaultValue={repo.deployHookUrl ?? ""}
            placeholder="https://api.vercel.com/v1/integrations/deploy/..."
          />
        </div>
        <div>
          <label className="label">Health check URL (optional)</label>
          <input
            name="healthCheckUrl"
            className="input"
            defaultValue={repo.healthCheckUrl ?? ""}
            placeholder="https://myapp.com/api/health"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Replace GitHub token (leave blank to keep current)</label>
          <input name="githubToken" type="password" className="input" placeholder="github_pat_..." />
        </div>
      </div>

      <div className="flex flex-col gap-2 text-sm text-gray-300">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="requireIdeaApproval" defaultChecked={repo.requireIdeaApproval} />
          Ask me to approve each idea before the Coder starts
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="requireHumanApproval" defaultChecked={repo.requireHumanApproval} />
          Ask me to approve before anything merges
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="autoMergePr" defaultChecked={repo.autoMergePr} />
          Auto-merge approved pull requests
        </label>
      </div>

      <div className="flex items-center gap-4">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving..." : "Save settings"}
        </button>
        {message && <p className="text-sm text-gray-400">{message}</p>}
      </div>

      {/* Danger zone */}
      <div className="rounded-lg border border-red-900/50 p-4">
        <p className="mb-2 text-sm font-semibold text-red-400">Danger zone</p>
        <p className="mb-3 text-xs text-gray-500">
          Disconnecting removes this repository and all its Foundry data. Your code on GitHub is
          not affected.
        </p>
        <button type="button" className="btn-danger" onClick={onDelete} disabled={deleting}>
          {deleting ? "Disconnecting..." : "Disconnect repository"}
        </button>
      </div>
    </form>
  );
}
