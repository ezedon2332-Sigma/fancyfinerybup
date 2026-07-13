/**
 * Centralised, validated environment access (cross-cutting config layer).
 *
 * Two surfaces:
 *  - `publicEnv`  — safe for the browser; sourced from NEXT_PUBLIC_* vars.
 *  - `serverEnv`  — server-only secrets; importing this from a Client Component
 *                   throws at build time thanks to `server-only`.
 *
 * Fail fast: a missing var throws here rather than surfacing as an opaque
 * runtime error deep inside the Supabase client.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing environment variable: ${name}. See .env.example and set it in .env.`,
    );
  }
  return value;
}

/** Browser-safe configuration. Importable from client or server code. */
export const publicEnv = {
  supabaseUrl: required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  supabasePublishableKey: required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
} as const;
