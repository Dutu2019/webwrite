#!/usr/bin/env node
/**
 * Applies pending Prisma migrations during Vercel production builds.
 *
 * Without this, a fresh Vercel database has no tables and every API route that
 * touches Prisma (e.g. POST /api/auth/register) fails with a 500.
 *
 * - Runs only when VERCEL_ENV=production (preview builds never migrate), or
 *   when PRISMA_MIGRATE_ON_BUILD=1 forces it. PRISMA_MIGRATE_ON_BUILD=0 skips it.
 * - A database created with `prisma db push` has tables but no migration
 *   history, so `migrate deploy` refuses it (P3005). If its schema already
 *   matches prisma/schema.prisma, every migration is marked as applied
 *   (baselined) and deploy is retried; otherwise the build fails loudly.
 *
 * Usage: node scripts/prisma-migrate.mjs
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const SCHEMA = "prisma/schema.prisma";
const MIGRATIONS_DIR = "prisma/migrations";

const flag = process.env.PRISMA_MIGRATE_ON_BUILD;
const enabled = flag === "1" || (flag !== "0" && process.env.VERCEL_ENV === "production");
if (!enabled) {
  console.log("[prisma] skipping migrate deploy (not a Vercel production build)");
  process.exit(0);
}

// Same variables as src/lib/db.ts. Migrations need a direct Postgres
// connection, so direct URLs win over Accelerate (prisma+postgres://) ones.
const candidates = [
  process.env.DATABASE_URL,
  process.env.VERCEL_DATABASE_URL,
  process.env.VERCEL_POSTGRES_URL,
  process.env.POSTGRES_URL,
  process.env.VERCEL_PRISMA_DATABASE_URL,
  process.env.PRISMA_DATABASE_URL,
].filter(Boolean);
const url = candidates.find((u) => /^postgres(ql)?:\/\//.test(u)) ?? candidates[0];
if (!url) {
  console.error(
    "[prisma] no database URL set; add DATABASE_URL to the Vercel project's environment variables",
  );
  process.exit(1);
}

const prismaCli = require.resolve("prisma/build/index.js");
const env = { ...process.env, DATABASE_URL: url };

function prisma(args, { capture = false } = {}) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    env,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });
  if (capture) {
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
  }
  return result;
}

const deploy = prisma(["migrate", "deploy", "--schema", SCHEMA], { capture: true });
if (deploy.status === 0) process.exit(0);

if (!`${deploy.stdout}${deploy.stderr}`.includes("P3005")) {
  process.exit(deploy.status ?? 1);
}

console.log("[prisma] database has tables but no migration history; checking it can be baselined");
const diff = prisma(
  ["migrate", "diff", "--from-url", url, "--to-schema-datamodel", SCHEMA, "--exit-code"],
  { capture: true },
);
if (diff.status !== 0) {
  console.error(
    "[prisma] database schema differs from prisma/schema.prisma; refusing to baseline. " +
      "Reconcile it manually (see https://pris.ly/d/migrate-baseline).",
  );
  process.exit(1);
}

const migrations = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
for (const name of migrations) {
  const resolved = prisma(["migrate", "resolve", "--applied", name, "--schema", SCHEMA]);
  if (resolved.status !== 0) process.exit(resolved.status ?? 1);
}

process.exit(prisma(["migrate", "deploy", "--schema", SCHEMA]).status ?? 1);
