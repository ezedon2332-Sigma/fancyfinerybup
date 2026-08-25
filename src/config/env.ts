/**
 * Centralised, validated environment access (cross-cutting config layer).
 *
 * Two surfaces:
 *  - `publicEnv`  — safe for the browser; sourced from NEXT_PUBLIC_* vars.
 *  - `serverEnv`  — server-only secrets; importing that module from a Client
 *                   Component throws at build time thanks to `server-only`.
 *
 * Fail fast: a missing var throws here rather than surfacing as an opaque
 * runtime error deep inside the database driver or the S3 client.
 *
 * Each NEXT_PUBLIC_* var must be read as a literal `process.env.NEXT_PUBLIC_X`
 * expression — Next.js inlines those at build time by static analysis, so a
 * computed lookup would silently be `undefined` in the browser bundle.
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
  /**
   * Public base URL for product media (MinIO via Caddy). Used by
   * `resolveMediaUrl` for <img>/<video> sources, and as the host that presigned
   * upload URLs are signed against — a mismatch with the browser's actual
   * request host invalidates the signature.
   */
  mediaUrl: required(
    "NEXT_PUBLIC_MEDIA_URL",
    process.env.NEXT_PUBLIC_MEDIA_URL,
  ).replace(/\/$/, ""),
} as const;
