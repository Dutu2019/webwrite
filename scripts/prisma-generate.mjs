#!/usr/bin/env node
/**
 * Generates the Prisma client, deriving a schema when needed.
 *
 * Local Windows ARM64 needs Prisma's "binary" engine: the default library
 * engine is an x64 native module that cannot load into ARM64 Node. Everywhere
 * else — including Vercel's Linux build — we drop it and use the default engine.
 *
 * Usage:
 *   node scripts/prisma-generate.mjs               # write schema + prisma generate
 *   node scripts/prisma-generate.mjs --schema-only # just write the schema
 */
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const BASE_SCHEMA = "prisma/schema.prisma";
const GENERATED_SCHEMA = "prisma/schema.generated.prisma";

const needsBinaryEngine = process.platform === "win32" && process.arch === "arm64";

let schema = await readFile(BASE_SCHEMA, "utf8");
if (!needsBinaryEngine) {
  schema = schema
    .split("\n")
    .filter((line) => !line.includes("engineType"))
    .join("\n");
}

await writeFile(GENERATED_SCHEMA, schema);
console.log(`[prisma] ${GENERATED_SCHEMA} written (binaryEngine=${needsBinaryEngine})`);

if (process.argv.includes("--schema-only")) {
  process.exit(0);
}

const prismaCli = require.resolve("prisma/build/index.js");
const result = spawnSync(
  process.execPath,
  [prismaCli, "generate", "--schema", GENERATED_SCHEMA],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
