import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { loadAiConfig, isAiConfigured } from "@/infrastructure/ai/settings";
import {
  getAnthropic,
  buildSystemPrompt,
  searchCatalog,
  SEARCH_CATALOG_TOOL,
  SEARCH_KNOWLEDGE_TOOL,
  REQUEST_HANDOFF_TOOL,
} from "@/infrastructure/ai/concierge";
import { searchKnowledge } from "@/infrastructure/ai/knowledge";
import {
  getOrCreateConversation,
  appendMessage,
  setStatus,
} from "@/infrastructure/ai/conversations";
import { notifyHumanHandoff } from "@/infrastructure/notifications/email";
import { getCurrentUser } from "@/infrastructure/supabase/auth";
import { rateLimit } from "@/lib/ai-rate-limit";
import type { ConciergeStreamEvent } from "@/lib/ai-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(24),
  token: z.string().uuid().optional(),
});

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip"))?.trim() || "unknown";
}

function ndjson(controller: ReadableStreamDefaultController, e: ConciergeStreamEvent) {
  controller.enqueue(new TextEncoder().encode(JSON.stringify(e) + "\n"));
}

export async function POST(request: Request): Promise<Response> {
  if (!isAiConfigured()) {
    return Response.json({ error: "Assistant not configured." }, { status: 503 });
  }
  const cfg = await loadAiConfig();
  if (!cfg.enabled) {
    return Response.json({ error: "Assistant is turned off." }, { status: 503 });
  }

  const gate = rateLimit(`ai:${clientIp(request)}`, 20, 60_000);
  if (!gate.ok) {
    return Response.json(
      { error: "You're sending messages a little fast — one moment." },
      { status: 429, headers: { "retry-after": String(gate.retryAfter) } },
    );
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const user = await getCurrentUser();
  const conv = await getOrCreateConversation(parsed.token, {
    userId: user?.id ?? null,
    contactEmail: user?.email ?? null,
  });

  const lastUser = [...parsed.messages].reverse().find((m) => m.role === "user");
  const lastUserText = lastUser?.content ?? "";

  const system = buildSystemPrompt(cfg);
  const messages: Anthropic.MessageParam[] = parsed.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const tools: Anthropic.Tool[] = [
    SEARCH_CATALOG_TOOL,
    SEARCH_KNOWLEDGE_TOOL,
    ...(cfg.humanHandoff ? [REQUEST_HANDOFF_TOOL] : []),
  ];

  const anthropic = getAnthropic();

  const stream = new ReadableStream({
    async start(controller) {
      // Hand the client its conversation token so it can persist + resume.
      ndjson(controller, { type: "session", token: conv.token });
      try {
        // Persist the shopper's newest message.
        if (lastUserText) await appendMessage(conv.id, "user", lastUserText);

        // A human is (or is about to be) handling this thread — the bot steps
        // aside; the widget switches to human mode and polls for replies.
        if (conv.status === "awaiting_human" || conv.status === "human") {
          ndjson(controller, { type: "handoff" });
          ndjson(controller, { type: "done" });
          return;
        }

        let assistantText = "";

        for (let turn = 0; turn < 5; turn++) {
          const s = anthropic.messages.stream({
            model: cfg.model,
            max_tokens: 3000,
            system,
            tools,
            messages,
          });
          s.on("text", (t) => {
            assistantText += t;
            ndjson(controller, { type: "text", text: t });
          });
          const final = await s.finalMessage();
          if (final.stop_reason !== "tool_use") break;

          messages.push({ role: "assistant", content: final.content });
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of final.content) {
            if (block.type !== "tool_use") continue;
            const input = block.input as Record<string, unknown>;
            if (block.name === "search_catalog") {
              const res = await searchCatalog(input);
              if (res.cards.length > 0) {
                ndjson(controller, { type: "products", items: res.cards });
              }
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: res.modelText,
              });
            } else if (block.name === "search_knowledge") {
              const res = await searchKnowledge(String(input.query ?? ""));
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: res.modelText,
              });
            } else if (block.name === "request_human_handoff") {
              await setStatus(conv.id, "awaiting_human");
              await notifyHumanHandoff(conv.id, lastUserText);
              ndjson(controller, { type: "handoff" });
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content:
                  "Handoff started. Reassure the shopper that a member of the team will join this chat shortly, then stop.",
              });
            } else {
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: "Unknown tool.",
                is_error: true,
              });
            }
          }
          messages.push({ role: "user", content: toolResults });
        }

        // Persist the assistant's reply for the admin transcript.
        if (assistantText.trim()) {
          await appendMessage(conv.id, "assistant", assistantText);
        }
        ndjson(controller, { type: "done" });
      } catch (e) {
        console.error("[ai:chat]", e);
        ndjson(controller, {
          type: "error",
          message: "I'm sorry — I couldn't respond just now. Please try again.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
