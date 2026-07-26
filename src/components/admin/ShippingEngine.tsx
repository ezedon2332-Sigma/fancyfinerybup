"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Calculator, Loader2, Plus, Trash2, X } from "lucide-react";

import {
  assignCountries,
  deleteBracket,
  deleteMethod,
  deleteRate,
  deleteZone,
  previewShipping,
  saveBracket,
  saveChargeSettings,
  saveMethod,
  saveRate,
  saveZone,
  unassignCountry,
  type PreviewResult,
  type SEResult,
} from "@/app/admin/shipping/engine-actions";
import { COUNTRIES } from "@/domain/shipping/countries";
import { formatWeight, type RateTable } from "@/domain/shipping/engine";
import type { ShippingSettings } from "@/domain/shipping/shipping";

type Tab = "zones" | "methods" | "brackets" | "rates" | "charges" | "preview";

const TABS: { id: Tab; label: string }[] = [
  { id: "zones", label: "Zones & Countries" },
  { id: "methods", label: "Methods" },
  { id: "brackets", label: "Weight Brackets" },
  { id: "rates", label: "Rate Matrix" },
  { id: "charges", label: "Tax & Discount" },
  { id: "preview", label: "Preview" },
];

const field =
  "w-full rounded-sm border border-white/20 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-yellow-500";
const label = "text-[10px] uppercase tracking-widest text-gray-400";
const btn =
  "inline-flex items-center gap-2 rounded-sm border border-white/20 px-3 py-2 text-xs text-gray-200 transition-colors hover:border-yellow-500/60 hover:text-yellow-400 disabled:opacity-50";

/** Zone / country-override / weight-bracket rate management. */
export function ShippingEngine({
  table,
  settings,
}: {
  table: RateTable;
  settings: ShippingSettings;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("zones");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  /** Every mutation funnels through here so the notice and refresh are uniform. */
  async function run(fn: () => Promise<SEResult>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    setNotice({ ok: res.ok, text: res.ok ? (res.message ?? "Saved.") : (res.error ?? "Failed.") });
    if (res.ok) router.refresh();
  }

  return (
    <section className="rounded-xl border border-yellow-600/25 bg-white/[0.02] p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-white">Shipping engine</h2>
          <p className="mt-1 text-xs text-gray-500">
            Zones, country overrides and weight brackets. Rates here take
            precedence over the legacy per-country prices below.
          </p>
        </div>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />}
      </header>

      <nav className="mt-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id}
            className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
              tab === t.id
                ? "border-yellow-500 bg-yellow-500/15 text-yellow-200"
                : "border-white/15 text-gray-300 hover:border-yellow-600/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {notice && (
        <p
          className={`mt-4 rounded-lg border px-4 py-2.5 text-xs ${
            notice.ok
              ? "border-yellow-600/30 bg-yellow-500/5 text-yellow-200"
              : "border-red-500/40 bg-red-500/10 text-red-300"
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="mt-6">
        {tab === "zones" && <ZonesTab table={table} run={run} />}
        {tab === "methods" && <MethodsTab table={table} run={run} />}
        {tab === "brackets" && <BracketsTab table={table} run={run} />}
        {tab === "rates" && <RatesTab table={table} run={run} />}
        {tab === "charges" && <ChargesTab settings={settings} run={run} />}
        {tab === "preview" && <PreviewTab />}
      </div>
    </section>
  );
}

type Run = (fn: () => Promise<SEResult>) => Promise<void>;

/* --- Zones ------------------------------------------------------------------ */

function ZonesTab({ table, run }: { table: RateTable; run: Run }) {
  const [name, setName] = useState("");
  const [openZone, setOpenZone] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const assigned = new Set(table.zones.flatMap((z) => z.countries));

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block flex-1 min-w-[200px]">
          <span className={label}>New zone name</span>
          <input
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Scandinavia"
          />
        </label>
        <button
          type="button"
          className={btn}
          disabled={name.trim().length < 2}
          onClick={async () => {
            await run(() => saveZone({ name, enabled: true, sortOrder: 0 }));
            setName("");
          }}
        >
          <Plus className="h-3.5 w-3.5" /> Add zone
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {table.zones.length === 0 && (
          <p className="text-sm text-gray-500">
            No zones yet. Apply the shipping-engine migration, then add one above.
          </p>
        )}

        {table.zones.map((z) => (
          <div key={z.id} className="rounded-lg border border-white/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-white">
                  {z.name}
                  {!z.enabled && (
                    <span className="ml-2 rounded bg-white/10 px-2 py-0.5 text-[10px] uppercase text-gray-400">
                      disabled
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  {z.countries.length} {z.countries.length === 1 ? "country" : "countries"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={btn}
                  onClick={() =>
                    run(() =>
                      saveZone({
                        id: z.id,
                        name: z.name,
                        enabled: !z.enabled,
                        sortOrder: z.sortOrder,
                      }),
                    )
                  }
                >
                  {z.enabled ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  className={btn}
                  onClick={() => {
                    setOpenZone(openZone === z.id ? null : z.id);
                    setPicked([]);
                  }}
                >
                  {openZone === z.id ? "Close" : "Assign countries"}
                </button>
                <button
                  type="button"
                  className={`${btn} hover:border-red-500/60 hover:text-red-400`}
                  onClick={() => {
                    if (
                      confirm(
                        `Delete "${z.name}"? Its country assignments and rates go with it.`,
                      )
                    ) {
                      void run(() => deleteZone(z.id));
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {z.countries.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {z.countries.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-gray-300"
                  >
                    {COUNTRIES.find((x) => x.code === c)?.name ?? c}
                    <button
                      type="button"
                      aria-label={`Remove ${c}`}
                      onClick={() => run(() => unassignCountry(c))}
                      className="text-gray-500 hover:text-red-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {openZone === z.id && (
              <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-3">
                <p className="text-[11px] text-gray-400">
                  Pick countries to move into <strong>{z.name}</strong>. A country
                  already in another zone is moved, not duplicated.
                </p>
                <select
                  multiple
                  size={10}
                  value={picked}
                  onChange={(e) =>
                    setPicked(
                      [...e.target.selectedOptions].map((o) => o.value),
                    )
                  }
                  className={`${field} mt-3 h-56`}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code} className="bg-neutral-950">
                      {c.name}
                      {assigned.has(c.code) && !z.countries.includes(c.code)
                        ? " — (in another zone)"
                        : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`${btn} mt-3`}
                  disabled={picked.length === 0}
                  onClick={async () => {
                    await run(() => assignCountries(z.id, picked));
                    setPicked([]);
                  }}
                >
                  Assign {picked.length > 0 ? `${picked.length} ` : ""}selected
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* --- Methods ----------------------------------------------------------------- */

function MethodsTab({ table, run }: { table: RateTable; run: Run }) {
  const [name, setName] = useState("");
  const [minDays, setMinDays] = useState(1);
  const [maxDays, setMaxDays] = useState(4);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block flex-1 min-w-[180px]">
          <span className={label}>Method name</span>
          <input
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. DHL Express"
          />
        </label>
        <label className="block w-24">
          <span className={label}>Min days</span>
          <input
            type="number"
            min={0}
            className={field}
            value={minDays}
            onChange={(e) => setMinDays(Number(e.target.value))}
          />
        </label>
        <label className="block w-24">
          <span className={label}>Max days</span>
          <input
            type="number"
            min={0}
            className={field}
            value={maxDays}
            onChange={(e) => setMaxDays(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          className={btn}
          disabled={name.trim().length < 2}
          onClick={async () => {
            await run(() =>
              saveMethod({
                name,
                minDays,
                maxDays,
                enabled: true,
                rateSource: "table",
                sortOrder: table.methods.length * 10,
              }),
            );
            setName("");
          }}
        >
          <Plus className="h-3.5 w-3.5" /> Add method
        </button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-widest text-gray-400">
            <tr>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Pricing</th>
              <th className="px-4 py-3">Transit</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {table.methods.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No shipping methods yet.
                </td>
              </tr>
            )}
            {table.methods.map((m) => (
              <tr key={m.id} className="border-t border-white/5">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{m.name}</div>
                  <div className="text-xs text-gray-500">{m.code}</div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {m.rateSource === "carrier"
                    ? `Live · ${m.carrierCode}`
                    : "Rate table"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-300">
                  {m.minDays}–{m.maxDays} days
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${
                      m.enabled
                        ? "bg-green-500/15 text-green-300"
                        : "bg-white/10 text-gray-400"
                    }`}
                  >
                    {m.enabled ? "on" : "off"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className={btn}
                      onClick={() =>
                        run(() =>
                          saveMethod({
                            id: m.id,
                            name: m.name,
                            description: m.description,
                            rateSource: m.rateSource,
                            carrierCode: m.carrierCode,
                            enabled: !m.enabled,
                            minDays: m.minDays,
                            maxDays: m.maxDays,
                            sortOrder: m.sortOrder,
                          }),
                        )
                      }
                    >
                      {m.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      className={`${btn} hover:border-red-500/60 hover:text-red-400`}
                      onClick={() => {
                        if (confirm(`Delete "${m.name}" and its rates?`)) {
                          void run(() => deleteMethod(m.id));
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --- Brackets ------------------------------------------------------------------ */

function BracketsTab({ table, run }: { table: RateTable; run: Run }) {
  const [labelText, setLabelText] = useState("");
  const [min, setMin] = useState(0);
  const [max, setMax] = useState<string>("");

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block flex-1 min-w-[160px]">
          <span className={label}>Label</span>
          <input
            className={field}
            value={labelText}
            onChange={(e) => setLabelText(e.target.value)}
            placeholder="e.g. 20 – 30 kg"
          />
        </label>
        <label className="block w-28">
          <span className={label}>From (kg)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className={field}
            value={min}
            onChange={(e) => setMin(Number(e.target.value))}
          />
        </label>
        <label className="block w-28">
          <span className={label}>To (kg)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className={field}
            value={max}
            onChange={(e) => setMax(e.target.value)}
            placeholder="∞"
          />
        </label>
        <button
          type="button"
          className={btn}
          disabled={labelText.trim().length === 0}
          onClick={async () => {
            await run(() =>
              saveBracket({
                label: labelText,
                min,
                max: max === "" ? null : Number(max),
                unit: "kg",
              }),
            );
            setLabelText("");
            setMax("");
          }}
        >
          <Plus className="h-3.5 w-3.5" /> Add bracket
        </button>
      </div>
      <p className="mt-2 text-[11px] text-gray-500">
        Leave “To” empty for the open-ended top bracket. Ranges are inclusive of
        the lower bound and exclusive of the upper, so exactly 1 kg falls into
        the 1–2 kg band.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {table.brackets.length === 0 && (
          <p className="text-sm text-gray-500">No weight brackets configured.</p>
        )}
        {table.brackets.map((b) => (
          <span
            key={b.id}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs text-gray-200"
          >
            <strong className="text-yellow-400">{b.label}</strong>
            <span className="text-gray-500">
              {formatWeight(b.minGrams)} –{" "}
              {b.maxGrams == null ? "∞" : formatWeight(b.maxGrams)}
            </span>
            <button
              type="button"
              aria-label={`Delete ${b.label}`}
              onClick={() => {
                if (confirm(`Delete bracket "${b.label}" and its rates?`)) {
                  void run(() => deleteBracket(b.id));
                }
              }}
              className="text-gray-500 hover:text-red-400"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

/* --- Rate matrix ------------------------------------------------------------------ */

function RatesTab({ table, run }: { table: RateTable; run: Run }) {
  const [scope, setScope] = useState<string>(
    table.zones[0] ? `zone:${table.zones[0].id}` : "",
  );
  const [methodId, setMethodId] = useState<string>(table.methods[0]?.id ?? "");

  const [kind, id] = scope.split(":");
  const isCountry = kind === "country";

  const rateFor = (bracketId: string) =>
    table.rates.find(
      (r) =>
        r.methodId === methodId &&
        r.bracketId === bracketId &&
        (isCountry
          ? r.countryCode?.toUpperCase() === id
          : r.zoneId === id),
    ) ?? null;

  if (table.methods.length === 0 || table.brackets.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Add at least one shipping method and one weight bracket before setting
        rates.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <label className="block min-w-[220px] flex-1">
          <span className={label}>Zone or country override</span>
          <select
            className={field}
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <optgroup label="Zones">
              {table.zones.map((z) => (
                <option key={z.id} value={`zone:${z.id}`} className="bg-neutral-950">
                  {z.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Country overrides">
              {COUNTRIES.map((c) => (
                <option
                  key={c.code}
                  value={`country:${c.code}`}
                  className="bg-neutral-950"
                >
                  {c.name} (override)
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label className="block min-w-[180px] flex-1">
          <span className={label}>Method</span>
          <select
            className={field}
            value={methodId}
            onChange={(e) => setMethodId(e.target.value)}
          >
            {table.methods.map((m) => (
              <option key={m.id} value={m.id} className="bg-neutral-950">
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isCountry && (
        <p className="mt-3 rounded-lg border border-yellow-600/25 bg-yellow-500/5 px-4 py-2.5 text-[11px] text-yellow-200">
          A country override wins over that country&apos;s zone rate for the same
          method and bracket. Leave a bracket blank to fall back to the zone.
        </p>
      )}

      <div className="mt-5 overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-widest text-gray-400">
            <tr>
              <th className="px-4 py-3">Weight bracket</th>
              <th className="px-4 py-3">Price (₦)</th>
              <th className="px-4 py-3">Free over (₦)</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {table.brackets.map((b) => (
              <RateRow
                key={`${scope}-${methodId}-${b.id}`}
                bracketLabel={b.label}
                existing={rateFor(b.id)}
                onSave={(priceNaira, freeOverNaira) =>
                  run(() =>
                    saveRate({
                      zoneId: isCountry ? null : id,
                      countryCode: isCountry ? id : null,
                      methodId,
                      bracketId: b.id,
                      priceNaira,
                      freeOverNaira,
                    }),
                  )
                }
                onClear={(rateId) => run(() => deleteRate(rateId))}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RateRow({
  bracketLabel,
  existing,
  onSave,
  onClear,
}: {
  bracketLabel: string;
  existing: { id: string; price: number; freeOver: number | null } | null;
  onSave: (priceNaira: number, freeOverNaira: number | null) => Promise<void>;
  onClear: (rateId: string) => Promise<void>;
}) {
  const [price, setPrice] = useState(existing ? existing.price / 100 : 0);
  const [freeOver, setFreeOver] = useState(
    existing?.freeOver != null ? String(existing.freeOver / 100) : "",
  );

  return (
    <tr className="border-t border-white/5">
      <td className="px-4 py-3 text-gray-200">{bracketLabel}</td>
      <td className="px-4 py-3">
        <input
          type="number"
          min={0}
          step="0.01"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className={`${field} w-32`}
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min={0}
          step="0.01"
          value={freeOver}
          onChange={(e) => setFreeOver(e.target.value)}
          placeholder="—"
          className={`${field} w-32`}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={btn}
            onClick={() =>
              onSave(price, freeOver === "" ? null : Number(freeOver))
            }
          >
            Save
          </button>
          {existing && (
            <button
              type="button"
              className={`${btn} hover:border-red-500/60 hover:text-red-400`}
              onClick={() => onClear(existing.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/* --- Tax & discount ------------------------------------------------------------------ */

function ChargesTab({
  settings,
  run,
}: {
  settings: ShippingSettings;
  run: Run;
}) {
  const [taxEnabled, setTaxEnabled] = useState(settings.taxEnabled);
  const [taxPercent, setTaxPercent] = useState(settings.taxRateBps / 100);
  const [taxLabel, setTaxLabel] = useState(settings.taxLabel);
  const [discountEnabled, setDiscountEnabled] = useState(settings.discountEnabled);
  const [discountPercent, setDiscountPercent] = useState(settings.discountBps / 100);
  const [discountLabel, setDiscountLabel] = useState(settings.discountLabel);
  const [defaultWeight, setDefaultWeight] = useState(
    settings.defaultItemWeightGrams,
  );

  return (
    <div className="max-w-2xl space-y-6">
      <fieldset className="rounded-lg border border-white/10 p-4">
        <legend className="px-2 text-xs uppercase tracking-widest text-yellow-500">
          Tax / VAT
        </legend>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={taxEnabled}
            onChange={(e) => setTaxEnabled(e.target.checked)}
            className="h-4 w-4 accent-yellow-500"
          />
          <span className="text-sm text-gray-200">Charge tax at checkout</span>
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Rate (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              className={field}
              value={taxPercent}
              onChange={(e) => setTaxPercent(Number(e.target.value))}
            />
          </label>
          <label className="block">
            <span className={label}>Label</span>
            <input
              className={field}
              value={taxLabel}
              onChange={(e) => setTaxLabel(e.target.value)}
            />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-gray-500">
          Applied to goods less discount, plus shipping.
        </p>
      </fieldset>

      <fieldset className="rounded-lg border border-white/10 p-4">
        <legend className="px-2 text-xs uppercase tracking-widest text-yellow-500">
          Discount
        </legend>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={discountEnabled}
            onChange={(e) => setDiscountEnabled(e.target.checked)}
            className="h-4 w-4 accent-yellow-500"
          />
          <span className="text-sm text-gray-200">
            Apply a store-wide discount
          </span>
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Rate (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              className={field}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
            />
          </label>
          <label className="block">
            <span className={label}>Label</span>
            <input
              className={field}
              value={discountLabel}
              onChange={(e) => setDiscountLabel(e.target.value)}
            />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-gray-500">
          Taken off the product subtotal before tax.
        </p>
      </fieldset>

      <label className="block max-w-xs">
        <span className={label}>Default parcel weight (g)</span>
        <input
          type="number"
          min={0}
          className={field}
          value={defaultWeight}
          onChange={(e) => setDefaultWeight(Number(e.target.value))}
        />
        <span className="mt-1 block text-[11px] text-gray-500">
          Used for products with no weight recorded, so a catalogue gap
          over-estimates postage rather than shipping for free.
        </span>
      </label>

      <button
        type="button"
        className="btn-gold !px-8 !py-3"
        onClick={() =>
          run(() =>
            saveChargeSettings({
              taxEnabled,
              taxPercent,
              taxLabel,
              discountEnabled,
              discountPercent,
              discountLabel,
              defaultItemWeightGrams: defaultWeight,
            }),
          )
        }
      >
        <span className="relative z-10">Save settings</span>
      </button>
    </div>
  );
}

/* --- Preview ------------------------------------------------------------------ */

function PreviewTab() {
  const [countryCode, setCountryCode] = useState("US");
  const [weight, setWeight] = useState(1.5);
  const [subtotal, setSubtotal] = useState(150000);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function go() {
    setLoading(true);
    setResult(
      await previewShipping({ countryCode, weight, unit: "kg", subtotalNaira: subtotal }),
    );
    setLoading(false);
  }

  return (
    <div>
      <p className="text-xs text-gray-500">
        Runs the same calculation checkout uses, so what you see here is what a
        customer would be charged.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block min-w-[200px] flex-1">
          <span className={label}>Destination</span>
          <select
            className={field}
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code} className="bg-neutral-950">
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block w-32">
          <span className={label}>Weight (kg)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className={field}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
          />
        </label>
        <label className="block w-40">
          <span className={label}>Subtotal (₦)</span>
          <input
            type="number"
            min={0}
            className={field}
            value={subtotal}
            onChange={(e) => setSubtotal(Number(e.target.value))}
          />
        </label>
        <button type="button" className={btn} onClick={go} disabled={loading}>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Calculator className="h-3.5 w-3.5" />
          )}
          Calculate
        </button>
      </div>

      {result && (
        <div className="mt-6 rounded-lg border border-white/10 p-4">
          {!result.ok ? (
            <p className="text-sm text-red-400">{result.error}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
                <span>
                  Zone:{" "}
                  <strong className="text-gray-200">
                    {result.zoneName ?? "unassigned"}
                  </strong>
                </span>
                <span>
                  Bracket:{" "}
                  <strong className="text-gray-200">
                    {result.bracketLabel ?? "none"}
                  </strong>
                </span>
                <span>
                  Weight:{" "}
                  <strong className="text-gray-200">
                    {formatWeight(result.weightGrams ?? 0)}
                  </strong>
                </span>
              </div>

              {result.options && result.options.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {result.options.map((o) => (
                    <li
                      key={o.method}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/10 px-3 py-2 text-sm"
                    >
                      <span className="text-white">{o.method}</span>
                      <span className="text-xs text-gray-500">
                        {o.source} · {o.days}
                      </span>
                      <span className="font-semibold text-yellow-400">
                        {o.free ? "FREE" : `₦${o.priceNaira.toLocaleString()}`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-amber-300">
                  No rate configured for this destination and weight — checkout
                  would fall back to the legacy per-country price.
                </p>
              )}

              {result.totals && (
                <dl className="mt-5 space-y-1 border-t border-white/10 pt-3 text-sm">
                  <Row k="Product subtotal" v={result.totals.subtotal} />
                  {result.totals.discount > 0 && (
                    <Row k="Discount" v={-result.totals.discount} />
                  )}
                  <Row k="Shipping (cheapest)" v={result.totals.shipping} />
                  {result.totals.tax > 0 && <Row k="Tax" v={result.totals.tax} />}
                  <div className="flex justify-between border-t border-white/10 pt-2 font-semibold text-white">
                    <dt>Grand total</dt>
                    <dd>₦{result.totals.total.toLocaleString()}</dd>
                  </div>
                </dl>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between text-gray-300">
      <dt>{k}</dt>
      <dd>₦{v.toLocaleString()}</dd>
    </div>
  );
}
