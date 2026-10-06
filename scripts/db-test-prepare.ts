// Prepares the local test database: validates both URLs with the fail-closed guard,
// then applies committed migrations with `prisma migrate deploy` (non-destructive).
// It never resets, drops, or truncates anything.
// Run with: pnpm db:test:prepare
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  assertSafeTestDatabase,
  UnsafeTestDatabaseError,
} from "../tests/helpers/database-safety.ts";

if (existsSync(".env")) {
  process.loadEnvFile(".env"); // never overrides variables already set
}

let testDatabaseUrl: string;
try {
  testDatabaseUrl = assertSafeTestDatabase({
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL,
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
  });
} catch (error) {
  if (error instanceof UnsafeTestDatabaseError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

console.log("Test database target validated; applying migrations to sprikle_ops_test.");
const result = spawnSync("prisma", ["migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "test", DATABASE_URL: testDatabaseUrl },
});
process.exit(result.status ?? 1);
