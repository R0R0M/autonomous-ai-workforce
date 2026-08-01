const PHASE_STYLES: Record<string, string> = {
  IDEATING: "bg-purple-900/60 text-purple-300",
  AWAITING_IDEA_APPROVAL: "bg-yellow-900/60 text-yellow-300",
  CODING: "bg-blue-900/60 text-blue-300",
  TESTING: "bg-amber-900/60 text-amber-300",
  FIXING: "bg-orange-900/60 text-orange-300",
  SAFETY_CHECK: "bg-cyan-900/60 text-cyan-300",
  PUSHING: "bg-sky-900/60 text-sky-300",
  AWAITING_APPROVAL: "bg-yellow-900/60 text-yellow-300",
  MERGING: "bg-indigo-900/60 text-indigo-300",
  DEPLOYING: "bg-teal-900/60 text-teal-300",
  VERIFYING: "bg-teal-900/60 text-teal-300",
  COMPLETED: "bg-emerald-900/60 text-emerald-300",
  FAILED: "bg-red-900/60 text-red-300",
  ROLLED_BACK: "bg-red-900/60 text-red-300",
  // Deployment statuses reuse the same component
  TRIGGERED: "bg-sky-900/60 text-sky-300",
  SUCCEEDED: "bg-emerald-900/60 text-emerald-300",
  // Repo statuses reuse the same component
  RUNNING: "bg-emerald-900/60 text-emerald-300",
  PAUSED: "bg-gray-800 text-gray-400",
  IDLE: "bg-gray-800 text-gray-400",
  ERROR: "bg-red-900/60 text-red-300",
};

export default function PhaseBadge({ phase }: { phase: string }) {
  const style = PHASE_STYLES[phase] ?? "bg-gray-800 text-gray-400";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}>
      {phase.replaceAll("_", " ")}
    </span>
  );
}
