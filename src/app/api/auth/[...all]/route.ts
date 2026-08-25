import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/infrastructure/auth/auth";

/**
 * Better Auth's endpoints: sign-in, sign-up, sign-out, session, email
 * verification, password reset, magic link, and the OAuth callback
 * (/api/auth/callback/google).
 *
 * This replaces both the hosted GoTrue endpoints and the app's own
 * /auth/callback route, which existed to exchange a Supabase code or
 * token_hash for a session cookie. Better Auth owns that exchange now.
 */
export const { GET, POST } = toNextJsHandler(auth);
