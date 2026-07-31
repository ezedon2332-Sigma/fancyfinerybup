"use server";

import { headers } from "next/headers";

import { signUpSchema } from "@/lib/validation";
import { composeFullName } from "@/domain/password-policy";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import { SITE_URL } from "@/lib/site";

export interface SignUpResult {
  ok: boolean;
  /** "active" — signed in already. "verify" — a confirmation email was sent. */
  kind?: "active" | "verify";
  email?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Create a customer account.
 *
 * Runs on the server rather than calling Supabase from the browser, for three
 * reasons: the schema that decides is the one the client cannot edit, the
 * session cookie is set by the SSR adapter rather than reconstructed after the
 * fact, and the honeypot verdict never reaches the browser.
 *
 * Passwords are never handled here beyond being passed to Supabase Auth, which
 * stores them bcrypt-hashed in `auth.users`. Nothing in this codebase reads,
 * logs or stores a password, and the profile row deliberately holds no
 * credential material at all.
 */
export async function signUpAction(input: unknown): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      ok: false,
      error: "Please check the highlighted fields.",
      fieldErrors,
    };
  }

  const data = parsed.data;

  // Honeypot: hidden from humans, irresistible to bots. Report success so the
  // bot learns nothing from the response, and create nothing.
  if (data.website) return { ok: true, kind: "verify", email: data.email };

  const h = await headers();
  const origin = h.get("origin") ?? SITE_URL;

  const supabase = await createSupabaseServerClient();
  const { data: created, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      // Read by the on-signup trigger, which writes the profile row.
      data: {
        full_name: composeFullName(data.firstName, data.lastName),
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone || null,
      },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/account")}`,
    },
  });

  if (error) {
    // Supabase reports an existing address in a few different wordings.
    if (/already registered|already exists|user already/i.test(error.message)) {
      return {
        ok: false,
        error:
          "An account already exists for that email. Try signing in instead.",
        fieldErrors: { email: "This email is already registered" },
      };
    }
    if (/rate limit|too many/i.test(error.message)) {
      return {
        ok: false,
        error:
          "Too many attempts from this network. Please wait a moment and try again.",
      };
    }
    return { ok: false, error: error.message };
  }

  // Duplicate address, the quiet way.
  //
  // With email confirmation enabled Supabase does NOT error for an address that
  // already exists — that would let anyone test which emails have accounts.
  // It returns a user with an empty `identities` array and sends no mail. Left
  // unhandled, a duplicate signup would show the customer a cheerful "check
  // your inbox" for a message that is never coming.
  //
  // We do tell them the address is taken, which trades a little enumeration
  // resistance for not stranding a real customer who simply forgot they had an
  // account. The sign-in link next to the message is the point.
  if (created.user && (created.user.identities?.length ?? 0) === 0) {
    return {
      ok: false,
      error: "An account already exists for that email. Try signing in instead.",
      fieldErrors: { email: "This email is already registered" },
    };
  }

  // The trigger creates the profile from auth metadata, but it only knows about
  // full_name and avatar_url. Phone is written here instead of by extending the
  // trigger, so this needs no migration and works whether or not the address
  // has been confirmed yet. Best-effort: a failure here must not lose an
  // account that already exists.
  if (created.user && data.phone) {
    try {
      const admin = createSupabaseAdminClient();
      await admin
        .from("profiles")
        .update({ phone: data.phone })
        .eq("id", created.user.id);
    } catch {
      /* the customer can add it at checkout */
    }
  }

  // With email confirmation enabled there is no session yet. Saying so beats
  // redirecting to a dashboard that will bounce them straight back to login.
  return created.session
    ? { ok: true, kind: "active", email: data.email }
    : { ok: true, kind: "verify", email: data.email };
}
