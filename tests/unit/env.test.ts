import { describe, expect, it } from "vitest";
import { EnvValidationError, parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("applies defaults when optional variables are absent", () => {
    expect(parseEnv({})).toEqual({ NODE_ENV: "development", APP_TIMEZONE: "America/New_York" });
  });

  it("accepts a valid IANA time zone", () => {
    expect(parseEnv({ APP_TIMEZONE: "Europe/London" }).APP_TIMEZONE).toBe("Europe/London");
  });

  it("rejects an invalid time zone and names the variable", () => {
    expect(() => parseEnv({ APP_TIMEZONE: "Mars/Olympus_Mons" })).toThrowError(
      /APP_TIMEZONE: must be a valid IANA time zone/,
    );
  });

  it("rejects an unknown NODE_ENV", () => {
    expect(() => parseEnv({ NODE_ENV: "staging" })).toThrowError(EnvValidationError);
  });

  it("does not echo supplied values in error messages", () => {
    const secretLooking = "not-a-zone-s3cr3t";
    try {
      parseEnv({ APP_TIMEZONE: secretLooking });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      expect((error as Error).message).not.toContain(secretLooking);
    }
  });
});
