import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import AppHeader from "@/components/AppHeader";
import ProfileForm from "@/components/ProfileForm";
import { billingEnabled, getBalanceUsd, microsToUsd } from "@/lib/billing";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [user, balanceUsd, transactions] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId } }),
    getBalanceUsd(userId),
    db.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <AppHeader user={session.user} />

      <h1 className="mb-6 text-2xl font-bold text-white">Account settings</h1>

      {/* Profile */}
      <section className="card mb-6">
        <h2 className="section-heading">
          <span className="section-dot bg-fuchsia-400" />
          Profile
        </h2>
        <div className="mb-4 flex items-center gap-4">
          {user.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="h-14 w-14 rounded-full ring-2 ring-fuchsia-500/40" />
          )}
          <div>
            <p className="font-medium text-white">{user.name ?? "Unnamed"}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
            <p className="text-xs text-gray-600">Signed in with GitHub</p>
          </div>
        </div>
        <ProfileForm initialName={user.name ?? ""} />
      </section>

      {/* Billing */}
      <section className="card">
        <h2 className="section-heading">
          <span className="section-dot bg-emerald-400" />
          Billing
        </h2>
        <p className="mb-4 text-sm text-gray-400">
          Balance:{" "}
          <span className={`font-mono text-lg font-bold ${balanceUsd > 0 ? "text-emerald-400" : "text-red-400"}`}>
            ${balanceUsd.toFixed(2)}
          </span>
          {!billingEnabled() && (
            <span className="ml-3 text-xs text-gray-600">(billing not configured on this server)</span>
          )}
        </p>
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-500">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Description</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-surface-border/50">
                    <td className="whitespace-nowrap py-2 pr-4 text-gray-500">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4 text-gray-300">{t.description}</td>
                    <td
                      className={`py-2 text-right font-mono ${
                        t.amountMicros >= 0 ? "text-emerald-400" : "text-gray-400"
                      }`}
                    >
                      {t.amountMicros >= 0 ? "+" : "−"}$
                      {Math.abs(microsToUsd(t.amountMicros)).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
