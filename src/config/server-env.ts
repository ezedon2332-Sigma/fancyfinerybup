import "server-only";

/**
 * Server-only environment access. The `server-only` import above makes any
 * attempt to bundle this into client code a hard build error — no secret here
 * can reach the browser.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing environment variable: ${name}. See .env.example and set it in .env.`,
    );
  }
  return value;
}

function optional(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null;
}

function int(name: string, value: string | undefined, fallback: number): number {
  if (!value || value.length === 0) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Environment variable ${name} must be a positive number.`);
  }
  return n;
}

const MB = 1024 * 1024;

export const serverEnv = {
  // --- Database ------------------------------------------------------------
  databaseUrl: required("DATABASE_URL", process.env.DATABASE_URL),
  /** Keep under Postgres' max_connections, leaving room for psql and backups. */
  databasePoolMax: int("DATABASE_POOL_MAX", process.env.DATABASE_POOL_MAX, 10),

  // --- Auth ----------------------------------------------------------------
  /** Signs session cookies and verification tokens. Rotating invalidates all sessions. */
  betterAuthSecret: required("BETTER_AUTH_SECRET", process.env.BETTER_AUTH_SECRET),
  /** Canonical origin for auth callbacks and emailed links. No trailing slash. */
  betterAuthUrl: required(
    "BETTER_AUTH_URL",
    process.env.BETTER_AUTH_URL,
  ).replace(/\/$/, ""),
  /** Google sign-in stays dormant unless BOTH are present. */
  googleClientId: optional(process.env.GOOGLE_CLIENT_ID),
  googleClientSecret: optional(process.env.GOOGLE_CLIENT_SECRET),

  // --- Storage (MinIO / any S3-compatible) ---------------------------------
  /** Internal endpoint the SERVER uses. Not browser-reachable in production. */
  s3Endpoint: required("S3_ENDPOINT", process.env.S3_ENDPOINT).replace(/\/$/, ""),
  s3Region: process.env.S3_REGION || "us-east-1",
  s3Bucket: required("S3_BUCKET", process.env.S3_BUCKET),
  s3AccessKeyId: required("S3_ACCESS_KEY_ID", process.env.S3_ACCESS_KEY_ID),
  s3SecretAccessKey: required(
    "S3_SECRET_ACCESS_KEY",
    process.env.S3_SECRET_ACCESS_KEY,
  ),

  /**
   * Upload ceilings. Enforced server-side when the presigned URL is issued —
   * the client-side check in upload-media.ts is for fast failure only and is
   * not a control.
   */
  maxImageBytes: int("MEDIA_MAX_IMAGE_MB", process.env.MEDIA_MAX_IMAGE_MB, 25) * MB,
  maxVideoBytes: int("MEDIA_MAX_VIDEO_MB", process.env.MEDIA_MAX_VIDEO_MB, 200) * MB,
} as const;
