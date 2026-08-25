import Link from "next/link";
import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";

import { requireAdmin } from "@/infrastructure/auth/session";
import { loadAiFaqs } from "@/infrastructure/db/admin-read-service";
import { loadAiConfig, isAiConfigured } from "@/infrastructure/db/ai/settings";
import { listDocuments } from "@/infrastructure/db/ai/knowledge";
import { AiSettingsForm } from "@/components/admin/AiSettingsForm";
import { KnowledgeManager } from "@/components/admin/KnowledgeManager";

export const metadata: Metadata = { title: "Admin · AI Concierge" };

export default async function AdminAiPage() {
  await requireAdmin();
  const cfg = await loadAiConfig();
  const docs = await listDocuments();

  const faqRows = await loadAiFaqs();

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">AI Concierge</h1>
          <p className="mt-1 text-sm text-gray-400">
            Configure the luxury shopping assistant shown on the storefront.
          </p>
        </div>
        <Link
          href="/admin/ai/conversations"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-gray-200 hover:border-yellow-500/40 hover:text-yellow-300"
        >
          <MessagesSquare className="h-4 w-4" /> View conversations
        </Link>
      </div>

      <div className="mt-6 space-y-8">
        <AiSettingsForm
          configured={isAiConfigured()}
          initial={{
            enabled: cfg.enabled,
            model: cfg.model,
            welcomeMessage: cfg.welcomeMessage,
            persona: cfg.persona,
            suggestedQuestions: cfg.suggestedQuestions,
            quickActions: cfg.quickActions,
            humanHandoff: cfg.humanHandoff,
            handoffMessage: cfg.handoffMessage,
          }}
          faqs={faqRows ?? []}
        />
        <KnowledgeManager docs={docs} />
      </div>
    </div>
  );
}
