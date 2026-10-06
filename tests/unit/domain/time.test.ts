import { describe, expect, it } from "vitest";
import {
  addLocalDays,
  assertSupportedTimeZone,
  assertValidDate,
  compareLocalDates,
  endOfLocalDay,
  formatDateOnly,
  isoWeekday,
  localDateOf,
  parseDateOnly,
  startOfIsoWeek,
  startOfLocalDay,
  startOfNextLocalDay,
} from "@/domain/time";

const at = (iso: string) => new Date(iso);
const date = (value: string) => {
  const parsed = parseDateOnly(value);
  if (!parsed) throw new Error(`bad fixture ${value}`);
  return parsed;
};

describe("parseDateOnly / formatDateOnly", () => {
  it.each(["2026-01-05", "2024-02-29", "1970-01-01", "9999-12-31", "2026-12-31"])(
    "accepts %s and round-trips it",
    (value) => {
      expect(formatDateOnly(date(value))).toBe(value);
    },
  );

  it.each([
    ["non-leap February 29", "2026-02-29"],
    ["February 30", "2024-02-30"],
    ["month 13", "2026-13-01"],
    ["month 0", "2026-00-10"],
    ["day 0", "2026-01-00"],
    ["April 31", "2026-04-31"],
    ["single-digit fields", "2026-1-5"],
    ["leading space", " 2026-01-05"],
    ["date-time", "2026-01-05T00:00"],
    ["slashes", "2026/01/05"],
    ["before 1970", "1969-12-31"],
    ["five-digit year", "10000-01-01"],
    ["non-ASCII digits", "２０２６-01-05"],
    ["empty", ""],
  ])("rejects %s", (_label, value) => {
    expect(parseDateOnly(value)).toBeNull();
  });

  it("refuses to format an impossible date", () => {
    expect(() => formatDateOnly({ year: 2026, month: 2, day: 30 })).toThrow(RangeError);
  });
});

describe("calendar arithmetic", () => {
  it("adds days across month, year, and leap-day boundaries", () => {
    expect(formatDateOnly(addLocalDays(date("2026-01-31"), 1))).toBe("2026-02-01");
    expect(formatDateOnly(addLocalDays(date("2026-12-31"), 1))).toBe("2027-01-01");
    expect(formatDateOnly(addLocalDays(date("2024-02-28"), 1))).toBe("2024-02-29");
    expect(formatDateOnly(addLocalDays(date("2024-03-01"), -1))).toBe("2024-02-29");
    expect(formatDateOnly(addLocalDays(date("2026-03-08"), -29))).toBe("2026-02-07");
  });

  it("rejects non-integer offsets and results outside the supported range", () => {
    expect(() => addLocalDays(date("2026-01-01"), 1.5)).toThrow(RangeError);
    expect(() => addLocalDays(date("1970-01-01"), -1)).toThrow(RangeError);
  });

  it("compares calendar dates", () => {
    expect(compareLocalDates(date("2026-03-08"), date("2026-03-09"))).toBeLessThan(0);
    expect(compareLocalDates(date("2026-03-09"), date("2026-03-09"))).toBe(0);
    expect(compareLocalDates(date("2027-01-01"), date("2026-12-31"))).toBeGreaterThan(0);
  });

  it.each([
    ["2026-10-05", 1, "2026-10-05"], // Monday
    ["2026-01-01", 4, "2025-12-29"], // Thursday; ISO week 1 of 2026 starts in 2025
    ["2027-01-01", 5, "2026-12-28"], // Friday; still ISO week 53 of 2026
    ["2026-03-08", 7, "2026-03-02"], // Sunday (spring-forward day)
    ["2024-02-29", 4, "2024-02-26"], // leap day
  ])("%s has ISO weekday %i and its week starts %s", (value, weekday, monday) => {
    expect(isoWeekday(date(value))).toBe(weekday);
    expect(formatDateOnly(startOfIsoWeek(date(value)))).toBe(monday);
  });
});

describe("America/New_York day boundaries", () => {
  it.each([
    // date, start of day (UTC), start of next day (UTC), local day length in hours
    ["2026-01-15", "2026-01-15T05:00:00.000Z", "2026-01-16T05:00:00.000Z", 24],
    ["2026-07-04", "2026-07-04T04:00:00.000Z", "2026-07-05T04:00:00.000Z", 24],
    ["2026-03-08", "2026-03-08T05:00:00.000Z", "2026-03-09T04:00:00.000Z", 23], // spring forward
    ["2026-11-01", "2026-11-01T04:00:00.000Z", "2026-11-02T05:00:00.000Z", 25], // fall back
    ["2027-03-14", "2027-03-14T05:00:00.000Z", "2027-03-15T04:00:00.000Z", 23],
    ["2027-11-07", "2027-11-07T04:00:00.000Z", "2027-11-08T05:00:00.000Z", 25],
    ["2024-03-10", "2024-03-10T05:00:00.000Z", "2024-03-11T04:00:00.000Z", 23],
    ["2024-02-29", "2024-02-29T05:00:00.000Z", "2024-03-01T05:00:00.000Z", 24], // leap day
    ["2026-12-31", "2026-12-31T05:00:00.000Z", "2027-01-01T05:00:00.000Z", 24], // year end
  ])("%s starts %s and ends before %s (%i h)", (value, start, next, hours) => {
    const day = date(value);
    expect(startOfLocalDay(day).toISOString()).toBe(start);
    expect(startOfNextLocalDay(day).toISOString()).toBe(next);
    expect(endOfLocalDay(day).getTime()).toBe(at(next).getTime() - 1);
    expect((at(next).getTime() - at(start).getTime()) / 3_600_000).toBe(hours);
  });

  it.each([
    ["2026-03-09T03:59:59.999Z", "2026-03-08"],
    ["2026-03-09T04:00:00.000Z", "2026-03-09"],
    ["2026-03-08T06:59:59.999Z", "2026-03-08"], // 01:59:59.999 EST, just before the gap
    ["2026-03-08T07:00:00.000Z", "2026-03-08"], // 03:00 EDT, just after the gap
    ["2026-11-01T05:30:00.000Z", "2026-11-01"], // 01:30 EDT (first occurrence)
    ["2026-11-01T06:30:00.000Z", "2026-11-01"], // 01:30 EST (repeated hour)
    ["2027-01-01T04:59:59.999Z", "2026-12-31"],
    ["2027-01-01T05:00:00.000Z", "2027-01-01"],
    ["2024-03-01T04:59:59.999Z", "2024-02-29"],
  ])("instant %s is local date %s", (instant, expected) => {
    expect(formatDateOnly(localDateOf(at(instant)))).toBe(expected);
  });
});

describe("input validation", () => {
  it("rejects invalid Date values", () => {
    expect(() => assertValidDate(new Date(Number.NaN))).toThrow(TypeError);
    expect(() => assertValidDate("2026-01-01")).toThrow(TypeError);
    expect(() => assertValidDate(undefined)).toThrow(TypeError);
    expect(() => localDateOf(new Date(Number.NaN))).toThrow(TypeError);
  });

  it("rejects unsupported or invalid time zones", () => {
    expect(() => assertSupportedTimeZone("Europe/London")).toThrow(RangeError);
    expect(() => assertSupportedTimeZone("Not/A_Zone")).toThrow(RangeError);
    expect(() => localDateOf(at("2026-01-01T00:00:00Z"), "UTC")).toThrow(RangeError);
    expect(() => startOfLocalDay(date("2026-01-01"), "Asia/Kolkata")).toThrow(RangeError);
  });

  it("rejects impossible LocalDate objects", () => {
    expect(() => startOfLocalDay({ year: 2026, month: 2, day: 29 })).toThrow(RangeError);
    expect(() => isoWeekday({ year: 2026, month: 1, day: 1.5 })).toThrow(RangeError);
  });

  it("does not mutate caller-provided dates and returns new instances", () => {
    const instant = at("2026-03-08T12:00:00.000Z");
    const before = instant.getTime();
    localDateOf(instant);
    expect(instant.getTime()).toBe(before);
    const start = startOfLocalDay(date("2026-03-08"));
    expect(start).not.toBe(startOfLocalDay(date("2026-03-08")));
  });
});
