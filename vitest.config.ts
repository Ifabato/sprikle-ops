import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  test: {
    // Coverage is measured for the database-free unit project (`pnpm test:coverage`).
    coverage: {
      provider: "v8",
      // Every domain/validation source file is reported, including files no test imports.
      include: ["src/domain/**/*.ts", "src/validation/**/*.ts"],
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage",
      thresholds: {
        "src/domain/**/*.ts": { lines: 90, statements: 90, functions: 90, branches: 85 },
        "src/domain/transitions.ts": { branches: 95 },
        "src/domain/permissions.ts": { branches: 95 },
        "src/validation/**/*.ts": { lines: 90, statements: 90 },
      },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          // Requires the local test database (pnpm db:up, then pnpm test:integration).
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/integration/setup-env.ts"],
          // Files share one database, so they run one at a time.
          fileParallelism: false,
          testTimeout: 15_000,
          hookTimeout: 15_000,
        },
      },
    ],
  },
});
