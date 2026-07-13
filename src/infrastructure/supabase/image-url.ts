import { publicEnv } from "@/config/env";

/**
 * Resolve a `product_images.storage_path` to a usable image URL.
 *
 * Three shapes are supported (see supabase/seed.sql):
 *   - absolute URL ("https://…")          -> used as-is
 *   - bucket path with a slash ("migrated/x.jpg") -> Supabase public URL
 *   - bare filename ("women.jpg")          -> local file in /public
 */
export function resolveImageUrl(storagePath: string): string {
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  if (storagePath.includes("/")) {
    const base = publicEnv.supabaseUrl.replace(/\/$/, "");
    return `${base}/storage/v1/object/public/product-images/${storagePath}`;
  }
  return `/${storagePath}`;
}
