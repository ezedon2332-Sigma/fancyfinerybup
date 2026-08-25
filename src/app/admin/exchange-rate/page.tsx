import type { Metadata } from "next";

import { requireAdmin } from "@/infrastructure/auth/session";
import { loadExchangeRates } from "@/infrastructure/db/exchange-rate-service";
import { ExchangeRatePanel } from "@/components/admin/ExchangeRatePanel";

export const metadata: Metadata = { title: "Admin · Exchange Rates" };

// Always read the live figures: an admin changing a rate expects to see it, and
// the storefront is pricing from the same row in real time.
export const dynamic = "force-dynamic";

export default async function ExchangeRatePage() {
  await requireAdmin();
  const rates = await loadExchangeRates();

  return (
    <div>
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[4px] text-yellow-500">Pricing</p>
        <h1 className="mt-1 text-2xl font-bold">Exchange Rates</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-400">
          Catalogue prices are stored in naira. These rates decide what a shopper
          in another currency is shown <em>and charged</em> — there is no separate
          conversion at checkout, so the price on the tag is the price paid.
        </p>
      </header>

      <ExchangeRatePanel initial={rates} />
    </div>
  );
}
