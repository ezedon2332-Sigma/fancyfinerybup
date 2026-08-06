"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2 } from "lucide-react";

import { addKnowledgeDoc, removeKnowledgeDoc } from "@/app/admin/ai/actions";

interface Doc {
  id: string;
  title: string;
  enabled: boolean;
  createdAt: string;
}

const field =
  "w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-yellow-500";

export function KnowledgeManager({ docs }: { docs: Doc[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function add() {
    setErr(null);
    start(async () => {
      const res = await addKnowledgeDoc({ title, content });
      if (res.ok) {
        setTitle("");
        setContent("");
        router.refresh();
      } else {
        setErr(res.error ?? "Could not save.");
      }
    });
  }

  function remove(id: string) {
    start(async () => {
      await removeKnowledgeDoc(id);
      router.refresh();
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-neutral-950/60 p-6">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300">
          Knowledge base
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Paste policies, shipping details, care guides or brand info. The
          assistant searches these to answer accurately (retrieval-augmented).
        </p>
      </div>

      <div className="space-y-2">
        {docs.length === 0 && (
          <p className="text-sm text-gray-500">No documents yet.</p>
        )}
        {docs.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3"
          >
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-yellow-500/70" />
              <span className="truncate text-sm text-white">{d.title}</span>
            </div>
            <button
              type="button"
              onClick={() => remove(d.id)}
              disabled={busy}
              aria-label="Delete document"
              className="shrink-0 rounded-md p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-white/10 pt-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Document title, e.g. Returns & Exchanges Policy"
          className={field}
        />
        <textarea
          rows={6}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste the full text here…"
          className={field}
        />
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={add}
            disabled={busy || !title.trim() || !content.trim()}
            className="rounded-full border border-yellow-500/50 px-5 py-2 text-sm font-semibold text-yellow-300 hover:bg-yellow-500/10 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add document"}
          </button>
          {err && <span className="text-sm text-red-400">{err}</span>}
        </div>
      </div>
    </section>
  );
}
