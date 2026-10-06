import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FIXED_NOW = new Date("2026-01-15T14:30:00.000Z");
const DATABASE_URL = "postgresql://user:placeholder@127.0.0.1:5432/sprikle_ops";

const checkDatabase = vi.fn();
vi.mock("@/server/health", () => ({ checkDatabase }));

async function loadRoute() {
  // Fresh module graph per test so the cached env in src/lib/env.ts is re-parsed.
  vi.resetModules();
  return import("@/app/api/health/route");
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    checkDatabase.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns 200 when configuration and database are healthy", async () => {
    vi.stubEnv("APP_TIMEZONE", "America/New_York");
    vi.stubEnv("DATABASE_URL", DATABASE_URL);
    checkDatabase.mockResolvedValue("ok");
    const { GET } = await loadRoute();

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "ok",
      service: "sprikle-ops",
      time: FIXED_NOW.toISOString(),
      checks: { config: "ok", database: "ok" },
    });
  });

  it("returns 503 when the database is unavailable", async () => {
    vi.stubEnv("DATABASE_URL", DATABASE_URL);
    checkDatabase.mockResolvedValue("unavailable");
    const { GET } = await loadRoute();

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      status: "error",
      checks: { config: "ok", database: "unavailable" },
    });
  });

  it("returns 503 without leaking details and skips the database when configuration is invalid", async () => {
    vi.stubEnv("APP_TIMEZONE", "Not/A_Zone");
    vi.stubEnv("DATABASE_URL", DATABASE_URL);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { GET } = await loadRoute();

    const response = await GET();
    const body = await response.json();

    expect(consoleError).toHaveBeenCalledOnce();
    expect(checkDatabase).not.toHaveBeenCalled();
    expect(response.status).toBe(503);
    expect(body).toEqual({
      status: "error",
      service: "sprikle-ops",
      time: FIXED_NOW.toISOString(),
      checks: { config: "invalid", database: "skipped" },
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("Not/A_Zone");
    expect(serialized).not.toContain("placeholder");
  });
});
