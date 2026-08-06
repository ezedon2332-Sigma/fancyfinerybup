import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { requireAdmin } from "@/infrastructure/supabase/auth";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";
import { AgentReplyForm } from "@/components/admin/AgentReplyForm";

export const metadata: Metadata = { title: "Admin · Conversation" };

const ROLE_LABEL: Record<string, string> = {
  user: "Customer",
  assistant: "Concierge (AI)",
  agent: "You (team)",
  system: "System",
};

export default async function AdminConversationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: conv } = await supabase
    .from("ai_conversations")
    .select("id, status, contact_email, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!conv) notFound();

  const { data: messages } = await supabase
    .from("ai_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/ai/conversations"
        className="text-sm text-gray-400 hover:text-yellow-400"
      >
        ← All conversations
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Conversation #{conv.id.slice(0, 8)}</h1>
          <p className="text-sm text-gray-400">
            {conv.contact_email ?? "Guest"} · status: {conv.status}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-neutral-950/60 p-5">
        {(messages ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">No messages.</p>
        ) : (
          (messages ?? []).map((m) => (
            <div
              key={m.id}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-yellow-500/90 text-black"
                    : m.role === "agent"
                      ? "border border-yellow-500/40 bg-white/[0.03] text-gray-100"
                      : m.role === "system"
                        ? "bg-transparent text-xs text-gray-500"
                        : "bg-white/[0.04] text-gray-200"
                }`}
              >
                <span className="mb-0.5 block text-[10px] uppercase tracking-widest opacity-60">
                  {ROLE_LABEL[m.role] ?? m.role} ·{" "}
                  {new Date(m.created_at).toLocaleTimeString()}
                </span>
                <span className="whitespace-pre-wrap">{m.content}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-6">
        <AgentReplyForm conversationId={conv.id} status={conv.status} />
      </div>
    </div>
  );
}
