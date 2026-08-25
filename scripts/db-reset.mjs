// Drop every object in the public schema and rebuild: migrate, then seed.
//
//   npm run db:reset
//
// Development only. Refuses to run against NODE_ENV=production, and refuses any
// DATABASE_URL that is not pointed at localhost unless --force is passed —
// "reset the database" is a sentence you only want to be true where you meant
// it.

import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(join(root, ".env"));
} catch {}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const force = process.argv.includes("--force");

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to reset with NODE_ENV=production.");
  process.exit(1);
}

const host = new URL(url).hostname;
const isLocal = host === "localhost" || host === "127.0.0.1" || host === "postgres";
if (!isLocal && !force) {
  console.error(
    `DATABASE_URL points at "${host}", which is not local. Re-run with --force if you are certain.`,
  );
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
process.stdout.write("  dropping public schema … ");
await client.query("drop schema public cascade");
await client.query("create schema public");
console.log("ok");
await client.end();

for (const script of ["db-migrate.mjs", "db-seed.mjs"]) {
  const r = spawnSync(process.execPath, [join(root, "scripts", script)], {
    stdio: "inherit",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
