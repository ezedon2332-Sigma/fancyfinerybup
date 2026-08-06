"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/infrastructure/supabase/auth";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";
import { saveDocument, deleteDocument } from "@/infrastructure/ai/knowledge";
import { appendMessage, setStatus } from "@/infrastructure/ai/conversations";

export interface AiActionResult {
  ok: boolean;
  error?: string;
}

// Constrain the model to known-good IDs — never let arbitrary text reach the API.
const MODEL_IDS = ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"] as const;

const settingsSchema = z.object({
  enabled: z.boolean(),
  model: z.enum(MODEL_IDS),
  welcomeMessage: z.string().trim().min(1).max(600),
  persona: z.string().trim().min(1).max(4000),
  suggestedQuestions: z.array(z.string().trim().min(1).max(160)).max(6),
  quickActions: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(40),
        href: z.string().trim().min(1).max(200),
      }),
    )
    .max(6),
  humanHandoff: z.boolean(),
  handoffMessage: z.string().trim().min(1).max(600),
});

export async function saveAiSettings(input: unknown): Promise<AiActionResult> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const s = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("ai_settings")
    .update({
      enabled: s.enabled,
      model: s.model,
      welcome_message: s.welcomeMessage,
      persona: s.persona,
      suggested_questions: s.suggestedQuestions,
      quick_actions: s.quickActions,
      human_handoff: s.humanHandoff,
      handoff_message: s.handoffMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "default");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/ai");
  return { ok: true };
}

const faqSchema = z.object({
  question: z.string().trim().min(1).max(300),
  answer: z.string().trim().min(1).max(2000),
});

export async function addFaq(input: unknown): Promise<AiActionResult> {
  await requireAdmin();
  const parsed = faqSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid FAQ." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("ai_faqs").insert({
    question: parsed.data.question,
    answer: parsed.data.answer,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/ai");
  return { ok: true };
}

export async function deleteFaq(id: string): Promise<AiActionResult> {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Invalid id." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("ai_faqs").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/ai");
  return { ok: true };
}

// ---- Knowledge base -------------------------------------------------------

const docSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(50_000),
});

export async function addKnowledgeDoc(input: unknown): Promise<AiActionResult> {
  await requireAdmin();
  const parsed = docSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid document." };
  }
  const res = await saveDocument(parsed.data);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/admin/ai");
  return { ok: true };
}

export async function removeKnowledgeDoc(id: string): Promise<AiActionResult> {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Invalid id." };
  await deleteDocument(id);
  revalidatePath("/admin/ai");
  return { ok: true };
}

// ---- Human handoff (agent replies) ----------------------------------------

const replySchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().trim().min(1).max(4000),
});

export async function replyAsAgent(input: unknown): Promise<AiActionResult> {
  await requireAdmin();
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid reply." };
  }
  await appendMessage(parsed.data.conversationId, "agent", parsed.data.content);
  await setStatus(parsed.data.conversationId, "human");
  revalidatePath(`/admin/ai/conversations/${parsed.data.conversationId}`);
  revalidatePath("/admin/ai/conversations");
  return { ok: true };
}

export async function closeConversation(id: string): Promise<AiActionResult> {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Invalid id." };
  await setStatus(id, "closed");
  revalidatePath(`/admin/ai/conversations/${id}`);
  revalidatePath("/admin/ai/conversations");
  return { ok: true };
}
