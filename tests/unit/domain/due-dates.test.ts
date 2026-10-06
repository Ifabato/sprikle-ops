import { describe, expect, it } from "vitest";
import {
  dueAtFromDateOnly,
  dueFilterBounds,
  isOverdue,
  matchesDueFilter,
  validateNewDueDate,
  type DueFilter,
} from "@/domain/due-dates";
import { WORK_ORDER_STATUSES, type WorkOrderStatus } from "@/domain/enums";
import { parseDateOnly } from "@/domain/time";

const at = (iso: string) => new Date(iso);
const due = (value: string) => dueAtFromDateOnly(value);

describe("dueAtFromDateOnly", () => {
  it("is the last millisecond of the date in America/New_York", () => {
    expect(due("2026-01-15").toISOString()).toBe("2026-01-16T04:59:59.999Z");
    expect(due("2026-07-15").toISOString()).toBe("2026-07-16T03:59:59.999Z");
    expect(due("2026-03-08").toISOString()).toBe("2026-03-09T03:59:59.999Z");
    expect(due("2026-11-01").toISOString()).toBe("2026-11-02T04:59:59.999Z");
  });

  it("accepts a LocalDate object", () => {
    const date = parseDateOnly("2024-02-29");
    expect(date && dueAtFromDateOnly(date).toISOString()).toBe("2024-03-01T04:59:59.999Z");
  });

  it("rejects malformed date strings", () => {
    expect(() => dueAtFromDateOnly("2026-02-30")).toThrow(RangeError);
  });
});

describe("isOverdue", () => {
  const dueAt = due("2026-03-08");

  it("is false at exactly dueAt and true one millisecond later", () => {
    expect(isOverdue({ status: "OPEN", dueAt }, new Date(dueAt.getTime()))).toBe(false);
    expect(isOverdue({ status: "OPEN", dueAt }, new Date(dueAt.getTime() + 1))).toBe(true);
  });

  it.each(WORK_ORDER_STATUSES.map((status) => [status]))(
    "only active statuses can be overdue (%s)",
    (status: WorkOrderStatus) => {
      const expected = status === "OPEN" || status === "IN_PROGRESS" || status === "BLOCKED";
      expect(isOverdue({ status, dueAt }, at("2026-04-01T00:00:00Z"))).toBe(expected);
    },
  );

  it("rejects invalid dates", () => {
    expect(() =>
      isOverdue({ status: "OPEN", dueAt: new Date(Number.NaN) }, at("2026-01-01T00:00:00Z")),
    ).toThrow(TypeError);
    expect(() => isOverdue({ status: "OPEN", dueAt }, new Date(Number.NaN))).toThrow(TypeError);
  });
});

describe("due filters", () => {
  // Monday 2026-10-05, 10:00 EDT.
  const now = at("2026-10-05T14:00:00.000Z");
  const cases: [string, string, Record<DueFilter, boolean>][] = [
    ["due yesterday", "2026-10-04", { overdue: true, today: false, week: false }],
    ["due today", "2026-10-05", { overdue: false, today: true, week: true }],
    ["due tomorrow", "2026-10-06", { overdue: false, today: false, week: true }],
    ["due today + 6", "2026-10-11", { overdue: false, today: false, week: true }],
    ["due today + 7", "2026-10-12", { overdue: false, today: false, week: false }],
  ];

  it.each(cases)("%s", (_label, dueDate, expected) => {
    for (const filter of ["overdue", "today", "week"] as const) {
      expect(matchesDueFilter({ status: "IN_PROGRESS", dueAt: due(dueDate) }, filter, now)).toBe(
        expected[filter],
      );
    }
  });

  it("never matches terminal work", () => {
    for (const status of ["COMPLETED", "CANCELLED"] as const) {
      for (const filter of ["overdue", "today", "week"] as const) {
        expect(matchesDueFilter({ status, dueAt: due("2026-10-01") }, filter, now)).toBe(false);
        expect(matchesDueFilter({ status, dueAt: due("2026-10-05") }, filter, now)).toBe(false);
      }
    }
  });

  it("treats a due time earlier today (not end-of-day) as overdue, not due today", () => {
    const earlierToday = at("2026-10-05T13:00:00.000Z");
    expect(matchesDueFilter({ status: "OPEN", dueAt: earlierToday }, "today", now)).toBe(false);
    expect(matchesDueFilter({ status: "OPEN", dueAt: earlierToday }, "overdue", now)).toBe(true);
  });

  it("returns half-open query bounds in New York calendar days", () => {
    expect(dueFilterBounds("overdue", now)).toEqual({ kind: "overdue", overdueBefore: now });
    expect(dueFilterBounds("today", now)).toEqual({
      kind: "upcoming",
      notBefore: now,
      before: at("2026-10-06T04:00:00.000Z"),
    });
    expect(dueFilterBounds("week", now)).toEqual({
      kind: "upcoming",
      notBefore: now,
      before: at("2026-10-12T04:00:00.000Z"),
    });
  });

  it("spans the spring-forward change in the 7-day window", () => {
    // Thursday 2026-03-05 10:00 EST; window ends at local midnight 2026-03-12 (EDT).
    const bounds = dueFilterBounds("week", at("2026-03-05T15:00:00.000Z"));
    expect(bounds.kind === "upcoming" && bounds.before.toISOString()).toBe(
      "2026-03-12T04:00:00.000Z",
    );
  });

  it("does not return the caller's Date instance", () => {
    const bounds = dueFilterBounds("overdue", now);
    expect(bounds.kind === "overdue" && bounds.overdueBefore).not.toBe(now);
  });
});

describe("validateNewDueDate", () => {
  it("accepts today even late in the local evening", () => {
    const lateEvening = at("2026-10-06T03:59:00.000Z"); // 23:59 EDT on 2026-10-05
    const result = validateNewDueDate("2026-10-05", lateEvening);
    expect(result).toEqual({ ok: true, value: due("2026-10-05") });
  });

  it("rejects yesterday (local), even when it is still that date in UTC terms", () => {
    const earlyMorning = at("2026-10-05T04:30:00.000Z"); // 00:30 EDT on 2026-10-05
    expect(validateNewDueDate("2026-10-04", earlyMorning)).toMatchObject({
      ok: false,
      code: "DUE_DATE_IN_PAST",
    });
  });

  it("rejects malformed dates", () => {
    expect(validateNewDueDate("2026-02-30", at("2026-01-01T12:00:00Z"))).toMatchObject({
      ok: false,
      code: "INVALID_DUE_DATE",
    });
  });

  it("accepts a LocalDate object in the future", () => {
    const date = parseDateOnly("2027-01-01");
    expect(date && validateNewDueDate(date, at("2026-10-05T14:00:00Z")).ok).toBe(true);
  });
});
