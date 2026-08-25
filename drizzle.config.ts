import type { Config } from "drizzle-kit";

/**
 * Drizzle Kit configuration — schema introspection and migration generation.
 *
 * `db/baseline.sql` remains the canonical initial schema (see its header for
 * provenance). Drizzle owns everything AFTER that: `drizzle-kit generate`
 * writes incremental migrations into `db/migrations/`.
 *
 * Next.js loads `.env` itself, but drizzle-kit runs outside it, so load the
 * file explicitly. `loadEnvFile` is built into Node 21+ (this repo runs 24) —
 * no dotenv dependency needed.
 */
try {
  process.loadEnvFile(".env");
} catch {
  // Absent in CI, where DATABASE_URL is supplied by the environment directly.
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. See .env.example.");
}

export default {
  dialect: "postgresql",
  schema: "./src/infrastructure/db/schema/index.ts",
  out: "./db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL },
  // Keep generated names stable and readable in the diffs.
  casing: "snake_case",
  verbose: true,
  strict: true,
} satisfies Config;
