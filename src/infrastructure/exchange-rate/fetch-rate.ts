import "server-only";

/**
 * Fetch the live USD→NGN rate.
 *
 * Keyless by default (ExchangeRate-API's free open endpoint — no key, no signup).
 * If EXCHANGE_RATE_API_KEY is set, uses the keyed ExchangeRate-API v6 endpoint
 * instead. The key is read server-side only and never reaches the client.
 *
 * Returns null on any failure so callers can keep the last known-good rate.
 */
export async function fetchLiveNgnPerUsd(): Promise<{
  rate: number;
  source: string;
} | null> {
  const key = process.env.EXCHANGE_RATE_API_KEY;

  try {
    if (key) {
      const res = await fetch(
        `https://v6.exchangerate-api.com/v6/${key}/pair/USD/NGN`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const j = await res.json();
        if (j?.result === "success" && typeof j.conversion_rate === "number") {
          return { rate: j.conversion_rate, source: "exchangerate-api.com" };
        }
      }
    }

    // Keyless fallback (always tried if no key or keyed call failed).
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      cache: "no-store",
    });
    if (res.ok) {
      const j = await res.json();
      const ngn = j?.rates?.NGN;
      if (typeof ngn === "number" && ngn > 0) {
        return { rate: ngn, source: "open.er-api.com" };
      }
    }
  } catch {
    /* network/parse error — caller falls back to the last stored rate */
  }
  return null;
}

/** NGN per 1 unit of USD / EUR / GBP, for the informational rate ticker. */
export interface DisplayRates {
  usd: number;
  eur: number;
  gbp: number;
}

export async function fetchDisplayRates(): Promise<DisplayRates | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      cache: "no-store",
    });
    if (res.ok) {
      const j = await res.json();
      const r = j?.rates;
      if (r?.NGN > 0 && r?.EUR > 0 && r?.GBP > 0) {
        // r.X = units of X per 1 USD. NGN per 1 EUR = (NGN/USD) / (EUR/USD).
        return {
          usd: Math.round(r.NGN),
          eur: Math.round(r.NGN / r.EUR),
          gbp: Math.round(r.NGN / r.GBP),
        };
      }
    }
  } catch {
    /* fall back handled by caller */
  }
  return null;
}
