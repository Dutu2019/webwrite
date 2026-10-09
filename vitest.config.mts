import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // tsconfig keeps `jsx: "preserve"` for Next.js; tests must compile JSX themselves.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
  },
});
