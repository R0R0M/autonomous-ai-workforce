import PhaseBadge from "./PhaseBadge";

interface IdeaRow {
  id: string;
  title: string;
  description: string;
  priority: number;
  status: string;
  scores: unknown;
}

const STATUS_STYLES: Record<string, string> = {
  BACKLOG: "bg-gray-800 text-gray-300",
  ACTIVE: "bg-blue-900/60 text-blue-300",
  DONE: "bg-emerald-900/60 text-emerald-300",
  FAILED: "bg-red-900/60 text-red-300",
  REJECTED: "bg-red-900/40 text-red-400",
};

export default function BacklogTable({ ideas }: { ideas: IdeaRow[] }) {
  if (ideas.length === 0) {
    return <p className="text-sm text-gray-500">The Ideator hasn&apos;t proposed anything yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-surface-border text-xs uppercase tracking-wide text-gray-500">
            <th className="py-2 pr-4">Priority</th>
            <th className="py-2 pr-4">Idea</th>
            <th className="py-2 pr-4">Impact</th>
            <th className="py-2 pr-4">Risk</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {ideas.map((idea) => {
            const scores = (idea.scores ?? {}) as Record<string, number>;
            return (
              <tr key={idea.id} className="border-b border-surface-border/50 align-top">
                <td className="py-3 pr-4 font-mono text-emerald-400">{idea.priority}</td>
                <td className="py-3 pr-4">
                  <p className="font-medium text-white">{idea.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-gray-400">{idea.description}</p>
                </td>
                <td className="py-3 pr-4 font-mono">{scores.userImpact ?? "—"}</td>
                <td className="py-3 pr-4 font-mono">{scores.risk ?? "—"}</td>
                <td className="py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[idea.status] ?? ""}`}
                  >
                    {idea.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
