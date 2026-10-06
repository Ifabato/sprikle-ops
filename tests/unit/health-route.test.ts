import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FIXED_NOW = new Date("2026-01-15T14:30:00.000Z");

async function loadRoute() {
  // Fresh module graph per test so the cached env in src/lib/env.ts is re-parsed.
  vi.resetModules();
  return import("@/app/api/health/route");
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns 200 with an ok status and a non-cacheable response", async () => {
    vi.stubEnv("APP_TIMEZONE", "America/New_York");
    const { GET } = await loadRoute();

    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "ok",
      service: "sprikle-ops",
      time: FIXED_NOW.toISOString(),
      checks: { config: "ok" },
    });
  });

  it("returns 503 without leaking details when configuration is invalid", async () => {
    vi.stubEnv("APP_TIMEZONE", "Not/A_Zone");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { GET } = await loadRoute();

    const response = GET();
    const body = await response.json();

    expect(consoleError).toHaveBeenCalledOnce();
    expect(response.status).toBe(503);
    expect(body).toEqual({
      status: "error",
      service: "sprikle-ops",
      time: FIXED_NOW.toISOString(),
      checks: { config: "invalid" },
    });
    expect(JSON.stringify(body)).not.toContain("Not/A_Zone");
  });
});
