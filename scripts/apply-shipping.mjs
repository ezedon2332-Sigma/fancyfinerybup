// Apply the shipping migrations AND seed all countries in one shot.
//   1) Put your DB connection string in .env as SUPABASE_DB_URL=...
//      (Supabase Dashboard → Project Settings → Database → Connection string → URI)
//   2) node scripts/apply-shipping.mjs
//
// SUPABASE_DB_URL stays in .env (gitignored) — it is never printed or committed.

import { readFileSync } from "node:fs";
import pg from "pg";

function loadEnv(path = ".env") {
  const out = {};
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  } catch {}
  return { ...out, ...process.env };
}

const env = loadEnv();
const url = env.SUPABASE_DB_URL;
if (!url) {
  console.error(
    "Missing SUPABASE_DB_URL. Add it to .env (Supabase → Settings → Database → Connection string → URI).",
  );
  process.exit(1);
}

// Zone defaults (mirror of src/domain/shipping/defaults.ts). Prices are NGN kobo.
const ZONE = {
  Africa: [true, 500000, 4, 9, 1200000, 2, 4, null],
  Europe: [true, 1500000, 6, 12, 3000000, 3, 6, null],
  Asia: [true, 1600000, 6, 12, 3200000, 3, 6, null],
  "North America": [true, 1800000, 6, 12, 3500000, 3, 6, null],
  "South America": [true, 2000000, 9, 16, 4000000, 5, 8, null],
  Oceania: [true, 2000000, 9, 16, 4000000, 5, 8, null],
  Antarctica: [false, 0, 20, 40, null, 20, 40, null],
};
const NG = [true, 200000, 2, 4, 500000, 1, 2, 20000000];

// Parse the canonical country dataset straight from the TS file.
function parseCountries() {
  const src = readFileSync("src/domain/shipping/countries.ts", "utf8");
  const re =
    /\{\s*code:\s*"([A-Z]{2})",\s*name:\s*"((?:[^"\\]|\\.)*)",\s*zone:\s*"([^"]+)"\s*\}/g;
  const rows = [];
  let m;
  while ((m = re.exec(src))) rows.push({ code: m[1], name: m[2], zone: m[3] });
  return rows;
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

async function applyFile(file) {
  const sql = readFileSync(file, "utf8");
  process.stdout.write(`Applying ${file} … `);
  await client.query("begin");
  try {
    await client.query(sql);
    await client.query("commit");
    console.log("ok");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    console.log("FAILED");
    throw e;
  }
}

try {
  await client.connect();
  console.log("Connected.");

  // Enum values first (own transaction), then the rest.
  await applyFile("supabase/migrations/20260719000010_order_statuses.sql");
  await applyFile("supabase/migrations/20260719000011_shipping.sql");

  // Seed settings + all countries (idempotent: never overwrites edits).
  await client.query(
    "insert into public.shipping_settings (id) values (true) on conflict (id) do nothing",
  );
  const countries = parseCountries();
  let seeded = 0;
  for (const c of countries) {
    const d = c.code === "NG" ? NG : ZONE[c.zone];
    const [enabled, sp, smin, smax, ep, emin, emax, free] = d;
    const res = await client.query(
      `insert into public.shipping_countries
        (code, name, zone, enabled, standard_price, standard_min_days, standard_max_days,
         express_price, express_min_days, express_max_days, free_over)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (code) do nothing`,
      [c.code, c.name, c.zone, enabled, sp, smin, smax, ep, emin, emax, free],
    );
    seeded += res.rowCount ?? 0;
  }
  console.log(
    `Seeded ${seeded} new countries (of ${countries.length}; existing rows preserved).`,
  );
  console.log("\nDone. Shipping schema + data are live.");
} finally {
  await client.end();
}
