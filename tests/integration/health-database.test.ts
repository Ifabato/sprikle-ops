import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { GET } from "@/app/api/health/route";
import { DATABASE_POOL_CONFIG, getDb } from "@/server/db";
import { checkDatabase } from "@/server/health";

afterAll(async () => {
  await getDb().$disconnect();
});

describe("health check against PostgreSQL", () => {
  it("application code is pointed at the test database", async () => {
    const rows = await getDb().$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    expect(rows[0]?.db).toBe("sprikle_ops_test");
  });

  it("GET /api/health returns 200 with database ok", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      checks: { config: "ok", database: "ok" },
    });
  });

  it("reports an unreachable database as unavailable within the timeout, without details", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    // Port 1 on loopback: nothing listens there, so the connection is refused.
    const unreachable = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: "postgresql://nobody:placeholder@127.0.0.1:1/sprikle_ops_test",
        ...DATABASE_POOL_CONFIG,
      }),
    });

    const started = performance.now();
    const status = await checkDatabase(unreachable);
    const elapsed = performance.now() - started;
    await unreachable.$disconnect();

    expect(status).toBe("unavailable");
    expect(elapsed).toBeLessThan(2_500);
    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).not.toContain("placeholder");
    expect(logged).not.toContain("127.0.0.1");
    consoleError.mockRestore();
  });
});
