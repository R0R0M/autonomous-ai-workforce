import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

const AGENTS = [
  {
    mark: "PM",
    name: "The Ideator",
    role: "Product Manager · Architect",
    gradient: "from-purple-500 to-fuchsia-500",
    ring: "ring-purple-500/30",
    text: "text-purple-300",
    blurb:
      "Studies your entire codebase like a founder obsessed with the product — UX, performance, security, accessibility, SEO — then proposes improvements scored across 11 dimensions and ranked by impact.",
  },
  {
    mark: "SWE",
    name: "The Coder",
    role: "Senior Full-Stack Engineer",
    gradient: "from-sky-500 to-blue-600",
    ring: "ring-sky-500/30",
    text: "text-sky-300",
    blurb:
      "Takes the top-ranked task and builds it on an isolated branch — following your architecture, your conventions, your style. Runs your linter, your types, your tests before calling anything done.",
  },
  {
    mark: "QA",
    name: "The Tester",
    role: "QA · Security · Performance",
    gradient: "from-amber-400 to-orange-500",
    ring: "ring-amber-500/30",
    text: "text-amber-300",
    blurb:
      "The gatekeeper. Runs every test suite, probes edge cases like a real user, hunts regressions and security holes. Nothing ships until it approves — and it rejects with precise, reproducible bug reports.",
  },
];

const PIPELINE = [
  { label: "Analyze", color: "text-purple-300" },
  { label: "Build", color: "text-sky-300" },
  { label: "Test & fix", color: "text-amber-300" },
  { label: "Safety scan", color: "text-cyan-300" },
  { label: "Pull request", color: "text-indigo-300" },
  { label: "Deploy", color: "text-teal-300" },
  { label: "Verify", color: "text-emerald-300" },
];

const STATS = [
  { value: "~20 min", label: "from idea to merged, tested PR" },
  { value: "100%", label: "of changes tested before they ship" },
  { value: "24/7", label: "continuous improvement, even while you sleep" },
  { value: "1 click", label: "to roll back — automatic on failed deploys" },
];

const FEATURES = [
  {
    title: "Watch it work, live",
    blurb:
      "A real-time feed of every command your agents run and every file they touch — with colored diffs, as it happens.",
  },
  {
    title: "Every commit, explained",
    blurb:
      "Plain-English explanations of what each commit changed and why — no jargon, no digging through diffs.",
  },
  {
    title: "Safety that's code, not vibes",
    blurb:
      "Sandboxed agents, secret scanning on every diff, encrypted tokens, and automatic git-revert rollback when a deploy fails its health check.",
  },
  {
    title: "You stay in control",
    blurb:
      "Pull requests by default, an optional human-approval gate before anything merges, and pause/resume any time.",
  },
  {
    title: "Know what every cycle costs",
    blurb:
      "Live token metering with per-cycle and all-time cost estimates. Runs on your Anthropic API key or your Claude plan.",
  },
  {
    title: "A team that remembers",
    blurb:
      "Persistent memory of past bugs, failed experiments, and wins — your agents never repeat a mistake or re-pitch a shipped idea.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Connect a repository",
    blurb: "Sign in with GitHub, paste a repo-scoped token, pick your schedule. Two minutes, tops.",
  },
  {
    n: "2",
    title: "Press start",
    blurb:
      "Your three-agent team ideates, builds, and battle-tests improvements on isolated branches — arguing with each other until the work is actually good.",
  },
  {
    n: "3",
    title: "Review the PRs (or don't)",
    blurb:
      "Approved changes arrive as clean pull requests with explanations. Auto-merge them, gate them behind your approval — your call.",
  },
];

export default function Landing() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* ambient background glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[140px]" />
      <div className="pointer-events-none absolute top-[38rem] -left-40 h-[400px] w-[500px] rounded-full bg-sky-600/15 blur-[120px]" />
      <div className="pointer-events-none absolute top-[70rem] -right-40 h-[400px] w-[500px] rounded-full bg-emerald-600/15 blur-[120px]" />

      <div className="relative mx-auto max-w-6xl px-6">

      {/* Nav */}
      <nav className="relative flex items-center justify-between py-6">
        <span className="flex items-center gap-2 text-lg font-bold tracking-tight text-white">
          <span className="h-3 w-3 rounded-sm bg-gradient-to-br from-fuchsia-500 to-sky-500" />
          Foundry
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className="btn-secondary">
            Sign in
          </Link>
        </div>
      </nav>

      {/* Hero — fills the first screen */}
      <section className="relative flex min-h-[calc(100vh-6rem)] flex-col items-center justify-center pb-10 text-center">
        <p className="mx-auto mb-6 w-fit rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-1 text-sm text-fuchsia-300">
          Your codebase, improving itself — right now
        </p>
        <h1 className="mx-auto max-w-3xl text-5xl font-extrabold leading-tight text-white sm:text-6xl">
          Hire a software company
          <span className="block bg-gradient-to-r from-fuchsia-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
            that never sleeps.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-300">
          Three specialized AI agents — a product visionary, a senior engineer, and a ruthless QA
          lead — continuously find, build, test, and ship improvements to your GitHub repository.
          You wake up to tested pull requests, not to-do lists.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-sky-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition-transform hover:scale-105"
          >
            Start free with GitHub →
          </Link>
          <a href="#how-it-works" className="btn-secondary px-6 py-3.5 text-base">
            See how it works
          </a>
        </div>
        <p className="mt-4 text-sm text-gray-400">
          <span className="font-semibold text-emerald-400">$1 of free credits</span> when you sign
          up — no card required. Then only pay for what you use, metered to the token.
        </p>

        {/* pipeline strip */}
        <div className="mx-auto mt-14 flex max-w-4xl flex-wrap items-center justify-center gap-x-2 gap-y-2 rounded-2xl border border-surface-border bg-surface-raised/70 px-6 py-4 text-sm font-medium backdrop-blur">
          {PIPELINE.map((step, i) => (
            <span key={step.label} className="flex items-center gap-2">
              <span className={step.color}>{step.label}</span>
              {i < PIPELINE.length - 1 && <span className="text-gray-600">→</span>}
            </span>
          ))}
          <span className="ml-2 flex items-center gap-1.5 text-emerald-300">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            repeat forever
          </span>
        </div>
      </section>

      {/* Stats */}
      <section className="relative grid grid-cols-2 gap-4 py-10 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="card text-center">
            <p className="bg-gradient-to-r from-sky-300 to-emerald-300 bg-clip-text text-3xl font-extrabold text-transparent">
              {s.value}
            </p>
            <p className="mt-1 text-sm text-gray-400">{s.label}</p>
          </div>
        ))}
      </section>

      {/* Agents */}
      <section className="relative py-16">
        <h2 className="text-center text-3xl font-bold text-white">Meet your new team</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-gray-400">
          Each agent has one job and can&apos;t do anyone else&apos;s — the same checks and
          balances as a great human team.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {AGENTS.map((a) => (
            <div key={a.name} className={`card ring-1 ${a.ring} transition-transform hover:-translate-y-1`}>
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${a.gradient} text-xs font-bold tracking-wide text-white`}
              >
                {a.mark}
              </div>
              <h3 className="text-lg font-bold text-white">{a.name}</h3>
              <p className={`text-xs font-semibold uppercase tracking-wide ${a.text}`}>{a.role}</p>
              <p className="mt-3 text-sm leading-relaxed text-gray-300">{a.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative py-16">
        <h2 className="text-center text-3xl font-bold text-white">Up and running in minutes</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card">
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-sky-500 text-lg font-bold text-white">
                {s.n}
              </span>
              <h3 className="font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">{s.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative py-16">
        <h2 className="text-center text-3xl font-bold text-white">
          Built for trust, tuned for speed
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card transition-colors hover:border-sky-700">
              <span className="block h-1 w-8 rounded-full bg-gradient-to-r from-fuchsia-500 to-sky-500" />
              <h3 className="mt-3 font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">{f.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing promise */}
      <section className="relative py-16">
        <div className="card mx-auto max-w-3xl border-emerald-500/25 bg-gradient-to-br from-surface-raised to-emerald-950/30 py-10 text-center">
          <h2 className="mt-3 text-3xl font-bold text-white">
            Pay for the work.{" "}
            <span className="bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">
              Nothing else.
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-300">
            You&apos;re charged exactly what your AI team uses — metered to the token, shown live
            on your dashboard down to the cent. No subscriptions, no seat fees, no markup, no
            surprises. If your agents don&apos;t work, you don&apos;t pay.
          </p>
          <div className="mx-auto mt-6 flex max-w-lg flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-emerald-300">
            <span>✓ $1 free starter credit</span>
            <span>✓ Usage-based, to the token</span>
            <span>✓ Live cost tracking</span>
            <span>✓ $0 extra fees</span>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-20 text-center">
        <div className="card mx-auto max-w-3xl border-fuchsia-500/30 bg-gradient-to-br from-surface-raised to-fuchsia-950/40 py-12">
          <h2 className="text-3xl font-bold text-white">
            Your competitors&apos; code sat still today.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-gray-300">
            Yours doesn&apos;t have to. Connect a repository and watch the first tested pull
            request arrive within the hour.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-block rounded-xl bg-gradient-to-r from-fuchsia-500 to-sky-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition-transform hover:scale-105"
          >
            Put your AI team to work →
          </Link>
        </div>
      </section>

      </div>

      <footer className="relative border-t border-surface-border py-8 text-center text-sm text-gray-500">
        Foundry — an autonomous software company for your repositories. Powered by Claude.
      </footer>
    </div>
  );
}
