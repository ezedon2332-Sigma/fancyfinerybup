import "server-only";

import { randomUUID } from "node:crypto";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";

import { serverEnv } from "@/config/server-env";
import { sendEmail } from "@/infrastructure/notifications/email";
import { db } from "@/infrastructure/db/client";
import * as schema from "@/infrastructure/db/schema";
import { consumeInviteForEmail } from "@/infrastructure/db/admin-invite-service";

/**
 * Better Auth — the replacement for Supabase Auth (GoTrue).
 *
 * Feature parity with what the app used before, all of it now self-hosted:
 *   email + password · magic link · Google OAuth · email verification ·
 *   password reset.
 *
 * Three things worth knowing:
 *
 *  - **UUID ids.** Better Auth generates text ids by default. Every user
 *    reference in the 37 app tables is `uuid`, so `generateId` is overridden to
 *    emit UUIDs and the auth tables declare `uuid` columns. That is what keeps
 *    this a contained change rather than a schema-wide retype.
 *
 *  - **Mail goes through the app's own sender.** Supabase sent auth mail itself
 *    via a separately-configured SMTP block. Everything now flows through
 *    `sendEmail`, so order receipts and password resets share one provider, one
 *    from-address and one set of logs.
 *
 *  - **Profile creation is a database hook.** It replaces the
 *    `on_auth_user_created` trigger on `auth.users` and carries the admin
 *    promotion with it — a pending invite for the address makes the new account
 *    an admin, which is what the old `admin_allowlist` did without expiry,
 *    revocation or an audit trail.
 */

const googleEnabled = Boolean(
  serverEnv.googleClientId && serverEnv.googleClientSecret,
);

export const auth = betterAuth({
  appName: "Fancy Finery",
  secret: serverEnv.betterAuthSecret,
  baseURL: serverEnv.betterAuthUrl,

  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    // Our tables are `auth_user`/`auth_session`/…; the JS exports keep Better
    // Auth's model names, so only the physical names differ.
    usePlural: false,
  }),

  advanced: {
    database: {
      // Match the uuid columns the rest of the schema references.
      generateId: () => randomUUID(),
    },
    cookiePrefix: "fancy",
  },

  // Opt out of the package's anonymous usage reporting: this is a self-hosted
  // deployment and nothing about it should leave the VPS uninvited.
  telemetry: { enabled: false },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Supabase required a confirmed address before sign-in; keep that.
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your Fancy Finery password",
        html: resetPasswordHtml(url),
        text: `Reset your password: ${url}`,
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Confirm your Fancy Finery account",
        html: confirmSignupHtml(url),
        text: `Confirm your account: ${url}`,
      });
    },
  },

  socialProviders: googleEnabled
    ? {
        google: {
          clientId: serverEnv.googleClientId!,
          clientSecret: serverEnv.googleClientSecret!,
        },
      }
    : {},

  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: email,
          subject: "Your Fancy Finery sign-in link",
          html: magicLinkHtml(url),
          text: `Sign in: ${url}`,
        });
      },
    }),
    // Must be last: lets Server Actions set auth cookies.
    nextCookies(),
  ],

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Replaces public.handle_new_user(). A pending invite promotes the
          // account to admin and is consumed in the same step, so a link cannot
          // mint two admins.
          const invited = await consumeInviteForEmail(user.email, user.id);

          await db
            .insert(schema.profiles)
            .values({
              id: user.id,
              fullName: user.name || null,
              avatarUrl: user.image || null,
              role: invited ? "admin" : "customer",
            })
            .onConflictDoUpdate({
              target: schema.profiles.id,
              set: invited
                ? { role: "admin" }
                : { fullName: user.name || null },
            });
        },
      },
    },
  },
});

export type Auth = typeof auth;

/** True when Google sign-in is configured; the UI hides the button otherwise. */
export const isGoogleEnabled = googleEnabled;

/** Look up a profile row directly — used by the session helpers. */
export async function findProfileById(userId: string) {
  return db.query.profiles.findFirst({ where: eq(schema.profiles.id, userId) });
}

// --- Email bodies ---------------------------------------------------------
// Plain, inline-styled HTML: these are transactional and must render in every
// client, including the ones that strip <style> blocks.

function shell(heading: string, body: string, cta: { url: string; label: string }) {
  return `
<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px;color:#1a1a1a">
  <h1 style="font-size:22px;font-weight:400;letter-spacing:.02em;margin:0 0 16px">${heading}</h1>
  <p style="font-size:15px;line-height:1.6;margin:0 0 24px">${body}</p>
  <p style="margin:0 0 24px">
    <a href="${cta.url}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 24px;font-size:14px;letter-spacing:.04em">${cta.label}</a>
  </p>
  <p style="font-size:12px;color:#777;line-height:1.6;margin:0">
    If the button does not work, paste this into your browser:<br>
    <span style="word-break:break-all">${cta.url}</span>
  </p>
</div>`.trim();
}

function confirmSignupHtml(url: string) {
  return shell(
    "Confirm your account",
    "Welcome to Fancy Finery. Confirm this address to finish creating your account.",
    { url, label: "Confirm account" },
  );
}

function resetPasswordHtml(url: string) {
  return shell(
    "Reset your password",
    "We received a request to reset your password. If it wasn't you, you can safely ignore this email.",
    { url, label: "Reset password" },
  );
}

function magicLinkHtml(url: string) {
  return shell(
    "Your sign-in link",
    "Use the link below to sign in. It expires shortly and can only be used once.",
    { url, label: "Sign in" },
  );
}
