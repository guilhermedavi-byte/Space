import type { NextConfig } from "next";
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy", value: "default-src 'self'; img-src 'self' https: data:; media-src 'self' https: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
];
const nextConfig: NextConfig = { reactStrictMode: true, poweredByHeader: false, async headers() { return [{ source: "/(.*)", headers: securityHeaders }]; } };
export default nextConfig;
