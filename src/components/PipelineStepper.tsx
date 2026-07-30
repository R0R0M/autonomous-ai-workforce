interface Step {
  keys: string[];
  label: string;
  dot: string; // tailwind bg color for the active dot
  text: string;
}

function buildSteps(requireApproval: boolean): Step[] {
  return [
    { keys: ["IDEATING"], label: "Ideate", dot: "bg-purple-400", text: "text-purple-300" },
    { keys: ["CODING"], label: "Code", dot: "bg-sky-400", text: "text-sky-300" },
    { keys: ["TESTING", "FIXING"], label: "Test ⇄ Fix", dot: "bg-amber-400", text: "text-amber-300" },
    { keys: ["SAFETY_CHECK"], label: "Safety", dot: "bg-cyan-400", text: "text-cyan-300" },
    { keys: ["PUSHING"], label: "Push", dot: "bg-indigo-400", text: "text-indigo-300" },
    ...(requireApproval
      ? [{ keys: ["AWAITING_APPROVAL"], label: "Approval", dot: "bg-yellow-400", text: "text-yellow-300" }]
      : []),
    { keys: ["MERGING"], label: "Merge", dot: "bg-violet-400", text: "text-violet-300" },
    { keys: ["DEPLOYING", "VERIFYING"], label: "Deploy", dot: "bg-teal-400", text: "text-teal-300" },
    { keys: ["COMPLETED"], label: "Done", dot: "bg-emerald-400", text: "text-emerald-300" },
  ];
}

/** Horizontal visual of where the current cycle is in the pipeline. */
export default function PipelineStepper({
  phase,
  requireApproval,
}: {
  phase: string;
  requireApproval: boolean;
}) {
  const failed = phase === "FAILED" || phase === "ROLLED_BACK";
  const steps = buildSteps(requireApproval || phase === "AWAITING_APPROVAL");
  const currentIdx = steps.findIndex((s) => s.keys.includes(phase));

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {steps.map((step, i) => {
        const done = !failed && currentIdx > i;
        const active = !failed && currentIdx === i;
        return (
          <span key={step.label} className="flex items-center gap-1">
            <span className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium">
              <span
                className={`section-dot ${
                  done
                    ? "bg-emerald-500"
                    : active
                      ? `${step.dot} animate-pulse`
                      : "bg-gray-700"
                }`}
              />
              <span className={done ? "text-emerald-400/80" : active ? step.text : "text-gray-600"}>
                {done ? "✓ " : ""}
                {step.label}
              </span>
            </span>
            {i < steps.length - 1 && <span className="text-gray-700">›</span>}
          </span>
        );
      })}
      {failed && (
        <span className="ml-2 rounded-full bg-red-900/60 px-2.5 py-1 text-xs font-semibold text-red-300">
          {phase.replaceAll("_", " ")}
        </span>
      )}
    </div>
  );
}
