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
 * **Nothing here runs until the first query.** The pool used to be constructed
 * at module scope, which read DATABASE_URL the moment anything imported this
 * file. `next build` imports every route module to collect page data, so the
 * build demanded a live database and failed in CI and inside `docker build` —
 * neither of which has one, or should. Building compiles code; it does not run
 * the app.
 *
 * The `db` export is a Proxy so that stays invisible to callers: every existing
 * `db.select(...)` and `db.query.products.findMany(...)` works unchanged, and
 * the connection is opened by whichever of them runs first.
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

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Next.js dev reloads modules on every edit, which would leak a pool per reload
 * and exhaust Postgres' connection limit within a few saves. Stashing both the
 * pool and the Drizzle instance on globalThis is the standard fix; production
 * simply memoises on first use.
 */
const globalForDb = globalThis as unknown as {
  __fancyPool?: Pool;
  __fancyDb?: DrizzleDb;
};

function getDb(): DrizzleDb {
  if (!globalForDb.__fancyDb) {
    globalForDb.__fancyPool ??= createPool();
    globalForDb.__fancyDb = drizzle(globalForDb.__fancyPool, {
      schema,
      casing: "snake_case",
    });
  }
  return globalForDb.__fancyDb;
}

export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
  // `has` and `ownKeys` keep `in` checks and spreads honest, so the Proxy is
  // not merely "good enough for the calls we happen to make today".
  has(_target, prop) {
    return Reflect.has(getDb(), prop);
  },
  ownKeys() {
    return Reflect.ownKeys(getDb());
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Reflect.getOwnPropertyDescriptor(getDb(), prop);
  },
});

/** The pool itself, for the rare raw query and for scripts that must close it. */
export function getPool(): Pool {
  globalForDb.__fancyPool ??= createPool();
  return globalForDb.__fancyPool;
}

export type Database = DrizzleDb;
