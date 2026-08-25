// Apply the database schema: the baseline first, then any Drizzle-generated
// deltas, each exactly once, each in its own transaction.
//
//   npm run db:migrate
//
// Why not `drizzle-kit migrate`? Drizzle introspects tables, enums, indexes and
// constraints — but NOT functions or triggers, and this schema has 5 functions
// and 18 triggers doing real work (updated_at stamping, review rating recounts,
// discount usage counters, campaign counters). `db/baseline.sql` is a dump of
// the real database, so it carries all of them. Drizzle owns everything after
// that: `npm run db:generate` writes deltas into db/migrations/.
//
// Idempotent: safe to run on every boot and in CI.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

try {
  process.loadEnvFile(join(root, ".env"));
} catch {
  // Absent in CI/production, where the environment supplies DATABASE_URL.
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. See .env.example.");
  process.exit(1);
}

const BASELINE = join(root, "db", "baseline.sql");
const REFERENCE = join(root, "db", "reference-data.sql");
const MIGRATIONS_DIR = join(root, "db", "migrations");

const client = new pg.Client({ connectionString: url });

/**
 * Files to apply, in order: schema, then the reference data the store cannot
 * operate without, then deltas sorted by filename.
 *
 * reference-data.sql is NOT optional and NOT sample data. Ten of the original
 * migrations carried INSERTs for shipping zones, couriers, weight bands, the
 * rate matrix, Nigeria's delivery areas and the singleton settings rows. Ship
 * the schema without them and every table is correct while checkout cannot
 * quote a single delivery.
 */
function plan() {
  const files = [{ name: "baseline.sql", path: BASELINE }];
  if (existsSync(REFERENCE)) {
    files.push({ name: "reference-data.sql", path: REFERENCE });
  }
  if (existsSync(MIGRATIONS_DIR)) {
    for (const f of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
      files.push({ name: f, path: join(MIGRATIONS_DIR, f) });
    }
  }
  // Two migrations sharing a numeric prefix is a latent ordering bug: the sort
  // is by full filename so it is deterministic today, but the next hand-written
  // file could land either side of a generated one depending on its name. Fail
  // loudly at the point it is introduced rather than on the day it matters.
  const prefixes = new Map();
  for (const f of files) {
    const m = /^(\d{4})_/.exec(f.name);
    if (!m) continue;
    const seen = prefixes.get(m[1]);
    if (seen) {
      throw new Error(
        `Duplicate migration prefix ${m[1]}: "${seen}" and "${f.name}". ` +
          `Renumber one of them so the apply order is unambiguous.`,
      );
    }
    prefixes.set(m[1], f.name);
  }

  return files;
}

try {
  await client.connect();

  await client.query(`
    create table if not exists public.schema_migrations (
      name        text primary key,
      applied_at  timestamptz not null default now()
    )
  `);

  const { rows } = await client.query("select name from public.schema_migrations");
  const applied = new Set(rows.map((r) => r.name));

  let ran = 0;
  for (const file of plan()) {
    if (applied.has(file.name)) {
      console.log(`  skip  ${file.name} (already applied)`);
      continue;
    }
    process.stdout.write(`  apply ${file.name} … `);
    try {
      await client.query("begin");
      // baseline.sql is a pg_dump, and pg_dump blanks the search_path at
      // SESSION scope (`set_config(..., false)`). That outlives its own file
      // and leaves every later migration unable to resolve an unqualified
      // CREATE TABLE — "no schema has been selected to create in". Re-assert it
      // per file. The dump itself is fully schema-qualified, so overriding it
      // costs nothing.
      await client.query("set search_path to public");
      await client.query(readFileSync(file.path, "utf8"));
      await client.query("insert into public.schema_migrations (name) values ($1)", [
        file.name,
      ]);
      await client.query("commit");
      console.log("ok");
      ran += 1;
    } catch (e) {
      await client.query("rollback").catch(() => {});
      console.log("FAILED");
      console.error(`\n${e.message}\n`);
      throw e;
    }
  }

  console.log(ran === 0 ? "Database already up to date." : `Applied ${ran} file(s).`);
} finally {
  await client.end();
}
