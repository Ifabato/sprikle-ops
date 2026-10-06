import { describe, expect, it } from "vitest";
import { DEFAULT_RETURN_PATH, loginPathFor, safeReturnPath } from "@/lib/return-path";

describe("safeReturnPath", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/work-orders", "/work-orders"],
    ["/work-orders/WO-000123", "/work-orders/WO-000123"],
    ["/work-orders?status=BLOCKED&page=2", "/work-orders?status=BLOCKED&page=2"],
    ["/analytics", "/analytics"],
    ["/profile", "/profile"],
  ])("keeps the in-app path %j", (input, expected) => {
    expect(safeReturnPath(input)).toBe(expected);
  });

  it("drops the fragment", () => {
    expect(safeReturnPath("/profile#section")).toBe("/profile");
  });

  it.each([
    ["absolute URL", "https://evil.example/dashboard"],
    ["protocol-relative URL", "//evil.example/dashboard"],
    ["backslash host", "/\\evil.example"],
    ["backslash after slash", "\\\\evil.example"],
    ["javascript scheme", "javascript:alert(1)"],
    ["encoded slash", "/%2F%2Fevil.example"],
    ["encoded backslash", "/%5Cevil.example"],
    ["control character", "/dashboard\nLocation: https://evil.example"],
    ["tab", "/dash\tboard"],
    ["traversal out of the app", "/dashboard/../login"],
    ["traversal to the API", "/work-orders/../../api/auth/sign-out"],
    ["login page", "/login"],
    ["API route", "/api/health"],
    ["root", "/"],
    ["look-alike prefix", "/dashboards"],
    ["relative path", "dashboard"],
    ["empty", ""],
    ["too long", `/dashboard/${"a".repeat(600)}`],
  ])("falls back to the dashboard for %s", (_label, input) => {
    expect(safeReturnPath(input)).toBe(DEFAULT_RETURN_PATH);
  });

  it.each([undefined, null, 42, ["/dashboard"], { path: "/dashboard" }])(
    "falls back for non-string input %j",
    (input) => {
      expect(safeReturnPath(input)).toBe(DEFAULT_RETURN_PATH);
    },
  );
});

describe("loginPathFor", () => {
  it("encodes a safe return path", () => {
    expect(loginPathFor("/work-orders?status=OPEN")).toBe(
      "/login?next=%2Fwork-orders%3Fstatus%3DOPEN",
    );
  });

  it("never encodes an unsafe return path", () => {
    expect(loginPathFor("https://evil.example")).toBe("/login?next=%2Fdashboard");
  });
});
