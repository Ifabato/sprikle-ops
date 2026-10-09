import { describe, expect, it } from "vitest";
import { isProtectedPath, proxyRedirectPath } from "@/proxy";

describe("isProtectedPath", () => {
  it.each(["/dashboard", "/work-orders", "/work-orders/WO-000001", "/analytics", "/profile"])(
    "protects %s",
    (path) => {
      expect(isProtectedPath(path)).toBe(true);
    },
  );

  it.each(["/", "/login", "/api/health", "/api/auth/get-session", "/dashboardx", "/profile-x"])(
    "leaves %s alone",
    (path) => {
      expect(isProtectedPath(path)).toBe(false);
    },
  );
});

describe("proxyRedirectPath", () => {
  it("sends a cookieless request to login with the safe return path", () => {
    expect(proxyRedirectPath("/work-orders", "?status=BLOCKED", false)).toBe(
      "/login?next=%2Fwork-orders%3Fstatus%3DBLOCKED",
    );
  });

  it("lets requests with a session cookie through for server-side verification", () => {
    expect(proxyRedirectPath("/analytics", "", true)).toBeNull();
  });

  it("ignores public paths", () => {
    expect(proxyRedirectPath("/login", "?next=/dashboard", false)).toBeNull();
  });
});
