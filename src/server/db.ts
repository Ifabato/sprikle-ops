import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "@/lib/env";

/**
 * Driver-level limits so no query can run indefinitely, even when a caller stops
 * waiting (for example the health check's overall timeout):
 * - connectionTimeoutMillis: give up connecting after 1.5 s.
 * - statement_timeout: PostgreSQL cancels any statement after 10 s (server side).
 * - query_timeout: the pg client abandons a query after 10 s (client side).
 * - max: small pool for an 8 GB development machine.
 */
export const DATABASE_POOL_CONFIG = {
  max: 5,
  connectionTimeoutMillis: 1_500,
  idleTimeoutMillis: 30_000,
  statement_timeout: 10_000,
  query_timeout: 10_000,
  application_name: "brindle",
} as const;

const globalForPrisma = globalThis as unknown as { brindlePrisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const { DATABASE_URL } = getEnv();
  const adapter = new PrismaPg({ connectionString: DATABASE_URL, ...DATABASE_POOL_CONFIG });
  return new PrismaClient({ adapter });
}

/**
 * Lazily created shared client. Lazy so that builds and unit tests never need a
 * database; cached on globalThis so development hot reloads do not open new pools.
 */
export function getDb(): PrismaClient {
  globalForPrisma.brindlePrisma ??= createPrismaClient();
  return globalForPrisma.brindlePrisma;
}
