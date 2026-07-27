import { Globe2, Layers, Truck } from "lucide-react";

import { requireAdmin } from "@/infrastructure/supabase/auth";
import { loadPricingTable } from "@/infrastructure/supabase/pricing-service";
import { COUNTRIES } from "@/domain/shipping/countries";
import {
  ShippingAdmin,
  type AdminBracket,
  type AdminCourier,
  type AdminZone,
} from "@/components/admin/ShippingAdmin";

export const metadata = { title: "Shipping" };

// Rates are edited here and quoted live elsewhere; a cached page would show an
// admin stale figures moments after they changed them.
export const dynamic = "force-dynamic";

export default async function AdminShippingPage() {
  await requireAdmin();
  const table = await loadPricingTable();

  const couriers: AdminCourier[] = table.couriers.map((c) => ({
    id: c.id,
    code: c.code,
    displayName: c.displayName,
    minDays: c.minDays,
    maxDays: c.maxDays,
    enabled: c.enabled,
  }));

  const zones: AdminZone[] = table.zones.map((z) => ({
    id: z.id,
    code: z.code,
    name: z.name,
    enabled: z.enabled,
    countries: z.countries,
  }));

  const brackets: AdminBracket[] = [...table.brackets]
    .sort((a, b) => a.minGrams - b.minGrams)
    .map((b) => ({
      id: b.id,
      label: b.label,
      minGrams: b.minGrams,
      maxGrams: b.maxGrams,
      sortOrder: b.sortOrder,
    }));

  const assigned = new Set(zones.flatMap((z) => z.countries));
  // Only the codes, not the rates: the matrix fetches cells on demand.
  const overriddenCodes = [
    ...new Set(
      table.rates
        .filter((r) => r.countryCode)
        .map((r) => r.countryCode!.toUpperCase()),
    ),
  ].sort();

  return (
    <div>
      <header>
        <p className="text-xs uppercase tracking-[4px] text-yellow-500">
          Fulfilment
        </p>
        <h1 className="mt-2 font-display text-3xl text-white">Shipping</h1>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-gray-400">
          Everything here is read live by the quote engine. A price changed on
          this page applies to the very next checkout — no deploy, no cache.
        </p>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Truck className="h-4 w-4" />} label="Couriers" value={couriers.filter((c) => c.enabled).length} />
        <Stat icon={<Globe2 className="h-4 w-4" />} label="Countries covered" value={assigned.size} />
        <Stat icon={<Layers className="h-4 w-4" />} label="Weight bands" value={brackets.length} />
        <Stat icon={<Truck className="h-4 w-4" />} label="Country overrides" value={overriddenCodes.length} />
      </div>

      <div className="mt-10">
        <ShippingAdmin
          couriers={couriers}
          zones={zones}
          brackets={brackets}
          overriddenCodes={overriddenCodes}
          countries={COUNTRIES.map((c) => ({ code: c.code, name: c.name }))}
        />
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center gap-2 text-yellow-500">{icon}</div>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-widest text-gray-500">
        {label}
      </p>
    </div>
  );
}
