import { describe, expect, it } from "vitest";
import { isCurrentPath, navItemsFor, ROLE_LABELS } from "@/components/shell/nav-items";

describe("navItemsFor", () => {
  it("shows administrators every area including Analytics", () => {
    expect(navItemsFor("ADMIN").map((item) => item.href)).toEqual([
      "/dashboard",
      "/work-orders",
      "/analytics",
    ]);
  });

  it("hides Analytics from team members", () => {
    expect(navItemsFor("TEAM_MEMBER").map((item) => item.href)).toEqual([
      "/dashboard",
      "/work-orders",
    ]);
  });
});

describe("isCurrentPath", () => {
  it.each([
    ["/dashboard", "/dashboard", true],
    ["/work-orders/WO-000001", "/work-orders", true],
    ["/work-orders-archive", "/work-orders", false],
    ["/analytics", "/dashboard", false],
  ])("%s under %s is %s", (pathname, href, expected) => {
    expect(isCurrentPath(pathname, href)).toBe(expected);
  });
});

describe("ROLE_LABELS", () => {
  it("labels both roles", () => {
    expect(ROLE_LABELS).toEqual({ ADMIN: "Administrator", TEAM_MEMBER: "Team member" });
  });
});
