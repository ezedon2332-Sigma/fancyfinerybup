import "server-only";

import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";

export type ConversationStatus = "bot" | "awaiting_human" | "human" | "closed";
export type MessageRole = "user" | "assistant" | "agent" | "system";

export interface ConversationRef {
  id: string;
  token: string;
  status: ConversationStatus;
}

export interface StoredMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

function normStatus(v: string | null | undefined): ConversationStatus {
  return v === "awaiting_human" || v === "human" || v === "closed" ? v : "bot";
}

/** Resolve an existing conversation by its token, or start a fresh one. */
export async function getOrCreateConversation(
  token: string | null | undefined,
  opts: { userId?: string | null; contactEmail?: string | null } = {},
): Promise<ConversationRef> {
  const admin = createSupabaseAdminClient();
  if (token && /^[0-9a-f-]{36}$/i.test(token)) {
    const { data } = await admin
      .from("ai_conversations")
      .select("id, token, status")
      .eq("token", token)
      .maybeSingle();
    if (data) {
      return { id: data.id, token: data.token, status: normStatus(data.status) };
    }
  }
  const { data, error } = await admin
    .from("ai_conversations")
    .insert({
      user_id: opts.userId ?? null,
      contact_email: opts.contactEmail ?? null,
    })
    .select("id, token, status")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not open conversation.");
  return { id: data.id, token: data.token, status: normStatus(data.status) };
}

export async function getConversationByToken(
  token: string,
): Promise<ConversationRef | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("ai_conversations")
    .select("id, token, status")
    .eq("token", token)
    .maybeSingle();
  return data
    ? { id: data.id, token: data.token, status: normStatus(data.status) }
    : null;
}

export async function appendMessage(
  conversationId: string,
  role: MessageRole,
  content: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  await admin.from("ai_messages").insert({
    conversation_id: conversationId,
    role,
    content: content.slice(0, 8000),
  });
  await admin
    .from("ai_conversations")
    .update({ last_message_at: now, updated_at: now })
    .eq("id", conversationId);
}

export async function setStatus(
  conversationId: string,
  status: ConversationStatus,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from("ai_conversations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

/** Messages in a conversation, optionally only those after an ISO timestamp. */
export async function loadMessagesAfter(
  conversationId: string,
  afterIso?: string | null,
): Promise<StoredMessage[]> {
  const admin = createSupabaseAdminClient();
  let q = admin
    .from("ai_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (afterIso) q = q.gt("created_at", afterIso);
  const { data } = await q;
  return (data ?? []).map((m) => ({
    id: m.id,
    role: m.role as MessageRole,
    content: m.content,
    createdAt: m.created_at,
  }));
}
