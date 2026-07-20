import type { Metadata } from "next";

import { getExchangeRate } from "@/infrastructure/exchange-rate/service";
import { ExchangeRateManager } from "@/components/admin/ExchangeRateManager";
import type { ExchangeRate } from "@/domain/exchange-rate";
import { DEFAULT_NGN_PER_USD } from "@/domain/shipping/currency";

export const metadata: Metadata = { title: "Admin · Exchange Rate" };

export default async function AdminExchangeRatePage() {
  let rate: ExchangeRate = {
    ngnPerUsd: DEFAULT_NGN_PER_USD,
    mode: "auto",
    source: null,
    updatedAt: null,
  };
  try {
    rate = await getExchangeRate();
  } catch {
    /* settings unavailable — show defaults */
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Exchange Rate</h1>
      <p className="mt-1 text-sm text-gray-400">
        Live USD → NGN rate used for currency display across the store. Auto mode
        refreshes hourly from a live provider; manual mode pins your own rate.
      </p>
      <div className="mt-6">
        <ExchangeRateManager rate={rate} />
      </div>
    </div>
  );
}
