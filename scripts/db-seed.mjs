// Seed the database with catalogue demo data and the bootstrap admin.
//
//   npm run db:seed
//
// Idempotent — every insert is ON CONFLICT DO NOTHING (catalogue) or an upsert
// (admin), so re-running is safe and is the intended way to apply a changed
// ADMIN_PASSWORD.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { seedAdmin } from "./seed-admin.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(join(root, ".env"));
} catch {}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. See .env.example.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

try {
  await client.connect();

  // Production starts with an empty catalogue (real products are added in Admin);
  // only staging seeds the demo catalogue. Both environments seed the admin.
  const seedFile = join(root, "db", "seed.sql");
  if (existsSync(seedFile) && process.env.APP_ENV !== "production") {
    process.stdout.write("  catalogue … ");
    await client.query(readFileSync(seedFile, "utf8"));
    const { rows } = await client.query(
      "select (select count(*)::int from products) p, (select count(*)::int from categories) c",
    );
    console.log(`ok (${rows[0].p} products, ${rows[0].c} categories)`);
  } else if (process.env.APP_ENV === "production") {
    console.log("  catalogue … skipped (production starts empty)");
  }

  await seedAdmin(client);
} finally {
  await client.end();
}
