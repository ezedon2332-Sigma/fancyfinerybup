import "server-only";

import { asc, eq } from "drizzle-orm";

import type { AiPublicConfig, QuickAction } from "@/lib/ai-types";
import { CACHE_KEYS, TTL, cached } from "@/infrastructure/cache/cache";
import { db } from "../client";
import { aiFaqs, aiSettings } from "../schema";

export type { AiPublicConfig, QuickAction } from "@/lib/ai-types";

/**
 * AI concierge configuration.
 *
 * Every loader is best-effort: if anything fails the assistant reports as
 * disabled rather than throwing during a page render or in the chat route. A
 * broken concierge must never take the storefront down with it.
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
  return cached(CACHE_KEYS.aiConfig, TTL.config, loadAiConfigUncached);
}

async function loadAiConfigUncached(): Promise<AiConfig> {
  try {
    const [s, faqRows] = await Promise.all([
      db.query.aiSettings.findFirst({ where: eq(aiSettings.id, "default") }),
      db
        .select({ question: aiFaqs.question, answer: aiFaqs.answer })
        .from(aiFaqs)
        .where(eq(aiFaqs.enabled, true))
        .orderBy(asc(aiFaqs.sortOrder)),
    ]);
    if (!s) return DISABLED;
    return {
      enabled: s.enabled,
      welcomeMessage: s.welcomeMessage,
      persona: s.persona,
      model: s.model || "claude-opus-5",
      suggestedQuestions: asStringArray(s.suggestedQuestions),
      quickActions: asQuickActions(s.quickActions),
      humanHandoff: s.humanHandoff,
      handoffMessage: s.handoffMessage,
      faqs: faqRows,
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
