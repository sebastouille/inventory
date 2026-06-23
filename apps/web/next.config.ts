import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@inventory/shared", "@inventory/ui"]
};

export default nextConfig;
