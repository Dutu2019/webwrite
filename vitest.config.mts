import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // tsconfig keeps `jsx: "preserve"` for Next.js; tests must compile JSX themselves.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    // Agent worktrees under .claude/ are full copies of the repo; don't run their tests too.
    exclude: [...configDefaults.exclude, ".claude/**"],
  },
});
