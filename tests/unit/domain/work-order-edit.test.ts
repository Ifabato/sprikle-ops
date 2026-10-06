import { describe, expect, it } from "vitest";
import { dueAtFromDateOnly } from "@/domain/due-dates";
import { MAX_INT32 } from "@/domain/limits";
import type { Actor } from "@/domain/permissions";
import {
  planWorkOrderEdit,
  type EditableWorkOrder,
  type WorkOrderEditInput,
} from "@/domain/work-order-edit";

const admin: Actor = { id: "admin-1", role: "ADMIN", isActive: true };
const tech: Actor = { id: "tech-1", role: "TEAM_MEMBER", isActive: true };
const NOW = new Date("2026-10-05T14:00:00.000Z"); // Monday 10:00 EDT

function workOrder(overrides: Partial<EditableWorkOrder> = {}): EditableWorkOrder {
  return {
    status: "OPEN",
    title: "Replace lobby light",
    description: "Ballast failing.",
    serviceAreaId: "area-north",
    priority: "MEDIUM",
    dueAt: dueAtFromDateOnly("2026-10-09"),
    assigneeId: "tech-1",
    version: 7,
    ...overrides,
  };
}

const edit = (fields: Omit<WorkOrderEditInput, "version">, version = 7): WorkOrderEditInput => ({
  version,
  ...fields,
});

describe("access and concurrency", () => {
  it("rejects unauthenticated, out-of-scope, and non-admin actors in that order", () => {
    expect(
      planWorkOrderEdit(null, workOrder(), edit({ title: "New title" }), { now: NOW }),
    ).toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(
      planWorkOrderEdit({ ...admin, isActive: false }, workOrder(), edit({ title: "New title" }), {
        now: NOW,
      }),
    ).toMatchObject({ code: "UNAUTHENTICATED" });
    expect(
      planWorkOrderEdit(tech, workOrder({ assigneeId: "tech-2" }), edit({ title: "New title" }), {
        now: NOW,
      }),
    ).toMatchObject({ code: "NOT_FOUND" });
    expect(
      planWorkOrderEdit(tech, workOrder(), edit({ title: "New title" }), { now: NOW }),
    ).toMatchObject({
      code: "FORBIDDEN",
    });
    expect(
      planWorkOrderEdit(tech, workOrder(), edit({ assigneeId: null }), { now: NOW }),
    ).toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("checks scope before revealing a version conflict", () => {
    expect(
      planWorkOrderEdit(tech, workOrder({ assigneeId: "tech-2" }), edit({ title: "x" }, 1), {
        now: NOW,
      }),
    ).toMatchObject({ code: "NOT_FOUND" });
    expect(
      planWorkOrderEdit(admin, workOrder(), edit({ title: "New title" }, 6), { now: NOW }),
    ).toMatchObject({
      code: "VERSION_CONFLICT",
    });
  });
});

describe("no-change detection", () => {
  it("compares normalized values and requests no version increment", () => {
    const result = planWorkOrderEdit(
      admin,
      workOrder(),
      edit({
        title: "  Replace lobby light ",
        description: "Ballast failing.  ",
        serviceAreaId: "area-north",
        priority: "MEDIUM",
        dueDate: "2026-10-09",
        assigneeId: "tech-1",
      }),
      { now: NOW },
    );
    expect(result).toEqual({ ok: true, value: { kind: "unchanged" } });
  });

  it("an unchanged edit at the version limit is still allowed (nothing to increment)", () => {
    expect(
      planWorkOrderEdit(
        admin,
        workOrder({ version: MAX_INT32 }),
        edit({ priority: "MEDIUM" }, MAX_INT32),
        {
          now: NOW,
        },
      ),
    ).toEqual({ ok: true, value: { kind: "unchanged" } });
  });
});

describe("changes and activities", () => {
  it("groups title, description, and service area into one DETAILS_UPDATED activity", () => {
    const result = planWorkOrderEdit(
      admin,
      workOrder(),
      edit({
        title: " Replace lobby fixture ",
        description: "Fixture replaced.",
        serviceAreaId: "area-south",
      }),
      { now: NOW },
    );
    expect(result).toEqual({
      ok: true,
      value: {
        kind: "changed",
        data: {
          title: "Replace lobby fixture",
          description: "Fixture replaced.",
          serviceAreaId: "area-south",
        },
        activities: [
          {
            type: "DETAILS_UPDATED",
            changes: {
              title: { from: "Replace lobby light", to: "Replace lobby fixture" },
              description: { from: "Ballast failing.", to: "Fixture replaced." },
              serviceAreaId: { from: "area-north", to: "area-south" },
            },
          },
        ],
        nextVersion: 8,
      },
    });
  });

  it("records priority, due date, and assignee changes separately", () => {
    const result = planWorkOrderEdit(
      admin,
      workOrder(),
      edit({ priority: "CRITICAL", dueDate: "2026-10-12", assigneeId: "tech-2" }),
      { now: NOW, newAssignee: { id: "tech-2", isActive: true } },
    );
    expect(
      result.ok && result.value.kind === "changed" && result.value.activities.map((a) => a.type),
    ).toEqual(["PRIORITY_CHANGED", "DUE_DATE_CHANGED", "ASSIGNEE_CHANGED"]);
    expect(result.ok && result.value.kind === "changed" && result.value.data).toEqual({
      priority: "CRITICAL",
      dueAt: dueAtFromDateOnly("2026-10-12"),
      assigneeId: "tech-2",
    });
  });

  it("allows assigning an active admin (Q3)", () => {
    const result = planWorkOrderEdit(
      admin,
      workOrder({ assigneeId: null }),
      edit({ assigneeId: "admin-1" }),
      {
        now: NOW,
        newAssignee: { id: "admin-1", isActive: true },
      },
    );
    expect(result.ok).toBe(true);
  });

  it("refuses to exceed the database integer limit for a real change", () => {
    expect(
      planWorkOrderEdit(
        admin,
        workOrder({ version: MAX_INT32 }),
        edit({ priority: "HIGH" }, MAX_INT32),
        {
          now: NOW,
        },
      ),
    ).toMatchObject({ code: "VERSION_LIMIT" });
  });
});

describe("due-date rules", () => {
  const overdue = workOrder({ dueAt: dueAtFromDateOnly("2026-09-30") });

  it("preserves an unchanged past due date during an unrelated edit (Q6)", () => {
    const result = planWorkOrderEdit(
      admin,
      overdue,
      edit({ dueDate: "2026-09-30", priority: "HIGH" }),
      {
        now: NOW,
      },
    );
    expect(result.ok && result.value.kind === "changed" && result.value.data).toEqual({
      priority: "HIGH",
    });
  });

  it("rejects changing the due date to a past date", () => {
    expect(
      planWorkOrderEdit(admin, overdue, edit({ dueDate: "2026-10-01" }), { now: NOW }),
    ).toMatchObject({
      code: "DUE_DATE_IN_PAST",
    });
  });

  it("accepts moving an overdue due date to today", () => {
    const result = planWorkOrderEdit(admin, overdue, edit({ dueDate: "2026-10-05" }), { now: NOW });
    expect(result.ok && result.value.kind).toBe("changed");
  });

  it("rejects impossible dates", () => {
    expect(
      planWorkOrderEdit(admin, workOrder(), edit({ dueDate: "2026-02-30" }), { now: NOW }),
    ).toMatchObject({
      code: "INVALID_DUE_DATE",
    });
  });
});

describe("assignment rules", () => {
  it("allows unassigning only while OPEN", () => {
    expect(planWorkOrderEdit(admin, workOrder(), edit({ assigneeId: null }), { now: NOW }).ok).toBe(
      true,
    );
    for (const status of ["IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"] as const) {
      expect(
        planWorkOrderEdit(admin, workOrder({ status }), edit({ assigneeId: null }), { now: NOW }),
      ).toMatchObject({ code: "UNASSIGN_NOT_ALLOWED" });
    }
  });

  it("allows reassigning in-progress work to another active user", () => {
    const result = planWorkOrderEdit(
      admin,
      workOrder({ status: "IN_PROGRESS" }),
      edit({ assigneeId: "tech-2" }),
      {
        now: NOW,
        newAssignee: { id: "tech-2", isActive: true },
      },
    );
    expect(result.ok).toBe(true);
  });

  it("rejects inactive, missing, or mismatched assignee lookups", () => {
    const input = edit({ assigneeId: "tech-2" });
    expect(
      planWorkOrderEdit(admin, workOrder(), input, {
        now: NOW,
        newAssignee: { id: "tech-2", isActive: false },
      }),
    ).toMatchObject({ code: "ASSIGNEE_INACTIVE" });
    expect(
      planWorkOrderEdit(admin, workOrder(), input, { now: NOW, newAssignee: null }),
    ).toMatchObject({
      code: "ASSIGNEE_NOT_FOUND",
    });
    expect(planWorkOrderEdit(admin, workOrder(), input, { now: NOW })).toMatchObject({
      code: "ASSIGNEE_NOT_FOUND",
    });
    expect(
      planWorkOrderEdit(admin, workOrder(), input, {
        now: NOW,
        newAssignee: { id: "tech-3", isActive: true },
      }),
    ).toMatchObject({ code: "ASSIGNEE_NOT_FOUND" });
  });
});

describe("date inputs", () => {
  it("rejects invalid Date values and never mutates inputs", () => {
    expect(() =>
      planWorkOrderEdit(admin, workOrder(), edit({ title: "Valid" }), {
        now: new Date(Number.NaN),
      }),
    ).toThrow(TypeError);
    const current = workOrder();
    const before = current.dueAt.getTime();
    planWorkOrderEdit(admin, current, edit({ dueDate: "2026-10-20" }), { now: NOW });
    expect(current.dueAt.getTime()).toBe(before);
  });
});
