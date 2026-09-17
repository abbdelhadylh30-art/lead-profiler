import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  outputFileTracingIncludes: {
    "/api/**": ["./db/**/*"],
    "/": ["./db/**/*"],
    "/opengraph-image": ["./db/**/*"],
  },
};

export default nextConfig;
