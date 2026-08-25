"use server";

import { headers } from "next/headers";

import { signUpSchema, signUpFieldErrors } from "@/lib/validation";
import { composeFullName } from "@/domain/password-policy";
import { countryByCode } from "@/domain/shipping/countries";
import { eq } from "drizzle-orm";

import { auth } from "@/infrastructure/auth/auth";
import { db } from "@/infrastructure/db/client";
import { profiles } from "@/infrastructure/db/schema";
import { rateLimit } from "@/lib/ai-rate-limit";

export interface SignUpResult {
  ok: boolean;
  /** "active" — account is ready; the client signs in immediately. */
  kind?: "active" | "verify";
  email?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Create a customer account.
 *
 * **Email verification is restored here.** The previous implementation created
 * every account ALREADY CONFIRMED (`email_confirm: true` via the Supabase admin
 * API) and signed the browser straight in. Its own comment explains why: the
 * Supabase built-in mailer was rate-limited, no custom SMTP was configured, and
 * confirmation emails never reached customers — so verifying was worse than not
 * verifying, because it stranded real shoppers on a "check your inbox" screen
 * forever.
 *
 * That constraint is gone. Auth mail now goes through the same Resend sender as
 * order receipts, from a verified domain, so the message actually arrives and
 * the account can be held unverified until the customer proves the address.
 * The comment promised to switch back once SMTP worked; this is that switch.
 *
 * Runs on the server so the schema and the honeypot verdict never reach the
 * browser. The password is passed only to Better Auth, which hashes it with
 * scrypt; nothing here reads, logs, or stores it.
 */
export async function signUpAction(input: unknown): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the highlighted fields.",
      fieldErrors: signUpFieldErrors(input),
    };
  }

  const data = parsed.data;

  // Honeypot: hidden from humans, irresistible to bots. Report success so the
  // bot learns nothing, and create nothing.
  if (data.website) return { ok: true, kind: "active", email: data.email };

  // Light per-IP throttle. Sign-up now sends a verification email, so an
  // unthrottled endpoint is also a way to make us mail strangers on demand.
  const h = await headers();
  const ip =
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown";
  if (!rateLimit(`signup:${ip}`, 8, 60 * 60 * 1000).ok) {
    return { ok: false, error: "Too many sign-up attempts. Please try again later." };
  }

  let userId: string | null = null;
  try {
    // Sends the verification email as a side effect (emailVerification.
    // sendOnSignUp in src/infrastructure/auth/auth.ts).
    const created = await auth.api.signUpEmail({
      body: {
        email: data.email,
        password: data.password,
        name: composeFullName(data.firstName, data.lastName),
      },
    });
    userId = created?.user?.id ?? null;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);

    // Deliberately the same wording as before. It reveals that an address is
    // registered, which the sign-in form already reveals, and the alternative —
    // a silent success — sends a real customer to an inbox with nothing in it.
    if (
      /already been registered|already registered|already exists|duplicate|email_exists|has already|USER_ALREADY_EXISTS/i.test(
        message,
      )
    ) {
      return {
        ok: false,
        error: "An account already exists for that email. Try signing in instead.",
        fieldErrors: { email: "This email is already registered" },
      };
    }
    if (/rate limit|too many/i.test(message)) {
      return {
        ok: false,
        error: "Too many attempts. Please wait a moment and try again.",
      };
    }
    console.error("[signup] failed", { email: data.email, message });
    return { ok: false, error: "Could not create your account. Please try again." };
  }

  // The Better Auth databaseHook creates the profile row; write phone/country
  // onto it (best-effort — a failure must not lose the account).
  if (userId && (data.phone || data.country)) {
    try {
      const patch: { phone?: string; country?: string } = {};
      if (data.phone) patch.phone = data.phone;
      if (data.country) {
        patch.country = countryByCode(data.country)?.name ?? data.country;
      }
      await db.update(profiles).set(patch).where(eq(profiles.id, userId));
    } catch {
      /* the customer can add these at checkout */
    }
  }

  // The customer must confirm the address before the account can sign in.
  return { ok: true, kind: "verify", email: data.email };
}
