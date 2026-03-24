import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 120_000,
    hookTimeout: 30_000,
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    fileParallelism: false,
  },
});
