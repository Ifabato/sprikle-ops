// Runs in each integration worker before any test module is imported.
// 1. Load .env without overriding variables that are already set.
// 2. Validate the ORIGINAL development and test URLs (fail closed).
// 3. Only then point DATABASE_URL at the test database for application code.
import { existsSync } from "node:fs";
import { assertSafeTestDatabase } from "../helpers/database-safety";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const developmentUrl = process.env.DATABASE_URL;
const testUrl = assertSafeTestDatabase({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: developmentUrl,
  TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
});

process.env.SPRIKLE_DEVELOPMENT_DATABASE_URL = developmentUrl;
process.env.DATABASE_URL = testUrl;
