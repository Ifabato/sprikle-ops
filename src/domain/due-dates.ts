import { isActiveStatus, type WorkOrderStatus } from "./enums";
import { fail, ok, type RuleResult } from "./result";
import {
  APP_TIME_ZONE,
  addLocalDays,
  assertValidDate,
  compareLocalDates,
  endOfLocalDay,
  type LocalDate,
  localDateOf,
  parseDateOnly,
  startOfLocalDay,
} from "./time";

export interface DueSubject {
  readonly status: WorkOrderStatus;
  readonly dueAt: Date;
}

/** `due=` list filter values. "week" means the next 7 local calendar days ("Due in 7 days"). */
export const DUE_FILTERS = ["overdue", "today", "week"] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];

/** Days covered by the "Due in 7 days" filter: today through today + 6. */
export const DUE_SOON_DAYS = 7;

function toLocalDate(date: LocalDate | string): LocalDate {
  if (typeof date !== "string") {
    return date;
  }
  const parsed = parseDateOnly(date);
  if (!parsed) {
    throw new RangeError("Due date must be a real date in YYYY-MM-DD format.");
  }
  return parsed;
}

/** A date-only due date means the end of that date in the app time zone (decision D7). */
export function dueAtFromDateOnly(
  date: LocalDate | string,
  timeZone: string = APP_TIME_ZONE,
): Date {
  return endOfLocalDay(toLocalDate(date), timeZone);
}

/** Overdue = active status and `dueAt < now` (strict). Never stored. */
export function isOverdue(subject: DueSubject, now: Date): boolean {
  assertValidDate(subject.dueAt, "dueAt");
  assertValidDate(now, "now");
  return isActiveStatus(subject.status) && subject.dueAt.getTime() < now.getTime();
}

/**
 * Query bounds for a due filter, always combined with "status is active".
 * - overdue: dueAt < overdueBefore (= now)
 * - today:   notBefore (= now) <= dueAt < before (= start of tomorrow, local)
 * - week:    notBefore (= now) <= dueAt < before (= start of today + 7 days, local)
 */
export type DueFilterBounds =
  | { readonly kind: "overdue"; readonly overdueBefore: Date }
  | { readonly kind: "upcoming"; readonly notBefore: Date; readonly before: Date };

export function dueFilterBounds(
  filter: DueFilter,
  now: Date,
  timeZone: string = APP_TIME_ZONE,
): DueFilterBounds {
  assertValidDate(now, "now");
  const nowCopy = new Date(now.getTime());
  if (filter === "overdue") {
    return { kind: "overdue", overdueBefore: nowCopy };
  }
  const today = localDateOf(now, timeZone);
  const days = filter === "today" ? 1 : DUE_SOON_DAYS;
  return {
    kind: "upcoming",
    notBefore: nowCopy,
    before: startOfLocalDay(addLocalDays(today, days), timeZone),
  };
}

export function matchesDueFilter(
  subject: DueSubject,
  filter: DueFilter,
  now: Date,
  timeZone: string = APP_TIME_ZONE,
): boolean {
  assertValidDate(subject.dueAt, "dueAt");
  if (!isActiveStatus(subject.status)) {
    return false;
  }
  const bounds = dueFilterBounds(filter, now, timeZone);
  const due = subject.dueAt.getTime();
  if (bounds.kind === "overdue") {
    return due < bounds.overdueBefore.getTime();
  }
  return due >= bounds.notBefore.getTime() && due < bounds.before.getTime();
}

export type DueDateRuleCode = "INVALID_DUE_DATE" | "DUE_DATE_IN_PAST";

/**
 * Rule for a NEW or CHANGED due date: it must be today or later in the app time zone
 * (decision D6). An unchanged existing due date is not re-checked (Q6), so overdue work can
 * still be edited.
 */
export function validateNewDueDate(
  date: LocalDate | string,
  now: Date,
  timeZone: string = APP_TIME_ZONE,
): RuleResult<Date, DueDateRuleCode> {
  assertValidDate(now, "now");
  const parsed = typeof date === "string" ? parseDateOnly(date) : date;
  if (!parsed) {
    return fail("INVALID_DUE_DATE", "Due date must be a real date in YYYY-MM-DD format.");
  }
  if (compareLocalDates(parsed, localDateOf(now, timeZone)) < 0) {
    return fail("DUE_DATE_IN_PAST", "Due date cannot be in the past.");
  }
  return ok(dueAtFromDateOnly(parsed, timeZone));
}
