// Regenerate db/baseline.sql from the original Supabase migrations.
//
//   npm run db:baseline
//
// This exists so the baseline stays PROVABLE rather than trusted. It rebuilds
// the schema the same way it was built the first time:
//
//   1. create a throwaway database
//   2. install compat shims (db/provenance/00_shim.sql) so the 28 Supabase
//      migrations apply UNMODIFIED — fidelity comes from running the real SQL,
//      not from retyping it
//   3. apply supabase/migrations/*.sql in filename order
//   4. strip every Supabase-ism (db/provenance/99_cleanup.sql)
//   5. pg_dump the result over the shim-free schema that remains
//
// Requires the postgres container to be running (docker compose up -d) because
// it shells out to pg_dump inside it.
//
// Once supabase/migrations/ is deleted at teardown this script retires with it;
// db/baseline.sql is the artifact that matters, and db/migrations/ takes over.

import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(join(root, ".env"));
} catch {}

const SRC = join(root, "supabase", "migrations");
if (!existsSync(SRC)) {
  console.error(
    `${SRC} is gone — the baseline has already been taken and this script has served its purpose.`,
  );
  process.exit(1);
}

const CONTAINER = process.env.POSTGRES_CONTAINER || "fancy-postgres";
const USER = process.env.POSTGRES_USER || "fancy";
const PORT = process.env.POSTGRES_PORT || "55432";
const PASSWORD = process.env.POSTGRES_PASSWORD || "";
const SCRATCH_DB = "baseline_scratch";

const admin = new pg.Client({
  host: "localhost",
  port: Number(PORT),
  user: USER,
  password: PASSWORD,
  database: "postgres",
});
await admin.connect();
await admin.query(`drop database if exists ${SCRATCH_DB}`);
await admin.query(`create database ${SCRATCH_DB}`);
await admin.end();
console.log(`Created scratch database ${SCRATCH_DB}.`);

const client = new pg.Client({
  host: "localhost",
  port: Number(PORT),
  user: USER,
  password: PASSWORD,
  database: SCRATCH_DB,
});
await client.connect();

async function run(label, sql) {
  process.stdout.write(`  ${label} … `);
  await client.query(sql);
  console.log("ok");
}

try {
  await run("shim", readFileSync(join(root, "db/provenance/00_shim.sql"), "utf8"));

  for (const f of readdirSync(SRC).filter((f) => f.endsWith(".sql")).sort()) {
    await run(f, readFileSync(join(SRC, f), "utf8"));
  }

  await run("cleanup", readFileSync(join(root, "db/provenance/99_cleanup.sql"), "utf8"));

  // Prove the strip worked before trusting the dump.
  const checks = await client.query(`
    select
      (select count(*) from pg_policies where schemaname = 'public')                       as policies,
      (select count(*) from pg_tables  where schemaname = 'public' and rowsecurity)        as rls_tables,
      (select count(*) from pg_namespace where nspname in ('auth','storage'))              as supa_schemas,
      (select count(*) from pg_tables  where schemaname = 'public')                        as tables
  `);
  const { policies, rls_tables, supa_schemas, tables } = checks.rows[0];
  if (Number(policies) || Number(rls_tables) || Number(supa_schemas)) {
    throw new Error(
      `Cleanup incomplete: policies=${policies} rls=${rls_tables} schemas=${supa_schemas}`,
    );
  }
  console.log(`  verified: ${tables} tables, no RLS, no auth/storage schemas`);
} finally {
  await client.end();
}

const dump = execFileSync(
  "docker",
  [
    "exec", CONTAINER,
    "pg_dump", "-U", USER, "-d", SCRATCH_DB,
    "--schema-only", "--no-owner", "--no-privileges", "--schema=public",
  ],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);

// ---------------------------------------------------------------------------
// Reference data.
//
// Ten of the 28 migrations carry INSERT statements — shipping zones, couriers,
// the weight ladder, the published rate matrix, Nigeria's states and delivery
// areas, the colour list, and the singleton settings rows. A `--schema-only`
// dump throws all of it away, which leaves a database whose tables are correct
// and whose checkout cannot quote a single delivery. (It did exactly that:
// every shipping table came back empty and the basket reported "this order
// exceeds our published weight bands".)
//
// The scratch database contains precisely this data and nothing else — it was
// built from migrations alone and no human has touched it — so a data-only dump
// of it IS the reference set.
//
// `admin_allowlist` is excluded: it is replaced by admin_invites.
const referenceData = execFileSync(
  "docker",
  [
    "exec", CONTAINER,
    "pg_dump", "-U", USER, "-d", SCRATCH_DB,
    "--data-only", "--no-owner", "--no-privileges",
    "--schema=public",
    // COPY ... FROM stdin cannot be executed over the wire by the `pg` driver
    // that applies this file — it is a psql streaming construct. --inserts
    // emits ordinary INSERT statements instead.
    "--inserts",
    "--rows-per-insert=200",
    // Makes the file re-runnable, which is what lets it be applied as a
    // migration step rather than a one-shot import.
    "--on-conflict-do-nothing",
    "--exclude-table=public.admin_allowlist",
    "--exclude-table=public.schema_migrations",
  ],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
)
  .replace(/^\\(un)?restrict .*$/gm, "");

const referenceRows = (referenceData.match(/^INSERT INTO /gm) ?? []).length;
writeFileSync(
  join(root, "db/reference-data.sql"),
  `-- ---------------------------------------------------------------------------
-- Fancy Finery — reference data. GENERATED by \`npm run db:baseline\`.
--
-- The configuration the store cannot operate without: shipping zones and their
-- country assignments, couriers, the weight ladder, the published rate matrix,
-- tax rules, Nigeria's states and delivery areas, the colour list, and the
-- singleton settings rows.
--
-- This is NOT sample data. db/seed.sql holds the demo catalogue and is
-- development-only; this file is applied in every environment, because without
-- it checkout cannot quote a delivery.
--
-- Idempotent by construction: applied once and recorded in schema_migrations,
-- exactly like the baseline.
-- ---------------------------------------------------------------------------

${referenceData}`,
  "utf8",
);
console.log(`Wrote db/reference-data.sql (${referenceRows} insert statements)`);

const header = readFileSync(join(root, "db/provenance/header.sql"), "utf8");

const body = dump
  // pg_dump emits a bare CREATE SCHEMA public, which fails on a database that
  // already has one. Every target does.
  .replace(/^CREATE SCHEMA public;$/m, "CREATE SCHEMA IF NOT EXISTS public;")
  // pg_dump 17.6+ wraps its output in `\restrict` / `\unrestrict`. Those are
  // psql meta-commands, not SQL: psql understands them, the `pg` driver that
  // applies this file does not, and chokes with `syntax error at or near "\"`.
  .replace(/^\\(un)?restrict .*$/gm, "");

writeFileSync(join(root, "db/baseline.sql"), header + body, "utf8");
console.log("Wrote db/baseline.sql");

const cleanup = new pg.Client({
  host: "localhost", port: Number(PORT), user: USER,
  password: PASSWORD, database: "postgres",
});
await cleanup.connect();
await cleanup.query(`drop database if exists ${SCRATCH_DB}`);
await cleanup.end();
console.log("Dropped scratch database.");
