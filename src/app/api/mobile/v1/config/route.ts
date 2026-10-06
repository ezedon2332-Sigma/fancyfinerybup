import {
  CURRENCY_META,
  DISPLAY_CURRENCIES,
} from "@/domain/shared/display-price";
import { isCurrencyPayable } from "@/infrastructure/payments/providers";
import { SITE_NAME, SITE_URL } from "@/lib/site";

import { handler, ok } from "../../_lib/respond";

/**
 * GET /api/mobile/v1/config — what the app needs to know before it can trade.
 *
 * Called once at launch and cached. It exists so that facts which change
 * without an app release are not frozen into a shipped binary:
 *
 *  - **Which currencies can actually be charged.** `isCurrencyPayable` is the
 *    same routing the checkout uses, so a currency with no live provider is
 *    reported as pay-on-delivery here rather than discovered by the customer at
 *    the payment step. Paystack dropping USD was exactly this: a routing fact
 *    that changed with no code shipped to a phone.
 *
 *  - **The minimum supported build.** An app store cannot recall a broken
 *    release; this lets the server tell an old client to update, which is the
 *    only lever available once a binary is out.
 */
export const GET = handler(async () => {
  return ok({
    siteName: SITE_NAME,
    siteUrl: SITE_URL,
    currencies: DISPLAY_CURRENCIES.map((code) => ({
      code,
      symbol: CURRENCY_META[code].symbol,
      name: CURRENCY_META[code].name,
      flag: CURRENCY_META[code].flag,
      /** False → orders in this currency are placed as pay-on-delivery. */
      payable: isCurrencyPayable(code),
    })),
    /**
     * Bump when an older build can no longer talk to this API correctly. The
     * app compares its own versionCode and blocks with an update prompt.
     */
    minimumBuild: 1,
  });
});
