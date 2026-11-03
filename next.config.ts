import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Konva optionally requires the node "canvas" package; it is never used in the browser bundle.
  turbopack: { resolveAlias: { canvas: "./lib/empty-module.ts" } },
  serverExternalPackages: ["sharp"],
  images: { unoptimized: true },
};

export default nextConfig;
