import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { db } from "../client";
import { knowledgeChunks, knowledgeDocuments } from "../schema";

/**
 * Knowledge base with full-text retrieval.
 *
 * Admin uploads documents; they are split into passages and indexed with a
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
  try {
    // One transaction: a document row whose chunks failed to insert is invisible
    // to search but visible in the admin list — it looks indexed and is not.
    await db.transaction(async (tx) => {
      const [doc] = await tx
        .insert(knowledgeDocuments)
        .values({ title: input.title, content: input.content })
        .returning({ id: knowledgeDocuments.id });
      if (!doc) throw new Error("Insert failed.");

      const chunks = chunkText(input.content).map((content) => ({
        documentId: doc.id,
        content,
      }));
      if (chunks.length > 0) {
        await tx.insert(knowledgeChunks).values(chunks);
      }
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteDocument(id: string): Promise<void> {
  // knowledge_chunks cascades on the FK.
  await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, id));
}

export async function listDocuments(): Promise<KnowledgeDocument[]> {
  return db
    .select({
      id: knowledgeDocuments.id,
      title: knowledgeDocuments.title,
      enabled: knowledgeDocuments.enabled,
      createdAt: knowledgeDocuments.createdAt,
    })
    .from(knowledgeDocuments)
    .orderBy(desc(knowledgeDocuments.createdAt));
}

/** Retrieve the most relevant passages for a query. Returns model-ready text. */
export async function searchKnowledge(
  query: string,
  limit = 5,
): Promise<{ passages: string[]; modelText: string }> {
  const q = query.trim().slice(0, 200);
  if (q.length < 2) return { passages: [], modelText: "No knowledge found." };

  const EMPTY = {
    passages: [] as string[],
    modelText: "No relevant knowledge base entries found.",
  };

  try {
    // PostgREST needed two round trips here (fetch enabled document ids, then
    // filter chunks by `in`) because the embedded-relation typing would not
    // carry the filter. In SQL it is one join, and the ranking comes back with
    // it — so results are ordered by relevance rather than by insertion order,
    // which the previous version never actually did.
    const rows = await db
      .select({ content: knowledgeChunks.content })
      .from(knowledgeChunks)
      .innerJoin(
        knowledgeDocuments,
        eq(knowledgeDocuments.id, knowledgeChunks.documentId),
      )
      .where(
        sql`${knowledgeDocuments.enabled} = true and ${knowledgeChunks.tsv} @@ websearch_to_tsquery('english', ${q})`,
      )
      .orderBy(
        desc(
          sql`ts_rank(${knowledgeChunks.tsv}, websearch_to_tsquery('english', ${q}))`,
        ),
      )
      .limit(limit);

    if (rows.length === 0) return EMPTY;

    const passages = rows.map((r) => r.content);
    return {
      passages,
      modelText: passages.map((p, i) => `[${i + 1}] ${p}`).join("\n\n"),
    };
  } catch {
    return EMPTY;
  }
}
