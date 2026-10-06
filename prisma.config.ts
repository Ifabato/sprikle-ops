import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 does not load .env automatically. process.loadEnvFile() never overrides
// variables that are already set, so a caller (for example the guarded test-database
// script) can point DATABASE_URL at another database explicitly.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Optional so `prisma generate` works without a database (build, CI, unit tests).
  // No shadowDatabaseUrl: `migrate dev` creates and drops its own temporary shadow
  // database on the local server and never uses the development or test databases.
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
