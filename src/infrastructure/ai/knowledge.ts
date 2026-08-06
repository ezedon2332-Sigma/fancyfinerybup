import "server-only";

import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";

/**
 * Knowledge base with full-text retrieval.
 *
 * Admin uploads documents; they're split into passages and indexed with a
 * Postgres tsvector (GIN). At query time the assistant's search_knowledge tool
 * ranks passages by relevance and feeds the top matches back to the model —
 * retrieval-augmented generation without an external embeddings provider. The
 * chunk table has a generated tsv column, so re-ranking is pure SQL.
 */

/** Split text into ~700-char passages on paragraph boundaries. */
export function chunkText(content: string, maxLen = 700): string[] {
  const paras = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paras) {
    if (p.length > maxLen) {
      if (buf) {
        chunks.push(buf);
        buf = "";
      }
      // Hard-split an oversized paragraph on sentence-ish boundaries.
      for (const piece of p.match(new RegExp(`[\\s\\S]{1,${maxLen}}`, "g")) ?? []) {
        chunks.push(piece.trim());
      }
      continue;
    }
    if ((buf + "\n\n" + p).length > maxLen) {
      chunks.push(buf);
      buf = p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf) chunks.push(buf);
  return chunks.filter((c) => c.length > 0).slice(0, 200);
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  enabled: boolean;
  createdAt: string;
}

export async function saveDocument(input: {
  title: string;
  content: string;
}): Promise<{ ok: boolean; error?: string }> {
  const admin = createSupabaseAdminClient();
  const { data: doc, error } = await admin
    .from("knowledge_documents")
    .insert({ title: input.title, content: input.content })
    .select("id")
    .single();
  if (error || !doc) return { ok: false, error: error?.message ?? "Insert failed." };

  const chunks = chunkText(input.content).map((content) => ({
    document_id: doc.id,
    content,
  }));
  if (chunks.length > 0) {
    const { error: chunkErr } = await admin.from("knowledge_chunks").insert(chunks);
    if (chunkErr) return { ok: false, error: chunkErr.message };
  }
  return { ok: true };
}

export async function deleteDocument(id: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  // knowledge_chunks cascades on the FK.
  await admin.from("knowledge_documents").delete().eq("id", id);
}

export async function listDocuments(): Promise<KnowledgeDocument[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("knowledge_documents")
    .select("id, title, enabled, created_at")
    .order("created_at", { ascending: false });
  return (data ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    enabled: d.enabled,
    createdAt: d.created_at,
  }));
}

/** Retrieve the most relevant passages for a query. Returns model-ready text. */
export async function searchKnowledge(
  query: string,
  limit = 5,
): Promise<{ passages: string[]; modelText: string }> {
  const q = query.trim().slice(0, 200);
  if (q.length < 2) return { passages: [], modelText: "No knowledge found." };

  const admin = createSupabaseAdminClient();
  // Only search enabled documents. Two steps avoids relying on embedded-relation
  // typing and keeps the filter explicit.
  const { data: docs } = await admin
    .from("knowledge_documents")
    .select("id")
    .eq("enabled", true);
  const ids = (docs ?? []).map((d) => d.id);
  if (ids.length === 0) {
    return { passages: [], modelText: "No relevant knowledge base entries found." };
  }

  const { data, error } = await admin
    .from("knowledge_chunks")
    .select("content")
    .in("document_id", ids)
    .textSearch("tsv", q, { type: "websearch", config: "english" })
    .limit(limit);

  if (error || !data || data.length === 0) {
    return { passages: [], modelText: "No relevant knowledge base entries found." };
  }
  const passages = data.map((r) => r.content);
  return {
    passages,
    modelText: passages.map((p, i) => `[${i + 1}] ${p}`).join("\n\n"),
  };
}
