import { describe, expect, it } from "vitest";
import { EnvValidationError, parseEnv } from "@/lib/env";

// Placeholders only; never real credentials.
const DATABASE_URL = "postgresql://user:placeholder@127.0.0.1:5432/sprikle_ops";
const AUTH = {
  BETTER_AUTH_SECRET: "unit-test-placeholder-secret-0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:3000",
};
const base = { DATABASE_URL, ...AUTH };

describe("parseEnv", () => {
  it("applies defaults when optional variables are absent", () => {
    expect(parseEnv(base)).toEqual({
      NODE_ENV: "development",
      APP_TIMEZONE: "America/New_York",
      ...base,
    });
  });

  it("accepts America/New_York, trimming surrounding whitespace", () => {
    expect(parseEnv({ ...base, APP_TIMEZONE: "  America/New_York " }).APP_TIMEZONE).toBe(
      "America/New_York",
    );
  });

  // The MVP's date rules support America/New_York only (ADR 0005); even valid IANA zones fail.
  it.each(["Europe/London", "UTC", "America/Chicago", "america/new_york", "Mars/Olympus_Mons", ""])(
    "rejects APP_TIMEZONE=%j and names the variable",
    (zone) => {
      expect(() => parseEnv({ ...base, APP_TIMEZONE: zone })).toThrowError(
        /APP_TIMEZONE: must be America\/New_York \(the only supported time zone\)/,
      );
    },
  );

  it("rejects an unknown NODE_ENV", () => {
    expect(() => parseEnv({ ...base, NODE_ENV: "staging" })).toThrowError(EnvValidationError);
  });

  it("requires DATABASE_URL", () => {
    expect(() => parseEnv({ ...AUTH })).toThrowError(/DATABASE_URL/);
  });

  it("requires an auth secret of at least 32 characters", () => {
    expect(() => parseEnv({ DATABASE_URL, BETTER_AUTH_URL: AUTH.BETTER_AUTH_URL })).toThrowError(
      /BETTER_AUTH_SECRET/,
    );
    expect(() => parseEnv({ ...base, BETTER_AUTH_SECRET: "too-short" })).toThrowError(
      /BETTER_AUTH_SECRET: must be at least 32 characters/,
    );
  });

  it("requires an http(s) BETTER_AUTH_URL", () => {
    expect(() => parseEnv({ ...base, BETTER_AUTH_URL: "ftp://localhost" })).toThrowError(
      /BETTER_AUTH_URL: must be an http:\/\/ or https:\/\/ base URL/,
    );
  });

  it("rejects a non-PostgreSQL DATABASE_URL", () => {
    expect(() => parseEnv({ ...base, DATABASE_URL: "mysql://u:p@127.0.0.1/db" })).toThrowError(
      /DATABASE_URL: must be a postgresql:\/\/ connection URL/,
    );
  });

  it("does not echo supplied values in error messages", () => {
    const secretLooking = "not-a-zone-s3cr3t";
    const secretUrl = "mysql://user:s3cr3t-pass@db.internal/x";
    try {
      parseEnv({
        APP_TIMEZONE: secretLooking,
        DATABASE_URL: secretUrl,
        BETTER_AUTH_SECRET: "short-s3cr3t-value",
        BETTER_AUTH_URL: AUTH.BETTER_AUTH_URL,
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const message = (error as Error).message;
      expect(message).not.toContain(secretLooking);
      expect(message).not.toContain("s3cr3t-pass");
      expect(message).not.toContain("db.internal");
      expect(message).not.toContain("short-s3cr3t-value");
    }
  });
});
