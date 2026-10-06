// Fail-closed guard for anything that migrates, cleans, or otherwise mutates a test
// database. Every rule must pass before a test process may override DATABASE_URL.
// Error messages name the failed rule but never include connection strings.
//
// Phase 2 deliberately allows local hosts only. CI will need its own explicit,
// trusted database-host configuration (documented in docs/test-strategy.md).

export const TEST_DATABASE_NAME = "sprikle_ops_test";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
// Query parameters that could redirect the connection (libpq/pg `host`, `dbname`, ...)
// are refused; only these harmless ones are accepted.
const ALLOWED_QUERY_PARAMS = new Set(["schema", "sslmode", "application_name"]);

/**
 * Tables the test cleanup may truncate. Explicit on purpose: Prisma's
 * _prisma_migrations table is never touched, and TRUNCATE without CASCADE fails
 * loudly if a new table references one of these but is missing from the list.
 */
export const TRUNCATABLE_TABLES = [
  "work_order_activities",
  "work_order_comments",
  "work_orders",
  "service_areas",
  // Better Auth tables (Phase 4A). sessions and accounts reference users.
  "sessions",
  "accounts",
  "verifications",
  "users",
] as const;

export class UnsafeTestDatabaseError extends Error {
  readonly rule: string;

  constructor(rule: string) {
    super(`Refusing to use the test database: ${rule}.`);
    this.name = "UnsafeTestDatabaseError";
    this.rule = rule;
  }
}

interface ParsedDatabaseUrl {
  host: string;
  database: string;
  searchParams: URLSearchParams;
}

function parseDatabaseUrl(value: string, label: string): ParsedDatabaseUrl {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UnsafeTestDatabaseError(`${label} is not a valid URL`);
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new UnsafeTestDatabaseError(`${label} must use the postgresql:// protocol`);
  }
  let database: string;
  try {
    database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  } catch {
    throw new UnsafeTestDatabaseError(`${label} has an invalid database name`);
  }
  if (!database || database.includes("/")) {
    throw new UnsafeTestDatabaseError(`${label} must name exactly one database`);
  }
  return { host: url.hostname.toLowerCase(), database, searchParams: url.searchParams };
}

export interface TestDatabaseEnv {
  NODE_ENV?: string | undefined;
  DATABASE_URL?: string | undefined;
  TEST_DATABASE_URL?: string | undefined;
}

/**
 * Validates the ORIGINAL development and test URLs and returns the test URL.
 * Must be called before DATABASE_URL is overridden in a test process.
 */
export function assertSafeTestDatabase(env: TestDatabaseEnv): string {
  if (env.NODE_ENV !== "test") {
    throw new UnsafeTestDatabaseError("NODE_ENV must be 'test'");
  }
  if (!env.TEST_DATABASE_URL) {
    throw new UnsafeTestDatabaseError("TEST_DATABASE_URL is not set");
  }
  if (!env.DATABASE_URL) {
    throw new UnsafeTestDatabaseError(
      "DATABASE_URL (development) is not set, so the two targets cannot be compared",
    );
  }

  const test = parseDatabaseUrl(env.TEST_DATABASE_URL, "TEST_DATABASE_URL");
  const development = parseDatabaseUrl(env.DATABASE_URL, "DATABASE_URL");

  if (test.database !== TEST_DATABASE_NAME) {
    throw new UnsafeTestDatabaseError(
      `TEST_DATABASE_URL must target the '${TEST_DATABASE_NAME}' database`,
    );
  }
  if (!LOCAL_HOSTS.has(test.host)) {
    throw new UnsafeTestDatabaseError("TEST_DATABASE_URL must use a local host");
  }
  for (const key of test.searchParams.keys()) {
    if (!ALLOWED_QUERY_PARAMS.has(key)) {
      throw new UnsafeTestDatabaseError(
        `TEST_DATABASE_URL query parameter '${key}' is not allowed`,
      );
    }
  }
  if (env.TEST_DATABASE_URL === env.DATABASE_URL || development.database === test.database) {
    throw new UnsafeTestDatabaseError(
      "TEST_DATABASE_URL and DATABASE_URL must target different databases",
    );
  }

  return env.TEST_DATABASE_URL;
}

/** Runtime check, run on the same connection immediately before destructive cleanup. */
export function assertCurrentDatabaseIsTest(currentDatabase: unknown): void {
  if (currentDatabase !== TEST_DATABASE_NAME) {
    throw new UnsafeTestDatabaseError(
      `connected database is not '${TEST_DATABASE_NAME}' (current_database() check failed)`,
    );
  }
}
