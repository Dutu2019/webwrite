import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// The Vercel Prisma Postgres integration injects PRISMA_DATABASE_URL /
// POSTGRES_URL, or provider-prefixed variables (VERCEL_PRISMA_DATABASE_URL /
// VERCEL_DATABASE_URL / VERCEL_POSTGRES_URL), while local development uses
// DATABASE_URL. Prefer DATABASE_URL, then fall back, so the deployed app
// connects even without a manual DATABASE_URL. Keep this list in sync with
// scripts/prisma-migrate.mjs, which migrates the same database on deploy.
const connectionUrl =
  process.env.DATABASE_URL ??
  process.env.VERCEL_PRISMA_DATABASE_URL ??
  process.env.VERCEL_DATABASE_URL ??
  process.env.VERCEL_POSTGRES_URL ??
  process.env.PRISMA_DATABASE_URL ??
  process.env.POSTGRES_URL;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    ...(connectionUrl ? { datasourceUrl: connectionUrl } : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
