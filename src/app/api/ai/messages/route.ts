import { z } from "zod";

import {
  getConversationByToken,
  appendMessage,
  loadMessagesAfter,
} from "@/infrastructure/ai/conversations";
import { rateLimit } from "@/lib/ai-rate-limit";
import type { ConciergeTranscriptMessage } from "@/lib/ai-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("poll"),
    token: z.string().uuid(),
    after: z.string().datetime().optional(),
  }),
  z.object({
    action: z.literal("send"),
    token: z.string().uuid(),
    content: z.string().trim().min(1).max(2000),
  }),
]);

function clientIp(req: Request): string {
  // Prefer the platform-set x-real-ip over the client-controllable leftmost
  // x-forwarded-for entry.
  return (
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  );
}

/**
 * Customer-side transcript for a handed-off conversation. Gated on the
 * conversation's unguessable token — the customer only ever sees their own
 * thread. `poll` returns staff/system messages the shopper hasn't seen; `send`
 * appends a shopper message (no bot reply — a human is handling it).
 */
export async function POST(request: Request): Promise<Response> {
  let input;
  try {
    input = schema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const conv = await getConversationByToken(input.token);
  if (!conv) return Response.json({ error: "Not found." }, { status: 404 });

  if (input.action === "send") {
    const gate = rateLimit(`aimsg:${clientIp(request)}`, 30, 60_000);
    if (!gate.ok) {
      return Response.json({ error: "Slow down a moment." }, { status: 429 });
    }
    await appendMessage(conv.id, "user", input.content);
    return Response.json({ ok: true, status: conv.status });
  }

  // poll
  const all = await loadMessagesAfter(conv.id, input.after ?? null);
  const messages: ConciergeTranscriptMessage[] = all
    .filter((m) => m.role !== "user") // the shopper already sees their own
    .map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    }));
  return Response.json({ status: conv.status, messages });
}
