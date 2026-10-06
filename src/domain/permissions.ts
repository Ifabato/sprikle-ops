import type { Role } from "./enums";
import { fail, ok, type RuleResult } from "./result";

// Pure authorization rules (docs/authorization.md).
//
// IMPORTANT: these helpers decide what an already-identified actor may do. They do NOT verify a
// session. Server code must resolve the actor from a verified session (Phase 4) and call these
// rules inside every service (Phase 5); hiding UI is never the security boundary.

export interface Actor {
  readonly id: string;
  readonly role: Role;
  readonly isActive: boolean;
}

/** What callers may hold before authentication is confirmed. */
export type MaybeActor = Actor | null | undefined;

export type AccessDenial = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND";
export type AccessDecision =
  | { readonly allowed: true; readonly actor: Actor }
  | { readonly allowed: false; readonly reason: AccessDenial };

/** Actions that do not target a specific work order. */
export type GlobalAction =
  | "dashboard.view"
  | "workOrder.list"
  | "workOrder.create"
  | "analytics.view"
  | "assignees.list"
  | "profile.view";

/** Actions on one work order; team members are limited to work currently assigned to them. */
export type WorkOrderAction =
  | "workOrder.view"
  | "workOrder.editDetails"
  | "workOrder.assign"
  | "workOrder.transition"
  | "comment.create";

export interface WorkOrderScopeSubject {
  readonly assigneeId: string | null;
}

const ADMIN_ONLY_GLOBAL: ReadonlySet<GlobalAction> = new Set([
  "workOrder.create",
  "analytics.view",
  "assignees.list",
]);

const ADMIN_ONLY_ON_WORK_ORDER: ReadonlySet<WorkOrderAction> = new Set([
  "workOrder.editDetails",
  "workOrder.assign",
]);

/** Missing or inactive actors are treated as unauthenticated (Q4). */
export function authenticatedActor(actor: MaybeActor): Actor | null {
  if (!actor || !actor.isActive || actor.id.length === 0) {
    return null;
  }
  return actor;
}

export function isInScope(actor: Actor, subject: WorkOrderScopeSubject): boolean {
  return actor.role === "ADMIN" || subject.assigneeId === actor.id;
}

export function decide(actor: MaybeActor, action: GlobalAction): AccessDecision {
  const current = authenticatedActor(actor);
  if (!current) {
    return { allowed: false, reason: "UNAUTHENTICATED" };
  }
  if (ADMIN_ONLY_GLOBAL.has(action) && current.role !== "ADMIN") {
    return { allowed: false, reason: "FORBIDDEN" };
  }
  return { allowed: true, actor: current };
}

/**
 * Precedence: UNAUTHENTICATED (missing/inactive) → NOT_FOUND (team member, not currently
 * assigned; never reveals that the work order exists) → FORBIDDEN (in scope, role lacks the
 * action) → allowed. `workOrder.transition` only establishes access; the specific transition is
 * checked by planTransition.
 */
export function decideOnWorkOrder(
  actor: MaybeActor,
  action: WorkOrderAction,
  subject: WorkOrderScopeSubject,
): AccessDecision {
  const current = authenticatedActor(actor);
  if (!current) {
    return { allowed: false, reason: "UNAUTHENTICATED" };
  }
  if (!isInScope(current, subject)) {
    return { allowed: false, reason: "NOT_FOUND" };
  }
  if (ADMIN_ONLY_ON_WORK_ORDER.has(action) && current.role !== "ADMIN") {
    return { allowed: false, reason: "FORBIDDEN" };
  }
  return { allowed: true, actor: current };
}

export type WorkOrderScope =
  { readonly kind: "all" } | { readonly kind: "assignedTo"; readonly userId: string };

/** Which work orders an actor's lists and dashboard may include. */
export function workOrderScopeFor(
  actor: MaybeActor,
): RuleResult<WorkOrderScope, "UNAUTHENTICATED"> {
  const current = authenticatedActor(actor);
  if (!current) {
    return fail("UNAUTHENTICATED", "Sign in to continue.");
  }
  return ok(
    current.role === "ADMIN" ? { kind: "all" } : { kind: "assignedTo", userId: current.id },
  );
}

export interface AssigneeCandidate {
  readonly id: string;
  readonly isActive: boolean;
}

export type AssigneeRuleCode = "ASSIGNEE_NOT_FOUND" | "ASSIGNEE_INACTIVE";

/** Any active user, ADMIN or TEAM_MEMBER, may be assigned work (Q3). */
export function checkAssignee(
  candidate: AssigneeCandidate | null | undefined,
): RuleResult<AssigneeCandidate, AssigneeRuleCode> {
  if (!candidate) {
    return fail("ASSIGNEE_NOT_FOUND", "The selected assignee does not exist.");
  }
  if (!candidate.isActive) {
    return fail("ASSIGNEE_INACTIVE", "Inactive users cannot be assigned work.");
  }
  return ok(candidate);
}
