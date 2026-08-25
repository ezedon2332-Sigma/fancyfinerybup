import { publicEnv } from "@/config/env";

/**
 * Resolve a `product_images.storage_path` to a URL the browser can load.
 *
 * This used to live in `src/infrastructure/supabase/image-url.ts` and was
 * imported directly by four components — a presentation concern parked in the
 * infrastructure layer purely because the Supabase Storage base URL was baked
 * into it. It is a pure function of (path, base) with no I/O, so with the base
 * in configuration it belongs here, and components no longer reach into
 * infrastructure to render an image.
 *
 * Three shapes are supported, unchanged from before (see db/seed.sql):
 *   - absolute URL ("https://…")           -> used as-is
 *   - bucket path with a slash ("products/x.jpg") -> object-storage URL
 *   - bare filename ("women.jpg")          -> local file in /public
 */
export function resolveMediaUrl(storagePath: string): string {
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  if (storagePath.includes("/")) {
    return `${publicEnv.mediaUrl}/${storagePath.replace(/^\/+/, "")}`;
  }
  return `/${storagePath}`;
}
