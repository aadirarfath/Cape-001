import type { NextConfig } from "next";

// Static security headers. The Content-Security-Policy needs a per-request nonce, so it is set
// in src/middleware.ts instead.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Location is used on the home page (same origin only); nothing else needs device access.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  // Shared workspace packages ship TypeScript source; let Next compile them.
  transpilePackages: ["@cape001/core", "@cape001/db"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
