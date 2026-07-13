// Verify the Phase 1 schema is present in Supabase.
// Usage: node scripts/db-check.mjs
// Reads SUPABASE_URL / SUPABASE_SECRET_KEY from .env (no CLI needed).

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Minimal .env loader (avoids a dependency; ignores quotes/comments).
function loadEnv(path = ".env") {
  const out = {};
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  } catch {
    /* no .env — fall back to process.env */
  }
  return { ...out, ...process.env };
}

const env = loadEnv();
const url = env.SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TABLES = [
  "profiles",
  "categories",
  "products",
  "product_images",
  "product_variants",
  "orders",
  "order_items",
];

let allPresent = true;
console.log(`Checking schema on ${url}\n`);

for (const table of TABLES) {
  // NOTE: use a real GET (not head:true). A HEAD response has no body, so
  // PostgREST's error JSON is invisible and missing tables look "present".
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact" })
    .limit(1);

  if (error) {
    allPresent = false;
    console.log(`  ✗ ${table.padEnd(18)} MISSING (${error.code ?? error.message})`);
  } else {
    console.log(`  ✓ ${table.padEnd(18)} present (${count ?? 0} rows)`);
  }
}

console.log(
  allPresent
    ? "\nAll Phase 1 tables present. ✅"
    : "\nSome tables are missing — apply supabase/migrations first (see supabase/README.md).",
);
process.exit(allPresent ? 0 : 1);
