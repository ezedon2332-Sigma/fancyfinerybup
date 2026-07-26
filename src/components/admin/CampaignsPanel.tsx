"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Plus, Send, Trash2 } from "lucide-react";

import {
  deleteCampaign,
  saveCampaign,
  sendCampaign,
} from "@/app/admin/newsletter/actions";
import {
  FASHION_INTERESTS,
  campaignRates,
  type Campaign,
} from "@/domain/newsletter";

/** Campaign composer + performance table. */
export function CampaignsPanel({ campaigns }: { campaigns: Campaign[] }) {
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy("save");
    const res = await saveCampaign({
      name: String(fd.get("name") ?? ""),
      subject: String(fd.get("subject") ?? ""),
      preheader: String(fd.get("preheader") ?? "") || null,
      html: String(fd.get("html") ?? "") || null,
      textBody: String(fd.get("textBody") ?? "") || null,
      interests,
      scheduledAt: String(fd.get("scheduledAt") ?? "") || null,
    });
    setBusy(null);
    setNotice(res.ok ? (res.message ?? "Saved.") : (res.error ?? "Failed."));
    if (res.ok) {
      setComposing(false);
      setInterests([]);
      router.refresh();
    }
  }

  async function onSend(c: Campaign) {
    if (!confirm(`Send "${c.name}" now? This cannot be undone.`)) return;
    setBusy(c.id);
    const res = await sendCampaign(c.id);
    setBusy(null);
    setNotice(res.ok ? (res.message ?? "Sent.") : (res.error ?? "Failed."));
    router.refresh();
  }

  async function onDelete(c: Campaign) {
    if (!confirm(`Delete "${c.name}"?`)) return;
    setBusy(c.id);
    await deleteCampaign(c.id);
    setBusy(null);
    router.refresh();
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl text-white">Campaigns</h2>
        <button
          type="button"
          onClick={() => setComposing((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-gray-200 transition-colors hover:border-yellow-500/60 hover:text-yellow-400"
        >
          <Plus className="h-3.5 w-3.5" />
          {composing ? "Cancel" : "New campaign"}
        </button>
      </div>

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
            <Labelled label="Campaign name">
              <input name="name" required className={input} placeholder="Autumn Privé Preview" />
            </Labelled>
            <Labelled label="Subject line">
              <input name="subject" required className={input} placeholder="Your private preview awaits" />
            </Labelled>
          </div>

          <div className="mt-4">
            <Labelled label="Preheader">
              <input name="preheader" className={input} placeholder="A first look, for members only" />
            </Labelled>
          </div>

          <div className="mt-4">
            <Labelled label="Body (HTML)">
              <textarea
                name="html"
                rows={6}
                className={`${input} font-mono text-xs`}
                placeholder="<p>Dear member…</p>"
              />
            </Labelled>
          </div>

          <div className="mt-4">
            <Labelled label="Plain-text fallback">
              <textarea name="textBody" rows={3} className={`${input} text-xs`} />
            </Labelled>
          </div>

          <fieldset className="mt-5">
            <legend className="text-[10px] uppercase tracking-widest text-gray-400">
              Audience — leave empty to send to every active member
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {FASHION_INTERESTS.map((i) => {
                const on = interests.includes(i.id);
                return (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() =>
                      setInterests((cur) =>
                        cur.includes(i.id)
                          ? cur.filter((x) => x !== i.id)
                          : [...cur, i.id],
                      )
                    }
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      on
                        ? "border-yellow-500 bg-yellow-500/15 text-yellow-200"
                        : "border-white/15 text-gray-300 hover:border-yellow-600/50"
                    }`}
                  >
                    {i.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-5 flex flex-wrap items-end gap-4">
            <Labelled label="Schedule for (optional)">
              <input
                name="scheduledAt"
                type="datetime-local"
                className={`${input} [color-scheme:dark]`}
              />
            </Labelled>
            <button
              type="submit"
              disabled={busy === "save"}
              className="btn-gold !px-8 !py-3 disabled:opacity-60"
            >
              <span className="relative z-10">
                {busy === "save" ? "Saving…" : "Save campaign"}
              </span>
            </button>
          </div>
        </form>
      )}

      <div className="mt-5 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-widest text-gray-400">
            <tr>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Sent</th>
              <th className="px-4 py-3 text-right">Opens</th>
              <th className="px-4 py-3 text-right">Clicks</th>
              <th className="px-4 py-3 text-right">Conv.</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                  No campaigns yet.
                </td>
              </tr>
            )}
            {campaigns.map((c) => {
              const r = campaignRates(c);
              return (
                <tr key={c.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{c.name}</div>
                    <div className="text-xs text-gray-500">{c.subject}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gray-300">
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-200">{c.sentCount}</td>
                  <td className="px-4 py-3 text-right text-gray-200">
                    {c.openCount}
                    <span className="ml-1 text-[10px] text-gray-500">
                      {r.open.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-200">
                    {c.clickCount}
                    <span className="ml-1 text-[10px] text-gray-500">
                      {r.click.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-200">
                    {c.conversionCount}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {c.status !== "sent" && (
                        <button
                          type="button"
                          onClick={() => onSend(c)}
                          disabled={busy === c.id}
                          title="Send now"
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-yellow-400 disabled:opacity-40"
                        >
                          {busy === c.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDelete(c)}
                        disabled={busy === c.id}
                        title="Delete"
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
        Sends run inline, one message at a time. That is fine for a few thousand
        members; beyond that, move the loop in <code>sendCampaign</code> behind a
        queue or a scheduled route so it is not bound by request timeouts.
        Scheduled campaigns are stored with their send time but still need a cron
        trigger to fire — see the note in the README.
      </p>
    </section>
  );
}

const input =
  "w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-500/70";

function Labelled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] uppercase tracking-widest text-gray-400">
        {label}
      </span>
      {children}
    </label>
  );
}
