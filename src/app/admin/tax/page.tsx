import { Percent } from "lucide-react";

import { requireAdmin } from "@/infrastructure/supabase/auth";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import {
  TaxRulesPanel,
  type TaxRuleRow,
  type ZoneOption,
} from "@/components/admin/TaxRulesPanel";

export const metadata = { title: "Tax" };

// Always read the live rules: an admin changing a rate expects to see it, and
// checkout is pricing from the same rows in real time.
export const dynamic = "force-dynamic";

export default async function AdminTaxPage() {
  await requireAdmin();
  const db = createSupabaseAdminClient();

  const [rulesRes, zonesRes] = await Promise.all([
    db.from("tax_rules").select("*"),
    db.from("shipping_zones").select("id, name").order("sort_order"),
  ]);

  const zones: ZoneOption[] = (zonesRes.data ?? []).map((z) => ({
    id: z.id,
    name: z.name,
  }));
  const zoneName = new Map(zones.map((z) => [z.id, z.name]));

  const rules: TaxRuleRow[] = (rulesRes.data ?? [])
    .map((r) => ({
      id: r.id,
      scope: r.scope,
      countryCode: r.country_code,
      zoneId: r.zone_id,
      zoneName: r.zone_id ? (zoneName.get(r.zone_id) ?? null) : null,
      rateBps: r.rate_bps,
      label: r.label,
      appliesToShipping: r.applies_to_shipping,
      enabled: r.enabled,
    }))
    // Most specific first, mirroring how the engine resolves them.
    .sort((a, b) => {
      const rank = { country: 0, zone: 1, global: 2 } as const;
      return rank[a.scope] - rank[b.scope];
    });

  const active = rules.filter((r) => r.enabled).length;

  return (
    <div>
      <header>
        <p className="text-xs uppercase tracking-[4px] text-yellow-500">
          Pricing
        </p>
        <h1 className="mt-2 font-display text-3xl text-white">Tax</h1>
      </header>

      <div className="mt-6 flex flex-wrap gap-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4">
          <div className="flex items-center gap-2 text-yellow-500">
            <Percent className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{active}</p>
          <p className="mt-1 text-[11px] uppercase tracking-widest text-gray-500">
            Active rules
          </p>
        </div>
        <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4">
          <p className="text-[11px] uppercase tracking-widest text-gray-500">
            How it reaches customers
          </p>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-gray-400">
            Rates are stored in basis points and read fresh on every quote and
            every order. Change one here and the next checkout uses it — no
            deploy, no cache to clear, and no percentage written anywhere in
            the code.
          </p>
        </div>
      </div>

      <div className="mt-10">
        <TaxRulesPanel rules={rules} zones={zones} />
      </div>
    </div>
  );
}
