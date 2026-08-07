import { NextResponse } from "next/server";

import { reconcilePendingPayments } from "@/infrastructure/payments/reconcile";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Payment reconciliation (Vercel Cron → see vercel.json).
 *
 * Re-verifies recently-started, still-unpaid charges directly with the provider
 * and settles any that actually succeeded — the backstop for a dropped webhook
 * where the customer also never returned to the callback.
 *
 * If CRON_SECRET is set, requires `Authorization: Bearer <CRON_SECRET>` (Vercel
 * sends this automatically for scheduled invocations).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  try {
    const result = await reconcilePendingPayments();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[cron:reconcile-payments] failed", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
