// Apply SQL files to the Supabase Postgres DB over a direct connection.
//   SUPABASE_DB_URL="postgresql://..." node scripts/db-apply.mjs <file.sql> [file2.sql ...]
//
// The connection string is read from the env var SUPABASE_DB_URL and is never
// written to disk or logged. Each file is run inside its own transaction.

import { readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("Set SUPABASE_DB_URL (not persisted). Aborting.");
  process.exit(1);
}
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node scripts/db-apply.mjs <file.sql> [...]");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log("Connected.");
  for (const file of files) {
    const sql = readFileSync(file, "utf8");
    process.stdout.write(`Applying ${file} … `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("commit");
      console.log("ok");
    } catch (e) {
      await client.query("rollback").catch(() => {});
      console.log("FAILED");
      console.error(`  ${e.message}`);
      throw e;
    }
  }
  console.log("All files applied.");
} finally {
  await client.end();
}
