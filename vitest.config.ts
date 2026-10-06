import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  test: {
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
