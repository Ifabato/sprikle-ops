import { describe, expect, it } from "vitest";
import { EnvValidationError, parseEnv } from "@/lib/env";

// Placeholder only; never a real credential.
const DATABASE_URL = "postgresql://user:placeholder@127.0.0.1:5432/sprikle_ops";

describe("parseEnv", () => {
  it("applies defaults when optional variables are absent", () => {
    expect(parseEnv({ DATABASE_URL })).toEqual({
      NODE_ENV: "development",
      APP_TIMEZONE: "America/New_York",
      DATABASE_URL,
    });
  });

  it("accepts a valid IANA time zone", () => {
    expect(parseEnv({ DATABASE_URL, APP_TIMEZONE: "Europe/London" }).APP_TIMEZONE).toBe(
      "Europe/London",
    );
  });

  it("rejects an invalid time zone and names the variable", () => {
    expect(() => parseEnv({ DATABASE_URL, APP_TIMEZONE: "Mars/Olympus_Mons" })).toThrowError(
      /APP_TIMEZONE: must be a valid IANA time zone/,
    );
  });

  it("rejects an unknown NODE_ENV", () => {
    expect(() => parseEnv({ DATABASE_URL, NODE_ENV: "staging" })).toThrowError(EnvValidationError);
  });

  it("requires DATABASE_URL", () => {
    expect(() => parseEnv({})).toThrowError(/DATABASE_URL/);
  });

  it("rejects a non-PostgreSQL DATABASE_URL", () => {
    expect(() => parseEnv({ DATABASE_URL: "mysql://u:p@127.0.0.1/db" })).toThrowError(
      /DATABASE_URL: must be a postgresql:\/\/ connection URL/,
    );
  });

  it("does not echo supplied values in error messages", () => {
    const secretLooking = "not-a-zone-s3cr3t";
    const secretUrl = "mysql://user:s3cr3t-pass@db.internal/x";
    try {
      parseEnv({ APP_TIMEZONE: secretLooking, DATABASE_URL: secretUrl });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const message = (error as Error).message;
      expect(message).not.toContain(secretLooking);
      expect(message).not.toContain("s3cr3t-pass");
      expect(message).not.toContain("db.internal");
    }
  });
});
