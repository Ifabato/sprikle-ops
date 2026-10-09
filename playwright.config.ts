import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { assertSafeTestDatabase } from "./tests/helpers/database-safety";

// Browser smoke suite (Phase 4B). Isolation rules:
// - The ORIGINAL development and test URLs are validated (fail closed) before anything else; only
//   the server under test receives the test database URL. The runner's own DATABASE_URL is left
//   unchanged so the guard can keep comparing the two targets.
// - A fresh production build is served on 127.0.0.1:3100 with BETTER_AUTH_URL (and therefore the
//   trusted origin and cookies) set to http://localhost:3100. An existing server is never reused.
// - One worker, no retries, no traces/videos/automatic screenshots (they could capture typed
//   passwords). Manual screenshots are taken only of screens without password values.

if (existsSync(".env")) {
  process.loadEnvFile(".env"); // never overrides variables already set
}

const testDatabaseUrl = assertSafeTestDatabase({
  NODE_ENV: "test",
  DATABASE_URL: process.env.DATABASE_URL,
  TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
});

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  testMatch: ["*.smoke.spec.ts", "*.journey.spec.ts"],
  outputDir: "test-results/e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: true,
  timeout: 30_000,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: "off",
    video: "off",
    screenshot: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    // Build and serve with the same environment so build, server, and origin all agree.
    command: `pnpm build && pnpm exec next start --hostname 127.0.0.1 --port ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      DATABASE_URL: testDatabaseUrl,
      BETTER_AUTH_URL: BASE_URL,
      // Not needed by the server under test.
      SEED_DEMO_PASSWORD: "",
    },
  },
});
