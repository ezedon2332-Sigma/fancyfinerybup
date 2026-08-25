"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

/**
 * Browser-side auth client — the replacement for `createSupabaseBrowserClient()`
 * in the two auth components.
 *
 * It talks to our own `/api/auth/*` handler on the same origin, so unlike the
 * Supabase browser client it carries no API key and needs no project URL:
 * there is nothing here that would be a secret if it leaked, because the
 * endpoints are the app's own and are protected by session cookies.
 *
 * `baseURL` is deliberately omitted so requests are same-origin relative. That
 * makes the client work unchanged on localhost, on a cloudflared tunnel, on
 * staging and in production, with no per-environment build.
 */
export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
} = authClient;
