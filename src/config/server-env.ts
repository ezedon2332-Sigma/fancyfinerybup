import "server-only";

/**
 * Server-only environment access. The `server-only` import above makes any
 * attempt to bundle this into client code a hard build error — no secret here
 * can reach the browser.
 *
 * **Every value is a getter, validated on first ACCESS rather than on import.**
 * That is not a style choice, it is what makes the project buildable.
 *
 * The previous version validated at module scope, so merely importing this file
 * threw when a variable was unset. `next build` imports every route module to
 * collect page data, which meant the build required a live DATABASE_URL — and
 * failed in CI and inside `docker build`, neither of which has (or should have)
 * a database. A build compiles code; it does not run the app.
 *
 * Lazy access keeps the property that mattered: the first piece of code to
 * actually need a variable still fails immediately, with a message naming it,
 * rather than surfacing as an opaque error deep inside the pg driver or the S3
 * client. It just no longer fails for code paths that were only being imported.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(
      `Missing environment variable: ${name}. See .env.example and set it in .env.`,
    );
  }
  return value;
}

function optional(name: string): string | null {
  const value = process.env[name];
  return value && value.length > 0 ? value : null;
}

function int(name: string, fallback: number): number {
  const value = process.env[name];
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
  get databaseUrl(): string {
    return required("DATABASE_URL");
  },
  /** Keep under Postgres' max_connections, leaving room for psql and backups. */
  get databasePoolMax(): number {
    return int("DATABASE_POOL_MAX", 10);
  },

  // --- Auth ----------------------------------------------------------------
  /** Signs session cookies and verification tokens. Rotating invalidates all sessions. */
  get betterAuthSecret(): string {
    return required("BETTER_AUTH_SECRET");
  },
  /** Canonical origin for auth callbacks and emailed links. No trailing slash. */
  get betterAuthUrl(): string {
    return required("BETTER_AUTH_URL").replace(/\/$/, "");
  },
  /** Google sign-in stays dormant unless BOTH are present. */
  get googleClientId(): string | null {
    return optional("GOOGLE_CLIENT_ID");
  },
  get googleClientSecret(): string | null {
    return optional("GOOGLE_CLIENT_SECRET");
  },

  // --- Storage (MinIO / any S3-compatible) ---------------------------------
  /** Internal endpoint the SERVER uses. Not browser-reachable in production. */
  get s3Endpoint(): string {
    return required("S3_ENDPOINT").replace(/\/$/, "");
  },
  get s3Region(): string {
    return process.env.S3_REGION || "us-east-1";
  },
  get s3Bucket(): string {
    return required("S3_BUCKET");
  },
  get s3AccessKeyId(): string {
    return required("S3_ACCESS_KEY_ID");
  },
  get s3SecretAccessKey(): string {
    return required("S3_SECRET_ACCESS_KEY");
  },

  /**
   * Upload ceilings. Enforced server-side when the presigned URL is issued —
   * the client-side check in upload-media.ts is for fast failure only and is
   * not a control.
   */
  get maxImageBytes(): number {
    return int("MEDIA_MAX_IMAGE_MB", 25) * MB;
  },
  get maxVideoBytes(): number {
    return int("MEDIA_MAX_VIDEO_MB", 200) * MB;
  },
} as const;
