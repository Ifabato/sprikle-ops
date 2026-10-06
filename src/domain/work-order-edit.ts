import { dueAtFromDateOnly, validateNewDueDate } from "./due-dates";
import type { Priority, WorkOrderStatus } from "./enums";
import { MAX_INT32 } from "./limits";
import {
  checkAssignee,
  decideOnWorkOrder,
  type AssigneeCandidate,
  type MaybeActor,
} from "./permissions";
import { fail, ok, type RuleResult } from "./result";
import { APP_TIME_ZONE, assertValidDate, parseDateOnly } from "./time";

// Pure edit planning for ADMIN detail edits and (re)assignment. Inputs are expected to come from
// editWorkOrderSchema (trimmed, length-checked); this module decides what actually changed.

export interface EditableWorkOrder {
  readonly status: WorkOrderStatus;
  readonly title: string;
  readonly description: string;
  readonly serviceAreaId: string;
  readonly priority: Priority;
  readonly dueAt: Date;
  readonly assigneeId: string | null;
  readonly version: number;
}

/** Omitted (undefined) fields are unchanged. `assigneeId: null` means "unassign". */
export interface WorkOrderEditInput {
  readonly version: number;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly serviceAreaId?: string | undefined;
  readonly priority?: Priority | undefined;
  readonly dueDate?: string | undefined;
  readonly assigneeId?: string | null | undefined;
}

export interface EditContext {
  readonly now: Date;
  readonly timeZone?: string;
  /** The user referenced by a non-null `assigneeId`, looked up by the caller (null if missing). */
  readonly newAssignee?: AssigneeCandidate | null;
}

interface FieldChange<T> {
  readonly from: T;
  readonly to: T;
}

export type EditActivity =
  | {
      readonly type: "DETAILS_UPDATED";
      readonly changes: {
        readonly title?: FieldChange<string>;
        readonly description?: FieldChange<string>;
        readonly serviceAreaId?: FieldChange<string>;
      };
    }
  | {
      readonly type: "PRIORITY_CHANGED";
      readonly changes: { readonly priority: FieldChange<Priority> };
    }
  | { readonly type: "DUE_DATE_CHANGED"; readonly changes: { readonly dueAt: FieldChange<string> } }
  | {
      readonly type: "ASSIGNEE_CHANGED";
      readonly changes: { readonly assigneeId: FieldChange<string | null> };
    };

export interface WorkOrderEditData {
  title?: string;
  description?: string;
  serviceAreaId?: string;
  priority?: Priority;
  dueAt?: Date;
  assigneeId?: string | null;
}

export type EditPlan =
  | { readonly kind: "unchanged" }
  | {
      readonly kind: "changed";
      readonly data: Readonly<WorkOrderEditData>;
      readonly activities: readonly EditActivity[];
      readonly nextVersion: number;
    };

export type EditErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "VERSION_CONFLICT"
  | "INVALID_DUE_DATE"
  | "DUE_DATE_IN_PAST"
  | "UNASSIGN_NOT_ALLOWED"
  | "ASSIGNEE_NOT_FOUND"
  | "ASSIGNEE_INACTIVE"
  | "VERSION_LIMIT";

/**
 * Plans an edit. Order: access (UNAUTHENTICATED → NOT_FOUND → FORBIDDEN) → VERSION_CONFLICT →
 * per-field rules → "unchanged" when no normalized value differs (no version increment) →
 * VERSION_LIMIT. Only a real change requests a version increment.
 */
export function planWorkOrderEdit(
  actor: MaybeActor,
  current: EditableWorkOrder,
  input: WorkOrderEditInput,
  context: EditContext,
): RuleResult<EditPlan, EditErrorCode> {
  assertValidDate(context.now, "now");
  assertValidDate(current.dueAt, "dueAt");
  const timeZone = context.timeZone ?? APP_TIME_ZONE;

  const touchesAssignee = input.assigneeId !== undefined;
  const touchesDetails =
    input.title !== undefined ||
    input.description !== undefined ||
    input.serviceAreaId !== undefined ||
    input.priority !== undefined ||
    input.dueDate !== undefined;
  // Both actions are ADMIN-only; check whichever the input touches (details if neither).
  const access = decideOnWorkOrder(
    actor,
    touchesAssignee && !touchesDetails ? "workOrder.assign" : "workOrder.editDetails",
    current,
  );
  if (!access.allowed) {
    return fail(access.reason, accessMessage(access.reason));
  }
  if (input.version !== current.version) {
    return fail(
      "VERSION_CONFLICT",
      "This work order was updated by someone else. Reload to see the latest version.",
    );
  }

  const data: WorkOrderEditData = {};
  const activities: EditActivity[] = [];
  const details: {
    title?: FieldChange<string>;
    description?: FieldChange<string>;
    serviceAreaId?: FieldChange<string>;
  } = {};

  const title = input.title?.trim();
  if (title !== undefined && title !== current.title.trim()) {
    details.title = { from: current.title, to: title };
    data.title = title;
  }
  const description = input.description?.trim();
  if (description !== undefined && description !== current.description.trim()) {
    details.description = { from: current.description, to: description };
    data.description = description;
  }
  if (input.serviceAreaId !== undefined && input.serviceAreaId !== current.serviceAreaId) {
    details.serviceAreaId = { from: current.serviceAreaId, to: input.serviceAreaId };
    data.serviceAreaId = input.serviceAreaId;
  }
  if (Object.keys(details).length > 0) {
    activities.push({ type: "DETAILS_UPDATED", changes: details });
  }

  if (input.priority !== undefined && input.priority !== current.priority) {
    activities.push({
      type: "PRIORITY_CHANGED",
      changes: { priority: { from: current.priority, to: input.priority } },
    });
    data.priority = input.priority;
  }

  if (input.dueDate !== undefined) {
    // Only a CHANGED due date must be today or later; an unchanged past due date is preserved (Q6).
    const due = validateNewDueDateIfChanged(input.dueDate, current.dueAt, context.now, timeZone);
    if (!due.ok) {
      return due;
    }
    if (due.value !== null) {
      activities.push({
        type: "DUE_DATE_CHANGED",
        changes: { dueAt: { from: current.dueAt.toISOString(), to: due.value.toISOString() } },
      });
      data.dueAt = due.value;
    }
  }

  if (input.assigneeId !== undefined && input.assigneeId !== current.assigneeId) {
    if (input.assigneeId === null) {
      if (current.status !== "OPEN") {
        return fail("UNASSIGN_NOT_ALLOWED", "Work can only be unassigned while it is OPEN.");
      }
    } else {
      const candidate = context.newAssignee;
      const assignee = checkAssignee(
        candidate && candidate.id === input.assigneeId ? candidate : null,
      );
      if (!assignee.ok) {
        return assignee;
      }
    }
    activities.push({
      type: "ASSIGNEE_CHANGED",
      changes: { assigneeId: { from: current.assigneeId, to: input.assigneeId } },
    });
    data.assigneeId = input.assigneeId;
  }

  if (activities.length === 0) {
    return ok({ kind: "unchanged" });
  }
  if (current.version >= MAX_INT32) {
    return fail("VERSION_LIMIT", "This work order has reached its maximum number of updates.");
  }
  return ok({ kind: "changed", data, activities, nextVersion: current.version + 1 });
}

/** Returns the new dueAt, or null when the requested date equals the current due date. */
function validateNewDueDateIfChanged(
  dueDate: string,
  currentDueAt: Date,
  now: Date,
  timeZone: string,
): RuleResult<Date | null, "INVALID_DUE_DATE" | "DUE_DATE_IN_PAST"> {
  const date = parseDateOnly(dueDate);
  if (!date) {
    return fail("INVALID_DUE_DATE", "Due date must be a real date in YYYY-MM-DD format.");
  }
  if (dueAtFromDateOnly(date, timeZone).getTime() === currentDueAt.getTime()) {
    return ok(null); // unchanged, even if it is already in the past
  }
  return validateNewDueDate(date, now, timeZone);
}

function accessMessage(reason: "UNAUTHENTICATED" | "NOT_FOUND" | "FORBIDDEN"): string {
  switch (reason) {
    case "UNAUTHENTICATED":
      return "Sign in to continue.";
    case "NOT_FOUND":
      return "Work order not found.";
    case "FORBIDDEN":
      return "Only an administrator can edit work orders.";
  }
}
