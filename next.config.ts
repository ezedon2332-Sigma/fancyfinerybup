import type { NextConfig } from "next";

// Security headers applied to every route. Deliberately NO Content-Security-
// Policy here — the app talks to Supabase, an exchange-rate API and redirects
// to payment providers, so a CSP needs careful per-source tuning first.
const securityHeaders = [
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
    // Next 16 requires an explicit allowlist; 90 is for the hero brand mark,
    // where gradient banding shows at the default 75.
    qualities: [75, 90],
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
