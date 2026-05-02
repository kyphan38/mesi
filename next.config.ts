import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const tailwindResolved = path.join(appDir, "node_modules", "tailwindcss");

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      tailwindcss: tailwindResolved,
    },
  },
  webpack: (config) => {
    const prev = config.resolve?.alias;
    const base =
      prev && typeof prev === "object" && !Array.isArray(prev)
        ? (prev as Record<string, string | false | string[]>)
        : {};
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...base,
      tailwindcss: tailwindResolved,
    };
    return config;
  },
};

export default nextConfig;
