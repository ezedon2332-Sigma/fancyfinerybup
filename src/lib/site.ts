/** Canonical site constants (SEO, metadata, sitemap, structured data). */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://fancyfinerybup.vercel.app"
).replace(/\/$/, "");

export const SITE_NAME = "Fancy Finery";

export const SITE_DESCRIPTION =
  "Fancy Finery — a curated luxury fashion house. Shop refined ready-to-wear and statement pieces, with worldwide shipping.";
