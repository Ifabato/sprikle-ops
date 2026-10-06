import { afterEach, describe, expect, it } from "vitest";
import { dueAtFromDateOnly, matchesDueFilter } from "@/domain/due-dates";
import { isoWeekBuckets, reportingWindow } from "@/domain/metrics";
import { formatDateOnly, localDateOf, parseDateOnly, startOfLocalDay } from "@/domain/time";

// Domain results must not depend on the server process's TZ. `pnpm test:timezones` also runs the
// whole unit suite under TZ=UTC, America/New_York, and Asia/Kolkata; this test additionally
// switches TZ at runtime (Node re-reads process.env.TZ when it is assigned).

const ORIGINAL_TZ = process.env.TZ;

function snapshot() {
  const now = new Date("2026-03-08T15:00:00.000Z");
  const day = parseDateOnly("2026-11-01");
  if (!day) throw new Error("fixture");
  return {
    localDate: formatDateOnly(localDateOf(new Date("2026-11-02T04:59:59.999Z"))),
    startOfDay: startOfLocalDay(day).toISOString(),
    dueAt: dueAtFromDateOnly("2026-03-08").toISOString(),
    dueToday: matchesDueFilter(
      { status: "OPEN", dueAt: dueAtFromDateOnly("2026-03-08") },
      "today",
      now,
    ),
    window: reportingWindow(now, 30).start.toISOString(),
    weeks: isoWeekBuckets(now, 3).map((bucket) => bucket.start.toISOString()),
  };
}

const EXPECTED = {
  localDate: "2026-11-01",
  startOfDay: "2026-11-01T04:00:00.000Z",
  dueAt: "2026-03-09T03:59:59.999Z",
  dueToday: true,
  window: "2026-02-07T05:00:00.000Z",
  weeks: ["2026-02-16T05:00:00.000Z", "2026-02-23T05:00:00.000Z", "2026-03-02T05:00:00.000Z"],
};

describe("independence from the process time zone", () => {
  afterEach(() => {
    if (ORIGINAL_TZ === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = ORIGINAL_TZ;
    }
  });

  it.each(["UTC", "America/New_York", "Asia/Kolkata", "Pacific/Kiritimati", "America/Los_Angeles"])(
    "produces identical results with TZ=%s",
    (zone) => {
      process.env.TZ = zone;
      expect(snapshot()).toEqual(EXPECTED);
    },
  );
});
