import type { NextConfig } from "next";

// On crée un type étendu pour éviter les erreurs TypeScript
interface ExtendedNextConfig extends NextConfig {
  allowedDevOrigins?: string[];
}

const nextConfig: ExtendedNextConfig = {
  output: "standalone",
  transpilePackages: ["@inventory/shared", "@inventory/ui"],
  allowedDevOrigins: ["127.0.0.1", "localhost", "10.5.0.2"],
};

export default nextConfig;