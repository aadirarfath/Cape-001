import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shared workspace packages ship TypeScript source; let Next compile them.
  transpilePackages: ["@cape001/core", "@cape001/db"],
};

export default nextConfig;
