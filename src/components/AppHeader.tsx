import Link from "next/link";
import { signOut } from "@/auth";
import ThemeToggle from "./ThemeToggle";

export default function AppHeader({
  user,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
}) {
  return (
    <header className="mb-8 flex items-center justify-between border-b border-surface-border pb-5">
      <Link href="/" className="text-lg font-bold text-white transition-opacity hover:opacity-80">
        ⚡{" "}
        <span className="bg-gradient-to-r from-fuchsia-400 to-sky-400 bg-clip-text text-transparent">
          Foundry
        </span>
      </Link>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        {user.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            className="h-8 w-8 rounded-full ring-2 ring-fuchsia-500/40"
          />
        )}
        <span className="hidden text-sm text-gray-400 sm:inline">
          {user.name ?? user.email}
        </span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button className="btn-secondary" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
