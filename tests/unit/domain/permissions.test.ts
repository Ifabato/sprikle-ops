import { describe, expect, it } from "vitest";
import {
  authenticatedActor,
  checkAssignee,
  decide,
  decideOnWorkOrder,
  workOrderScopeFor,
  type Actor,
  type GlobalAction,
  type MaybeActor,
  type WorkOrderAction,
} from "@/domain/permissions";

const admin: Actor = { id: "admin-1", role: "ADMIN", isActive: true };
const tech: Actor = { id: "tech-1", role: "TEAM_MEMBER", isActive: true };
const inactiveAdmin: Actor = { ...admin, isActive: false };
const inactiveTech: Actor = { ...tech, isActive: false };
const blankId: Actor = { id: "", role: "ADMIN", isActive: true };

const unauthenticatedActors: [string, MaybeActor][] = [
  ["no actor (null)", null],
  ["no actor (undefined)", undefined],
  ["inactive admin", inactiveAdmin],
  ["inactive team member", inactiveTech],
  ["actor without id", blankId],
];

describe("authenticatedActor", () => {
  it.each(unauthenticatedActors)("treats %s as unauthenticated", (_label, actor) => {
    expect(authenticatedActor(actor)).toBeNull();
  });

  it("returns active actors unchanged", () => {
    expect(authenticatedActor(tech)).toBe(tech);
  });
});

describe("decide (global actions)", () => {
  const expected: Record<GlobalAction, { admin: boolean; teamMember: boolean }> = {
    "dashboard.view": { admin: true, teamMember: true },
    "workOrder.list": { admin: true, teamMember: true },
    "profile.view": { admin: true, teamMember: true },
    "workOrder.create": { admin: true, teamMember: false },
    "analytics.view": { admin: true, teamMember: false },
    "assignees.list": { admin: true, teamMember: false },
  };

  it.each(Object.entries(expected) as [GlobalAction, { admin: boolean; teamMember: boolean }][])(
    "%s",
    (action, allowed) => {
      expect(decide(admin, action)).toEqual(
        allowed.admin ? { allowed: true, actor: admin } : { allowed: false, reason: "FORBIDDEN" },
      );
      expect(decide(tech, action)).toEqual(
        allowed.teamMember
          ? { allowed: true, actor: tech }
          : { allowed: false, reason: "FORBIDDEN" },
      );
      for (const [, actor] of unauthenticatedActors) {
        expect(decide(actor, action)).toEqual({ allowed: false, reason: "UNAUTHENTICATED" });
      }
    },
  );
});

describe("decideOnWorkOrder", () => {
  const ownWork = { assigneeId: tech.id };
  const otherWork = { assigneeId: "tech-2" };
  const unassigned = { assigneeId: null };

  const teamMemberOnOwnWork: Record<WorkOrderAction, "ALLOW" | "FORBIDDEN"> = {
    "workOrder.view": "ALLOW",
    "workOrder.transition": "ALLOW",
    "comment.create": "ALLOW",
    "workOrder.editDetails": "FORBIDDEN",
    "workOrder.assign": "FORBIDDEN",
  };

  it.each(Object.entries(teamMemberOnOwnWork) as [WorkOrderAction, "ALLOW" | "FORBIDDEN"][])(
    "%s",
    (action, ownResult) => {
      // Admins: every action on every work order.
      for (const subject of [ownWork, otherWork, unassigned]) {
        expect(decideOnWorkOrder(admin, action, subject)).toEqual({ allowed: true, actor: admin });
      }
      // Team member on currently assigned work.
      expect(decideOnWorkOrder(tech, action, ownWork)).toEqual(
        ownResult === "ALLOW"
          ? { allowed: true, actor: tech }
          : { allowed: false, reason: "FORBIDDEN" },
      );
      // Team member on anyone else's or unassigned work: always NOT_FOUND (Q17), even for
      // admin-only actions, so references cannot be probed.
      expect(decideOnWorkOrder(tech, action, otherWork)).toEqual({
        allowed: false,
        reason: "NOT_FOUND",
      });
      expect(decideOnWorkOrder(tech, action, unassigned)).toEqual({
        allowed: false,
        reason: "NOT_FOUND",
      });
      // Unauthenticated always wins.
      for (const [, actor] of unauthenticatedActors) {
        expect(decideOnWorkOrder(actor, action, ownWork)).toEqual({
          allowed: false,
          reason: "UNAUTHENTICATED",
        });
      }
    },
  );

  it("loses access when work is reassigned away (scope is the CURRENT assignee)", () => {
    expect(decideOnWorkOrder(tech, "workOrder.view", { assigneeId: "someone-else" })).toEqual({
      allowed: false,
      reason: "NOT_FOUND",
    });
  });
});

describe("workOrderScopeFor", () => {
  it("gives admins every work order and team members only their assignments", () => {
    expect(workOrderScopeFor(admin)).toEqual({ ok: true, value: { kind: "all" } });
    expect(workOrderScopeFor(tech)).toEqual({
      ok: true,
      value: { kind: "assignedTo", userId: tech.id },
    });
  });

  it.each(unauthenticatedActors)("rejects %s", (_label, actor) => {
    expect(workOrderScopeFor(actor)).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
  });
});

describe("checkAssignee", () => {
  it("accepts any active user, including admins (Q3)", () => {
    expect(checkAssignee({ id: admin.id, isActive: true })).toEqual({
      ok: true,
      value: { id: admin.id, isActive: true },
    });
  });

  it("rejects inactive and missing users", () => {
    expect(checkAssignee({ id: "u", isActive: false })).toMatchObject({
      ok: false,
      code: "ASSIGNEE_INACTIVE",
    });
    expect(checkAssignee(null)).toMatchObject({ ok: false, code: "ASSIGNEE_NOT_FOUND" });
    expect(checkAssignee(undefined)).toMatchObject({ ok: false, code: "ASSIGNEE_NOT_FOUND" });
  });
});
