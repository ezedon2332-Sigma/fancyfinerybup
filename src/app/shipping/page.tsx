import type { Metadata } from "next";
import Link from "next/link";
import { Package, Truck } from "lucide-react";

import { loadCountryRates } from "@/infrastructure/supabase/rate-card";
import {
  RatesBrowser,
  type CountryRates,
} from "@/components/shipping/RatesBrowser";

export const metadata: Metadata = {
  title: "Shipping Rates",
  description:
    "UPS delivery rates by destination and parcel weight for Fancy Finery. Estimate your shipping before you shop.",
};

export default async function ShippingRatesPage() {
  const rates: CountryRates[] = await loadCountryRates();

  return (
    <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
      <header className="mx-auto max-w-2xl text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-yellow-600/40 px-4 py-1.5 text-[10px] uppercase tracking-[0.3em] text-yellow-500">
          <Truck className="h-3 w-3" /> Worldwide Delivery
        </p>
        <h1 className="brand-wordmark mt-7 text-3xl leading-tight tracking-[0.04em] sm:text-4xl">
          Shipping Rates
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-gray-300 sm:text-base">
          Delivery is priced by destination and parcel weight. Choose a country
          to see every band before you shop — your exact cost is confirmed at
          checkout with nothing added afterwards.
        </p>
      </header>

      <div className="mx-auto mt-12 max-w-3xl">
        <RatesBrowser rates={rates} />
      </div>

      <footer className="mx-auto mt-16 max-w-2xl rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
        <Package className="mx-auto h-5 w-5 text-yellow-500" />
        <p className="mt-3 text-xs leading-relaxed text-gray-400">
          Weight ranges include their upper limit — a parcel of exactly 2 kg is
          charged the “up to 2 kg” rate. Destinations not listed are quoted
          individually; for those, or for consignments above the heaviest band,
          please{" "}
          <Link href="/contact" className="text-yellow-400 underline">
            contact us
          </Link>
          .
        </p>
      </footer>
    </div>
  );
}
