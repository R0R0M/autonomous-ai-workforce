import Link from "next/link";
import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden px-6">
      <div className="pointer-events-none absolute top-0 left-1/2 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[130px]" />

      <Link href="/" className="relative text-sm text-gray-500 hover:text-gray-300">
        ← Back to home
      </Link>

      <div className="relative text-center">
        <p className="text-4xl">⚡</p>
        <h1 className="mt-3 text-3xl font-bold text-white">Autonomous AI Workforce</h1>
        <p className="mx-auto mt-3 max-w-md text-gray-400">
          Sign in and put a three-agent AI software company to work on your repositories —
          ideating, building, and shipping tested improvements around the clock.
        </p>
      </div>

      <form
        className="relative"
        action={async () => {
          "use server";
          await signIn("github", { redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-sky-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition-transform hover:scale-105"
        >
          Sign in with GitHub
        </button>
      </form>

      <p className="relative max-w-sm text-center text-xs text-gray-600">
        We only use GitHub to identify you. Repository access is granted per-repo with tokens you
        control, encrypted at rest, and revocable any time.
      </p>
    </main>
  );
}
