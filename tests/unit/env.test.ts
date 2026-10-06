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

  it("accepts America/New_York, trimming surrounding whitespace", () => {
    expect(parseEnv({ DATABASE_URL, APP_TIMEZONE: "  America/New_York " }).APP_TIMEZONE).toBe(
      "America/New_York",
    );
  });

  // The MVP's date rules support America/New_York only (ADR 0005); even valid IANA zones fail.
  it.each(["Europe/London", "UTC", "America/Chicago", "america/new_york", "Mars/Olympus_Mons", ""])(
    "rejects APP_TIMEZONE=%j and names the variable",
    (zone) => {
      expect(() => parseEnv({ DATABASE_URL, APP_TIMEZONE: zone })).toThrowError(
        /APP_TIMEZONE: must be America\/New_York \(the only supported time zone\)/,
      );
    },
  );

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
