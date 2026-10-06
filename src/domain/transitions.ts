import type { Role, WorkOrderStatus } from "./enums";
import { MAX_INT32, TEXT_LIMITS } from "./limits";
import { authenticatedActor, isInScope, type MaybeActor } from "./permissions";
import { fail, ok, type RuleResult } from "./result";
import { assertValidDate } from "./time";

// Work-order state machine (docs/authorization.md, decision D8). Pure: returns a plan; services
// apply it to the database in Phase 5.

type AllowedActors = "ADMIN" | "ADMIN_OR_ASSIGNEE";

/** Missing entries are not allowed for anyone (✗). */
const TRANSITIONS: Readonly<
  Record<WorkOrderStatus, Readonly<Partial<Record<WorkOrderStatus, AllowedActors>>>>
> = {
  OPEN: {
    IN_PROGRESS: "ADMIN_OR_ASSIGNEE",
    BLOCKED: "ADMIN",
    COMPLETED: "ADMIN",
    CANCELLED: "ADMIN",
  },
  IN_PROGRESS: {
    OPEN: "ADMIN",
    BLOCKED: "ADMIN_OR_ASSIGNEE",
    COMPLETED: "ADMIN_OR_ASSIGNEE",
    CANCELLED: "ADMIN",
  },
  BLOCKED: {
    OPEN: "ADMIN",
    IN_PROGRESS: "ADMIN_OR_ASSIGNEE",
    CANCELLED: "ADMIN",
  },
  COMPLETED: { IN_PROGRESS: "ADMIN" },
  CANCELLED: { OPEN: "ADMIN" },
};

/** Entering these statuses requires an assignee (D6). */
export const STATUSES_REQUIRING_ASSIGNEE: readonly WorkOrderStatus[] = [
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETED",
];

/** Entering these statuses requires a note: BLOCKED (note) and CANCELLED (reason) (Q1). */
export const STATUSES_REQUIRING_NOTE: readonly WorkOrderStatus[] = ["BLOCKED", "CANCELLED"];

function roleMayPerform(allowed: AllowedActors, role: Role): boolean {
  return allowed === "ADMIN_OR_ASSIGNEE" || role === "ADMIN";
}

/** Targets reachable from `from` for a role (for UI action lists; access is still re-checked). */
export function allowedTargets(role: Role, from: WorkOrderStatus): WorkOrderStatus[] {
  return (Object.entries(TRANSITIONS[from]) as [WorkOrderStatus, AllowedActors][])
    .filter(([, allowed]) => roleMayPerform(allowed, role))
    .map(([to]) => to);
}

export interface TransitionSubject {
  readonly status: WorkOrderStatus;
  readonly assigneeId: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
  readonly cancelledAt: Date | null;
}

export interface TransitionRequest {
  readonly toStatus: WorkOrderStatus;
  /** Optimistic-concurrency token the client last saw. */
  readonly expectedVersion: number;
  /** Required for BLOCKED (note) and CANCELLED (reason); optional otherwise. */
  readonly note?: string | undefined;
}

export type TransitionErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "VERSION_CONFLICT"
  | "NO_CHANGE"
  | "INVALID_TRANSITION"
  | "FORBIDDEN"
  | "ASSIGNEE_REQUIRED"
  | "NOTE_REQUIRED"
  | "NOTE_TOO_LONG"
  | "CLOCK_SKEW"
  | "VERSION_LIMIT";

export interface TransitionPlan {
  readonly status: WorkOrderStatus;
  readonly completedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly nextVersion: number;
  readonly activity: {
    readonly type: "STATUS_CHANGED";
    readonly fromStatus: WorkOrderStatus;
    readonly toStatus: WorkOrderStatus;
  };
  /** BLOCKED note, cancellation reason, or optional note, stored as a comment. */
  readonly comment: { readonly body: string } | null;
}

/**
 * Evaluates a status change and returns what should be written. Checks, in order (first failure
 * wins), so unauthenticated or out-of-scope actors never learn anything about the work order:
 *  1. UNAUTHENTICATED — missing or inactive actor
 *  2. NOT_FOUND       — team member not currently assigned
 *  3. VERSION_CONFLICT
 *  4. NO_CHANGE       — target equals current status
 *  5. INVALID_TRANSITION — not allowed for anyone (✗ in the matrix)
 *  6. FORBIDDEN       — allowed only for ADMIN
 *  7. ASSIGNEE_REQUIRED, NOTE_REQUIRED / NOTE_TOO_LONG
 *  8. CLOCK_SKEW      — now earlier than createdAt; VERSION_LIMIT — version at INT32 maximum
 */
export function planTransition(
  actor: MaybeActor,
  subject: TransitionSubject,
  request: TransitionRequest,
  now: Date,
): RuleResult<TransitionPlan, TransitionErrorCode> {
  assertValidDate(now, "now");
  assertValidDate(subject.createdAt, "createdAt");

  const current = authenticatedActor(actor);
  if (!current) {
    return fail("UNAUTHENTICATED", "Sign in to continue.");
  }
  if (!isInScope(current, subject)) {
    return fail("NOT_FOUND", "Work order not found.");
  }
  if (request.expectedVersion !== subject.version) {
    return fail(
      "VERSION_CONFLICT",
      "This work order was updated by someone else. Reload to see the latest version.",
    );
  }

  const from = subject.status;
  const to = request.toStatus;
  if (from === to) {
    return fail("NO_CHANGE", `Work order is already ${from}.`);
  }
  const allowed = TRANSITIONS[from][to];
  if (!allowed) {
    return fail("INVALID_TRANSITION", `A work order cannot move from ${from} to ${to}.`);
  }
  if (!roleMayPerform(allowed, current.role)) {
    return fail("FORBIDDEN", "Only an administrator can make this change.");
  }
  if (STATUSES_REQUIRING_ASSIGNEE.includes(to) && subject.assigneeId === null) {
    return fail("ASSIGNEE_REQUIRED", `Assign the work order before moving it to ${to}.`);
  }

  const note = request.note?.trim() ?? "";
  if (STATUSES_REQUIRING_NOTE.includes(to) && note.length < TEXT_LIMITS.comment.min) {
    return fail(
      "NOTE_REQUIRED",
      to === "CANCELLED"
        ? "A cancellation reason is required."
        : "A note explaining the block is required.",
    );
  }
  if (note.length > TEXT_LIMITS.comment.max) {
    return fail("NOTE_TOO_LONG", `Notes can be at most ${TEXT_LIMITS.comment.max} characters.`);
  }
  if (now.getTime() < subject.createdAt.getTime()) {
    return fail("CLOCK_SKEW", "The current time is earlier than the work order's creation time.");
  }
  if (subject.version >= MAX_INT32) {
    return fail("VERSION_LIMIT", "This work order has reached its maximum number of updates.");
  }

  const at = new Date(now.getTime());
  return ok({
    status: to,
    // The database requires completedAt/cancelledAt to be set exactly when the status is
    // COMPLETED/CANCELLED, so entering stamps `now` and every other target (including reopen and
    // restore) clears them.
    completedAt: to === "COMPLETED" ? at : null,
    cancelledAt: to === "CANCELLED" ? at : null,
    nextVersion: subject.version + 1,
    activity: { type: "STATUS_CHANGED", fromStatus: from, toStatus: to },
    comment: note.length > 0 ? { body: note } : null,
  });
}
