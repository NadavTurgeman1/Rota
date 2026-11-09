import os from "os";
import type { NextConfig } from "next";

function lanOrigins(): string[] {
  const hosts = new Set<string>();
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) hosts.add(entry.address);
    }
  }
  return [...hosts];
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: lanOrigins(),
  agentRules: false,
  experimental: {
    agentUpgrade: "security",
  },
  serverExternalPackages: ["postgres"],
  async headers() {
    return [
      {
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
};

export default nextConfig;
