import "server-only";

import { and, asc, eq, gt } from "drizzle-orm";

import { db } from "../client";
import { aiConversations, aiMessages } from "../schema";

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

/** Conversation tokens are UUIDs; anything else is rejected before it reaches
 *  the database, so a malformed token can never widen a lookup. */
const TOKEN_RE = /^[0-9a-f-]{36}$/i;

function normStatus(v: string | null | undefined): ConversationStatus {
  return v === "awaiting_human" || v === "human" || v === "closed" ? v : "bot";
}

/** Resolve an existing conversation by its token, or start a fresh one. */
export async function getOrCreateConversation(
  token: string | null | undefined,
  opts: { userId?: string | null; contactEmail?: string | null } = {},
): Promise<ConversationRef> {
  if (token && TOKEN_RE.test(token)) {
    const existing = await db.query.aiConversations.findFirst({
      where: eq(aiConversations.token, token),
      columns: { id: true, token: true, status: true },
    });
    if (existing) {
      return {
        id: existing.id,
        token: existing.token,
        status: normStatus(existing.status),
      };
    }
  }

  const [created] = await db
    .insert(aiConversations)
    .values({
      userId: opts.userId ?? null,
      contactEmail: opts.contactEmail ?? null,
    })
    .returning({
      id: aiConversations.id,
      token: aiConversations.token,
      status: aiConversations.status,
    });

  if (!created) throw new Error("Could not open conversation.");
  return {
    id: created.id,
    token: created.token,
    status: normStatus(created.status),
  };
}

export async function getConversationByToken(
  token: string,
): Promise<ConversationRef | null> {
  if (!TOKEN_RE.test(token)) return null;
  const row = await db.query.aiConversations.findFirst({
    where: eq(aiConversations.token, token),
    columns: { id: true, token: true, status: true },
  });
  return row
    ? { id: row.id, token: row.token, status: normStatus(row.status) }
    : null;
}

export async function appendMessage(
  conversationId: string,
  role: MessageRole,
  content: string,
): Promise<void> {
  // One transaction: a stored message whose conversation timestamp never moved
  // leaves the admin inbox showing a stale "last activity" for a live thread.
  await db.transaction(async (tx) => {
    await tx.insert(aiMessages).values({
      conversationId,
      role,
      content: content.slice(0, 8000),
    });
    const now = new Date().toISOString();
    await tx
      .update(aiConversations)
      .set({ lastMessageAt: now, updatedAt: now })
      .where(eq(aiConversations.id, conversationId));
  });
}

export async function setStatus(
  conversationId: string,
  status: ConversationStatus,
): Promise<void> {
  await db
    .update(aiConversations)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(aiConversations.id, conversationId));
}

/** Messages in a conversation, optionally only those after an ISO timestamp. */
export async function loadMessagesAfter(
  conversationId: string,
  afterIso?: string | null,
): Promise<StoredMessage[]> {
  const rows = await db
    .select({
      id: aiMessages.id,
      role: aiMessages.role,
      content: aiMessages.content,
      createdAt: aiMessages.createdAt,
    })
    .from(aiMessages)
    .where(
      afterIso
        ? and(
            eq(aiMessages.conversationId, conversationId),
            gt(aiMessages.createdAt, afterIso),
          )
        : eq(aiMessages.conversationId, conversationId),
    )
    .orderBy(asc(aiMessages.createdAt))
    .limit(200);

  return rows.map((m) => ({
    id: m.id,
    role: m.role as MessageRole,
    content: m.content,
    createdAt: m.createdAt,
  }));
}
