// Empty and delete the legacy `Products` storage bucket via the Storage API.
// Storage rows are protected from direct SQL deletion, so this must go through
// the API. Run AFTER scripts/seed.mjs (which copies the images into
// product-images). Uses the SECRET key.
//   node scripts/drop-legacy-bucket.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const BUCKET = "Products";

// List objects (root + any folders) and remove them explicitly — emptyBucket
// alone proved unreliable here.
async function removeAll(prefix = "") {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000 });
  if (error) {
    if (/not found/i.test(error.message)) return;
    throw error;
  }
  const files = [];
  for (const item of data) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      await removeAll(path); // folder
    } else {
      files.push(path);
    }
  }
  if (files.length) {
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove(files);
    if (rmErr) throw rmErr;
    console.log(`  removed ${files.length} object(s): ${files.join(", ")}`);
  }
}
await removeAll();
await supabase.storage.emptyBucket(BUCKET).catch(() => {});
const { error: delErr } = await supabase.storage.deleteBucket(BUCKET);
if (delErr) {
  if (/not found/i.test(delErr.message)) {
    console.log(`Bucket "${BUCKET}" already gone.`);
  } else {
    console.error("deleteBucket:", delErr.message);
    process.exit(1);
  }
} else {
  console.log(`Bucket "${BUCKET}" emptied and deleted.`);
}
