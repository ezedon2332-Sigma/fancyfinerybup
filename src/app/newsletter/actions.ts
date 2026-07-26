"use server";

import { headers } from "next/headers";

import { newsletterSignupSchema } from "@/lib/validation";
import {
  hashIp,
  isRateLimited,
  subscribe,
} from "@/infrastructure/supabase/newsletter-service";

export interface JoinResult {
  ok: boolean;
  /** Distinguishes a fresh join from an address already on the list, so the
   *  UI can say something true rather than a generic "thanks". */
  kind?: "created" | "resubscribed" | "already";
  error?: string;
  fieldErrors?: Record<string, string>;
}

/** Public entry point for the Privé Circle join form. */
export async function joinPriveCircle(
  input: unknown,
): Promise<JoinResult> {
  const parsed = newsletterSignupSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
  }

  // Honeypot: hidden from humans, irresistible to bots. Answer "ok" so the
  // bot has nothing to learn from the response.
  if (parsed.data.website) return { ok: true, kind: "created" };

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  const ipHash = hashIp(ip);

  if (await isRateLimited(ipHash)) {
    return {
      ok: false,
      error: "Too many attempts from this network. Please try again shortly.",
    };
  }

  try {
    const outcome = await subscribe({
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName ?? null,
      country: parsed.data.country ?? null,
      birthday: parsed.data.birthday || null,
      interests: parsed.data.interests,
      source: parsed.data.source,
      ipHash,
      userAgent: h.get("user-agent"),
    });
    return { ok: true, kind: outcome.kind };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
