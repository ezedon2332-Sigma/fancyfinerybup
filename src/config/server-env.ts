import "server-only";

/**
 * Server-only environment access. The `server-only` import above makes any
 * attempt to bundle this into client code a hard build error — the secret key
 * can never leak to the browser.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing environment variable: ${name}. See .env.example and set it in .env.`,
    );
  }
  return value;
}

export const serverEnv = {
  supabaseUrl: required("SUPABASE_URL", process.env.SUPABASE_URL),
  supabasePublishableKey: required(
    "SUPABASE_PUBLISHABLE_KEY",
    process.env.SUPABASE_PUBLISHABLE_KEY,
  ),
  /** Bypasses Row Level Security. Use ONLY in trusted server contexts. */
  supabaseSecretKey: required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
  supabaseJwksUrl: required("SUPABASE_JWKS_URL", process.env.SUPABASE_JWKS_URL),
} as const;
