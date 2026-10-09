import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { WorkOrderStatus } from "@/domain/enums";
import { statusMatchesLatestEvent } from "@/domain/metrics";
import type { Actor } from "@/domain/permissions";
import {
  addComment,
  createWorkOrder,
  editWorkOrder,
  getWorkOrder,
  listActivity,
  listAssignees,
  listComments,
  listServiceAreas,
  listWorkOrders,
  transitionWorkOrder,
  type WorkOrderDetail,
} from "@/server/services/work-orders";
import {
  disconnectTestPrisma,
  getTestPrisma,
  truncateTestDatabase,
} from "../helpers/test-database";

// Service-layer behavior against the real test database (AC-2 … AC-6, D3, Q1–Q17).

const prisma = getTestPrisma();

/** Monday 2026-03-02, 10:00 in New York (EST, UTC−5). */
const NOW = new Date("2026-03-02T15:00:00.000Z");
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

let admin: Actor;
let tech: Actor;
let otherTech: Actor;
let inactiveTech: Actor;
let areaId: string;
let retiredAreaId: string;

beforeEach(async () => {
  await truncateTestDatabase();
  const [a, t, o, i, area, retired] = await Promise.all([
    prisma.user.create({
      data: { name: "Avery Admin", email: "admin@sprikle.test", role: "ADMIN" },
    }),
    prisma.user.create({ data: { name: "Taylor Tech", email: "tech@sprikle.test" } }),
    prisma.user.create({ data: { name: "Jordan Tech", email: "other@sprikle.test" } }),
    prisma.user.create({
      data: { name: "Riley Inactive", email: "inactive@sprikle.test", isActive: false },
    }),
    prisma.serviceArea.create({ data: { name: "North District" } }),
    prisma.serviceArea.create({ data: { name: "Retired Zone", isActive: false } }),
  ]);
  admin = { id: a.id, role: "ADMIN", isActive: true };
  tech = { id: t.id, role: "TEAM_MEMBER", isActive: true };
  otherTech = { id: o.id, role: "TEAM_MEMBER", isActive: true };
  inactiveTech = { id: i.id, role: "TEAM_MEMBER", isActive: false };
  areaId = area.id;
  retiredAreaId = retired.id;
});

afterAll(async () => {
  await disconnectTestPrisma();
});

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Replace lobby light fixture",
    description: "Fixture flickers; replace ballast and bulbs.",
    serviceAreaId: areaId,
    dueDate: "2026-03-05",
    ...overrides,
  };
}

async function create(overrides: Record<string, unknown> = {}, at = NOW): Promise<WorkOrderDetail> {
  const result = await createWorkOrder(prisma, admin, validInput(overrides), at);
  if (!result.ok) throw new Error(`create failed: ${result.code}`);
  return result.data;
}

async function transition(
  actor: Actor,
  number: number,
  toStatus: WorkOrderStatus,
  version: number,
  note?: string,
  at = later(5),
) {
  return transitionWorkOrder(prisma, actor, number, { version, toStatus, note }, at);
}

async function activityTypes(number: number) {
  const rows = await prisma.workOrderActivity.findMany({
    where: { workOrder: { number } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map((row) => row.type);
}

describe("createWorkOrder (AC-2)", () => {
  it("creates an OPEN work order with a CREATED activity in the same transaction", async () => {
    const result = await createWorkOrder(prisma, admin, validInput({ assigneeId: tech.id }), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      reference: "WO-000001",
      status: "OPEN",
      priority: "MEDIUM",
      version: 0,
      assignee: { id: tech.id },
      overdue: false,
    });
    // Date-only due date = end of that day in New York (D7).
    expect(result.data.dueAt.toISOString()).toBe("2026-03-06T04:59:59.999Z");
    const activities = await prisma.workOrderActivity.findMany();
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      type: "CREATED",
      actorId: admin.id,
      description: "Created and assigned to Taylor Tech",
    });
  });

  it("accepts today's date (New York) and rejects yesterday", async () => {
    expect(
      (await createWorkOrder(prisma, admin, validInput({ dueDate: "2026-03-02" }), NOW)).ok,
    ).toBe(true);
    const past = await createWorkOrder(prisma, admin, validInput({ dueDate: "2026-03-01" }), NOW);
    expect(past).toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
      fieldErrors: { dueDate: ["Due date cannot be in the past."] },
    });
  });

  it("uses the New York date, not UTC, near midnight", async () => {
    // 2026-03-03T03:00Z is still March 2 in New York, so March 2 is "today".
    const lateEvening = new Date("2026-03-03T03:00:00.000Z");
    expect(
      (await createWorkOrder(prisma, admin, validInput({ dueDate: "2026-03-02" }), lateEvening)).ok,
    ).toBe(true);
  });

  it("returns field errors for invalid input and writes nothing", async () => {
    const result = await createWorkOrder(
      prisma,
      admin,
      validInput({ title: "  x ", description: "   ", dueDate: "2026-02-30" }),
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual([
      "description",
      "dueDate",
      "title",
    ]);
    expect(await prisma.workOrder.count()).toBe(0);
    expect(await prisma.workOrderActivity.count()).toBe(0);
  });

  it("rejects unknown fields, including server-owned ones", async () => {
    const result = await createWorkOrder(prisma, admin, validInput({ status: "COMPLETED" }), NOW);
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
  });

  it("rejects inactive or unknown assignees and inactive service areas", async () => {
    expect(
      await createWorkOrder(prisma, admin, validInput({ assigneeId: inactiveTech.id }), NOW),
    ).toMatchObject({
      ok: false,
      fieldErrors: { assigneeId: ["Inactive users cannot be assigned work."] },
    });
    expect(
      await createWorkOrder(prisma, admin, validInput({ assigneeId: "missing-user" }), NOW),
    ).toMatchObject({
      ok: false,
      fieldErrors: { assigneeId: ["The selected assignee does not exist."] },
    });
    expect(
      await createWorkOrder(prisma, admin, validInput({ serviceAreaId: retiredAreaId }), NOW),
    ).toMatchObject({
      ok: false,
      fieldErrors: { serviceAreaId: ["Choose an active service area."] },
    });
    expect(await prisma.workOrder.count()).toBe(0);
  });

  it("denies team members (403), inactive actors and signed-out callers (401)", async () => {
    expect(await createWorkOrder(prisma, tech, validInput(), NOW)).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
    expect(await createWorkOrder(prisma, inactiveTech, validInput(), NOW)).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(await createWorkOrder(prisma, null, validInput(), NOW)).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(await prisma.workOrder.count()).toBe(0);
  });
});

describe("getWorkOrder and object-level access (D3, Q17)", () => {
  it("lets admins and the current assignee view; others get NOT_FOUND like a missing number", async () => {
    const wo = await create({ assigneeId: tech.id });
    expect((await getWorkOrder(prisma, admin, wo.number, NOW)).ok).toBe(true);
    const own = await getWorkOrder(prisma, tech, wo.number, NOW);
    expect(own.ok && own.data.allowedTransitions).toEqual(["IN_PROGRESS"]);
    expect(await getWorkOrder(prisma, otherTech, wo.number, NOW)).toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await getWorkOrder(prisma, otherTech, 999, NOW)).toMatchObject({ code: "NOT_FOUND" });
    expect(await getWorkOrder(prisma, inactiveTech, wo.number, NOW)).toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("removes access as soon as work is reassigned away", async () => {
    const wo = await create({ assigneeId: tech.id });
    const moved = await editWorkOrder(
      prisma,
      admin,
      wo.number,
      { version: 0, assigneeId: otherTech.id },
      later(1),
    );
    expect(moved.ok).toBe(true);
    expect(await getWorkOrder(prisma, tech, wo.number, NOW)).toMatchObject({ code: "NOT_FOUND" });
    expect(await listComments(prisma, tech, wo.number)).toMatchObject({ code: "NOT_FOUND" });
    expect(await listActivity(prisma, tech, wo.number)).toMatchObject({ code: "NOT_FOUND" });
    expect(
      await addComment(prisma, tech, wo.number, { body: "Still here?" }, later(2)),
    ).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("editWorkOrder (AC-3, Q6, OD-1)", () => {
  it("writes one activity per changed field group and bumps the version once", async () => {
    const wo = await create();
    const result = await editWorkOrder(
      prisma,
      admin,
      wo.number,
      {
        version: 0,
        title: "Replace lobby fixture",
        priority: "HIGH",
        dueDate: "2026-03-09",
        assigneeId: tech.id,
        description: wo.description,
      },
      later(1),
    );
    expect(result.ok && result.data.kind).toBe("changed");
    if (!result.ok) return;
    expect(result.data.workOrder.version).toBe(1);
    const rows = await prisma.workOrderActivity.findMany({ orderBy: { createdAt: "asc" } });
    expect(rows.map((row) => [row.type, row.description])).toEqual([
      ["CREATED", "Created work order"],
      ["DETAILS_UPDATED", "Updated title"],
      ["PRIORITY_CHANGED", "Priority changed from Medium to High"],
      ["DUE_DATE_CHANGED", "Due date changed from 2026-03-05 to 2026-03-09"],
      ["ASSIGNEE_CHANGED", "Assigned to Taylor Tech"],
    ]);
  });

  it("reports unchanged edits without writing or bumping the version", async () => {
    const wo = await create();
    const result = await editWorkOrder(
      prisma,
      admin,
      wo.number,
      { version: 0, title: ` ${wo.title} `, dueDate: "2026-03-05" },
      later(1),
    );
    expect(result.ok && result.data.kind).toBe("unchanged");
    expect(
      (await prisma.workOrder.findUniqueOrThrow({ where: { number: wo.number } })).version,
    ).toBe(0);
    expect(await prisma.workOrderActivity.count()).toBe(1);
  });

  it("rejects a stale version with CONFLICT and changes nothing", async () => {
    const wo = await create();
    expect(
      (await editWorkOrder(prisma, admin, wo.number, { version: 0, priority: "LOW" }, later(1))).ok,
    ).toBe(true);
    const stale = await editWorkOrder(
      prisma,
      admin,
      wo.number,
      { version: 0, priority: "CRITICAL" },
      later(2),
    );
    expect(stale).toMatchObject({
      ok: false,
      code: "CONFLICT",
      message: "This work order was updated by someone else. Reload to see the latest version.",
    });
    expect(
      (await prisma.workOrder.findUniqueOrThrow({ where: { number: wo.number } })).priority,
    ).toBe("LOW");
  });

  it("preserves an unchanged past due date but rejects a new past date (Q6)", async () => {
    const wo = await create({ dueDate: "2026-03-02" });
    const nextWeek = new Date("2026-03-09T15:00:00.000Z");
    const edit = await editWorkOrder(
      prisma,
      admin,
      wo.number,
      { version: 0, priority: "HIGH", dueDate: "2026-03-02" },
      nextWeek,
    );
    expect(edit.ok).toBe(true);
    const moved = await editWorkOrder(
      prisma,
      admin,
      wo.number,
      { version: 1, dueDate: "2026-03-03" },
      nextWeek,
    );
    expect(moved).toMatchObject({
      ok: false,
      fieldErrors: { dueDate: ["Due date cannot be in the past."] },
    });
  });

  it("denies team members (403 on own work, 404 elsewhere) and blocks inactive assignees", async () => {
    const own = await create({ assigneeId: tech.id });
    expect(
      await editWorkOrder(prisma, tech, own.number, { version: 0, priority: "LOW" }, later(1)),
    ).toMatchObject({ code: "FORBIDDEN" });
    expect(
      await editWorkOrder(prisma, otherTech, own.number, { version: 0, priority: "LOW" }, later(1)),
    ).toMatchObject({ code: "NOT_FOUND" });
    expect(
      await editWorkOrder(
        prisma,
        admin,
        own.number,
        { version: 0, assigneeId: inactiveTech.id },
        later(1),
      ),
    ).toMatchObject({
      fieldErrors: { assigneeId: ["Inactive users cannot be assigned work."] },
    });
  });

  it("allows unassigning only while OPEN", async () => {
    const wo = await create({ assigneeId: tech.id });
    const started = await transition(tech, wo.number, "IN_PROGRESS", 0);
    expect(started.ok).toBe(true);
    expect(
      await editWorkOrder(prisma, admin, wo.number, { version: 1, assigneeId: null }, later(10)),
    ).toMatchObject({
      code: "UNASSIGN_NOT_ALLOWED",
    });
  });

  it("allows admins to edit completed work (OD-1: current approved permission matrix)", async () => {
    const wo = await create({ assigneeId: tech.id });
    expect((await transition(admin, wo.number, "COMPLETED", 0)).ok).toBe(true);
    const edit = await editWorkOrder(
      prisma,
      admin,
      wo.number,
      { version: 1, priority: "LOW" },
      later(10),
    );
    expect(edit.ok && edit.data.kind).toBe("changed");
  });
});

describe("transitionWorkOrder (AC-4, AC-5, D8, Q1, Q2, Q16)", () => {
  it("runs the full lifecycle with timestamps, notes, and one STATUS_CHANGED per step", async () => {
    const wo = await create({ assigneeId: tech.id });
    const steps: [Actor, WorkOrderStatus, string | undefined][] = [
      [tech, "IN_PROGRESS", undefined],
      [tech, "BLOCKED", "Waiting on a replacement ballast"],
      [tech, "IN_PROGRESS", undefined],
      [tech, "COMPLETED", "Installed and tested"],
      [admin, "IN_PROGRESS", "Reopened: fixture still flickers"],
      [admin, "CANCELLED", "Duplicate of WO-000002"],
      [admin, "OPEN", undefined],
    ];
    let version = 0;
    let minute = 1;
    for (const [actor, toStatus, note] of steps) {
      const result = await transition(actor, wo.number, toStatus, version, note, later(minute++));
      expect(result, `${toStatus}`).toMatchObject({ ok: true });
      if (!result.ok) return;
      version = result.data.version;
      expect(result.data.status).toBe(toStatus);
      expect(result.data.completedAt !== null).toBe(toStatus === "COMPLETED");
      expect(result.data.cancelledAt !== null).toBe(toStatus === "CANCELLED");
    }
    expect(version).toBe(steps.length);
    expect(await activityTypes(wo.number)).toEqual([
      "CREATED",
      ...steps.map(() => "STATUS_CHANGED"),
    ]);
    // Notes are stored as comments linked to their status change.
    const activity = await listActivity(prisma, admin, wo.number);
    expect(
      activity.ok && activity.data.filter((a) => a.comment).map((a) => a.comment!.body),
    ).toEqual([
      "Waiting on a replacement ballast",
      "Installed and tested",
      "Reopened: fixture still flickers",
      "Duplicate of WO-000002",
    ]);
  });

  it("requires a note to block and a reason to cancel", async () => {
    const wo = await create({ assigneeId: tech.id });
    await transition(tech, wo.number, "IN_PROGRESS", 0);
    expect(await transition(tech, wo.number, "BLOCKED", 1)).toMatchObject({
      code: "VALIDATION_ERROR",
      fieldErrors: { note: ["A note explaining the block is required."] },
    });
    expect(await transition(admin, wo.number, "CANCELLED", 1, "   ")).toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects NO_CHANGE, INVALID_TRANSITION, ASSIGNEE_REQUIRED, and team-member admin moves", async () => {
    const unassigned = await create();
    expect(await transition(admin, unassigned.number, "OPEN", 0)).toMatchObject({
      code: "NO_CHANGE",
    });
    expect(await transition(admin, unassigned.number, "IN_PROGRESS", 0)).toMatchObject({
      code: "ASSIGNEE_REQUIRED",
    });
    // Q16: admin quick close needs an existing assignee.
    expect(await transition(admin, unassigned.number, "COMPLETED", 0)).toMatchObject({
      code: "ASSIGNEE_REQUIRED",
    });

    const own = await create({ assigneeId: tech.id });
    expect(await transition(tech, own.number, "CANCELLED", 0, "Not needed")).toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await transition(tech, own.number, "COMPLETED", 0)).toMatchObject({ code: "FORBIDDEN" });
    await transition(admin, own.number, "COMPLETED", 0);
    expect(await transition(admin, own.number, "BLOCKED", 1, "nope")).toMatchObject({
      code: "INVALID_TRANSITION",
    });
    expect(await transition(otherTech, own.number, "IN_PROGRESS", 1)).toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await activityTypes(unassigned.number)).toEqual(["CREATED"]);
  });

  it("lets exactly one of two concurrent transitions win; the loser writes nothing", async () => {
    const wo = await create({ assigneeId: tech.id });
    await transition(tech, wo.number, "IN_PROGRESS", 0);
    const [first, second] = await Promise.all([
      transition(tech, wo.number, "BLOCKED", 1, "Blocked by A", later(20)),
      transition(admin, wo.number, "BLOCKED", 1, "Blocked by B", later(20)),
    ]);
    const outcomes = [first, second].map((result) => (result.ok ? "ok" : result.code)).sort();
    expect(outcomes).toEqual(["CONFLICT", "ok"]);
    expect(await prisma.workOrderComment.count()).toBe(1);
    expect(await activityTypes(wo.number)).toEqual(["CREATED", "STATUS_CHANGED", "STATUS_CHANGED"]);
  });

  it("keeps every record's status equal to its latest STATUS_CHANGED event (Q10 reconciliation)", async () => {
    const a = await create({ assigneeId: tech.id });
    const b = await create({ assigneeId: otherTech.id });
    await create();
    await transition(tech, a.number, "IN_PROGRESS", 0);
    await transition(admin, b.number, "COMPLETED", 0);
    await transition(admin, b.number, "IN_PROGRESS", 1, "Reopen", later(9));
    const orders = await prisma.workOrder.findMany({
      include: {
        activities: {
          where: { type: "STATUS_CHANGED" },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
        },
      },
    });
    for (const order of orders) {
      const latest = order.activities[0];
      expect(
        statusMatchesLatestEvent(order.status, latest ? { toStatus: latest.toStatus! } : null),
      ).toBe(true);
    }
  });
});

describe("comments (AC-6)", () => {
  it("adds trimmed comments with a COMMENT_ADDED activity for admins and the assignee", async () => {
    const wo = await create({ assigneeId: tech.id });
    const result = await addComment(
      prisma,
      tech,
      wo.number,
      { body: "  On site at 2pm  " },
      later(3),
    );
    expect(result).toMatchObject({
      ok: true,
      data: { body: "On site at 2pm", author: { id: tech.id } },
    });
    expect((await addComment(prisma, admin, wo.number, { body: "Thanks" }, later(4))).ok).toBe(
      true,
    );
    const activity = await prisma.workOrderActivity.findMany({ where: { type: "COMMENT_ADDED" } });
    expect(activity).toHaveLength(2);
    expect(activity.every((row) => row.commentId !== null)).toBe(true);
    const comments = await listComments(prisma, tech, wo.number);
    expect(comments.ok && comments.data.map((c) => c.body)).toEqual(["On site at 2pm", "Thanks"]);
  });

  it("rejects empty and oversized comments and other users' work", async () => {
    const wo = await create({ assigneeId: tech.id });
    expect(await addComment(prisma, tech, wo.number, { body: "   " }, later(1))).toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(
      await addComment(prisma, tech, wo.number, { body: "x".repeat(2001) }, later(1)),
    ).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await addComment(prisma, otherTech, wo.number, { body: "Hi" }, later(1))).toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await prisma.workOrderComment.count()).toBe(0);
  });
});

describe("listWorkOrders (AC-7)", () => {
  async function refs(actor: Actor, params: Record<string, string | string[]>, at = NOW) {
    const result = await listWorkOrders(prisma, actor, params, at);
    if (!result.ok)
      throw new Error(`list failed: ${result.code} ${JSON.stringify(result.fieldErrors)}`);
    return result.data.data.map((row) => row.reference);
  }

  beforeEach(async () => {
    // #1 due today (Mar 2), #2 due Mar 8 (+6), #3 due Mar 9 (+7), #4 completed, #5 unassigned critical.
    await create({
      title: "Fix gate latch",
      dueDate: "2026-03-02",
      assigneeId: tech.id,
      priority: "HIGH",
    });
    await create({
      title: "Inspect boiler 100% capacity",
      dueDate: "2026-03-08",
      assigneeId: otherTech.id,
    });
    await create({
      title: "Paint stairwell",
      description: "Second floor GATE area",
      dueDate: "2026-03-09",
      assigneeId: tech.id,
      priority: "LOW",
    });
    const done = await create({
      title: "Swap filters",
      dueDate: "2026-03-03",
      assigneeId: tech.id,
    });
    await transition(admin, done.number, "COMPLETED", 0);
    await create({ title: "Burst pipe", dueDate: "2026-03-04", priority: "CRITICAL" });
  });

  it("defaults to active work sorted by due date and scopes team members to their own", async () => {
    expect(await refs(admin, {})).toEqual(["WO-000001", "WO-000005", "WO-000002", "WO-000003"]);
    expect(await refs(tech, {})).toEqual(["WO-000001", "WO-000003"]);
    expect(await refs(tech, { assignee: otherTech.id })).toEqual([]);
    expect(await refs(admin, { status: "all", sort: "priority" })).toEqual([
      "WO-000005",
      "WO-000001",
      "WO-000002",
      "WO-000004",
      "WO-000003",
    ]);
  });

  it("applies due filters with New York day boundaries (Q7, Q8)", async () => {
    expect(await refs(admin, { due: "today" })).toEqual(["WO-000001"]);
    // Due in 7 days = today through today + 6 (Mar 2–8); Mar 9 is excluded.
    expect(await refs(admin, { due: "week" })).toEqual(["WO-000001", "WO-000005", "WO-000002"]);
    expect(await refs(admin, { due: "overdue" })).toEqual([]);
    // One millisecond after the end of March 2 in New York, #1 is overdue.
    const justAfter = new Date("2026-03-03T05:00:00.000Z");
    expect(await refs(admin, { due: "overdue" }, justAfter)).toEqual(["WO-000001"]);
    expect(await refs(admin, { due: "today" }, justAfter)).toEqual([]);
    // Terminal work is never overdue, even when a terminal status is requested.
    expect(
      await refs(admin, { due: "overdue", status: "COMPLETED" }, new Date("2026-04-01T00:00:00Z")),
    ).toEqual([]);
  });

  it("searches references, numbers, title, and description case-insensitively; wildcards are literal", async () => {
    expect(await refs(admin, { q: "WO-000003" })).toEqual(["WO-000003"]);
    expect(await refs(admin, { q: "2" })).toEqual(["WO-000002"]);
    expect(await refs(admin, { q: "gAtE" })).toEqual(["WO-000001", "WO-000003"]);
    expect(await refs(admin, { q: "100%" })).toEqual(["WO-000002"]);
    expect(await refs(admin, { q: "%" })).toEqual(["WO-000002"]);
    expect(await refs(admin, { q: "_" })).toEqual([]);
  });

  it("filters by priority, assignee, and service area, and paginates", async () => {
    expect(await refs(admin, { priority: "HIGH,CRITICAL" })).toEqual(["WO-000001", "WO-000005"]);
    expect(await refs(admin, { assignee: "unassigned" })).toEqual(["WO-000005"]);
    expect(await refs(tech, { assignee: "me", status: "all" })).toEqual([
      "WO-000001",
      "WO-000004",
      "WO-000003",
    ]);
    expect(await refs(admin, { serviceAreaId: retiredAreaId })).toEqual([]);
    const page = await listWorkOrders(prisma, admin, { pageSize: "3", page: "2" }, NOW);
    expect(page.ok && page.data.page).toEqual({ page: 2, pageSize: 3, total: 4, totalPages: 2 });
    expect(page.ok && page.data.data.map((r) => r.reference)).toEqual(["WO-000003"]);
  });

  it("rejects unknown or repeated parameters (Q14) and unauthenticated callers", async () => {
    expect(await listWorkOrders(prisma, admin, { colour: "red" }, NOW)).toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(
      await listWorkOrders(prisma, admin, new URLSearchParams("page=1&page=2"), NOW),
    ).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await listWorkOrders(prisma, null, {}, NOW)).toMatchObject({ code: "UNAUTHENTICATED" });
  });
});

describe("lookups", () => {
  it("lists active assignees for admins only and active service areas for signed-in users", async () => {
    const assignees = await listAssignees(prisma, admin);
    expect(assignees.ok && assignees.data.map((u) => u.name)).toEqual([
      "Avery Admin",
      "Jordan Tech",
      "Taylor Tech",
    ]);
    expect(await listAssignees(prisma, tech)).toMatchObject({ code: "FORBIDDEN" });
    const areas = await listServiceAreas(prisma, tech);
    expect(areas.ok && areas.data.map((a) => a.name)).toEqual(["North District"]);
    expect(await listServiceAreas(prisma, null)).toMatchObject({ code: "UNAUTHENTICATED" });
  });
});
