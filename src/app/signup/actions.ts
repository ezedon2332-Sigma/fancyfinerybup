"use server";

import { headers } from "next/headers";

import { signUpSchema, signUpFieldErrors } from "@/lib/validation";
import { composeFullName } from "@/domain/password-policy";
import { countryByCode } from "@/domain/shipping/countries";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
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
 * Create a customer account — reliably, without depending on confirmation-email
 * delivery.
 *
 * The project's Supabase instance requires email confirmation, but the built-in
 * mailer is heavily rate-limited and no custom SMTP is configured, so those
 * emails don't reach real customers. Rather than strand every new shopper on a
 * "check your inbox" screen for a message that never arrives, the account is
 * created ALREADY CONFIRMED via the admin API (`email_confirm: true`) and the
 * browser signs in straight after. To restore the email-verification flow,
 * configure custom SMTP in the Supabase dashboard and switch back to
 * `auth.signUp` with `emailRedirectTo`.
 *
 * Runs on the server so the schema, the honeypot verdict, and the service-role
 * key never reach the browser. Passwords are only ever passed to Supabase Auth
 * (bcrypt-hashed in auth.users); nothing here reads, logs, or stores them.
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

  // Light per-IP throttle — creating confirmed accounts has no email step to
  // slow abuse, so cap it here (8 / hour / IP).
  const h = await headers();
  const ip =
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown";
  if (!rateLimit(`signup:${ip}`, 8, 60 * 60 * 1000).ok) {
    return { ok: false, error: "Too many sign-up attempts. Please try again later." };
  }

  const admin = createSupabaseAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true, // no confirmation email required
    user_metadata: {
      full_name: composeFullName(data.firstName, data.lastName),
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone || null,
      country: data.country || null,
      terms_accepted_at: new Date().toISOString(),
    },
  });

  // Server-side diagnostics (never returned to the browser).
  console.log("[signup] admin.createUser", {
    email: data.email,
    hasUser: Boolean(created?.user),
    userId: created?.user?.id ?? null,
    error: error
      ? {
          message: error.message,
          status: (error as { status?: number }).status ?? null,
          code: (error as { code?: string }).code ?? null,
        }
      : null,
  });

  if (error) {
    if (
      /already been registered|already registered|already exists|duplicate|email_exists|has already/i.test(
        error.message,
      )
    ) {
      return {
        ok: false,
        error: "An account already exists for that email. Try signing in instead.",
        fieldErrors: { email: "This email is already registered" },
      };
    }
    if (/rate limit|too many/i.test(error.message)) {
      return {
        ok: false,
        error: "Too many attempts. Please wait a moment and try again.",
      };
    }
    return { ok: false, error: error.message };
  }

  // The on-signup trigger creates the profile from the metadata above; write
  // phone/country onto it (best-effort — a failure must not lose the account).
  if (created.user && (data.phone || data.country)) {
    try {
      const patch: { phone?: string; country?: string } = {};
      if (data.phone) patch.phone = data.phone;
      if (data.country) {
        patch.country = countryByCode(data.country)?.name ?? data.country;
      }
      await admin.from("profiles").update(patch).eq("id", created.user.id);
    } catch {
      /* the customer can add these at checkout */
    }
  }

  // Account is ready and confirmed — the client signs in to establish a session.
  return { ok: true, kind: "active", email: data.email };
}
