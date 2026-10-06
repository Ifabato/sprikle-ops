import { afterEach, describe, expect, it, vi } from "vitest";
import { logAuthEvent, sanitizeAuthLogMessage } from "@/server/auth-log";

describe("sanitizeAuthLogMessage", () => {
  it("keeps ordinary messages", () => {
    expect(sanitizeAuthLogMessage("User not found")).toBe("User not found");
  });

  it.each([
    [
      "connection string",
      "connect postgresql://sprikle:s3cr3tpassword@127.0.0.1:5432/db failed",
      "s3cr3tpassword",
    ],
    ["email", "lookup for admin@sprikle.test", "admin@sprikle.test"],
    ["session token", "token qX9fT2mV8kLp0Zs4Rb7Yc1Nd6We3Ha5J", "qX9fT2mV8kLp0Zs4Rb7Yc1Nd6We3Ha5J"],
    [
      "scrypt hash",
      "hash 3f1a9c0d2b7e4f6a8c5d1e9b0a7f3c2d:9e8d7c6b5a4f",
      "3f1a9c0d2b7e4f6a8c5d1e9b0a7f3c2d",
    ],
  ])("redacts a %s", (_label, input, secret) => {
    expect(sanitizeAuthLogMessage(input)).not.toContain(secret);
  });

  it("removes control characters and truncates long messages", () => {
    expect(sanitizeAuthLogMessage("line one\nforged line")).toBe("line one forged line");
    expect(sanitizeAuthLogMessage(`${"word ".repeat(100)}`).length).toBeLessThanOrEqual(301);
  });

  it("does not print non-string messages", () => {
    expect(sanitizeAuthLogMessage({ password: "x" })).toBe("(non-text log message)");
  });
});

describe("logAuthEvent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes only the sanitized message and drops extra arguments", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = logAuthEvent as (level: "warn", message: string, ...args: unknown[]) => void;

    log("warn", "Invalid password", { password: "hunter2-secret", token: "abc" });

    expect(warn).toHaveBeenCalledWith("[auth] Invalid password");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("hunter2-secret");
  });

  it("routes levels to the matching console method", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    logAuthEvent("error", "boom");
    logAuthEvent("info", "note");
    logAuthEvent("debug", "detail");
    expect(error).toHaveBeenCalledWith("[auth] boom");
    expect(info).toHaveBeenCalledTimes(2);
  });
});
