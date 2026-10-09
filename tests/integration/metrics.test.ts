import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isOverdue } from "@/domain/due-dates";
import { ACTIVE_STATUSES, isActiveStatus, PRIORITIES, WORK_ORDER_STATUSES } from "@/domain/enums";
import {
  averageCompletionTime,
  completionRateForCohort,
  countByBucket,
  isoWeekBuckets,
  needsAttention,
  reportingWindow,
} from "@/domain/metrics";
import type { Actor } from "@/domain/permissions";
import { getAnalytics, getDashboard } from "@/server/services/metrics";
import { listWorkOrders } from "@/server/services/work-orders";
import { DEMO_SERVICE_AREAS, seedDemoWorkOrders } from "../../scripts/lib/demo-work-orders.ts";
import {
  disconnectTestPrisma,
  getTestPrisma,
  truncateTestDatabase,
} from "../helpers/test-database";

// Metric queries must equal the pure definitions (metrics.md) applied to the same records, and each
// dashboard count card must equal the total of the list it links to (AC-8).

const prisma = getTestPrisma();
const NOW = new Date("2026-10-09T16:30:00.000Z");

let admin: Actor;
let one: Actor;
let inactiveHolder: Actor;

beforeAll(async () => {
  await truncateTestDatabase();
  const [a, t1, t2, leaver] = await Promise.all([
    prisma.user.create({
      data: { name: "Avery Admin", email: "admin@sprikle.test", role: "ADMIN" },
    }),
    prisma.user.create({ data: { name: "Taylor Tech", email: "tech.one@sprikle.test" } }),
    prisma.user.create({ data: { name: "Jordan Tech", email: "tech.two@sprikle.test" } }),
    prisma.user.create({ data: { name: "Pat Leaver", email: "leaver@sprikle.test" } }),
  ]);
  admin = { id: a.id, role: "ADMIN", isActive: true };
  one = { id: t1.id, role: "TEAM_MEMBER", isActive: true };
  inactiveHolder = { id: leaver.id, role: "TEAM_MEMBER", isActive: true };
  const areas = await Promise.all(
    DEMO_SERVICE_AREAS.map((name) => prisma.serviceArea.create({ data: { name } })),
  );
  const areaIds = Object.fromEntries(areas.map((area) => [area.name, area.id])) as Record<
    (typeof DEMO_SERVICE_AREAS)[number],
    string
  >;
  await seedDemoWorkOrders(
    prisma,
    { admin, one, two: { id: t2.id, role: "TEAM_MEMBER", isActive: true } },
    areaIds,
    NOW,
  );
  // Active work held by a user who is later deactivated, plus a record created in the future
  // (clock skew between app servers) that every current window must ignore.
  const held = await prisma.workOrder.findFirstOrThrow({
    where: { status: "OPEN", assigneeId: null },
  });
  await prisma.workOrder.update({
    where: { id: held.id },
    data: { assigneeId: inactiveHolder.id },
  });
  await prisma.user.update({ where: { id: leaver.id }, data: { isActive: false } });
  await prisma.workOrder.create({
    data: {
      title: "Future-dated record",
      description: "Created by a server with a fast clock.",
      serviceAreaId: areas[0]!.id,
      createdById: admin.id,
      dueAt: new Date("2026-10-20T03:59:59.999Z"),
      createdAt: new Date("2026-10-10T12:00:00.000Z"),
    },
  });
});

afterAll(async () => {
  await disconnectTestPrisma();
});

async function records(where = {}) {
  return prisma.workOrder.findMany({ where });
}

async function listTotal(actor: Actor, params: Record<string, string>) {
  const result = await listWorkOrders(prisma, actor, params, NOW);
  if (!result.ok) throw new Error(result.code);
  return result.data.page.total;
}

describe("dashboard (AC-8)", () => {
  it("matches the pure definitions for the organization", async () => {
    const result = await getDashboard(prisma, admin, NOW);
    if (!result.ok) throw new Error(result.code);
    const all = await records();
    const active = all.filter((r) => isActiveStatus(r.status));
    const { kpis } = result.data;
    expect(kpis.open).toBe(all.filter((r) => r.status === "OPEN").length);
    expect(kpis.inProgress).toBe(all.filter((r) => r.status === "IN_PROGRESS").length);
    expect(kpis.blocked).toBe(all.filter((r) => r.status === "BLOCKED").length);
    expect(kpis.overdue).toBe(all.filter((r) => isOverdue(r, NOW)).length);
    expect(kpis.highPriority).toBe(
      active.filter((r) => r.priority === "HIGH" || r.priority === "CRITICAL").length,
    );
    expect(kpis.active).toBe(active.length);
    expect(kpis.overdue).toBeGreaterThan(0);
    expect(kpis.completionRate).toEqual(completionRateForCohort(all, reportingWindow(NOW, 30)));
    expect(result.data.needsAttention.map((i) => i.number)).toEqual(
      needsAttention(all, NOW).map((r) => r.number),
    );
    expect(result.data.needsAttention.length).toBeLessThanOrEqual(10);
    expect(result.data.recentActivity).toHaveLength(10);
  });

  it("links every count card to a list whose total equals the card", async () => {
    for (const actor of [admin, one]) {
      const result = await getDashboard(prisma, actor, NOW);
      if (!result.ok) throw new Error(result.code);
      const { kpis } = result.data;
      expect(await listTotal(actor, { status: "OPEN" })).toBe(kpis.open);
      expect(await listTotal(actor, { status: "IN_PROGRESS" })).toBe(kpis.inProgress);
      expect(await listTotal(actor, { status: "BLOCKED" })).toBe(kpis.blocked);
      expect(await listTotal(actor, { due: "overdue" })).toBe(kpis.overdue);
      expect(await listTotal(actor, { priority: "HIGH,CRITICAL" })).toBe(kpis.highPriority);
    }
  });

  it("scopes a team member's dashboard to work currently assigned to them", async () => {
    const result = await getDashboard(prisma, one, NOW);
    if (!result.ok) throw new Error(result.code);
    const mine = await records({ assigneeId: one.id });
    expect(result.data.scope).toBe("assigned");
    expect(result.data.kpis.active).toBe(mine.filter((r) => isActiveStatus(r.status)).length);
    expect(result.data.kpis.completionRate).toEqual(
      completionRateForCohort(mine, reportingWindow(NOW, 30)),
    );
    const visible = new Set(mine.map((r) => r.number));
    expect(result.data.needsAttention.every((i) => visible.has(i.number))).toBe(true);
    const myRefs = new Set(mine.map((r) => `WO-${String(r.number).padStart(6, "0")}`));
    expect(result.data.recentActivity.every((a) => myRefs.has(a.workOrder.reference))).toBe(true);
  });

  it("requires a signed-in actor", async () => {
    expect(await getDashboard(prisma, null, NOW)).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
  });
});

describe("analytics (AC-9)", () => {
  it("is ADMIN-only", async () => {
    expect(await getAnalytics(prisma, one, NOW)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await getAnalytics(prisma, null, NOW)).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
  });

  it("matches the pure definitions for every metric", async () => {
    const result = await getAnalytics(prisma, admin, NOW, { completionWindowDays: 90 });
    if (!result.ok) throw new Error(result.code);
    const data = result.data;
    const all = await records();
    const active = all.filter((r) => isActiveStatus(r.status));

    for (const status of WORK_ORDER_STATUSES) {
      expect(data.byStatus[status], status).toBe(all.filter((r) => r.status === status).length);
    }
    for (const priority of PRIORITIES) {
      expect(data.activeByPriority[priority], priority).toBe(
        active.filter((r) => r.priority === priority).length,
      );
    }
    expect(data.overdue).toBe(all.filter((r) => isOverdue(r, NOW)).length);
    expect(data.completionRate).toEqual(completionRateForCohort(all, reportingWindow(NOW, 90)));
    expect(data.averageCompletion).toEqual(averageCompletionTime(all, reportingWindow(NOW, 30)));
    expect(data.averageCompletion.n).toBeGreaterThan(0);

    const weeks = isoWeekBuckets(NOW, 12);
    expect(data.trend.map((w) => w.created)).toEqual(
      countByBucket(
        all.map((r) => r.createdAt),
        weeks,
      ),
    );
    expect(data.trend.map((w) => w.completed)).toEqual(
      countByBucket(
        all.filter((r) => r.completedAt).map((r) => r.completedAt!),
        weeks,
      ),
    );
    expect(data.trend.reduce((sum, w) => sum + w.completed, 0)).toBeGreaterThan(10);
  });

  it("lists workload for every active user, Unassigned, and flagged inactive holders", async () => {
    const result = await getAnalytics(prisma, admin, NOW);
    if (!result.ok) throw new Error(result.code);
    const all = await records({ status: { in: [...ACTIVE_STATUSES] } });
    const rows = result.data.workload;
    for (const row of rows) {
      const id = row.user?.id ?? null;
      const mine = all.filter((r) => r.assigneeId === id);
      expect(row.active, row.user?.name ?? "Unassigned").toBe(mine.length);
      expect(row.overdue).toBe(mine.filter((r) => isOverdue(r, NOW)).length);
      expect(row.highPriority).toBe(
        mine.filter((r) => r.priority === "HIGH" || r.priority === "CRITICAL").length,
      );
    }
    expect(rows.reduce((sum, row) => sum + row.active, 0)).toBe(all.length);
    expect(rows.find((row) => row.user?.id === admin.id)?.active).toBe(0); // zero-work users are listed
    expect(rows.find((row) => row.user?.id === inactiveHolder.id)?.user?.isActive).toBe(false);
    expect(rows.at(-1)?.user).toBeNull();
  });

  it("filters work by status to a creation range and reports empty data as null, not 0%", async () => {
    const range = {
      start: new Date("2030-01-01T05:00:00.000Z"),
      end: new Date("2030-02-01T05:00:00.000Z"),
    };
    const result = await getAnalytics(prisma, admin, NOW, { statusRange: range });
    if (!result.ok) throw new Error(result.code);
    expect(Object.values(result.data.byStatus).every((count) => count === 0)).toBe(true);
    const empty = await getAnalytics(prisma, admin, new Date("2020-01-15T12:00:00.000Z"));
    if (!empty.ok) throw new Error(empty.code);
    expect(empty.data.completionRate.value).toBeNull();
    expect(empty.data.averageCompletion).toEqual({ meanMs: null, n: 0 });
  });
});
