/** Canonical site constants (SEO, metadata, sitemap, structured data). */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://fancyfinerybup.vercel.app"
).replace(/\/$/, "");

export const SITE_NAME = "Fancy Finery";

export const SITE_DESCRIPTION =
  "Fancy Finery — a curated luxury fashion house. Shop refined ready-to-wear and statement pieces, with worldwide shipping.";

/**
 * The address the house writes from and is written to.
 *
 * The same mailbox that owns the admin dashboard, so a customer replying to a
 * confirmation email reaches somebody who can act on it rather than a no-reply
 * that goes nowhere.
 *
 * Note for whoever moves this to a custom domain: an address can only be sent
 * FROM if the sending service can prove it owns the domain. gmail.com cannot be
 * verified by us, so this address works through Gmail's own SMTP and nowhere
 * else — see supabase/templates/README.md.
 */
export const BRAND_EMAIL = "fancyxquisite@gmail.com";

/** RFC 5322 sender, e.g. for the From header. */
export const BRAND_FROM = `${SITE_NAME} <${BRAND_EMAIL}>`;
