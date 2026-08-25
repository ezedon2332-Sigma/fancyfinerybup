import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { serverEnv } from "@/config/server-env";
import * as schema from "./schema";

/**
 * The database connection — one pool per process, shared by every repository.
 *
 * Replaces the Supabase clients. Note what is NOT here: there is no separate
 * "anon" and "service role" client any more. Supabase needed two because Row
 * Level Security decided what each could see; we connect once as the app's own
 * role, and authorization is decided in application code (the repository
 * adapters and the requireAdmin gate). See docs/MIGRATION_PLAN.md Phase 6.
 *
 * Next.js dev reloads modules on every edit, which would leak a pool per reload
 * and exhaust Postgres' connection limit within a few saves. Stashing the pool
 * on globalThis is the standard fix; production takes the plain path.
 */
function createPool(): Pool {
  return new Pool({
    connectionString: serverEnv.databaseUrl,
    max: serverEnv.databasePoolMax,
    // Postgres is a container away, not an ocean away. Fail fast rather than
    // letting a request hang on a dead pool.
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
}

const globalForDb = globalThis as unknown as { __fancyPool?: Pool };

const pool = globalForDb.__fancyPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.__fancyPool = pool;

export const db = drizzle(pool, { schema, casing: "snake_case" });

/** The pool itself, for the rare raw query and for scripts that must close it. */
export { pool };

export type Database = typeof db;
