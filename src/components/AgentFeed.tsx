import PhaseBadge from "./PhaseBadge";

interface Message {
  id: string;
  fromAgent: string;
  toAgent: string;
  type: string;
  content: unknown;
  createdAt: Date;
}

const AGENT_COLORS: Record<string, string> = {
  IDEATOR: "text-purple-300",
  CODER: "text-blue-300",
  TESTER: "text-amber-300",
  SYSTEM: "text-gray-400",
};

function ContentView({ type, content }: { type: string; content: Record<string, unknown> }) {
  switch (type) {
    case "ANALYSIS":
      return <p className="text-sm text-gray-300">{String(content.summary ?? "")}</p>;
    case "TASK_BRIEF":
      return (
        <div className="space-y-1 text-sm text-gray-300">
          <p className="font-semibold text-white">{String(content.title ?? "")}</p>
          <p>{String(content.description ?? "")}</p>
          {Array.isArray(content.acceptanceCriteria) && (
            <ul className="list-inside list-disc text-gray-400">
              {(content.acceptanceCriteria as string[]).slice(0, 6).map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      );
    case "IMPLEMENTATION_REPORT":
      return (
        <p className="whitespace-pre-wrap text-sm text-gray-300">
          {String(content.report ?? "").slice(0, 1500)}
        </p>
      );
    case "CHANGE_SUMMARY": {
      const changes = Array.isArray(content.changes)
        ? (content.changes as { file: string; whatChanged: string }[])
        : [];
      return (
        <div className="space-y-1 text-sm text-gray-300">
          <p>{String(content.overall ?? "")}</p>
          {changes.length > 0 && (
            <ul className="list-inside list-disc text-gray-400">
              {changes.slice(0, 8).map((c, i) => (
                <li key={i}>
                  <span className="font-mono text-gray-300">{c.file}</span> — {c.whatChanged}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    case "VERDICT": {
      const approved = Boolean(content.approved);
      const bugs = Array.isArray(content.bugs) ? (content.bugs as { severity: string; title: string }[]) : [];
      return (
        <div className="space-y-1 text-sm">
          <PhaseBadge phase={approved ? "COMPLETED" : "FAILED"} />
          <p className="text-gray-300">{String(content.summary ?? "")}</p>
          {bugs.length > 0 && (
            <ul className="list-inside list-disc text-red-300">
              {bugs.map((b, i) => (
                <li key={i}>
                  [{b.severity}] {b.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    default:
      return (
        <pre className="max-h-40 overflow-auto text-xs text-gray-400">
          {JSON.stringify(content, null, 2)}
        </pre>
      );
  }
}

export default function AgentFeed({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return <p className="text-sm text-gray-500">No agent activity yet.</p>;
  }
  return (
    <div className="space-y-4">
      {messages.map((m) => (
        <div key={m.id} className="rounded-lg border border-surface-border bg-surface p-4">
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className={`font-bold ${AGENT_COLORS[m.fromAgent] ?? ""}`}>{m.fromAgent}</span>
            <span className="text-gray-600">→</span>
            <span className={`font-bold ${AGENT_COLORS[m.toAgent] ?? ""}`}>{m.toAgent}</span>
            <span className="rounded bg-surface-border px-1.5 py-0.5 text-gray-400">{m.type}</span>
            <span className="ml-auto text-gray-500">
              {new Date(m.createdAt).toLocaleString()}
            </span>
          </div>
          <ContentView type={m.type} content={(m.content ?? {}) as Record<string, unknown>} />
        </div>
      ))}
    </div>
  );
}
