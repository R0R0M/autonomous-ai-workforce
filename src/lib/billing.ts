import Stripe from "stripe";
import { db } from "./db";

export const MICROS_PER_USD = 1_000_000;

export function usdToMicros(usd: number): number {
  return Math.round(usd * MICROS_PER_USD);
}

export function microsToUsd(micros: number): number {
  return micros / MICROS_PER_USD;
}

/** Billing is active only when a Stripe key is configured. */
export function billingEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

let stripeClient: Stripe | null = null;

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  if (!stripeClient) stripeClient = new Stripe(key);
  return stripeClient;
}

function trialMicros(): number {
  return usdToMicros(Number(process.env.TRIAL_CREDIT_USD ?? 1));
}

/** Get the user's billing account, creating it (with the welcome trial credit) on first touch. */
export async function getAccount(userId: string) {
  const existing = await db.billingAccount.findUnique({ where: { userId } });
  if (existing) return existing;
  try {
    const account = await db.billingAccount.create({
      data: { userId, balanceMicros: trialMicros() },
    });
    await db.creditTransaction.create({
      data: {
        userId,
        type: "TRIAL",
        amountMicros: trialMicros(),
        description: "Welcome trial credit",
      },
    });
    return account;
  } catch {
    // Raced with a concurrent create — the account exists now.
    return db.billingAccount.findUniqueOrThrow({ where: { userId } });
  }
}

export async function getBalanceUsd(userId: string): Promise<number> {
  const account = await getAccount(userId);
  return microsToUsd(account.balanceMicros);
}

export async function hasCredit(userId: string): Promise<boolean> {
  const account = await getAccount(userId);
  return account.balanceMicros > 0;
}

/**
 * Meter usage against the balance at cost — no markup. Amounts smaller than
 * one micro-dollar are dropped rather than rounded up.
 */
export async function chargeUsage(
  userId: string,
  usd: number,
  description: string,
  runId?: string,
): Promise<void> {
  const micros = Math.floor(usd * MICROS_PER_USD);
  if (micros <= 0) return;
  await getAccount(userId);
  await db.$transaction([
    db.billingAccount.update({
      where: { userId },
      data: { balanceMicros: { decrement: micros } },
    }),
    db.creditTransaction.create({
      data: { userId, type: "USAGE", amountMicros: -micros, description, runId },
    }),
  ]);
}

/**
 * Credit a completed Stripe Checkout purchase. Idempotent: the session id is
 * unique, so replays (webhook + success page both firing) credit exactly once.
 */
export async function creditPurchase(
  userId: string,
  usd: number,
  stripeSessionId: string,
): Promise<{ credited: boolean }> {
  const micros = usdToMicros(usd);
  await getAccount(userId);
  try {
    await db.$transaction([
      db.creditTransaction.create({
        data: {
          userId,
          type: "PURCHASE",
          amountMicros: micros,
          description: `Credit purchase ($${usd.toFixed(2)})`,
          stripeSessionId,
        },
      }),
      db.billingAccount.update({
        where: { userId },
        data: { balanceMicros: { increment: micros } },
      }),
    ]);
    return { credited: true };
  } catch {
    // Unique constraint on stripeSessionId — already credited.
    return { credited: false };
  }
}

export const CREDIT_PACKS_USD = [5, 10, 25] as const;
