import type { NextConfig } from "next";

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
 *   img  *.supabase.co            product photography in Storage
 *   connect  *.supabase.co        PostgREST and Storage from the client
 *            nominatim…           reverse geocoding for checkout's "use my
 *                                 location", which runs in the browser
 *   form-action  paystack         checkout redirects to the hosted payment page
 *   frame-ancestors 'none'        no embedding; stricter than X-Frame-Options
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://nominatim.openstreetmap.org",
  "media-src 'self' https://*.supabase.co",
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

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    // Next 16 requires an explicit allowlist; 95 is for the hero brand mark,
    // where gradient banding shows at the default 75.
    qualities: [75, 95],
    // 31 days, up from the Next 16 default of 4 hours. Every revalidation
    // re-fetches the original from Supabase Storage, which bills as cached
    // egress — the quota that took the project offline. Uploads are written to
    // `products/<uuid>.<ext>` with upsert:false (see src/lib/upload-media.ts),
    // so an image's URL is immutable: replacing a product photo yields a new
    // path and a new src. There is nothing to go stale, which is what makes a
    // TTL this long safe here despite there being no cache-invalidation hook.
    minimumCacheTTL: 2678400,
    remotePatterns: [
      {
        // Supabase Storage public objects (product images).
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
