interface ToolEventRow {
  id: string;
  agent: string;
  tool: string;
  summary: string;
  detail: string | null;
  createdAt: Date;
}

const AGENT_COLORS: Record<string, string> = {
  CODER: "text-blue-300",
  TESTER: "text-amber-300",
  IDEATOR: "text-purple-300",
};

const TOOL_ICONS: Record<string, string> = {
  bash: "❯",
  write_file: "✎",
  read_file: "📄",
  list_files: "🗂",
  usage: "🎟",
};

function DiffView({ text }: { text: string }) {
  return (
    <pre className="mt-2 max-h-96 overflow-auto rounded bg-black/40 p-3 text-[11px] leading-relaxed">
      {text.split("\n").map((line, i) => {
        const cls = line.startsWith("+")
          ? "text-emerald-400"
          : line.startsWith("-")
            ? "text-red-400"
            : line.startsWith("@@")
              ? "text-cyan-400"
              : "text-gray-400";
        return (
          <div key={i} className={cls}>
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}

/**
 * Live feed of every tool action the agents take: commands with their output,
 * and file edits rendered as colored diffs. The page's AutoRefresh keeps it
 * near-real-time.
 */
export default function LiveActivityFeed({ events }: { events: ToolEventRow[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No tool activity yet — this fills up live while the Coder and Tester work.
      </p>
    );
  }
  return (
    <div className="max-h-[36rem] space-y-1.5 overflow-y-auto font-mono text-xs">
      {events.map((e, idx) => {
        const isDiff = e.tool === "write_file";
        const isUsage = e.tool === "usage";
        const hasDetail = !!e.detail && e.detail !== "(no output)";
        return (
          <div key={e.id} className="rounded border border-surface-border/60 bg-surface px-3 py-2">
            <div className="flex items-baseline gap-2">
              <span className="text-gray-600">{new Date(e.createdAt).toLocaleTimeString()}</span>
              <span className={`font-bold ${AGENT_COLORS[e.agent] ?? "text-gray-400"}`}>
                {e.agent}
              </span>
              <span className="text-gray-500">{TOOL_ICONS[e.tool] ?? "•"}</span>
              <span
                className={`break-all ${
                  isDiff ? "text-white" : isUsage ? "text-violet-300" : "text-gray-300"
                }`}
              >
                {e.summary}
              </span>
            </div>
            {hasDetail &&
              (isDiff ? (
                // Newest file edit is expanded; older ones collapse.
                <details open={idx === 0}>
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-300">
                    diff
                  </summary>
                  <DiffView text={e.detail!} />
                </details>
              ) : (
                <details>
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-300">
                    output
                  </summary>
                  <pre className="mt-2 max-h-60 overflow-auto rounded bg-black/40 p-3 text-[11px] text-gray-400">
                    {e.detail}
                  </pre>
                </details>
              ))}
          </div>
        );
      })}
    </div>
  );
}
