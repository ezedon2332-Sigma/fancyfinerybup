/** Canonical site constants (SEO, metadata, sitemap, structured data). */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://fancyfinerybup.com"
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
 * else. Auth mail now goes through the same Resend sender as everything else
 * (src/infrastructure/auth/auth.ts), so there is no separate SMTP config.
 */
export const BRAND_EMAIL = "fancyxquisite@gmail.com";

/** RFC 5322 sender, e.g. for the From header. */
export const BRAND_FROM = `${SITE_NAME} <${BRAND_EMAIL}>`;

/**
 * Bare host of the canonical site — the domain that carries our DKIM and SPF
 * records, and therefore the only domain we are entitled to send mail from.
 */
export const SITE_DOMAIN = SITE_URL.replace(/^https?:\/\//, "")
  .replace(/^www\./, "")
  .split("/")[0];

/** The canonical sending domain, hard-coded as the fallback: in local dev
 *  SITE_URL is `localhost:3000`, and `orders@localhost:3000` is not an address
 *  any provider will accept. Only a real dotted host is trusted. */
const MAIL_DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(SITE_DOMAIN)
  ? SITE_DOMAIN
  : "fancyfinerybup.com";

/**
 * Default From address for outbound mail.
 *
 * Deliberately NOT `BRAND_EMAIL`: Resend (like every other mail service) will
 * only send from a domain whose ownership you prove with DNS records, and
 * nobody can add records to `gmail.com`. Mail therefore goes out as the owned
 * domain, with `MAIL_REPLY_TO` steering replies back to the house mailbox so a
 * customer who hits Reply still reaches a human. Override with EMAIL_FROM.
 */
export const MAIL_FROM = `${SITE_NAME} <orders@${MAIL_DOMAIN}>`;

/** Where replies land — the mailbox a person actually reads. */
export const MAIL_REPLY_TO = BRAND_EMAIL;
