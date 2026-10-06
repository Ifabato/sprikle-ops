import { describe, expect, it } from "vitest";
import { dueAtFromDateOnly } from "@/domain/due-dates";
import {
  attentionCategory,
  averageCompletionTime,
  completionDurationMs,
  completionRate,
  completionRateForCohort,
  countByBucket,
  intervalContains,
  isoWeekBuckets,
  meanDuration,
  needsAttention,
  reportingWindow,
  statusMatchesLatestEvent,
  type AttentionCandidate,
  type MetricRecord,
} from "@/domain/metrics";

const at = (iso: string) => new Date(iso);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// Monday 2026-10-05 10:00 EDT.
const NOW = at("2026-10-05T14:00:00.000Z");

describe("reportingWindow (New York calendar days)", () => {
  it("starts at local midnight 29 days before today and includes now", () => {
    const window = reportingWindow(NOW, 30);
    expect(window.start.toISOString()).toBe("2026-09-06T04:00:00.000Z");
    expect(window.end.getTime()).toBe(NOW.getTime() + 1);
    expect(intervalContains(window, window.start)).toBe(true);
    expect(intervalContains(window, new Date(window.start.getTime() - 1))).toBe(false);
    expect(intervalContains(window, NOW)).toBe(true);
    expect(intervalContains(window, new Date(NOW.getTime() + 1))).toBe(false); // future excluded
  });

  it("uses the correct offset when the window crosses a DST change", () => {
    // 2026-03-20 (EDT); 30 days back starts 2026-02-19 (EST).
    expect(reportingWindow(at("2026-03-20T16:00:00Z"), 30).start.toISOString()).toBe(
      "2026-02-19T05:00:00.000Z",
    );
    // 2026-11-15 (EST); start 2026-10-17 (EDT).
    expect(reportingWindow(at("2026-11-15T17:00:00Z"), 30).start.toISOString()).toBe(
      "2026-10-17T04:00:00.000Z",
    );
  });

  it("a 1-day window is today from local midnight", () => {
    expect(reportingWindow(NOW, 1).start.toISOString()).toBe("2026-10-05T04:00:00.000Z");
  });

  it.each([0, -1, 1.5, 367, Number.NaN])("rejects days = %s", (days) => {
    expect(() => reportingWindow(NOW, days)).toThrow(RangeError);
  });

  it("rejects an invalid now", () => {
    expect(() => reportingWindow(new Date(Number.NaN), 30)).toThrow(TypeError);
  });
});

describe("isoWeekBuckets", () => {
  it("returns 12 contiguous ISO weeks, oldest first, with the current week clipped to now", () => {
    const buckets = isoWeekBuckets(NOW, 12);
    expect(buckets).toHaveLength(12);
    expect(buckets[0]?.start.toISOString()).toBe("2026-07-20T04:00:00.000Z");
    expect(buckets[11]?.start.toISOString()).toBe("2026-10-05T04:00:00.000Z");
    expect(buckets[11]?.end.getTime()).toBe(NOW.getTime() + 1);
    for (let i = 1; i < buckets.length; i += 1) {
      expect(buckets[i]?.start.getTime()).toBe(buckets[i - 1]?.end.getTime());
    }
  });

  it("has 167 h and 169 h weeks around DST changes", () => {
    const spring = isoWeekBuckets(at("2026-03-20T16:00:00Z"), 3);
    // The week starting Monday 2026-03-02 contains the spring-forward Sunday (2026-03-08).
    expect(spring.map((b) => b.start.toISOString())).toEqual([
      "2026-03-02T05:00:00.000Z",
      "2026-03-09T04:00:00.000Z",
      "2026-03-16T04:00:00.000Z",
    ]);
    expect(((spring[0]?.end.getTime() ?? 0) - (spring[0]?.start.getTime() ?? 0)) / HOUR).toBe(167);

    const fall = isoWeekBuckets(at("2026-11-04T17:00:00Z"), 2);
    expect(fall.map((b) => b.start.toISOString())).toEqual([
      "2026-10-26T04:00:00.000Z",
      "2026-11-02T05:00:00.000Z",
    ]);
    expect(((fall[0]?.end.getTime() ?? 0) - (fall[0]?.start.getTime() ?? 0)) / HOUR).toBe(169);
  });

  it("handles ISO weeks spanning the new year", () => {
    const buckets = isoWeekBuckets(at("2027-01-01T17:00:00Z"), 1);
    expect(buckets[0]?.start.toISOString()).toBe("2026-12-28T05:00:00.000Z");
  });

  it.each([0, 54, 2.5])("rejects weeks = %s", (weeks) => {
    expect(() => isoWeekBuckets(NOW, weeks)).toThrow(RangeError);
  });
});

describe("countByBucket", () => {
  it("zero-fills, counts start inclusive / end exclusive, and excludes future timestamps", () => {
    const buckets = isoWeekBuckets(NOW, 3);
    const counts = countByBucket(
      [
        buckets[0]!.start, // first instant of week 1
        new Date(buckets[1]!.start.getTime() - 1), // last instant of week 1
        buckets[2]!.start, // current week
        NOW, // now itself counts
        new Date(NOW.getTime() + 1), // future: excluded
        at("2020-01-01T00:00:00Z"), // before the range: excluded
      ],
      buckets,
    );
    expect(counts).toEqual([2, 0, 2]);
  });

  it("returns all zeros for no data", () => {
    expect(countByBucket([], isoWeekBuckets(NOW, 4))).toEqual([0, 0, 0, 0]);
  });

  it("rejects invalid instants", () => {
    expect(() => countByBucket([new Date(Number.NaN)], isoWeekBuckets(NOW, 1))).toThrow(TypeError);
  });
});

describe("completionRate", () => {
  it("is completed ÷ (total − cancelled)", () => {
    expect(completionRate({ total: 10, completed: 6, cancelled: 2 })).toEqual({
      numerator: 6,
      denominator: 8,
      value: 0.75,
    });
  });

  it("returns null (not 0) when the denominator is zero", () => {
    expect(completionRate({ total: 0, completed: 0, cancelled: 0 }).value).toBeNull();
    expect(completionRate({ total: 3, completed: 0, cancelled: 3 })).toEqual({
      numerator: 0,
      denominator: 0,
      value: null,
    });
  });

  it.each([
    { total: -1, completed: 0, cancelled: 0 },
    { total: 1.5, completed: 0, cancelled: 0 },
    { total: 2, completed: Number.NaN, cancelled: 0 },
    { total: 2, completed: 2, cancelled: 1 },
  ])("rejects inconsistent counts %j", (counts) => {
    expect(() => completionRate(counts)).toThrow(RangeError);
  });
});

describe("completionRateForCohort (current records)", () => {
  const window = reportingWindow(NOW, 30);
  const inWindow = at("2026-09-20T15:00:00Z");
  const record = (status: MetricRecord["status"], createdAt = inWindow): MetricRecord => ({
    status,
    createdAt,
    completedAt: status === "COMPLETED" ? at("2026-09-25T15:00:00Z") : null,
  });

  it("counts the cohort created in the window by CURRENT status", () => {
    const records = [
      record("COMPLETED"),
      record("COMPLETED"),
      record("IN_PROGRESS"), // e.g. reopened and not yet completed again: not completed
      record("OPEN"), // e.g. restored from CANCELLED: counts by current status
      record("CANCELLED"), // excluded from the denominator
      record("COMPLETED", at("2026-08-01T15:00:00Z")), // created before the window
      record("OPEN", new Date(NOW.getTime() + DAY)), // created in the future: excluded
    ];
    expect(completionRateForCohort(records, window)).toEqual({
      numerator: 2,
      denominator: 4,
      value: 0.5,
    });
  });

  it("returns null for an empty cohort", () => {
    expect(completionRateForCohort([], window).value).toBeNull();
  });

  it("rejects records whose completedAt disagrees with status", () => {
    expect(() =>
      completionRateForCohort(
        [{ status: "COMPLETED", createdAt: inWindow, completedAt: null }],
        window,
      ),
    ).toThrow(RangeError);
    expect(() =>
      completionRateForCohort(
        [{ status: "IN_PROGRESS", createdAt: inWindow, completedAt: inWindow }],
        window,
      ),
    ).toThrow(RangeError);
  });
});

describe("durations", () => {
  it("computes completion durations and rejects negative ones", () => {
    expect(completionDurationMs(at("2026-09-01T00:00:00Z"), at("2026-09-02T00:00:00Z"))).toBe(DAY);
    expect(() =>
      completionDurationMs(at("2026-09-02T00:00:00Z"), at("2026-09-01T00:00:00Z")),
    ).toThrow(RangeError);
  });

  it("averages durations and reports n", () => {
    expect(meanDuration([HOUR, 3 * HOUR])).toEqual({ meanMs: 2 * HOUR, n: 2 });
    expect(meanDuration([])).toEqual({ meanMs: null, n: 0 });
  });

  it.each([[-1], [Number.NaN], [Number.POSITIVE_INFINITY]])("rejects duration %s", (bad) => {
    expect(() => meanDuration([HOUR, bad])).toThrow(RangeError);
  });

  it("averages current completed records by completedAt in the window", () => {
    const window = reportingWindow(NOW, 30);
    const records: MetricRecord[] = [
      // Created and completed in the window: 2 days.
      {
        status: "COMPLETED",
        createdAt: at("2026-09-20T12:00:00Z"),
        completedAt: at("2026-09-22T12:00:00Z"),
      },
      // Reopened and completed again: measured to the FINAL completion (4 days).
      {
        status: "COMPLETED",
        createdAt: at("2026-08-30T12:00:00Z"),
        completedAt: at("2026-09-03T12:00:00Z"),
      },
      // Created before the window but completed inside it: included (6 days).
      {
        status: "COMPLETED",
        createdAt: at("2026-09-01T12:00:00Z"),
        completedAt: at("2026-09-07T12:00:00Z"),
      },
      // Reopened, not completed again: excluded.
      { status: "IN_PROGRESS", createdAt: at("2026-09-10T12:00:00Z"), completedAt: null },
      // Completed in the future (clock skew/test data): excluded.
      {
        status: "COMPLETED",
        createdAt: at("2026-09-10T12:00:00Z"),
        completedAt: new Date(NOW.getTime() + HOUR),
      },
    ];
    // 2026-09-03 is before the window start (2026-09-06), so only 2 records count.
    expect(averageCompletionTime(records, window)).toEqual({ meanMs: 4 * DAY, n: 2 });
  });

  it("reports n = 0 with no completions in the window", () => {
    expect(averageCompletionTime([], reportingWindow(NOW, 30))).toEqual({ meanMs: null, n: 0 });
  });
});

describe("Needs Attention", () => {
  const item = (
    number: number,
    status: AttentionCandidate["status"],
    priority: AttentionCandidate["priority"],
    dueDate: string,
  ): AttentionCandidate => ({ number, status, priority, dueAt: dueAtFromDateOnly(dueDate) });

  it("assigns the FIRST matching category", () => {
    expect(attentionCategory(item(1, "BLOCKED", "CRITICAL", "2026-10-01"), NOW)).toBe("OVERDUE");
    expect(attentionCategory(item(2, "BLOCKED", "CRITICAL", "2026-10-09"), NOW)).toBe("CRITICAL");
    expect(attentionCategory(item(3, "BLOCKED", "HIGH", "2026-10-09"), NOW)).toBe("BLOCKED");
    expect(attentionCategory(item(4, "OPEN", "HIGH", "2026-10-09"), NOW)).toBe("HIGH");
    expect(attentionCategory(item(5, "OPEN", "MEDIUM", "2026-10-09"), NOW)).toBeNull();
    expect(attentionCategory(item(6, "COMPLETED", "CRITICAL", "2026-10-01"), NOW)).toBeNull();
    expect(attentionCategory(item(7, "CANCELLED", "HIGH", "2026-10-01"), NOW)).toBeNull();
  });

  it("orders by category, then dueAt, then number, and limits to 10", () => {
    const items = [
      item(10, "OPEN", "HIGH", "2026-10-07"),
      item(11, "OPEN", "LOW", "2026-10-02"), // overdue
      item(12, "BLOCKED", "LOW", "2026-10-08"),
      item(13, "IN_PROGRESS", "CRITICAL", "2026-10-09"),
      item(14, "OPEN", "LOW", "2026-10-01"), // overdue, earlier
      item(9, "OPEN", "LOW", "2026-10-02"), // overdue, same due as #11, lower number
      item(15, "OPEN", "MEDIUM", "2026-10-06"), // not included
      item(16, "COMPLETED", "CRITICAL", "2026-10-01"), // not included
    ];
    expect(needsAttention(items, NOW).map((i) => i.number)).toEqual([14, 9, 11, 13, 12, 10]);

    const many = Array.from({ length: 15 }, (_, i) =>
      item(100 + i, "OPEN", "CRITICAL", "2026-10-09"),
    );
    expect(needsAttention(many, NOW)).toHaveLength(10);
    expect(needsAttention(many, NOW, 3).map((i) => i.number)).toEqual([100, 101, 102]);
  });

  it("returns an empty list for no data and rejects invalid limits", () => {
    expect(needsAttention([], NOW)).toEqual([]);
    expect(() => needsAttention([], NOW, -1)).toThrow(RangeError);
    expect(() => needsAttention([], NOW, 1.5)).toThrow(RangeError);
  });
});

describe("statusMatchesLatestEvent (record/event reconciliation)", () => {
  it("an untouched work order with only CREATED activity must be OPEN", () => {
    expect(statusMatchesLatestEvent("OPEN", null)).toBe(true);
    expect(statusMatchesLatestEvent("COMPLETED", null)).toBe(false);
  });

  it("otherwise the current status equals the latest STATUS_CHANGED target", () => {
    expect(statusMatchesLatestEvent("COMPLETED", { toStatus: "COMPLETED" })).toBe(true);
    // Reopened after completion: latest event is → IN_PROGRESS.
    expect(statusMatchesLatestEvent("IN_PROGRESS", { toStatus: "IN_PROGRESS" })).toBe(true);
    expect(statusMatchesLatestEvent("IN_PROGRESS", { toStatus: "COMPLETED" })).toBe(false);
  });
});
