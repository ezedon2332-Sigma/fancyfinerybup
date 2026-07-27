"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Globe2, Loader2, Plus, Power, Trash2, Truck, Weight } from "lucide-react";

import {
  deleteBracket,
  deleteZone,
  saveBracket,
  saveCourier,
  saveRate,
  saveZone,
  setZoneCountries,
} from "@/app/admin/shipping/actions";
import { flagEmoji } from "@/domain/shipping/countries";
import { formatWeight } from "@/domain/shipping/pricing";

export interface AdminCourier {
  id: string;
  code: string;
  displayName: string;
  minDays: number;
  maxDays: number;
  enabled: boolean;
}
export interface AdminZone {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
  countries: string[];
}
export interface AdminBracket {
  id: string;
  label: string;
  minGrams: number;
  maxGrams: number | null;
  sortOrder: number;
}
export interface AdminRate {
  zoneId: string | null;
  countryCode: string | null;
  courierId: string;
  bracketId: string;
  priceNaira: number;
}
export interface CountryChoice {
  code: string;
  name: string;
}

type Tab = "rates" | "zones" | "bands" | "couriers";

export function ShippingAdmin({
  couriers,
  zones,
  brackets,
  rates,
  countries,
}: {
  couriers: AdminCourier[];
  zones: AdminZone[];
  brackets: AdminBracket[];
  rates: AdminRate[];
  countries: CountryChoice[];
}) {
  const [tab, setTab] = useState<Tab>("rates");
  const [notice, setNotice] = useState<string | null>(null);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "rates", label: "Rates", icon: <Truck className="h-3.5 w-3.5" /> },
    { id: "zones", label: "Zones & Countries", icon: <Globe2 className="h-3.5 w-3.5" /> },
    { id: "bands", label: "Weight Bands", icon: <Weight className="h-3.5 w-3.5" /> },
    { id: "couriers", label: "Couriers", icon: <Truck className="h-3.5 w-3.5" /> },
  ];

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-white/10">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-xs uppercase tracking-widest transition-colors ${
              tab === t.id
                ? "border-yellow-500 text-yellow-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {notice && (
        <p className="mt-4 rounded-lg border border-yellow-600/30 bg-yellow-500/5 px-4 py-2.5 text-xs text-yellow-200">
          {notice}
        </p>
      )}

      <div className="mt-6">
        {tab === "rates" && (
          <RateMatrix
            couriers={couriers}
            zones={zones}
            brackets={brackets}
            rates={rates}
            countries={countries}
            onNotice={setNotice}
          />
        )}
        {tab === "zones" && (
          <ZonesPanel zones={zones} countries={countries} onNotice={setNotice} />
        )}
        {tab === "bands" && <BandsPanel brackets={brackets} onNotice={setNotice} />}
        {tab === "couriers" && <CouriersPanel couriers={couriers} onNotice={setNotice} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function RateMatrix({
  couriers,
  zones,
  brackets,
  rates,
  countries,
  onNotice,
}: {
  couriers: AdminCourier[];
  zones: AdminZone[];
  brackets: AdminBracket[];
  rates: AdminRate[];
  countries: CountryChoice[];
  onNotice: (m: string) => void;
}) {
  const router = useRouter();
  const [courierId, setCourierId] = useState(couriers[0]?.id ?? "");
  // A scope is either "zone:<id>" or "country:<CODE>".
  const [scope, setScope] = useState(zones[0] ? `zone:${zones[0].id}` : "");
  const [saving, setSaving] = useState<string | null>(null);

  const [kind, code] = scope.split(":");
  const zoneId = kind === "zone" ? code : null;
  const countryCode = kind === "country" ? code : null;

  const current = new Map(
    rates
      .filter(
        (r) =>
          r.courierId === courierId &&
          (countryCode
            ? r.countryCode?.toUpperCase() === countryCode
            : r.zoneId === zoneId && !r.countryCode),
      )
      .map((r) => [r.bracketId, r.priceNaira]),
  );

  async function onBlurSave(bracketId: string, raw: string) {
    const trimmed = raw.trim();
    const priceNaira = trimmed === "" ? null : Number(trimmed);
    if (priceNaira !== null && !Number.isFinite(priceNaira)) return;
    if (priceNaira === (current.get(bracketId) ?? null)) return; // unchanged

    setSaving(bracketId);
    const res = await saveRate({
      courierId,
      bracketId,
      zoneId,
      countryCode,
      priceNaira,
      freeOverNaira: null,
    });
    setSaving(null);
    if (!res.ok) onNotice(res.error ?? "Could not save that rate.");
    else router.refresh();
  }

  // Countries that already carry an override, so they are easy to find again.
  const overridden = [
    ...new Set(rates.filter((r) => r.countryCode).map((r) => r.countryCode!.toUpperCase())),
  ].sort();

  return (
    <section>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelCls}>Courier</span>
          <select
            value={courierId}
            onChange={(e) => setCourierId(e.target.value)}
            className={input}
          >
            {couriers.map((c) => (
              <option key={c.id} value={c.id} className="bg-neutral-950">
                {c.displayName}
                {c.enabled ? "" : " (disabled)"}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelCls}>Pricing for</span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className={input}
          >
            <optgroup label="Zones">
              {zones.map((z) => (
                <option key={z.id} value={`zone:${z.id}`} className="bg-neutral-950">
                  {z.name} ({z.countries.length} countries)
                </option>
              ))}
            </optgroup>
            <optgroup label="Country overrides">
              {overridden.map((c) => (
                <option key={c} value={`country:${c}`} className="bg-neutral-950">
                  {countries.find((x) => x.code === c)?.name ?? c} — override
                </option>
              ))}
            </optgroup>
            <optgroup label="Add a country override">
              {countries
                .filter((c) => !overridden.includes(c.code))
                .map((c) => (
                  <option key={c.code} value={`country:${c.code}`} className="bg-neutral-950">
                    {c.name}
                  </option>
                ))}
            </optgroup>
          </select>
        </label>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-gray-500">
        {countryCode
          ? "A country override beats its zone rate — this is how two countries in the same region can price differently."
          : "Applies to every country in this zone that has no override of its own."}{" "}
        Prices are in Naira. Clear a box to remove that band, so the engine
        falls back rather than quoting zero.
      </p>

      <div className="mt-5 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-widest text-gray-400">
            <tr>
              <th className="px-4 py-3">Weight band</th>
              <th className="px-4 py-3 text-right">Price (₦)</th>
            </tr>
          </thead>
          <tbody>
            {brackets.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-10 text-center text-gray-500">
                  No weight bands yet — add some under Weight Bands.
                </td>
              </tr>
            )}
            {brackets.map((b) => (
              <tr key={b.id} className="border-t border-white/5">
                <th scope="row" className="px-4 py-2 text-sm font-normal text-gray-300">
                  {b.label}
                  <span className="ml-2 text-[10px] text-gray-600">
                    {formatWeight(b.minGrams)} –{" "}
                    {b.maxGrams === null ? "∞" : formatWeight(b.maxGrams)}
                  </span>
                </th>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {saving === b.id && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" />
                    )}
                    <input
                      key={`${courierId}-${scope}-${b.id}-${current.get(b.id) ?? ""}`}
                      type="number"
                      min="0"
                      step="100"
                      defaultValue={current.get(b.id) ?? ""}
                      onBlur={(e) => onBlurSave(b.id, e.target.value)}
                      placeholder="—"
                      aria-label={`Price for ${b.label}`}
                      className="w-36 rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-right text-sm tabular-nums text-white outline-none focus:border-yellow-500/70"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function ZonesPanel({
  zones,
  countries,
  onNotice,
}: {
  zones: AdminZone[];
  countries: CountryChoice[];
  onNotice: (m: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  function openEditor(z: AdminZone) {
    setEditing(z.id);
    setPicked(z.countries);
    setQuery("");
  }

  async function onSaveCountries(zoneId: string) {
    setBusy(zoneId);
    const res = await setZoneCountries({ zoneId, countryCodes: picked });
    setBusy(null);
    onNotice(res.ok ? (res.message ?? "Saved.") : (res.error ?? "Failed."));
    if (res.ok) {
      setEditing(null);
      router.refresh();
    }
  }

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy("new");
    const res = await saveZone({
      code: String(fd.get("code") ?? ""),
      name: String(fd.get("name") ?? ""),
      enabled: true,
    });
    setBusy(null);
    onNotice(res.ok ? (res.message ?? "Saved.") : (res.error ?? "Failed."));
    if (res.ok) {
      setAdding(false);
      router.refresh();
    }
  }

  const filtered = query
    ? countries.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.code.toLowerCase() === query.toLowerCase(),
      )
    : countries;

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl text-white">Zones</h2>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-gray-200 transition-colors hover:border-yellow-500/60 hover:text-yellow-400"
        >
          <Plus className="h-3.5 w-3.5" /> {adding ? "Cancel" : "New zone"}
        </button>
      </div>

      {adding && (
        <form
          onSubmit={onAdd}
          className="mt-4 grid gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <label className="block">
            <span className={labelCls}>Name</span>
            <input name="name" required placeholder="Middle East" className={input} />
          </label>
          <label className="block">
            <span className={labelCls}>Code</span>
            <input name="code" required placeholder="middle-east" className={input} />
          </label>
          <button
            type="submit"
            disabled={busy === "new"}
            className="btn-gold !px-6 !py-3 disabled:opacity-60"
          >
            <span className="relative z-10">Add</span>
          </button>
        </form>
      )}

      <div className="mt-5 space-y-3">
        {zones.map((z) => (
          <div key={z.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-white">{z.name}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {z.countries.length} countries · {z.code}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => (editing === z.id ? setEditing(null) : openEditor(z))}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gray-200 transition-colors hover:border-yellow-500/60 hover:text-yellow-400"
                >
                  {editing === z.id ? "Close" : "Countries"}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Delete "${z.name}"? Its rates go too.`)) return;
                    setBusy(z.id);
                    const res = await deleteZone(z.id);
                    setBusy(null);
                    onNotice(res.ok ? (res.message ?? "Deleted.") : (res.error ?? "Failed."));
                    router.refresh();
                  }}
                  disabled={busy === z.id}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                  title="Delete zone"
                >
                  {busy === z.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {editing === z.id && (
              <div className="mt-4 border-t border-white/10 pt-4">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search countries…"
                  className={`${input} mb-3`}
                />
                <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10 p-2">
                  <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((c) => {
                      const on = picked.includes(c.code);
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() =>
                            setPicked((cur) =>
                              on ? cur.filter((x) => x !== c.code) : [...cur, c.code],
                            )
                          }
                          className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                            on ? "bg-yellow-500/15 text-yellow-200" : "text-gray-300 hover:bg-white/5"
                          }`}
                        >
                          <span
                            className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border ${
                              on ? "border-yellow-400 bg-yellow-400" : "border-white/30"
                            }`}
                          >
                            {on && <Check className="h-2.5 w-2.5 text-black" strokeWidth={4} />}
                          </span>
                          <span aria-hidden>{flagEmoji(c.code)}</span>
                          <span className="truncate">{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onSaveCountries(z.id)}
                    disabled={busy === z.id}
                    className="btn-gold !px-6 !py-2.5 disabled:opacity-60"
                  >
                    <span className="relative z-10">
                      Save {picked.length} countries
                    </span>
                  </button>
                  <p className="text-[11px] text-gray-500">
                    A country belongs to one zone; assigning it here removes it
                    from any other.
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function BandsPanel({
  brackets,
  onNotice,
}: {
  brackets: AdminBracket[];
  onNotice: (m: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const maxKg = String(fd.get("maxKg") ?? "").trim();
    setBusy("new");
    const res = await saveBracket({
      label: String(fd.get("label") ?? ""),
      minGrams: Math.round(Number(fd.get("minKg") ?? 0) * 1000),
      maxGrams: maxKg === "" ? null : Math.round(Number(maxKg) * 1000),
      sortOrder: brackets.length * 10 + 10,
    });
    setBusy(null);
    onNotice(res.ok ? (res.message ?? "Saved.") : (res.error ?? "Failed."));
    if (res.ok) {
      setAdding(false);
      router.refresh();
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl text-white">Weight bands</h2>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-gray-200 transition-colors hover:border-yellow-500/60 hover:text-yellow-400"
        >
          <Plus className="h-3.5 w-3.5" /> {adding ? "Cancel" : "New band"}
        </button>
      </div>

      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-gray-500">
        Bands include their upper limit: a parcel of exactly 2 kg is charged the
        “up to 2 kg” rate. Leave the maximum empty for an open-ended top band —
        without one, anything heavier gets no quote at all.
      </p>

      {adding && (
        <form
          onSubmit={onAdd}
          className="mt-4 grid gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end"
        >
          <label className="block">
            <span className={labelCls}>Label</span>
            <input name="label" required placeholder="5 – 6 kg" className={input} />
          </label>
          <label className="block">
            <span className={labelCls}>From (kg)</span>
            <input name="minKg" type="number" step="0.1" min="0" required defaultValue="5" className={input} />
          </label>
          <label className="block">
            <span className={labelCls}>To (kg)</span>
            <input name="maxKg" type="number" step="0.1" min="0" placeholder="empty = ∞" className={input} />
          </label>
          <button type="submit" disabled={busy === "new"} className="btn-gold !px-6 !py-3 disabled:opacity-60">
            <span className="relative z-10">Add</span>
          </button>
        </form>
      )}

      <div className="mt-5 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-widest text-gray-400">
            <tr>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Range</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {brackets.map((b) => (
              <tr key={b.id} className="border-t border-white/5">
                <td className="px-4 py-3 text-gray-200">{b.label}</td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {formatWeight(b.minGrams)} –{" "}
                  {b.maxGrams === null ? "∞ (open-ended)" : formatWeight(b.maxGrams)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`Delete "${b.label}"? Its rates go too.`)) return;
                      setBusy(b.id);
                      const res = await deleteBracket(b.id);
                      setBusy(null);
                      onNotice(res.ok ? (res.message ?? "Deleted.") : (res.error ?? "Failed."));
                      router.refresh();
                    }}
                    disabled={busy === b.id}
                    className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                    title="Delete band"
                  >
                    {busy === b.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function CouriersPanel({
  couriers,
  onNotice,
}: {
  couriers: AdminCourier[];
  onNotice: (m: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function onSave(c: AdminCourier, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(c.id);
    const res = await saveCourier({
      id: c.id,
      displayName: String(fd.get("displayName") ?? ""),
      minDays: Number(fd.get("minDays") ?? 0),
      maxDays: Number(fd.get("maxDays") ?? 0),
      enabled: fd.get("enabled") === "on",
    });
    setBusy(null);
    onNotice(res.ok ? (res.message ?? "Saved.") : (res.error ?? "Failed."));
    if (res.ok) router.refresh();
  }

  return (
    <section>
      <h2 className="font-display text-xl text-white">Couriers</h2>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-gray-500">
        Disabling a courier removes it from every quote immediately. Delivery
        estimates shown to customers come from these numbers.
      </p>

      <div className="mt-5 space-y-3">
        {couriers.map((c) => (
          <form
            key={c.id}
            onSubmit={(e) => onSave(c, e)}
            className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:grid-cols-[1.4fr_0.7fr_0.7fr_auto_auto] sm:items-end"
          >
            <label className="block">
              <span className={labelCls}>Display name</span>
              <input name="displayName" defaultValue={c.displayName} required className={input} />
            </label>
            <label className="block">
              <span className={labelCls}>Min days</span>
              <input name="minDays" type="number" min="0" defaultValue={c.minDays} className={input} />
            </label>
            <label className="block">
              <span className={labelCls}>Max days</span>
              <input name="maxDays" type="number" min="0" defaultValue={c.maxDays} className={input} />
            </label>
            <label className="flex items-center gap-2 pb-2.5 text-xs text-gray-300">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={c.enabled}
                className="h-4 w-4 accent-yellow-500"
              />
              <Power className="h-3.5 w-3.5" /> Active
            </label>
            <button
              type="submit"
              disabled={busy === c.id}
              className="btn-gold !px-6 !py-3 disabled:opacity-60"
            >
              <span className="relative z-10">
                {busy === c.id ? "Saving…" : "Save"}
              </span>
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}

const input =
  "mt-1.5 w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-500/70";
const labelCls = "block text-[10px] uppercase tracking-widest text-gray-400";
