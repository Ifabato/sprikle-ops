// Test data for the browser smoke suite (Phase 4B). Touches ONLY sprikle_ops_test:
// the original development and test URLs are validated with the fail-closed guard first, and
// current_database() is re-checked on the same connection before anything is truncated.
// The password comes from E2E_USER_PASSWORD (generated per run by e2e/global-setup.ts) and is
// never printed. Never resets, drops, or migrates anything; never connects to sprikle_ops.
//
//   node scripts/e2e-test-data.ts setup            truncate test tables, provision E2E users
//   node scripts/e2e-test-data.ts teardown         truncate test tables
//   node scripts/e2e-test-data.ts deactivate EMAIL mark one E2E user inactive
//   node scripts/e2e-test-data.ts sessions EMAIL   print that user's session count
import { existsSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import {
  assertCurrentDatabaseIsTest,
  assertSafeTestDatabase,
  TRUNCATABLE_TABLES,
  UnsafeTestDatabaseError,
} from "../tests/helpers/database-safety.ts";
import { E2E_SERVICE_AREAS, E2E_USERS } from "../e2e/users.ts";
import { MIN_DEMO_PASSWORD_LENGTH, provisionCredentialUser } from "./lib/auth-users.ts";

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

const E2E_EMAILS = new Set<string>(E2E_USERS.map((user) => user.email));

function e2eEmail(value: string | undefined): string {
  if (!value || !E2E_EMAILS.has(value)) {
    console.error("Refusing: the email is not one of the E2E test users.");
    process.exit(1);
  }
  return value;
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: testDatabaseUrl, max: 1 }),
});

async function truncate(): Promise<void> {
  await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
    assertCurrentDatabaseIsTest(rows[0]?.current_database);
    const tables = TRUNCATABLE_TABLES.map((table) => `"${table}"`).join(", ");
    await tx.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY`);
  });
}

const [command, argument] = process.argv.slice(2);
try {
  switch (command) {
    case "setup": {
      const password = process.env.E2E_USER_PASSWORD ?? "";
      if (password.length < MIN_DEMO_PASSWORD_LENGTH) {
        throw new Error("E2E_USER_PASSWORD is missing or too short.");
      }
      await truncate();
      for (const user of E2E_USERS) {
        await provisionCredentialUser(db, user, password);
      }
      for (const name of E2E_SERVICE_AREAS) {
        await db.serviceArea.create({ data: { name } });
      }
      console.log(
        `E2E test data ready in sprikle_ops_test (${E2E_USERS.length} users, ${E2E_SERVICE_AREAS.length} service areas).`,
      );
      break;
    }
    case "teardown":
      await truncate();
      console.log("E2E test data removed from sprikle_ops_test.");
      break;
    case "deactivate": {
      const email = e2eEmail(argument);
      await db.user.update({ where: { email }, data: { isActive: false } });
      break;
    }
    case "sessions": {
      const email = e2eEmail(argument);
      console.log(String(await db.session.count({ where: { user: { email } } })));
      break;
    }
    default:
      console.error(
        "Usage: node scripts/e2e-test-data.ts setup|teardown|deactivate EMAIL|sessions EMAIL",
      );
      process.exitCode = 1;
  }
} finally {
  await db.$disconnect();
}
