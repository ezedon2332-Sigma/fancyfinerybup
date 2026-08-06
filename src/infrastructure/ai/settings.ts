import "server-only";

import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import type { AiPublicConfig, QuickAction } from "@/lib/ai-types";

export type { AiPublicConfig, QuickAction } from "@/lib/ai-types";

/**
 * AI concierge configuration.
 *
 * Read through the service-role client because ai_settings / ai_faqs are
 * admin-only under RLS. Every loader is best-effort: if the tables aren't
 * migrated yet, or anything fails, the assistant simply reports as disabled
 * rather than throwing on a page render or in the chat route.
 */

export interface AiFaq {
  question: string;
  answer: string;
}

/** Everything the chat route needs (server-only — includes the persona). */
export interface AiConfig {
  enabled: boolean;
  welcomeMessage: string;
  persona: string;
  model: string;
  suggestedQuestions: string[];
  quickActions: QuickAction[];
  humanHandoff: boolean;
  handoffMessage: string;
  faqs: AiFaq[];
}

/** An ANTHROPIC_API_KEY must be present for the assistant to answer at all. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function asQuickActions(v: unknown): QuickAction[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) => {
    if (
      x &&
      typeof x === "object" &&
      typeof (x as QuickAction).label === "string" &&
      typeof (x as QuickAction).href === "string"
    ) {
      return [{ label: (x as QuickAction).label, href: (x as QuickAction).href }];
    }
    return [];
  });
}

const DISABLED: AiConfig = {
  enabled: false,
  welcomeMessage: "",
  persona: "",
  model: "claude-opus-5",
  suggestedQuestions: [],
  quickActions: [],
  humanHandoff: false,
  handoffMessage: "",
  faqs: [],
};

export async function loadAiConfig(): Promise<AiConfig> {
  try {
    const admin = createSupabaseAdminClient();
    const [{ data: s }, { data: faqRows }] = await Promise.all([
      admin.from("ai_settings").select("*").eq("id", "default").maybeSingle(),
      admin
        .from("ai_faqs")
        .select("question, answer, sort_order")
        .eq("enabled", true)
        .order("sort_order", { ascending: true }),
    ]);
    if (!s) return DISABLED;
    return {
      enabled: s.enabled,
      welcomeMessage: s.welcome_message,
      persona: s.persona,
      model: s.model || "claude-opus-5",
      suggestedQuestions: asStringArray(s.suggested_questions),
      quickActions: asQuickActions(s.quick_actions),
      humanHandoff: s.human_handoff,
      handoffMessage: s.handoff_message,
      faqs: (faqRows ?? []).map((f) => ({ question: f.question, answer: f.answer })),
    };
  } catch {
    return DISABLED;
  }
}

/** For the storefront layout: only what the widget renders before its first turn. */
export async function loadAiPublicConfig(): Promise<AiPublicConfig> {
  const cfg = await loadAiConfig();
  return {
    // The widget is only usable when an operator enabled it AND a key exists.
    enabled: cfg.enabled && isAiConfigured(),
    welcomeMessage: cfg.welcomeMessage,
    suggestedQuestions: cfg.suggestedQuestions,
    quickActions: cfg.quickActions,
  };
}
