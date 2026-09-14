import type { NextConfig } from "next";

const browserSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_NOSMO_AUTH_MODE:
      process.env.VERCEL === "1" || process.env.VERCEL_ENV ? "clerk" : "sites",
  },
  ...(process.env.VERCEL === "1" ? {
    typescript: { tsconfigPath: "tsconfig.vercel.json" },
  } : {}),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: browserSecurityHeaders,
      },
    ];
  },
};

export default nextConfig;
