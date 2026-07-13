// Detect the correct Supabase pooler region by attempting a session-pooler
// connection per region. Reads PGPASSWORD from env (never persisted) and the
// project ref from SUPABASE_URL in .env. Prints the working host on success.
import { readFileSync } from "node:fs";
import pg from "pg";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const ref = (env.SUPABASE_URL.match(/https:\/\/([^.]+)\./) || [])[1];
const pw = process.env.PGPASSWORD;
if (!ref || !pw) { console.error("need ref + PGPASSWORD"); process.exit(1); }

const regions = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-central-2",
  "eu-north-1", "ap-south-1", "ap-southeast-1", "ap-southeast-2",
  "ap-northeast-1", "ap-northeast-2", "ca-central-1", "sa-east-1",
];

for (const prefix of ["aws-0", "aws-1"]) {
  for (const region of regions) {
    const host = `${prefix}-${region}.pooler.supabase.com`;
    const client = new pg.Client({
      host, port: 5432, user: `postgres.${ref}`, password: pw,
      database: "postgres", ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 4000,
    });
    try {
      await client.connect();
      await client.end();
      console.log(`MATCH host=${host} port=5432 user=postgres.${ref}`);
      process.exit(0);
    } catch (e) {
      const msg = e.message || "";
      // Wrong region -> "Tenant or user not found". Timeouts/refused -> skip.
      if (!/Tenant or user not found|ENOTFOUND|ETIMEDOUT|timeout|ECONNREFUSED|password authentication/i.test(msg)) {
        console.log(`  ${host}: ${msg}`);
      }
      await client.end().catch(() => {});
    }
  }
}
console.error("No matching pooler region found.");
process.exit(2);
