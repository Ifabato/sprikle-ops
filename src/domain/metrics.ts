import { isOverdue } from "./due-dates";
import { isActiveStatus, type Priority, type WorkOrderStatus } from "./enums";
import { NEEDS_ATTENTION_LIMIT } from "./limits";
import {
  APP_TIME_ZONE,
  addLocalDays,
  assertValidDate,
  localDateOf,
  startOfIsoWeek,
  startOfLocalDay,
} from "./time";

// Pure metric calculations (docs/metrics.md). Database aggregation queries come in Phases 9–10;
// they must produce the same numbers as these helpers for the same records.
//
// Records vs events: every MVP metric uses CURRENT work-order records (current status and current
// completedAt). A work order reopened and completed again is one completed record but two
// historical completion events; no MVP metric counts events.

// ---------------------------------------------------------------------------
// Reporting intervals
// ---------------------------------------------------------------------------

/** Half-open interval: `start` inclusive, `end` exclusive. */
export interface Interval {
  readonly start: Date;
  readonly end: Date;
}

export function intervalContains(interval: Interval, instant: Date): boolean {
  assertValidDate(instant, "instant");
  const t = instant.getTime();
  return t >= interval.start.getTime() && t < interval.end.getTime();
}

/** Exclusive end for "up to and including now": records timestamped after `now` are excluded. */
function endIncludingNow(now: Date): Date {
  return new Date(now.getTime() + 1);
}

/**
 * "Last N days" in New York calendar terms: from local midnight N−1 days before today, through
 * now (inclusive). Future timestamps are excluded. Example: N = 30 → today plus the 29 prior days.
 */
export function reportingWindow(
  now: Date,
  days: number,
  timeZone: string = APP_TIME_ZONE,
): Interval {
  assertValidDate(now, "now");
  if (!Number.isInteger(days) || days < 1 || days > 366) {
    throw new RangeError("days must be an integer from 1 to 366.");
  }
  const today = localDateOf(now, timeZone);
  return {
    start: startOfLocalDay(addLocalDays(today, -(days - 1)), timeZone),
    end: endIncludingNow(now),
  };
}

/**
 * The last `weeks` ISO weeks (Monday 00:00 local to the next Monday 00:00 local), oldest first,
 * including the current partial week, whose end is clipped to now (inclusive).
 */
export function isoWeekBuckets(
  now: Date,
  weeks: number,
  timeZone: string = APP_TIME_ZONE,
): Interval[] {
  assertValidDate(now, "now");
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 53) {
    throw new RangeError("weeks must be an integer from 1 to 53.");
  }
  const currentMonday = startOfIsoWeek(localDateOf(now, timeZone));
  const buckets: Interval[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const monday = addLocalDays(currentMonday, -7 * i);
    const start = startOfLocalDay(monday, timeZone);
    const nextMonday = startOfLocalDay(addLocalDays(monday, 7), timeZone);
    buckets.push({ start, end: i === 0 ? endIncludingNow(now) : nextMonday });
  }
  return buckets;
}

/** Count of instants per bucket (zero-filled). Instants outside every bucket are not counted. */
export function countByBucket(instants: readonly Date[], buckets: readonly Interval[]): number[] {
  for (const instant of instants) {
    assertValidDate(instant, "instant");
  }
  // Buckets are disjoint, so each instant is counted at most once.
  return buckets.map(
    (bucket) => instants.filter((instant) => intervalContains(bucket, instant)).length,
  );
}

// ---------------------------------------------------------------------------
// Completion rate (cohort by createdAt)
// ---------------------------------------------------------------------------

export interface Rate {
  readonly numerator: number;
  readonly denominator: number;
  /** null when the denominator is 0 (shown as "—", never 0%). */
  readonly value: number | null;
}

function assertCount(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer.`);
  }
}

/**
 * Completion rate = completed ÷ (total − cancelled), all counted over the same cohort
 * (work orders created in the window), using CURRENT statuses.
 */
export function completionRate(counts: {
  readonly total: number;
  readonly completed: number;
  readonly cancelled: number;
}): Rate {
  assertCount(counts.total, "total");
  assertCount(counts.completed, "completed");
  assertCount(counts.cancelled, "cancelled");
  if (counts.completed + counts.cancelled > counts.total) {
    throw new RangeError("completed + cancelled cannot exceed total.");
  }
  const denominator = counts.total - counts.cancelled;
  return {
    numerator: counts.completed,
    denominator,
    value: denominator === 0 ? null : counts.completed / denominator,
  };
}

export interface MetricRecord {
  readonly status: WorkOrderStatus;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
}

/** Rejects records whose completedAt disagrees with their status (corrupt data, never skipped). */
function assertConsistent(record: MetricRecord): void {
  assertValidDate(record.createdAt, "createdAt");
  if ((record.status === "COMPLETED") !== (record.completedAt !== null)) {
    throw new RangeError("completedAt must be set exactly when status is COMPLETED.");
  }
  if (record.completedAt !== null) {
    assertValidDate(record.completedAt, "completedAt");
  }
}

/**
 * Cohort = records with createdAt in the window (future-created records are outside it).
 * Numerator: cohort records currently COMPLETED (whenever completed). Denominator: cohort minus
 * records currently CANCELLED. Restored work counts by its current status; reopened work that
 * has not been completed again counts as not completed.
 */
export function completionRateForCohort(records: readonly MetricRecord[], window: Interval): Rate {
  let total = 0;
  let completed = 0;
  let cancelled = 0;
  for (const record of records) {
    assertConsistent(record);
    if (!intervalContains(window, record.createdAt)) {
      continue;
    }
    total += 1;
    if (record.status === "COMPLETED") completed += 1;
    if (record.status === "CANCELLED") cancelled += 1;
  }
  return completionRate({ total, completed, cancelled });
}

// ---------------------------------------------------------------------------
// Average time to completion
// ---------------------------------------------------------------------------

/** completedAt − createdAt in ms; negative durations are data errors and throw. */
export function completionDurationMs(createdAt: Date, completedAt: Date): number {
  assertValidDate(createdAt, "createdAt");
  assertValidDate(completedAt, "completedAt");
  const duration = completedAt.getTime() - createdAt.getTime();
  if (duration < 0) {
    throw new RangeError("completedAt cannot be earlier than createdAt.");
  }
  return duration;
}

export interface MeanDuration {
  /** null when n = 0 (shown as "—"). */
  readonly meanMs: number | null;
  readonly n: number;
}

/** Mean of durations; negative or non-finite durations throw instead of being included. */
export function meanDuration(durationsMs: readonly number[]): MeanDuration {
  let sum = 0;
  for (const duration of durationsMs) {
    if (!Number.isFinite(duration) || duration < 0) {
      throw new RangeError("Durations must be finite and non-negative.");
    }
    sum += duration;
  }
  return {
    meanMs: durationsMs.length === 0 ? null : sum / durationsMs.length,
    n: durationsMs.length,
  };
}

/**
 * Mean(completedAt − createdAt) over records CURRENTLY completed with completedAt in the window.
 * For reopened-and-recompleted work this spans creation to the final completion (including the
 * reopened period). Reopened work not yet completed again has no completedAt and is excluded.
 */
export function averageCompletionTime(
  records: readonly MetricRecord[],
  window: Interval,
): MeanDuration {
  const durations: number[] = [];
  for (const record of records) {
    assertConsistent(record);
    if (record.completedAt !== null && intervalContains(window, record.completedAt)) {
      durations.push(completionDurationMs(record.createdAt, record.completedAt));
    }
  }
  return meanDuration(durations);
}

// ---------------------------------------------------------------------------
// Needs Attention
// ---------------------------------------------------------------------------

export interface AttentionCandidate {
  readonly number: number;
  readonly status: WorkOrderStatus;
  readonly priority: Priority;
  readonly dueAt: Date;
}

/** Category ranks: 0 overdue, 1 CRITICAL, 2 BLOCKED, 3 HIGH. */
export const ATTENTION_CATEGORIES = ["OVERDUE", "CRITICAL", "BLOCKED", "HIGH"] as const;
export type AttentionCategory = (typeof ATTENTION_CATEGORIES)[number];

/**
 * The FIRST matching category in the order overdue → CRITICAL → BLOCKED → HIGH, or null when the
 * work order does not need attention (terminal, or active with none of the conditions).
 */
export function attentionCategory(item: AttentionCandidate, now: Date): AttentionCategory | null {
  if (!isActiveStatus(item.status)) return null;
  if (isOverdue(item, now)) return "OVERDUE";
  if (item.priority === "CRITICAL") return "CRITICAL";
  if (item.status === "BLOCKED") return "BLOCKED";
  if (item.priority === "HIGH") return "HIGH";
  return null;
}

/** Ranked by category, then dueAt ascending, then work-order number ascending (deterministic). */
export function needsAttention<T extends AttentionCandidate>(
  items: readonly T[],
  now: Date,
  limit: number = NEEDS_ATTENTION_LIMIT,
): T[] {
  if (!Number.isInteger(limit) || limit < 0) {
    throw new RangeError("limit must be a non-negative integer.");
  }
  return items
    .map((item) => ({ item, category: attentionCategory(item, now) }))
    .filter((entry): entry is { item: T; category: AttentionCategory } => entry.category !== null)
    .sort(
      (a, b) =>
        ATTENTION_CATEGORIES.indexOf(a.category) - ATTENTION_CATEGORIES.indexOf(b.category) ||
        a.item.dueAt.getTime() - b.item.dueAt.getTime() ||
        a.item.number - b.item.number,
    )
    .slice(0, limit)
    .map((entry) => entry.item);
}

// ---------------------------------------------------------------------------
// Record/event reconciliation
// ---------------------------------------------------------------------------

/**
 * A work order's current status must equal the target of its LATEST STATUS_CHANGED activity.
 * Work orders are always created OPEN, so one with no status-change events (only CREATED, and
 * possibly comment/assignment/detail activity) must still be OPEN.
 */
export function statusMatchesLatestEvent(
  currentStatus: WorkOrderStatus,
  latestStatusChange: { readonly toStatus: WorkOrderStatus } | null,
): boolean {
  return latestStatusChange === null
    ? currentStatus === "OPEN"
    : latestStatusChange.toStatus === currentStatus;
}
