import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "e2e",
          include: ["tests/e2e/critical/**/*.test.ts", "tests/e2e/full/**/*.test.ts"],
          environment: "node",
          fileParallelism: false,
          testTimeout: 120_000,
          hookTimeout: 60_000,
          globalSetup: ["tests/e2e/helpers/global-setup.ts"],
          globalTeardown: ["tests/e2e/helpers/global-teardown.ts"],
          setupFiles: ["tests/e2e/helpers/setup.ts"],
          pool: "forks",
        },
      },
    ],
  },
});
