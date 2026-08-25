"use server";

import { headers } from "next/headers";

import { sql } from "drizzle-orm";

import { db } from "@/infrastructure/db/client";
import { user } from "@/infrastructure/db/schema";
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
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown";
  const gate = rateLimit(`emailcheck:${ip}`, 30, 60_000);
  if (!gate.ok) {
    return { ok: false, exists: false, error: "Too many attempts — one moment." };
  }

  try {
    // Replaces the `email_exists()` SECURITY DEFINER function. That existed so
    // PostgREST could answer this question without granting the browser read
    // access to auth.users; the identity table is ours now and this code runs
    // server-side, so a plain query is both sufficient and clearer.
    //
    // Matched case-insensitively against the unique index on email.
    const [row] = await db
      .select({ n: sql<number>`1` })
      .from(user)
      .where(sql`lower(${user.email}) = ${parsed.data.email.toLowerCase()}`)
      .limit(1);
    return { ok: true, exists: Boolean(row) };
  } catch {
    return { ok: false, exists: false, error: "Could not verify email." };
  }
}
