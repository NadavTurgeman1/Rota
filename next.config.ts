import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  experimental: {
    agentUpgrade: "security",
  },
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
