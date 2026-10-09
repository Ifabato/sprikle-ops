import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { isOverdue } from "@/domain/due-dates";
import { WORK_ORDER_STATUSES } from "@/domain/enums";
import { attentionCategory, statusMatchesLatestEvent } from "@/domain/metrics";
import { DEMO_SERVICE_AREAS, seedDemoWorkOrders } from "../../scripts/lib/demo-work-orders.ts";
import {
  disconnectTestPrisma,
  getTestPrisma,
  truncateTestDatabase,
} from "../helpers/test-database";

// The demo dataset is produced through the real services; these checks keep it honest and useful.

const prisma = getTestPrisma();
const NOW = new Date("2026-10-09T16:30:00.000Z");

async function seed(now = NOW) {
  const [admin, one, two] = await Promise.all([
    prisma.user.create({
      data: { name: "Avery Admin", email: "admin@sprikle.test", role: "ADMIN" },
    }),
    prisma.user.create({ data: { name: "Taylor Tech", email: "tech.one@sprikle.test" } }),
    prisma.user.create({ data: { name: "Jordan Tech", email: "tech.two@sprikle.test" } }),
  ]);
  const areas = await Promise.all(
    DEMO_SERVICE_AREAS.map((name) => prisma.serviceArea.create({ data: { name } })),
  );
  const areaIds = Object.fromEntries(areas.map((area) => [area.name, area.id])) as Record<
    (typeof DEMO_SERVICE_AREAS)[number],
    string
  >;
  return seedDemoWorkOrders(
    prisma,
    {
      admin: { id: admin.id, role: "ADMIN", isActive: true },
      one: { id: one.id, role: "TEAM_MEMBER", isActive: true },
      two: { id: two.id, role: "TEAM_MEMBER", isActive: true },
    },
    areaIds,
    now,
  );
}

beforeEach(async () => {
  await truncateTestDatabase();
});

afterAll(async () => {
  await disconnectTestPrisma();
});

describe("demo seed", () => {
  it("creates a varied, internally consistent history that never runs past now", async () => {
    const result = await seed();
    expect(result.workOrders).toBe(37);

    const orders = await prisma.workOrder.findMany({
      include: {
        activities: {
          where: { type: "STATUS_CHANGED" },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
        },
      },
    });
    const statuses = new Set(orders.map((order) => order.status));
    expect([...statuses].sort()).toEqual([...WORK_ORDER_STATUSES].sort());

    const categories = new Set(orders.map((order) => attentionCategory(order, NOW)));
    for (const category of ["OVERDUE", "CRITICAL", "BLOCKED", "HIGH"]) {
      expect(categories.has(category as never), category).toBe(true);
    }
    expect(orders.some((order) => order.assigneeId === null && order.status === "OPEN")).toBe(true);
    expect(orders.some((order) => isOverdue(order, NOW))).toBe(true);

    for (const order of orders) {
      const latest = order.activities[0];
      expect(
        statusMatchesLatestEvent(order.status, latest ? { toStatus: latest.toStatus! } : null),
      ).toBe(true);
      expect(order.createdAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
      expect(order.updatedAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
    }
    const newest = await prisma.workOrderActivity.aggregate({ _max: { createdAt: true } });
    expect(newest._max.createdAt!.getTime()).toBeLessThanOrEqual(NOW.getTime());

    // Reopened and restored history exists (exercises Q10 records-versus-events).
    expect(
      await prisma.workOrderActivity.count({
        where: { fromStatus: "COMPLETED", toStatus: "IN_PROGRESS" },
      }),
    ).toBe(1);
    expect(
      await prisma.workOrderActivity.count({
        where: { fromStatus: "CANCELLED", toStatus: "OPEN" },
      }),
    ).toBe(1);
  });

  it("is deterministic for the same anchor time", async () => {
    await seed();
    const first = await prisma.workOrder.findMany({
      orderBy: { number: "asc" },
      select: {
        title: true,
        status: true,
        priority: true,
        dueAt: true,
        createdAt: true,
        completedAt: true,
      },
    });
    await truncateTestDatabase();
    await seed();
    const second = await prisma.workOrder.findMany({
      orderBy: { number: "asc" },
      select: {
        title: true,
        status: true,
        priority: true,
        dueAt: true,
        createdAt: true,
        completedAt: true,
      },
    });
    expect(second).toEqual(first);
  });
});
