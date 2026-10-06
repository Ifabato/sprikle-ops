import { describe, expect, it } from "vitest";
import {
  assertCurrentDatabaseIsTest,
  assertSafeTestDatabase,
  TRUNCATABLE_TABLES,
  UnsafeTestDatabaseError,
} from "../helpers/database-safety";

// Placeholder credentials only.
const DEV = "postgresql://user:placeholder@127.0.0.1:5432/sprikle_ops";
const TEST = "postgresql://user:placeholder@127.0.0.1:5432/sprikle_ops_test";
const valid = { NODE_ENV: "test", DATABASE_URL: DEV, TEST_DATABASE_URL: TEST };

function refusal(env: Parameters<typeof assertSafeTestDatabase>[0]): UnsafeTestDatabaseError {
  try {
    assertSafeTestDatabase(env);
  } catch (error) {
    expect(error).toBeInstanceOf(UnsafeTestDatabaseError);
    return error as UnsafeTestDatabaseError;
  }
  throw new Error("expected the guard to refuse");
}

describe("assertSafeTestDatabase", () => {
  it("accepts the local sprikle_ops_test database and returns its URL", () => {
    expect(assertSafeTestDatabase(valid)).toBe(TEST);
  });

  it.each(["localhost", "[::1]"])("accepts the local host %s", (host) => {
    const url = `postgresql://user:placeholder@${host}:5432/sprikle_ops_test`;
    expect(assertSafeTestDatabase({ ...valid, TEST_DATABASE_URL: url })).toBe(url);
  });

  it.each([
    ["NODE_ENV is not test", { ...valid, NODE_ENV: "development" }, /NODE_ENV/],
    ["NODE_ENV is missing", { ...valid, NODE_ENV: undefined }, /NODE_ENV/],
    [
      "TEST_DATABASE_URL is missing",
      { ...valid, TEST_DATABASE_URL: undefined },
      /TEST_DATABASE_URL is not set/,
    ],
    [
      "DATABASE_URL is missing",
      { ...valid, DATABASE_URL: undefined },
      /DATABASE_URL \(development\)/,
    ],
    ["test URL is malformed", { ...valid, TEST_DATABASE_URL: "not a url" }, /not a valid URL/],
    ["dev URL is malformed", { ...valid, DATABASE_URL: "::" }, /DATABASE_URL is not a valid URL/],
    [
      "wrong protocol",
      { ...valid, TEST_DATABASE_URL: "mysql://u:p@127.0.0.1/sprikle_ops_test" },
      /protocol/,
    ],
    [
      "targets the development database",
      { ...valid, TEST_DATABASE_URL: DEV },
      /'sprikle_ops_test'/,
    ],
    [
      "similar but different name",
      { ...valid, TEST_DATABASE_URL: `${TEST}2` },
      /'sprikle_ops_test'/,
    ],
    [
      "no database name",
      { ...valid, TEST_DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/" },
      /exactly one database/,
    ],
    [
      "remote host",
      { ...valid, TEST_DATABASE_URL: "postgresql://u:p@db.example.com/sprikle_ops_test" },
      /local host/,
    ],
    [
      "host override parameter",
      { ...valid, TEST_DATABASE_URL: `${TEST}?host=db.example.com` },
      /'host' is not allowed/,
    ],
    [
      "dbname override parameter",
      { ...valid, TEST_DATABASE_URL: `${TEST}?dbname=sprikle_ops` },
      /'dbname' is not allowed/,
    ],
    [
      "options parameter",
      { ...valid, TEST_DATABASE_URL: `${TEST}?options=-c%20search_path%3Dx` },
      /'options' is not allowed/,
    ],
    ["dev and test URLs identical", { ...valid, DATABASE_URL: TEST }, /different databases/],
  ])("refuses when %s", (_label, env, message) => {
    expect(refusal(env).message).toMatch(message);
  });

  it("never includes connection details in refusal messages", () => {
    const leaky = "postgresql://leaky:s3cr3t@db.example.com/sprikle_ops_test";
    const message = refusal({ ...valid, TEST_DATABASE_URL: leaky }).message;
    expect(message).not.toContain("s3cr3t");
    expect(message).not.toContain("db.example.com");
    expect(message).not.toContain("leaky");
  });
});

describe("assertCurrentDatabaseIsTest", () => {
  it("accepts sprikle_ops_test", () => {
    expect(() => assertCurrentDatabaseIsTest("sprikle_ops_test")).not.toThrow();
  });

  it.each(["sprikle_ops", "postgres", undefined, null, ""])("refuses %s", (name) => {
    expect(() => assertCurrentDatabaseIsTest(name)).toThrowError(UnsafeTestDatabaseError);
  });
});

describe("TRUNCATABLE_TABLES", () => {
  it("never includes Prisma's migration history table", () => {
    expect(TRUNCATABLE_TABLES).not.toContain("_prisma_migrations");
  });
});
