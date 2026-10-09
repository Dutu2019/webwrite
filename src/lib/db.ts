import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// The Vercel Prisma Postgres integration injects PRISMA_DATABASE_URL /
// POSTGRES_URL, or provider-prefixed variables (VERCEL_PRISMA_DATABASE_URL /
// VERCEL_DATABASE_URL / VERCEL_POSTGRES_URL), while local development uses
// DATABASE_URL. The generated client only accepts direct postgres:// URLs —
// an Accelerate (prisma+postgres://) URL fails every query with "the URL must
// start with the protocol postgresql://" — so the first direct URL wins, in the
// same order as scripts/prisma-migrate.mjs (keep the two in sync).
const candidates = [
  process.env.DATABASE_URL,
  process.env.VERCEL_DATABASE_URL,
  process.env.VERCEL_POSTGRES_URL,
  process.env.POSTGRES_URL,
  process.env.VERCEL_PRISMA_DATABASE_URL,
  process.env.PRISMA_DATABASE_URL,
].filter((url): url is string => Boolean(url));
const connectionUrl = candidates.find((url) => /^postgres(ql)?:\/\//.test(url)) ?? candidates[0];

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    ...(connectionUrl ? { datasourceUrl: connectionUrl } : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
