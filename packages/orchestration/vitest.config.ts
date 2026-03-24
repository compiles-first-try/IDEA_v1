import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 60_000,
    hookTimeout: 30_000,
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/temporal-workflow.test.ts"],
    fileParallelism: false, // Tests share Redis state
    pool: "forks",
  },
});
