import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Points next-intl at src/i18n/request.ts, which resolves the locale per request.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Public origin of the media store (MinIO, fronted by Caddy in production).
 * Read here rather than imported from src/config so this file stays free of app
 * modules — next.config.ts is evaluated before the app's module graph exists.
 */
const mediaUrl = (
  process.env.NEXT_PUBLIC_MEDIA_URL || "http://localhost:9000/product-media"
).replace(/\/$/, "");
const mediaOrigin = new URL(mediaUrl).origin;

/**
 * Content-Security-Policy, in REPORT-ONLY mode.
 *
 * Report-Only deliberately: a CSP that blocks something the checkout needs
 * takes payments down, and that is not a failure worth risking to gain a
 * header. In this mode the browser reports what *would* have been blocked
 * without blocking it, so the policy can be proven against real traffic first.
 * Promote it by renaming the header to `Content-Security-Policy` once the
 * console is quiet.
 *
 * Sources were enumerated from the codebase, not guessed. Only origins the
 * BROWSER reaches are listed — the email providers and the Paystack API are
 * called server-side and never appear in a page request.
 *
 *   script/style 'unsafe-inline'  Next.js inlines its hydration bootstrap, and
 *                                the app uses inline style attributes. Removing
 *                                these needs per-request nonces.
 *   img/media  <mediaOrigin>     product photography and video in MinIO
 *   connect  <mediaOrigin>        presigned PUT uploads go browser -> MinIO
 *                                 directly, so the browser now talks to the
 *                                 media origin as well as reading from it
 *            nominatim…           reverse geocoding for checkout's "use my
 *                                 location", which runs in the browser
 *   form-action  paystack         checkout redirects to the hosted payment page
 *   frame-ancestors 'none'        no embedding; stricter than X-Frame-Options
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${mediaOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${mediaOrigin} https://nominatim.openstreetmap.org`,
  `media-src 'self' ${mediaOrigin}`,
  "form-action 'self' https://checkout.paystack.com",
  "frame-src 'self' https://checkout.paystack.com",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

// Security headers applied to every route.
const securityHeaders = [
  { key: "Content-Security-Policy-Report-Only", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Allow geolocation on our own origin (checkout "Use my location"); block the rest.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), browsing-topics=()",
  },
];

/**
 * Hosts allowed to reach the DEV server cross-origin.
 *
 * A cloudflared tunnel arrives with its own Host header, which Next.js
 * otherwise rejects in development. Set DEV_TUNNEL_HOST to the hostname
 * `npm run tunnel` prints (a quick tunnel gets a new one every restart).
 * Development only — Next ignores this in production builds.
 */
// The NODE_ENV guard is deliberate and not redundant. `allowedDevOrigins` only
// affects `next dev`, but reading the variable at all in a production build
// would mean a stray DEV_TUNNEL_HOST in a deployed environment silently became
// part of the config. Gating it here makes the tunnel un-configurable in
// production rather than merely ineffective — see scripts/tunnel.mjs.
const devTunnelHost =
  process.env.NODE_ENV === "production"
    ? undefined
    : process.env.DEV_TUNNEL_HOST?.trim();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  /**
   * Emit a self-contained server bundle in .next/standalone.
   *
   * Without this the runtime image needs the whole node_modules tree (~500MB
   * for this dependency set); with it, Next traces exactly the files the server
   * actually imports and the final image is a fraction of that. It is also what
   * makes the Dockerfile's runtime stage able to drop the build toolchain
   * entirely.
   */
  output: "standalone",
  ...(devTunnelHost ? { allowedDevOrigins: [devTunnelHost] } : {}),
  images: {
    formats: ["image/avif", "image/webp"],
    // Next 16 requires an explicit allowlist; 95 is for the hero brand mark,
    // where gradient banding shows at the default 75.
    qualities: [75, 95],
    // 31 days, up from the Next 16 default of 4 hours. This was originally set
    // to stop revalidations re-fetching from Supabase Storage, whose cached
    // egress quota took the project offline; the bill is now our own disk and
    // bandwidth, but the reasoning is unchanged and the saving is still real.
    // Uploads are written to an immutable `products/<uuid>.<ext>` path, so
    // replacing a product photo yields a new path and a new src. There is
    // nothing to go stale, which is what makes a TTL this long safe here
    // despite there being no cache-invalidation hook.
    minimumCacheTTL: 2678400,
    remotePatterns: [
      {
        // Public objects in the media bucket (MinIO in dev, MinIO behind Caddy
        // in production). Derived from NEXT_PUBLIC_MEDIA_URL so one variable
        // drives the image loader, the CSP and resolveMediaUrl alike.
        protocol: new URL(mediaUrl).protocol.replace(":", "") as "http" | "https",
        hostname: new URL(mediaUrl).hostname,
        port: new URL(mediaUrl).port || undefined,
        pathname: `${new URL(mediaUrl).pathname.replace(/\/$/, "")}/**`,
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
