"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { saveAiSettings, addFaq, deleteFaq } from "@/app/admin/ai/actions";
import type { QuickAction } from "@/lib/ai-types";

interface Settings {
  enabled: boolean;
  model: string;
  welcomeMessage: string;
  persona: string;
  suggestedQuestions: string[];
  quickActions: QuickAction[];
  humanHandoff: boolean;
  handoffMessage: string;
}

interface Faq {
  id: string;
  question: string;
  answer: string;
}

const field =
  "w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-yellow-500";
const label = "mb-1 block text-xs uppercase tracking-widest text-gray-400";

export function AiSettingsForm({
  initial,
  faqs,
  configured,
}: {
  initial: Settings;
  faqs: Faq[];
  configured: boolean;
}) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [suggestedText, setSuggestedText] = useState(
    initial.suggestedQuestions.join("\n"),
  );
  const [actionsText, setActionsText] = useState(
    initial.quickActions.map((a) => `${a.label} | ${a.href}`).join("\n"),
  );
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSave] = useTransition();

  function save() {
    setMsg(null);
    const suggestedQuestions = suggestedText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 6);
    const quickActions = actionsText
      .split("\n")
      .map((l) => {
        const [labelPart, hrefPart] = l.split("|");
        return {
          label: (labelPart ?? "").trim(),
          href: (hrefPart ?? "").trim(),
        };
      })
      .filter((a) => a.label && a.href)
      .slice(0, 6);

    startSave(async () => {
      const res = await saveAiSettings({ ...s, suggestedQuestions, quickActions });
      setMsg(
        res.ok
          ? { ok: true, text: "Saved." }
          : { ok: false, text: res.error ?? "Could not save." },
      );
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {!configured && (
        <div className="rounded-lg border border-yellow-600/30 bg-yellow-500/5 p-4 text-sm text-yellow-200">
          <strong>ANTHROPIC_API_KEY is not set.</strong> The concierge stays
          hidden until the key is configured in your environment (Vercel), even
          with “Enabled” on.
        </div>
      )}

      {/* Core settings */}
      <section className="space-y-4 rounded-2xl border border-white/10 bg-neutral-950/60 p-6">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={s.enabled}
            onChange={(e) => setS({ ...s, enabled: e.target.checked })}
            className="h-4 w-4 accent-yellow-500"
          />
          <span className="text-sm font-medium text-white">
            Enable the AI concierge on the storefront
          </span>
        </label>

        <div>
          <span className={label}>Model</span>
          <select
            value={s.model}
            onChange={(e) => setS({ ...s, model: e.target.value })}
            className={field}
          >
            <option value="claude-haiku-4-5">
              Claude Haiku 4.5 — fastest & cheapest (recommended for chat)
            </option>
            <option value="claude-sonnet-5">Claude Sonnet 5 — balanced</option>
            <option value="claude-opus-5">Claude Opus 5 — most capable</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Haiku replies fastest — ideal for a snappy concierge. Opus is
            deepest but slower and pricier per message.
          </p>
        </div>

        <div>
          <span className={label}>Welcome message</span>
          <textarea
            rows={2}
            value={s.welcomeMessage}
            onChange={(e) => setS({ ...s, welcomeMessage: e.target.value })}
            className={field}
          />
        </div>

        <div>
          <span className={label}>Personality & tone (system persona)</span>
          <textarea
            rows={4}
            value={s.persona}
            onChange={(e) => setS({ ...s, persona: e.target.value })}
            className={field}
          />
        </div>

        <div>
          <span className={label}>Suggested questions (one per line, max 6)</span>
          <textarea
            rows={4}
            value={suggestedText}
            onChange={(e) => setSuggestedText(e.target.value)}
            className={field}
          />
        </div>

        <div>
          <span className={label}>
            Quick actions — “Label | /href” per line (max 6)
          </span>
          <textarea
            rows={4}
            value={actionsText}
            onChange={(e) => setActionsText(e.target.value)}
            className={`${field} font-mono text-xs`}
          />
        </div>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={s.humanHandoff}
            onChange={(e) => setS({ ...s, humanHandoff: e.target.checked })}
            className="h-4 w-4 accent-yellow-500"
          />
          <span className="text-sm text-gray-200">
            Offer human handoff when the assistant can’t help
          </span>
        </label>
        {s.humanHandoff && (
          <div>
            <span className={label}>Handoff message</span>
            <textarea
              rows={2}
              value={s.handoffMessage}
              onChange={(e) => setS({ ...s, handoffMessage: e.target.value })}
              className={field}
            />
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-full bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
          {msg && (
            <span className={msg.ok ? "text-sm text-green-400" : "text-sm text-red-400"}>
              {msg.text}
            </span>
          )}
        </div>
      </section>

      {/* FAQs */}
      <FaqManager faqs={faqs} />
    </div>
  );
}

function FaqManager({ faqs }: { faqs: Faq[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  function add() {
    setErr(null);
    startBusy(async () => {
      const res = await addFaq({ question: q, answer: a });
      if (res.ok) {
        setQ("");
        setA("");
        router.refresh();
      } else {
        setErr(res.error ?? "Could not add.");
      }
    });
  }

  function remove(id: string) {
    startBusy(async () => {
      await deleteFaq(id);
      router.refresh();
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-neutral-950/60 p-6">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300">
          Custom FAQs
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          The assistant treats these as authoritative for policy questions.
        </p>
      </div>

      <div className="space-y-3">
        {faqs.length === 0 && (
          <p className="text-sm text-gray-500">No FAQs yet.</p>
        )}
        {faqs.map((f) => (
          <div
            key={f.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">{f.question}</p>
              <p className="mt-0.5 text-sm text-gray-400">{f.answer}</p>
            </div>
            <button
              type="button"
              onClick={() => remove(f.id)}
              disabled={busy}
              aria-label="Delete FAQ"
              className="shrink-0 rounded-md p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-white/10 pt-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Question, e.g. What is your return window?"
          className={field}
        />
        <textarea
          rows={2}
          value={a}
          onChange={(e) => setA(e.target.value)}
          placeholder="Answer"
          className={field}
        />
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={add}
            disabled={busy || !q.trim() || !a.trim()}
            className="rounded-full border border-yellow-500/50 px-5 py-2 text-sm font-semibold text-yellow-300 hover:bg-yellow-500/10 disabled:opacity-50"
          >
            Add FAQ
          </button>
          {err && <span className="text-sm text-red-400">{err}</span>}
        </div>
      </div>
    </section>
  );
}
