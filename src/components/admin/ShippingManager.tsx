"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Save, Trash2 } from "lucide-react";

import { flagEmoji, SHIPPING_ZONES } from "@/domain/shipping/countries";
import type {
  ShippingCountry,
  ShippingSettings,
} from "@/domain/shipping/shipping";
import {
  removeShippingCountry,
  seedShippingCountries,
  updateShippingCountry,
  updateShippingSettings,
  updateShippingZone,
} from "@/app/admin/shipping/actions";

const naira = (n: number | null) => (n == null ? 0 : n / 100);

const field =
  "w-full rounded-sm border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white outline-none focus:border-yellow-500";

function CountryRow({ c }: { c: ShippingCountry }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(c.enabled);
  const [stdPrice, setStdPrice] = useState(naira(c.standardPrice));
  const [stdMin, setStdMin] = useState(c.standardMinDays);
  const [stdMax, setStdMax] = useState(c.standardMaxDays);
  const [expOffered, setExpOffered] = useState(c.expressPrice != null);
  const [expPrice, setExpPrice] = useState(naira(c.expressPrice));
  const [expMin, setExpMin] = useState(c.expressMinDays);
  const [expMax, setExpMax] = useState(c.expressMaxDays);
  const [freeOn, setFreeOn] = useState(c.freeOver != null);
  const [freeOver, setFreeOver] = useState(naira(c.freeOver));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    const res = await updateShippingCountry({
      code: c.code,
      enabled,
      standardPriceNaira: stdPrice,
      standardMinDays: stdMin,
      standardMaxDays: stdMax,
      expressOffered: expOffered,
      expressPriceNaira: expPrice,
      expressMinDays: expMin,
      expressMaxDays: expMax,
      freeShipping: freeOn,
      freeOverNaira: freeOver,
    });
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
      router.refresh();
    } else {
      alert(res.error ?? "Could not save.");
    }
  }

  async function remove() {
    if (!confirm(`Remove ${c.name} from shipping?`)) return;
    setBusy(true);
    const res = await removeShippingCountry(c.code);
    setBusy(false);
    if (res.ok) router.refresh();
    else alert(res.error ?? "Could not remove.");
  }

  return (
    <tr className="border-t border-white/5 align-top">
      <td className="px-2 py-2 whitespace-nowrap">
        <span className="mr-1">{flagEmoji(c.code)}</span>
        <span className="text-sm">{c.name}</span>
        <span className="block text-[10px] uppercase tracking-wide text-gray-500">{c.zone}</span>
      </td>
      <td className="px-2 py-2 text-center">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-yellow-500" />
      </td>
      <td className="px-2 py-2">
        <input type="number" min={0} className={`${field} w-24`} value={stdPrice} onChange={(e) => setStdPrice(Number(e.target.value))} />
        <div className="mt-1 flex gap-1">
          <input type="number" min={0} className={`${field} w-12`} value={stdMin} onChange={(e) => setStdMin(Number(e.target.value))} />
          <input type="number" min={0} className={`${field} w-12`} value={stdMax} onChange={(e) => setStdMax(Number(e.target.value))} />
        </div>
      </td>
      <td className="px-2 py-2">
        <label className="flex items-center gap-1 text-[10px] text-gray-400">
          <input type="checkbox" checked={expOffered} onChange={(e) => setExpOffered(e.target.checked)} className="h-3 w-3 accent-yellow-500" />
          offer
        </label>
        <input type="number" min={0} disabled={!expOffered} className={`${field} mt-1 w-24 disabled:opacity-40`} value={expPrice} onChange={(e) => setExpPrice(Number(e.target.value))} />
        <div className="mt-1 flex gap-1">
          <input type="number" min={0} disabled={!expOffered} className={`${field} w-12 disabled:opacity-40`} value={expMin} onChange={(e) => setExpMin(Number(e.target.value))} />
          <input type="number" min={0} disabled={!expOffered} className={`${field} w-12 disabled:opacity-40`} value={expMax} onChange={(e) => setExpMax(Number(e.target.value))} />
        </div>
      </td>
      <td className="px-2 py-2">
        <label className="flex items-center gap-1 text-[10px] text-gray-400">
          <input type="checkbox" checked={freeOn} onChange={(e) => setFreeOn(e.target.checked)} className="h-3 w-3 accent-yellow-500" />
          free over
        </label>
        <input type="number" min={0} disabled={!freeOn} className={`${field} mt-1 w-24 disabled:opacity-40`} value={freeOver} onChange={(e) => setFreeOver(Number(e.target.value))} />
      </td>
      <td className="px-2 py-2 whitespace-nowrap">
        <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-1 rounded-sm bg-yellow-500 px-2 py-1 text-xs font-semibold text-black hover:bg-yellow-600 disabled:opacity-50">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          {saved ? "Saved" : "Save"}
        </button>
        <button type="button" onClick={remove} disabled={busy} className="ml-1 rounded-sm p-1 text-gray-500 hover:text-red-400" aria-label="Remove">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

export function ShippingManager({
  countries,
  settings,
}: {
  countries: ShippingCountry[];
  settings: ShippingSettings;
}) {
  const router = useRouter();
  const [rate, setRate] = useState(settings.ngnPerUsd);
  const [rateBusy, setRateBusy] = useState(false);
  const [seedBusy, setSeedBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState<string>("all");

  // Zone bulk editor
  const [bulkZone, setBulkZone] = useState(SHIPPING_ZONES[0]);
  const [bulkEnabled, setBulkEnabled] = useState(true);
  const [bulkStd, setBulkStd] = useState(0);
  const [bulkExpOffered, setBulkExpOffered] = useState(true);
  const [bulkExp, setBulkExp] = useState(0);
  const [bulkBusy, setBulkBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return countries.filter(
      (c) =>
        (zoneFilter === "all" || c.zone === zoneFilter) &&
        (!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q),
    );
  }, [countries, search, zoneFilter]);

  async function saveRate() {
    setRateBusy(true);
    const res = await updateShippingSettings(rate);
    setRateBusy(false);
    if (!res.ok) alert(res.error ?? "Could not save rate.");
    else router.refresh();
  }

  async function seed() {
    setSeedBusy(true);
    const res = await seedShippingCountries();
    setSeedBusy(false);
    if (res.ok) {
      alert(`Synced ${res.count ?? 0} countries (existing edits preserved).`);
      router.refresh();
    } else {
      alert(res.error ?? "Could not sync countries.");
    }
  }

  async function applyBulk() {
    setBulkBusy(true);
    const res = await updateShippingZone({
      zone: bulkZone,
      enabled: bulkEnabled,
      standardPriceNaira: bulkStd,
      expressOffered: bulkExpOffered,
      expressPriceNaira: bulkExp,
    });
    setBulkBusy(false);
    if (res.ok) {
      alert(`Updated ${res.count ?? 0} countries in ${bulkZone}.`);
      router.refresh();
    } else {
      alert(res.error ?? "Could not update zone.");
    }
  }

  return (
    <div className="space-y-8">
      {/* Settings + seed */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300">Exchange rate</h2>
          <p className="mt-1 text-xs text-gray-500">NGN per 1 USD — used to convert international orders to USD.</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-gray-400">₦</span>
            <input type="number" min={1} value={rate} onChange={(e) => setRate(Number(e.target.value))} className={`${field} w-32`} />
            <span className="text-sm text-gray-400">= $1</span>
            <button type="button" onClick={saveRate} disabled={rateBusy} className="ml-auto inline-flex items-center gap-1 rounded-sm bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-yellow-600 disabled:opacity-50">
              {rateBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300">Country catalog</h2>
          <p className="mt-1 text-xs text-gray-500">Sync all ISO countries with default zone rates. Existing rows are never overwritten.</p>
          <button type="button" onClick={seed} disabled={seedBusy} className="mt-3 inline-flex items-center gap-2 rounded-sm border border-yellow-500/40 px-4 py-2 text-xs font-medium text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-50">
            {seedBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sync all countries
          </button>
        </div>
      </div>

      {/* Zone bulk editor */}
      <div className="rounded-xl border border-white/10 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300">Bulk edit by zone</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-gray-400">
            Zone
            <select value={bulkZone} onChange={(e) => setBulkZone(e.target.value as typeof bulkZone)} className={`${field} mt-1 block w-40`}>
              {SHIPPING_ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-400">
            <input type="checkbox" checked={bulkEnabled} onChange={(e) => setBulkEnabled(e.target.checked)} className="h-4 w-4 accent-yellow-500" /> Enabled
          </label>
          <label className="text-xs text-gray-400">
            Standard ₦
            <input type="number" min={0} value={bulkStd} onChange={(e) => setBulkStd(Number(e.target.value))} className={`${field} mt-1 block w-28`} />
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-400">
            <input type="checkbox" checked={bulkExpOffered} onChange={(e) => setBulkExpOffered(e.target.checked)} className="h-4 w-4 accent-yellow-500" /> Express
          </label>
          <label className="text-xs text-gray-400">
            Express ₦
            <input type="number" min={0} disabled={!bulkExpOffered} value={bulkExp} onChange={(e) => setBulkExp(Number(e.target.value))} className={`${field} mt-1 block w-28 disabled:opacity-40`} />
          </label>
          <button type="button" onClick={applyBulk} disabled={bulkBusy} className="inline-flex items-center gap-1 rounded-sm bg-yellow-500 px-4 py-2 text-xs font-semibold text-black hover:bg-yellow-600 disabled:opacity-50">
            {bulkBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Apply to zone
          </button>
        </div>
      </div>

      {/* Country table */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search countries…" className={`${field} w-56`} />
          <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} className={`${field} w-40`}>
            <option value="all">All zones</option>
            {SHIPPING_ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
          <span className="text-xs text-gray-500">{filtered.length} countries</span>
        </div>

        {countries.length === 0 ? (
          <p className="mt-6 rounded-lg border border-white/10 p-6 text-center text-sm text-gray-400">
            No countries yet — click <strong>Sync all countries</strong> above to populate the catalog.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[820px] text-left">
              <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-gray-400">
                <tr>
                  <th className="px-2 py-2">Country</th>
                  <th className="px-2 py-2 text-center">On</th>
                  <th className="px-2 py-2">Standard ₦ / days</th>
                  <th className="px-2 py-2">Express ₦ / days</th>
                  <th className="px-2 py-2">Free shipping ₦</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => <CountryRow key={c.code} c={c} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
