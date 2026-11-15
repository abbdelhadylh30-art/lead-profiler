import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  outputFileTracingIncludes: {
    // Prompt files are read at runtime by /api/profile-lead — they MUST travel
    // inside the serverless bundle. Do not remove the prompts entry.
    "/api/**": ["./db/**/*", "./download/prompts/**/*"],
    "/": ["./db/**/*"],
    "/opengraph-image": ["./db/**/*"],
  },
};

export default nextConfig;
