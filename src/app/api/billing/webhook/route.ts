import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { billingEnabled, stripe, creditPurchase } from "@/lib/billing";

/**
 * Stripe webhook (production path). Local dev doesn't need this — the
 * /billing/success page verifies and credits the session directly.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!billingEnabled() || !secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 501 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const amountUsd = Number(session.metadata?.amountUsd);
    if (userId && amountUsd > 0 && session.payment_status === "paid") {
      await creditPurchase(userId, amountUsd, session.id);
    }
  }

  return NextResponse.json({ received: true });
}
