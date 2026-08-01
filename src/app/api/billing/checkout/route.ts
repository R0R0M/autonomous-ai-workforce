import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { db } from "@/lib/db";
import { billingEnabled, stripe, CREDIT_PACKS_USD } from "@/lib/billing";

const CheckoutSchema = z.object({
  amountUsd: z.number().refine((n) => (CREDIT_PACKS_USD as readonly number[]).includes(n), {
    message: "Invalid credit pack",
  }),
  // Optional intent: after payment succeeds, perform this action automatically.
  repoId: z.string().optional(),
  action: z.enum(["start", "run-once"]).optional(),
});

function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!billingEnabled()) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 501 });
  }
  const body = CheckoutSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  // Only carry the intent if the repo really belongs to this user.
  let repoId = "";
  if (body.data.repoId) {
    const repo = await db.repository.findUnique({ where: { id: body.data.repoId } });
    if (repo?.userId === userId) repoId = repo.id;
  }

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Foundry credits",
            description: "Prepaid usage credits — metered to the token, no markup.",
          },
          unit_amount: body.data.amountUsd * 100,
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      amountUsd: String(body.data.amountUsd),
      repoId,
      action: repoId ? (body.data.action ?? "") : "",
    },
    success_url: `${appUrl()}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: repoId ? `${appUrl()}/repos/${repoId}` : `${appUrl()}/`,
  });

  return NextResponse.json({ url: session.url });
}
