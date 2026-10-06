// Domain enum values. Client-safe: these mirror the Prisma/PostgreSQL enums without importing
// generated server code. tests/unit/domain/enums-sync.test.ts fails if they drift.
// Declaration order matches the database (PostgreSQL sorts enums by declaration order).

export const ROLES = ["ADMIN", "TEAM_MEMBER"] as const;
export type Role = (typeof ROLES)[number];

export const WORK_ORDER_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

/** Statuses that still need work. Overdue and workload metrics consider only these. */
export const ACTIVE_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "BLOCKED",
] as const satisfies readonly WorkOrderStatus[];

export const TERMINAL_STATUSES = [
  "COMPLETED",
  "CANCELLED",
] as const satisfies readonly WorkOrderStatus[];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const ACTIVITY_TYPES = [
  "CREATED",
  "STATUS_CHANGED",
  "ASSIGNEE_CHANGED",
  "PRIORITY_CHANGED",
  "DUE_DATE_CHANGED",
  "DETAILS_UPDATED",
  "COMMENT_ADDED",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export function isActiveStatus(status: WorkOrderStatus): boolean {
  return (ACTIVE_STATUSES as readonly WorkOrderStatus[]).includes(status);
}
