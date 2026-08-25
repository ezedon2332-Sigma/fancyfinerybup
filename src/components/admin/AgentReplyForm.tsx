"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { replyAsAgent, closeConversation } from "@/app/admin/ai/actions";
import { toast } from "@/components/ui/Toast";

export function AgentReplyForm({
  conversationId,
  status,
}: {
  conversationId: string;
  status: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, start] = useTransition();
  const closed = status === "closed";

  function send() {
    start(async () => {
      const res = await replyAsAgent({ conversationId, content: text });
      if (res.ok) {
        setText("");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not send.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-300">
          Reply as the team
        </h2>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-yellow-400"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {closed ? (
        <p className="text-sm text-gray-500">This conversation is closed.</p>
      ) : (
        <>
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your reply — the customer sees it live in the chat…"
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-yellow-500"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={send}
              disabled={busy || !text.trim()}
              className="rounded-full bg-yellow-500 px-6 py-2 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send reply"}
            </button>
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  await closeConversation(conversationId);
                  router.refresh();
                })
              }
              disabled={busy}
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-gray-300 hover:bg-white/5"
            >
              Close conversation
            </button>
          </div>
        </>
      )}
    </div>
  );
}
