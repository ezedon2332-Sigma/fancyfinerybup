import { startPaymentAction } from "@/app/checkout/payment-actions";

import { requireUser } from "../../../../../_lib/context";
import { fail, handler, ok } from "../../../../../_lib/respond";

/**
 * POST /api/mobile/v1/checkout/orders/[id]/pay
 *
 * Returns the provider's hosted payment URL. The app opens it in a Custom Tab
 * (Android) or `SFSafariViewController` (iOS) rather than a WebView, so the
 * customer keeps a real address bar and TLS indicator in front of a card form —
 * which is both what the providers require and what app review looks for.
 *
 * This delegates to the website's own `startPaymentAction` instead of
 * reimplementing it. That action is an ordinary async function; the `"use
 * server"` directive only additionally exposes it to the browser. Reusing it
 * keeps ONE implementation of the ownership check, the already-paid and
 * already-refunded guards, the provider routing, the reference generation and
 * the ledger write — none of which should ever differ between a phone and a
 * browser.
 *
 * **How the app learns the payment succeeded.** Not from this call, and not
 * from the redirect. The provider's callback lands on the website, and the
 * authoritative confirmation is the webhook (with the nightly reconcile sweep
 * behind it). So the app polls `GET /checkout/orders/{id}/status` after the tab
 * closes. That is deliberate: a customer who kills the app on the payment page
 * still gets a paid order, because nothing about settlement depends on the
 * client coming back.
 */
export const POST = handler(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    // Establish the caller before doing anything else. The action re-checks
    // ownership itself — this is here so an unauthenticated request gets a
    // clean 401 rather than the action's generic error string.
    await requireUser();

    const { id } = await ctx.params;
    const result = await startPaymentAction(id);

    if (!result.ok || !result.url) {
      // "Not your order" and "already paid" both arrive here as plain strings.
      // They are reported as a conflict rather than a server error: the request
      // was well-formed, the order's state is simply not payable.
      return fail(
        "payment_unavailable",
        result.error ?? "Could not start payment.",
      );
    }

    return ok({ paymentUrl: result.url });
  },
);
