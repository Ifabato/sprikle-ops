import { describe, expect, it } from "vitest";
import { dateInputValue, dueDisplay, formatDate, formatDateTime } from "@/lib/format";

// Display formatting must follow New York calendar dates regardless of the process time zone.

const NOW = new Date("2026-03-02T15:00:00.000Z"); // Mar 2, 10:00 EST
const endOf = (iso: string) => new Date(iso); // end-of-day instants in New York

describe("dueDisplay", () => {
  it("labels overdue, today, upcoming, and closed work", () => {
    expect(dueDisplay({ status: "OPEN", dueAt: endOf("2026-03-02T04:59:59.999Z") }, NOW)).toEqual({
      tone: "overdue",
      text: "Overdue · due Mar 1, 2026",
    });
    expect(
      dueDisplay({ status: "BLOCKED", dueAt: endOf("2026-03-03T04:59:59.999Z") }, NOW),
    ).toEqual({
      tone: "today",
      text: "Due today",
    });
    expect(
      dueDisplay({ status: "IN_PROGRESS", dueAt: endOf("2026-03-04T04:59:59.999Z") }, NOW),
    ).toEqual({
      tone: "upcoming",
      text: "Due Mar 3, 2026",
    });
    // Terminal work is never overdue.
    expect(
      dueDisplay({ status: "COMPLETED", dueAt: endOf("2026-02-01T04:59:59.999Z") }, NOW),
    ).toEqual({
      tone: "closed",
      text: "Due Jan 31, 2026",
    });
  });

  it("switches from today to overdue exactly at New York midnight", () => {
    const dueAt = endOf("2026-03-03T04:59:59.999Z"); // end of Mar 2 in New York
    expect(dueDisplay({ status: "OPEN", dueAt }, new Date("2026-03-03T04:59:59.999Z")).tone).toBe(
      "today",
    );
    expect(dueDisplay({ status: "OPEN", dueAt }, new Date("2026-03-03T05:00:00.000Z")).tone).toBe(
      "overdue",
    );
  });
});

describe("date formatting", () => {
  it("uses New York dates near UTC midnight and across DST", () => {
    const lateEvening = new Date("2026-03-03T03:30:00.000Z"); // Mar 2, 22:30 EST
    expect(formatDate(lateEvening)).toBe("Mar 2, 2026");
    expect(dateInputValue(lateEvening)).toBe("2026-03-02");
    expect(formatDateTime(lateEvening)).toBe("Mar 2, 2026, 10:30 PM EST");
    expect(formatDateTime(new Date("2026-07-01T16:05:00.000Z"))).toBe("Jul 1, 2026, 12:05 PM EDT");
  });
});
