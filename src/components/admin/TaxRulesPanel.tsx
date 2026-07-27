"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Plus, Power, Trash2 } from "lucide-react";

import {
  deleteTaxRule,
  saveTaxRule,
  setTaxRuleEnabled,
} from "@/app/admin/tax/actions";
import { formatBps } from "@/components/checkout/OrderSummary";

export interface TaxRuleRow {
  id: string;
  scope: "global" | "zone" | "country";
  countryCode: string | null;
  zoneId: string | null;
  zoneName: string | null;
  rateBps: number;
  label: string;
  appliesToShipping: boolean;
  enabled: boolean;
}

export interface ZoneOption {
  id: string;
  name: string;
}

/** Tax rules editor. Rates are entered as percentages and stored as basis
 *  points; nothing about a rate lives in code. */
export function TaxRulesPanel({
  rules,
  zones,
}: {
  rules: TaxRuleRow[];
  zones: ZoneOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [scope, setScope] = useState<"global" | "zone" | "country">("country");

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy("save");
    const res = await saveTaxRule({
      scope,
      countryCode: String(fd.get("countryCode") ?? "") || null,
      zoneId: String(fd.get("zoneId") ?? "") || null,
      ratePercent: Number(fd.get("ratePercent") ?? 0),
      label: String(fd.get("label") ?? "VAT"),
      appliesToShipping: fd.get("appliesToShipping") === "on",
      enabled: fd.get("enabled") === "on",
    });
    setBusy(null);
    setNotice(res.ok ? (res.message ?? "Saved.") : (res.error ?? "Failed."));
    if (res.ok) {
      setComposing(false);
      router.refresh();
    }
  }

  async function onToggle(rule: TaxRuleRow) {
    setBusy(rule.id);
    await setTaxRuleEnabled(rule.id, !rule.enabled);
    setBusy(null);
    router.refresh();
  }

  async function onDelete(rule: TaxRuleRow) {
    if (!confirm(`Delete the ${describe(rule)} tax rule?`)) return;
    setBusy(rule.id);
    await deleteTaxRule(rule.id);
    setBusy(null);
    router.refresh();
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl text-white">Tax rules</h2>
        <button
          type="button"
          onClick={() => setComposing((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-gray-200 transition-colors hover:border-yellow-500/60 hover:text-yellow-400"
        >
          <Plus className="h-3.5 w-3.5" />
          {composing ? "Cancel" : "New rule"}
        </button>
      </div>

      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-gray-500">
        The most specific enabled rule wins: a country rule beats its zone,
        which beats the global rule. With no rule matching, checkout shows
        “No Tax” and continues normally.
      </p>

      {notice && (
        <p className="mt-3 rounded-lg border border-yellow-600/30 bg-yellow-500/5 px-4 py-2.5 text-xs text-yellow-200">
          {notice}
        </p>
      )}

      {composing && (
        <form
          onSubmit={onSave}
          className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Applies to</span>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as typeof scope)}
                className={input}
              >
                <option value="country" className="bg-neutral-950">A country</option>
                <option value="zone" className="bg-neutral-950">A zone</option>
                <option value="global" className="bg-neutral-950">Everywhere (fallback)</option>
              </select>
            </label>

            {scope === "country" && (
              <label className="block">
                <span className={labelCls}>Country code</span>
                <input
                  name="countryCode"
                  maxLength={2}
                  placeholder="NG"
                  className={`${input} uppercase`}
                />
              </label>
            )}

            {scope === "zone" && (
              <label className="block">
                <span className={labelCls}>Zone</span>
                <select name="zoneId" className={input} defaultValue="">
                  <option value="" className="bg-neutral-950">Select a zone</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id} className="bg-neutral-950">
                      {z.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Rate (%)</span>
              <input
                name="ratePercent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                defaultValue="7.5"
                required
                className={input}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Label shown to customers</span>
              <input name="label" defaultValue="VAT" required className={input} />
            </label>
          </div>

          <div className="mt-4 space-y-2.5">
            <label className="flex items-center gap-2.5 text-xs text-gray-300">
              <input
                type="checkbox"
                name="appliesToShipping"
                defaultChecked
                className="h-4 w-4 accent-yellow-500"
              />
              Charge tax on the shipping fee as well as the goods
            </label>
            <label className="flex items-center gap-2.5 text-xs text-gray-300">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked
                className="h-4 w-4 accent-yellow-500"
              />
              Active
            </label>
          </div>

          <button
            type="submit"
            disabled={busy === "save"}
            className="btn-gold mt-5 !px-8 !py-3 disabled:opacity-60"
          >
            <span className="relative z-10">
              {busy === "save" ? "Saving…" : "Save rule"}
            </span>
          </button>
        </form>
      )}

      <div className="mt-5 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-widest text-gray-400">
            <tr>
              <th className="px-4 py-3">Applies to</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3">On shipping</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  No tax rules. Checkout shows “No Tax”.
                </td>
              </tr>
            )}
            {rules.map((r) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-gray-200">{describe(r)}</td>
                <td className="px-4 py-3 text-gray-300">{r.label}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-yellow-400">
                  {formatBps(r.rateBps)}
                  <span className="ml-2 text-[10px] font-normal text-gray-600">
                    {r.rateBps} bps
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {r.appliesToShipping ? "Yes" : "Goods only"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                      r.enabled
                        ? "bg-green-500/15 text-green-300"
                        : "bg-white/10 text-gray-400"
                    }`}
                  >
                    {r.enabled ? "Active" : "Off"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onToggle(r)}
                      disabled={busy === r.id}
                      title={r.enabled ? "Turn off" : "Turn on"}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-yellow-400 disabled:opacity-40"
                    >
                      {busy === r.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Power className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(r)}
                      disabled={busy === r.id}
                      title="Delete"
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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

function describe(r: TaxRuleRow): string {
  if (r.scope === "country") return `Country · ${r.countryCode}`;
  if (r.scope === "zone") return `Zone · ${r.zoneName ?? "—"}`;
  return "Everywhere (fallback)";
}

const input =
  "mt-1.5 w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-500/70";
const labelCls = "block text-[10px] uppercase tracking-widest text-gray-400";
