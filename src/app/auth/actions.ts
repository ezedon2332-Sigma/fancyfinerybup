"use server";

import { headers } from "next/headers";

import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import { magicLinkSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/ai-rate-limit";

export interface EmailCheckResult {
  ok: boolean;
  exists: boolean;
  error?: string;
}

/**
 * Identity-first routing: does this email already have an account?
 *
 * Server-only and rate-limited. The boolean drives the UX (show sign-in vs.
 * create-account) and never reveals more than the signup flow already does. On
 * any failure it returns exists:false so the UI can fall back gracefully rather
 * than trap the customer.
 */
export async function checkEmailExists(email: unknown): Promise<EmailCheckResult> {
  const parsed = magicLinkSchema.safeParse({ email });
  if (!parsed.success) {
    return { ok: false, exists: false, error: "Enter a valid email address." };
  }

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip")?.trim() ||
    "unknown";
  const gate = rateLimit(`emailcheck:${ip}`, 30, 60_000);
  if (!gate.ok) {
    return { ok: false, exists: false, error: "Too many attempts — one moment." };
  }

  try {
    const admin = createSupabaseAdminClient();
    // The Database type leaves Functions untyped on purpose — typing it there
    // perturbs supabase-js relation inference for unrelated tables — so bind rpc
    // through a narrow local signature instead of widening the global schema.
    const callEmailExists = admin.rpc.bind(admin) as unknown as (
      name: "email_exists",
      args: { p_email: string },
    ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
    const { data, error } = await callEmailExists("email_exists", {
      p_email: parsed.data.email,
    });
    if (error) return { ok: false, exists: false, error: "Could not verify email." };
    return { ok: true, exists: Boolean(data) };
  } catch {
    return { ok: false, exists: false, error: "Could not verify email." };
  }
}
