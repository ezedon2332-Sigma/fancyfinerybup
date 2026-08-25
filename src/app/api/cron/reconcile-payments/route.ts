import { NextResponse } from "next/server";

import { releaseAbandonedOrders, reconcilePendingPayments } from "@/infrastructure/payments/reconcile";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Payment reconciliation. Fired by the `ofelia` container in docker-compose,
 * which sends the CRON_SECRET bearer token.
 *
 * Re-verifies recently-started, still-unpaid charges directly with the provider
 * and settles any that actually succeeded — the backstop for a dropped webhook
 * where the customer also never returned to the callback.
 *
 * If CRON_SECRET is set, requires `Authorization: Bearer <CRON_SECRET>` (the
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
    // Order matters: settle anything that was actually paid FIRST, so the
    // release step below can never cancel an order that a lost webhook is
    // about to account for.
    const result = await reconcilePendingPayments();
    const released = await releaseAbandonedOrders();
    return NextResponse.json({ ok: true, ...result, abandoned: released });
  } catch (e) {
    console.error("[cron:reconcile-payments] failed", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
