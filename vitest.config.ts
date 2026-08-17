import path from "node:path";
import { defineConfig } from "vitest/config";

const root = path.resolve(import.meta.dirname);

export default defineConfig({
  root,
  resolve: {
    alias: {
      "@": path.resolve(root, "client", "src"),
    },
  },
  test: {
    environment: "node",
    include: ["client/src/**/*.test.ts"],
    setupFiles: ["client/src/core/__tests__/setup.ts"],
  },
});
