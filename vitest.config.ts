import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/**/*.test.ts",
      "apps/**/*.test.ts",
      "apps/**/*.test.tsx",
      "tests/integration/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
    environment: "node",
    // Windows filesystem/process fixtures share a small hosted runner.
    // Bound independent file workers; retain each test's timeout and its own concurrency.
    maxWorkers: process.platform === "win32" ? 1 : undefined,
  },
});
