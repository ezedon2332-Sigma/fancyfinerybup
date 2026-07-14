// Seed the Phase 1 schema with sample data AND migrate the legacy `Products`
// table into the normalized schema. Idempotent — safe to re-run.
//
//   node scripts/seed.mjs
//
// Uses the SECRET key (RLS bypass) — never ship this to the browser.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path = ".env") {
  const out = {};
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  } catch {
    /* fall back to process.env */
  }
  return { ...out, ...process.env };
}

const env = loadEnv();
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const BUCKET = "product-images";

function slugify(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function must(label, promise) {
  const { data, error } = await promise;
  if (error) {
    console.error(`  ✗ ${label}: ${error.message}`);
    throw error;
  }
  return data;
}

// --- Sample catalog ---------------------------------------------------------
const CATEGORIES = [
  { name: "Dresses", slug: "dresses", description: "Refined day-to-evening dresses.", sort_order: 1 },
  { name: "Outerwear", slug: "outerwear", description: "Statement coats and tailored jackets.", sort_order: 2 },
  { name: "Tops", slug: "tops", description: "Blouses, shirts and knitwear.", sort_order: 3 },
  { name: "Accessories", slug: "accessories", description: "Finishing touches for every look.", sort_order: 4 },
];

// price is in kobo (minor units). image = local file in /public.
const SAMPLE_PRODUCTS = [
  { name: "Golden Hour Gown", slug: "golden-hour-gown", categorySlug: "dresses", price: 45000000, status: "published", featured: true, description: "A floor-length silk gown with a subtle gold sheen. Made for the spotlight.", image: "women.jpg", variants: [["S","Gold","FF-GHG-S",5],["M","Gold","FF-GHG-M",4],["L","Gold","FF-GHG-L",2]] },
  { name: "Midnight Tailored Coat", slug: "midnight-tailored-coat", categorySlug: "outerwear", price: 38000000, status: "published", featured: true, description: "Structured wool-blend coat in deep black with a sharp lapel.", image: "women2.jpeg", variants: [["S","Black","FF-MTC-S",3],["M","Black","FF-MTC-M",6]] },
  { name: "Ivory Silk Blouse", slug: "ivory-silk-blouse", categorySlug: "tops", price: 15000000, status: "published", featured: false, description: "An effortless ivory blouse in pure silk. Understated luxury.", image: "women3.jpeg", variants: [["S","Ivory","FF-ISB-S",8],["M","Ivory","FF-ISB-M",8]] },
  { name: "Amber Evening Dress", slug: "amber-evening-dress", categorySlug: "dresses", price: 29000000, status: "published", featured: true, description: "Fitted amber cocktail dress with a draped neckline.", image: "women4.jpeg", variants: [["M","Amber","FF-AED-M",4],["L","Amber","FF-AED-L",3]] },
  { name: "Noir Wrap Dress", slug: "noir-wrap-dress", categorySlug: "dresses", price: 22000000, status: "published", featured: false, description: "A timeless black wrap dress that moves with you.", image: "women5.jpeg", variants: [["S","Black","FF-NWD-S",7],["M","Black","FF-NWD-M",5]] },
  { name: "Draft — Spring Trench", slug: "draft-spring-trench", categorySlug: "outerwear", price: 34000000, status: "draft", featured: false, description: "Lightweight trench (not yet released — tests draft visibility).", image: "women6.jpeg", variants: [["M","Beige","FF-DST-M",0]] },
  { name: "Ivory Bubble-Hem Mini Dress", slug: "ivory-bubble-hem-mini-dress", categorySlug: "dresses", price: 26000000, status: "published", featured: true, description: "A sculptural ivory mini in structured satin, finished with a signature bubble hem and long fitted sleeves.", image: "women7.jpeg", variants: [["S","Ivory","FF-IBH-S",6],["M","Ivory","FF-IBH-M",5],["L","Ivory","FF-IBH-L",3]] },
  { name: "Tangerine Bubble Mini Dress", slug: "tangerine-bubble-mini-dress", categorySlug: "dresses", price: 24000000, status: "published", featured: true, description: "A vivid tangerine mini with a sleeveless high neck and tiered bubble volume — made to be noticed.", image: "women8.jpeg", variants: [["S","Tangerine","FF-TBM-S",5],["M","Tangerine","FF-TBM-M",5],["L","Tangerine","FF-TBM-L",2]] },
  { name: "Pearl Puff Cocktail Dress", slug: "pearl-puff-cocktail-dress", categorySlug: "dresses", price: 28000000, status: "published", featured: false, description: "An ivory cocktail mini with a voluminous puff-ball skirt and long sleeves — quietly dramatic.", image: "women9.jpeg", variants: [["S","Ivory","FF-PPC-S",4],["M","Ivory","FF-PPC-M",4]] },
  { name: "Ivory Feather-Drape Mini Dress", slug: "ivory-feather-drape-mini-dress", categorySlug: "dresses", price: 32000000, status: "published", featured: true, description: "An ivory satin mini with a draped one-shoulder sash and soft feather trim, finished with a sculpted bubble hem and long sleeves.", image: "women10.jpeg", variants: [["S","Ivory","FF-IFD-S",5],["M","Ivory","FF-IFD-M",4],["L","Ivory","FF-IFD-L",2]] },
];

async function ensureImage(productId, storage_path, alt) {
  const { count } = await supabase
    .from("product_images")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId);
  if ((count ?? 0) > 0) return;
  await must("image", supabase.from("product_images").insert({ product_id: productId, storage_path, alt, sort_order: 0 }));
}

async function seedSample() {
  console.log("Seeding categories…");
  await must("categories", supabase.from("categories").upsert(CATEGORIES, { onConflict: "slug" }));
  const cats = await must("read categories", supabase.from("categories").select("id, slug"));
  const catId = Object.fromEntries(cats.map((c) => [c.slug, c.id]));

  console.log("Seeding sample products…");
  for (const p of SAMPLE_PRODUCTS) {
    const [row] = await must(
      `product ${p.slug}`,
      supabase
        .from("products")
        .upsert(
          {
            name: p.name, slug: p.slug, description: p.description, price: p.price,
            currency: "NGN", category_id: catId[p.categorySlug], status: p.status, featured: p.featured,
          },
          { onConflict: "slug" },
        )
        .select("id"),
    );
    await ensureImage(row.id, p.image, p.name);
    const variants = p.variants.map(([size, color, sku, stock_qty]) => ({
      product_id: row.id, size, color, sku, stock_qty,
    }));
    await must(`variants ${p.slug}`, supabase.from("product_variants").upsert(variants, { onConflict: "sku" }));
  }
}

// --- Legacy migration -------------------------------------------------------
async function reuploadImage(url, slug) {
  const ext = (url.split(".").pop() || "jpg").split(/[?#]/)[0].toLowerCase();
  const path = `migrated/${slug}.${ext}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch image ${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = ext === "png" ? "image/png" : "image/jpeg";
  const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType, upsert: true });
  if (error) throw error;
  return path; // bucket-relative path
}

async function migrateLegacy() {
  console.log("Migrating legacy \"Products\"…");
  const { data: legacy, error } = await supabase.from("Products").select("*").order("id");
  if (error) {
    console.log(`  (no legacy Products table or unreadable: ${error.message}) — skipping`);
    return 0;
  }
  const cats = await must("read categories", supabase.from("categories").select("id, slug"));
  const dressesId = cats.find((c) => c.slug === "dresses")?.id ?? null;

  let migrated = 0;
  for (const row of legacy) {
    const slug = slugify(row.name);
    const bucketPath = await reuploadImage(row.image_url, slug);
    const [prod] = await must(
      `legacy ${slug}`,
      supabase
        .from("products")
        .upsert(
          {
            name: row.name, slug, description: row.Description,
            price: Math.round(Number(row.Price) * 100), // whole naira -> kobo
            currency: "NGN", category_id: dressesId, status: "published", featured: false,
          },
          { onConflict: "slug" },
        )
        .select("id"),
    );
    await ensureImage(prod.id, bucketPath, row.name);
    await must(
      `legacy variant ${slug}`,
      supabase
        .from("product_variants")
        .upsert(
          { product_id: prod.id, size: null, color: null, sku: `LEGACY-${row.id}`, stock_qty: Number(row.Stock) || 0 },
          { onConflict: "sku" },
        ),
    );
    migrated++;
    console.log(`  ✓ ${row.name} -> ${slug} (image: ${BUCKET}/${bucketPath})`);
  }
  return migrated;
}

async function main() {
  await seedSample();
  const n = await migrateLegacy();
  const { count } = await supabase.from("products").select("*", { count: "exact", head: true });
  console.log(`\nDone. products total: ${count}. legacy migrated: ${n}.`);
  console.log("Legacy TABLE drop is a separate step: apply supabase/legacy-drop.sql.");
}

main().catch((e) => {
  console.error("\nSeed failed:", e.message);
  process.exit(1);
});
