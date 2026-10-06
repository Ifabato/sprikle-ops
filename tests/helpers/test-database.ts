import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import {
  assertCurrentDatabaseIsTest,
  assertSafeTestDatabase,
  TRUNCATABLE_TABLES,
} from "./database-safety";

let client: PrismaClient | undefined;

/**
 * Prisma client for integration tests. The integration setup file has already
 * validated the original URLs and pointed DATABASE_URL at the test database; the
 * test URL is re-validated here as defense in depth.
 */
export function getTestPrisma(): PrismaClient {
  if (!client) {
    const url = assertSafeTestDatabase({
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.SPRIKLE_DEVELOPMENT_DATABASE_URL,
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
    });
    client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 2 }) });
  }
  return client;
}

/**
 * Empties the application tables. Runs in one transaction: current_database() is
 * checked on the same connection immediately before the TRUNCATE.
 */
export async function truncateTestDatabase(): Promise<void> {
  const prisma = getTestPrisma();
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
    assertCurrentDatabaseIsTest(rows[0]?.current_database);
    const tables = TRUNCATABLE_TABLES.map((table) => `"${table}"`).join(", ");
    await tx.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY`);
  });
}

export async function disconnectTestPrisma(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}
