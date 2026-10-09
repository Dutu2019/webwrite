import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the tracing root to this project so a stray lockfile in a parent
  // directory isn't mistaken for the workspace root.
  outputFileTracingRoot: path.join(__dirname),
  // Keep Prisma (and its binary query engine) and bcryptjs out of the bundler
  // so they are required from node_modules at runtime.
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
