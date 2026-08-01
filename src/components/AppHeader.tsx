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
      <Link
        href="/"
        className="flex items-center gap-2 text-lg font-bold tracking-tight text-white transition-opacity hover:opacity-80"
      >
        <span className="h-3 w-3 rounded-sm bg-gradient-to-br from-fuchsia-500 to-sky-500" />
        Foundry
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
