// Time-zone-aware calendar helpers built on the platform Intl API (no date library).
//
// Rules (see docs/decisions/0005-time-zones-and-dates.md):
// - No implicit clock reads: callers always pass `now`. (ESLint blocks Date.now() and `new Date()`.)
// - Caller-provided Date objects are never mutated; new instants are built from millisecond values.
// - Only local-time *parts* are read from Intl.DateTimeFormat#formatToParts; formatted strings are
//   never parsed back into dates.
// - Process-local time zone methods (getHours, setDate, ...) are not used; all calendar arithmetic
//   uses UTC fields of calendar-only values, so results do not depend on the process TZ.
// - Supported zones are limited to those covered by tests (currently America/New_York).

export const APP_TIME_ZONE = "America/New_York";

export const SUPPORTED_TIME_ZONES = [APP_TIME_ZONE] as const;
export type SupportedTimeZone = (typeof SUPPORTED_TIME_ZONES)[number];

export function isSupportedTimeZone(value: string): value is SupportedTimeZone {
  return (SUPPORTED_TIME_ZONES as readonly string[]).includes(value);
}

export function assertSupportedTimeZone(value: string): asserts value is SupportedTimeZone {
  if (!isSupportedTimeZone(value)) {
    throw new RangeError(
      `Unsupported time zone: only ${SUPPORTED_TIME_ZONES.join(", ")} is supported and tested.`,
    );
  }
}

/** Throws for anything that is not a valid Date instance. */
export function assertValidDate(value: unknown, label = "date"): asserts value is Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new TypeError(`${label} must be a valid Date.`);
  }
}

// ---------------------------------------------------------------------------
// Calendar dates (no time zone)
// ---------------------------------------------------------------------------

/** A calendar date with no time zone attached. `month` is 1–12. */
export interface LocalDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export const MIN_YEAR = 1970;
export const MAX_YEAR = 9999;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** Days since 1970-01-01 for a calendar date (pure calendar arithmetic, UTC-based). */
function epochDay(date: LocalDate): number {
  return Date.UTC(date.year, date.month - 1, date.day) / MS_PER_DAY;
}

function fromEpochDay(days: number): LocalDate {
  const utc = new Date(days * MS_PER_DAY);
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

function isValidLocalDate(date: LocalDate): boolean {
  if (
    !Number.isInteger(date.year) ||
    !Number.isInteger(date.month) ||
    !Number.isInteger(date.day) ||
    date.year < MIN_YEAR ||
    date.year > MAX_YEAR
  ) {
    return false;
  }
  const roundTrip = fromEpochDay(epochDay(date));
  return (
    roundTrip.year === date.year && roundTrip.month === date.month && roundTrip.day === date.day
  );
}

function assertValidLocalDate(date: LocalDate): void {
  if (!isValidLocalDate(date)) {
    throw new RangeError("Invalid calendar date.");
  }
}

/** Parses a strict `YYYY-MM-DD` calendar date. Returns null for malformed or impossible dates. */
export function parseDateOnly(value: string): LocalDate | null {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return isValidLocalDate(date) ? date : null;
}

export function formatDateOnly(date: LocalDate): string {
  assertValidLocalDate(date);
  const pad = (n: number, width: number) => String(n).padStart(width, "0");
  return `${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}`;
}

/** Negative if a < b, 0 if equal, positive if a > b. */
export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  assertValidLocalDate(a);
  assertValidLocalDate(b);
  return epochDay(a) - epochDay(b);
}

export function addLocalDays(date: LocalDate, days: number): LocalDate {
  assertValidLocalDate(date);
  if (!Number.isInteger(days)) {
    throw new RangeError("days must be an integer.");
  }
  const result = fromEpochDay(epochDay(date) + days);
  assertValidLocalDate(result);
  return result;
}

/** ISO weekday: Monday = 1 … Sunday = 7. */
export function isoWeekday(date: LocalDate): number {
  assertValidLocalDate(date);
  const sundayBased = new Date(epochDay(date) * MS_PER_DAY).getUTCDay();
  return sundayBased === 0 ? 7 : sundayBased;
}

/** The Monday that starts the ISO week containing `date`. */
export function startOfIsoWeek(date: LocalDate): LocalDate {
  return addLocalDays(date, 1 - isoWeekday(date));
}

// ---------------------------------------------------------------------------
// Instants <-> local calendar dates in a time zone
// ---------------------------------------------------------------------------

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<SupportedTimeZone, Intl.DateTimeFormat>();

function formatterFor(timeZone: SupportedTimeZone): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      calendar: "gregory",
      numberingSystem: "latn",
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Local wall-clock fields of an instant, read from numeric parts (never from a formatted string). */
function wallClockAt(epochMs: number, timeZone: SupportedTimeZone): WallClock {
  const fields: Partial<Record<keyof WallClock, number>> = {};
  for (const part of formatterFor(timeZone).formatToParts(epochMs)) {
    if (
      part.type === "year" ||
      part.type === "month" ||
      part.type === "day" ||
      part.type === "hour" ||
      part.type === "minute" ||
      part.type === "second"
    ) {
      fields[part.type] = Number(part.value);
    }
  }
  const { year, month, day, hour, minute, second } = fields;
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined
  ) {
    throw new Error("Intl.DateTimeFormat returned incomplete date parts.");
  }
  // Some ICU versions report midnight as hour 24 even with h23.
  return { year, month, day, hour: hour === 24 ? 0 : hour, minute, second };
}

/** UTC offset (local − UTC) in milliseconds at the given instant. */
function offsetAt(epochMs: number, timeZone: SupportedTimeZone): number {
  const wall = wallClockAt(epochMs, timeZone);
  const wallAsUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );
  const wholeSecond = epochMs - (((epochMs % 1000) + 1000) % 1000);
  return wallAsUtc - wholeSecond;
}

/** The calendar date of `instant` in `timeZone`. */
export function localDateOf(instant: Date, timeZone: string = APP_TIME_ZONE): LocalDate {
  assertValidDate(instant, "instant");
  assertSupportedTimeZone(timeZone);
  const wall = wallClockAt(instant.getTime(), timeZone);
  return { year: wall.year, month: wall.month, day: wall.day };
}

/**
 * The instant at which `date` begins (local midnight) in `timeZone`.
 * Uses a two-pass offset correction and verifies the round trip, so a nonexistent local
 * midnight (not possible in America/New_York, which changes clocks at 02:00) throws instead of
 * returning a wrong instant.
 */
export function startOfLocalDay(date: LocalDate, timeZone: string = APP_TIME_ZONE): Date {
  assertValidLocalDate(date);
  assertSupportedTimeZone(timeZone);
  const wallAsUtc = Date.UTC(date.year, date.month - 1, date.day);
  const firstOffset = offsetAt(wallAsUtc, timeZone);
  let instant = wallAsUtc - firstOffset;
  const secondOffset = offsetAt(instant, timeZone);
  if (secondOffset !== firstOffset) {
    instant = wallAsUtc - secondOffset;
  }
  const check = wallClockAt(instant, timeZone);
  if (
    check.year !== date.year ||
    check.month !== date.month ||
    check.day !== date.day ||
    check.hour !== 0 ||
    check.minute !== 0 ||
    check.second !== 0
  ) {
    throw new RangeError("Local midnight does not exist on this date in this time zone.");
  }
  return new Date(instant);
}

/** Exclusive end of `date`: the start of the following local day. */
export function startOfNextLocalDay(date: LocalDate, timeZone: string = APP_TIME_ZONE): Date {
  return startOfLocalDay(addLocalDays(date, 1), timeZone);
}

/** The last representable millisecond of `date` in `timeZone` (23:59:59.999 local). */
export function endOfLocalDay(date: LocalDate, timeZone: string = APP_TIME_ZONE): Date {
  return new Date(startOfNextLocalDay(date, timeZone).getTime() - 1);
}
