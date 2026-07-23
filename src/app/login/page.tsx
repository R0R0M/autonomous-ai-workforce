import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Autonomous AI Workforce</h1>
        <p className="mt-2 max-w-md text-gray-400">
          Three AI agents — Ideator, Coder, and Tester — working around the clock to improve your
          software.
        </p>
      </div>
      <form
        action={async () => {
          "use server";
          await signIn("github", { redirectTo: "/" });
        }}
      >
        <button type="submit" className="btn-primary text-base">
          Sign in with GitHub
        </button>
      </form>
    </main>
  );
}
