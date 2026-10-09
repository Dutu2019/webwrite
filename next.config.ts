import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Prisma (and its binary query engine) and bcryptjs out of the bundler
  // so they are required from node_modules at runtime.
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
