import { estimateCostUsd, formatTokens } from "@/lib/pricing";

export interface CommitExplanation {
  sha: string | null;
  message: string;
  overall: string;
  files: { file: string; whatChanged: string; purpose: string }[];
  createdAt: Date;
  taskTitle: string | null;
  isCurrentCycle: boolean;
}

interface LogRow {
  id: string;
  level: string;
  message: string;
  createdAt: Date;
}

export default function ChangesShelf({
  ideaTitle,
  commits,
  coderBusy,
  inputTokens,
  outputTokens,
  totalInputTokens,
  totalOutputTokens,
  modelName,
  logs,
}: {
  ideaTitle: string | null;
  commits: CommitExplanation[];
  coderBusy: boolean;
  inputTokens: number;
  outputTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  modelName: string;
  logs: LogRow[];
}) {
  const cycleCost = estimateCostUsd(modelName, inputTokens, outputTokens);
  const totalCost = estimateCostUsd(modelName, totalInputTokens, totalOutputTokens);

  return (
    <aside className="space-y-4">
      <div className="card">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-400">
          Changes this cycle
        </h2>
        {ideaTitle ? (
          <p className="text-sm font-medium text-white">{ideaTitle}</p>
        ) : (
          <p className="text-sm text-gray-500">No cycle yet.</p>
        )}
      </div>

      {/* Token usage */}
      <div className="card">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Token usage
        </h3>
        <div className="space-y-3 font-mono text-sm">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">This cycle</p>
            {inputTokens + outputTokens === 0 ? (
              <p className="text-xs text-gray-500">Nothing spent yet.</p>
            ) : (
              <>
                <p className="flex justify-between">
                  <span className="text-gray-400">tokens</span>
                  <span className="text-gray-200">
                    {formatTokens(inputTokens)} in / {formatTokens(outputTokens)} out
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="text-gray-400">≈ cost</span>
                  <span className="text-emerald-400">${cycleCost.toFixed(4)}</span>
                </p>
              </>
            )}
          </div>
          <div className="border-t border-surface-border pt-2">
            <p className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">All time</p>
            <p className="flex justify-between">
              <span className="text-gray-400">tokens</span>
              <span className="text-gray-200">
                {formatTokens(totalInputTokens)} in / {formatTokens(totalOutputTokens)} out
              </span>
            </p>
            <p className="flex justify-between">
              <span className="text-gray-400">≈ cost</span>
              <span className="text-emerald-400">${totalCost.toFixed(4)}</span>
            </p>
          </div>
          <p className="text-right text-[10px] text-gray-600">{modelName}</p>
        </div>
      </div>

      {/* Commits with explanations */}
      <div className="card max-h-[32rem] space-y-3 overflow-y-auto">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Commits</h3>
        {coderBusy && (
          <div className="rounded-lg border border-dashed border-surface-border bg-surface p-3">
            <p className="flex items-center gap-2 text-xs text-gray-400">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400" />
              Coder is working — the next commit and its explanation will appear here.
            </p>
          </div>
        )}
        {commits.length === 0 && !coderBusy && (
          <p className="text-sm text-gray-500">No commits yet this cycle.</p>
        )}
        {commits.map((c, i) => (
          <div
            key={c.sha ?? i}
            className={`rounded-lg border bg-surface p-3 ${
              c.isCurrentCycle ? "border-blue-800/70" : "border-surface-border/60"
            }`}
          >
            {!c.isCurrentCycle && c.taskTitle && (
              <p className="mb-1 truncate text-[10px] text-gray-500">{c.taskTitle}</p>
            )}
            <p className="break-words font-mono text-xs text-white">
              {c.sha && <span className="mr-2 text-amber-300">{c.sha.slice(0, 7)}</span>}
              {c.message}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-gray-300">{c.overall}</p>
            {c.files.length > 0 && (
              <details className="mt-1.5">
                <summary className="cursor-pointer text-[11px] text-gray-500 hover:text-gray-300">
                  {c.files.length} file{c.files.length === 1 ? "" : "s"} — details
                </summary>
                <div className="mt-1.5 space-y-1.5">
                  {c.files.map((f) => (
                    <div key={f.file} className="text-[11px]">
                      <p className="break-all font-mono text-gray-300">{f.file}</p>
                      <p className="text-gray-400">{f.whatChanged} {f.purpose}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}
            <p className="mt-1 text-right text-[10px] text-gray-600">
              {new Date(c.createdAt).toLocaleTimeString()}
            </p>
          </div>
        ))}
      </div>

      {/* Activity log */}
      <div className="card">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Activity log
        </h3>
        <div className="max-h-80 space-y-1 overflow-y-auto font-mono text-[11px]">
          {logs.map((log) => (
            <p key={log.id} className="flex gap-2">
              <span className="whitespace-nowrap text-gray-600">
                {new Date(log.createdAt).toLocaleTimeString()}
              </span>
              <span
                className={
                  log.level === "error"
                    ? "text-red-400"
                    : log.level === "warn"
                      ? "text-amber-400"
                      : "text-gray-300"
                }
              >
                {log.message}
              </span>
            </p>
          ))}
          {logs.length === 0 && <p className="text-gray-500">No activity yet.</p>}
        </div>
      </div>
    </aside>
  );
}
