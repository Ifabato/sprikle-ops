import { describe, expect, it, vi } from "vitest";
import {
  classifySessionResponse,
  createSessionCheck,
  KEEPALIVE_INTERVAL_MS,
  SESSION_ENDPOINT,
} from "@/lib/session-monitor";

const activeBody = { session: { id: "s" }, user: { id: "u", isActive: true } };
const inactiveBody = { session: { id: "s" }, user: { id: "u", isActive: false } };

describe("classifySessionResponse", () => {
  it("treats an active user as valid", () => {
    expect(classifySessionResponse(200, activeBody)).toBe("valid");
  });

  it("treats a null session as a confirmed sign-out", () => {
    expect(classifySessionResponse(200, null)).toBe("signed-out");
  });

  it("treats an inactive user as a confirmed sign-out", () => {
    expect(classifySessionResponse(200, inactiveBody)).toBe("signed-out");
  });

  it("treats 401 as a confirmed sign-out", () => {
    expect(classifySessionResponse(401, undefined)).toBe("signed-out");
  });

  it.each([
    ["server error", 500],
    ["bad gateway", 502],
    ["unavailable", 503],
    ["rate limited", 429],
    ["forbidden", 403],
  ])("treats %s (%i) as transient", (_label, status) => {
    expect(classifySessionResponse(status, undefined)).toBe("transient");
  });

  it.each([
    ["missing user", { session: {} }],
    ["missing isActive", { session: {}, user: { id: "u" } }],
    ["non-boolean isActive", { session: {}, user: { isActive: "true" } }],
    ["string body", "null"],
    ["undefined body", undefined],
  ])("treats an unexpected 200 body (%s) as transient", (_label, body) => {
    expect(classifySessionResponse(200, body)).toBe("transient");
  });
});

describe("createSessionCheck", () => {
  function setup(response: () => Promise<{ status: number; body: unknown }>, visible = true) {
    const deps = {
      fetchSession: vi.fn(response),
      isVisible: vi.fn(() => visible),
      onSignedOut: vi.fn(),
    };
    return { deps, check: createSessionCheck(deps) };
  }

  it("does not redirect for a valid session", async () => {
    const { deps, check } = setup(async () => ({ status: 200, body: activeBody }));
    await expect(check()).resolves.toBe("valid");
    expect(deps.onSignedOut).not.toHaveBeenCalled();
  });

  it("redirects once for a confirmed expired session", async () => {
    const { deps, check } = setup(async () => ({ status: 200, body: null }));
    await expect(check()).resolves.toBe("signed-out");
    expect(deps.onSignedOut).toHaveBeenCalledTimes(1);
  });

  it("redirects for an inactive account", async () => {
    const { deps, check } = setup(async () => ({ status: 200, body: inactiveBody }));
    await expect(check()).resolves.toBe("signed-out");
    expect(deps.onSignedOut).toHaveBeenCalledTimes(1);
  });

  it("does not redirect on a network error", async () => {
    const { deps, check } = setup(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(check()).resolves.toBe("transient");
    expect(deps.onSignedOut).not.toHaveBeenCalled();
  });

  it("does not redirect on a 5xx", async () => {
    const { deps, check } = setup(async () => ({ status: 503, body: undefined }));
    await expect(check()).resolves.toBe("transient");
    expect(deps.onSignedOut).not.toHaveBeenCalled();
  });

  it("skips hidden tabs without requesting", async () => {
    const { deps, check } = setup(async () => ({ status: 200, body: null }), false);
    await expect(check()).resolves.toBe("skipped");
    expect(deps.fetchSession).not.toHaveBeenCalled();
    expect(deps.onSignedOut).not.toHaveBeenCalled();
  });

  it("never overlaps requests and allows a new check after completion", async () => {
    let release: (value: { status: number; body: unknown }) => void = () => {};
    const { deps, check } = setup(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const first = check();
    await expect(check()).resolves.toBe("skipped");
    expect(deps.fetchSession).toHaveBeenCalledTimes(1);
    release({ status: 200, body: activeBody });
    await expect(first).resolves.toBe("valid");
    deps.fetchSession.mockImplementation(async () => ({ status: 200, body: activeBody }));
    await expect(check()).resolves.toBe("valid");
    expect(deps.fetchSession).toHaveBeenCalledTimes(2);
  });

  it("releases the in-flight guard after a failure", async () => {
    const { deps, check } = setup(() => Promise.reject(new Error("offline")));
    await check();
    await check();
    expect(deps.fetchSession).toHaveBeenCalledTimes(2);
  });

  it("uses the approved endpoint and 15-minute cadence", () => {
    expect(SESSION_ENDPOINT).toBe("/api/auth/get-session");
    expect(KEEPALIVE_INTERVAL_MS).toBe(900_000);
  });
});
