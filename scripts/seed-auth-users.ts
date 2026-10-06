// Creates the synthetic demo accounts in the LOCAL DEVELOPMENT database (sprikle_ops).
// Existing accounts are reported as unchanged and never modified. Test accounts are created by
// the integration tests inside sprikle_ops_test instead.
// Run with: pnpm db:seed:auth
import { existsSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { DEMO_USERS, MIN_DEMO_PASSWORD_LENGTH, provisionCredentialUser } from "./lib/auth-users.ts";

const DEVELOPMENT_DATABASE = "sprikle_ops";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function fail(message: string): never {
  console.error(`Refusing to seed: ${message}.`);
  process.exit(1);
}

if (existsSync(".env")) {
  process.loadEnvFile(".env"); // never overrides variables already set
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) fail("DATABASE_URL is not set");
let target: URL;
try {
  target = new URL(databaseUrl);
} catch {
  fail("DATABASE_URL is not a valid URL");
}
if (!LOCAL_HOSTS.has(target.hostname.toLowerCase())) fail("the database host is not local");
if (decodeURIComponent(target.pathname.slice(1)) !== DEVELOPMENT_DATABASE) {
  fail(`the target database is not '${DEVELOPMENT_DATABASE}'`);
}
if ([...target.searchParams.keys()].some((key) => key !== "schema")) {
  fail("unexpected connection parameters");
}

const password = process.env.SEED_DEMO_PASSWORD ?? "";
if (password.length < MIN_DEMO_PASSWORD_LENGTH) {
  fail(
    `SEED_DEMO_PASSWORD must be at least ${MIN_DEMO_PASSWORD_LENGTH} characters (run pnpm env:init --add-missing)`,
  );
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl, max: 2 }) });
try {
  for (const user of DEMO_USERS) {
    const outcome = await provisionCredentialUser(db, user, password);
    console.log(
      `${user.email.padEnd(24)} ${user.role.padEnd(12)} ${user.isActive ? "active  " : "inactive"} ${outcome}`,
    );
  }
} finally {
  await db.$disconnect();
}
