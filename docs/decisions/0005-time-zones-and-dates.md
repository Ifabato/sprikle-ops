# ADR 0005 — Time zones and dates without a date library

- **Status:** Accepted
- **Date:** 2026-10-05
- **Phase:** 3 (Domain logic and validation)
- **Decisions:** D7, Q5–Q9

## Context

The product stores timestamps in UTC but interprets date-only due dates, "today", "Due in 7 days",
reporting windows, and ISO-week buckets in `America/New_York`, including across daylight-saving
changes. Domain code must be deterministic (no clock reads) and client-safe. Node 24.6 does not
ship `Temporal` (`globalThis.Temporal` is undefined), and browsers do not uniformly support it.

## Decision

Use the platform `Intl` API, with a deliberately narrow implementation in `src/domain/time.ts`:

- **Calendar dates** (`LocalDate`) are plain `{year, month, day}` values. Arithmetic (adding days,
  ISO weekday, week start) uses UTC fields of calendar-only values, so it never depends on the
  process time zone.
- **Instant → local date**: `Intl.DateTimeFormat#formatToParts` with explicit `timeZone`,
  `calendar: "gregory"`, `numberingSystem: "latn"`, and `hourCycle: "h23"`. Only the numeric parts
  are read; formatted strings are never parsed back into dates.
- **Local midnight → instant**: two-pass offset correction (guess, then re-check the offset at the
  candidate instant), followed by a round-trip verification that throws if the local midnight does
  not exist. End of day is the next local midnight minus 1 ms.
- **Supported zones**: only `America/New_York`, the zone the tests cover. Other zones throw
  `RangeError` until they are explicitly added and tested. (New York changes clocks at 02:00 local,
  so midnight and 23:59:59.999 always exist exactly once.)
- **Determinism**: every function takes `now` explicitly. ESLint (`src/domain/**`,
  `src/validation/**`) rejects `Date.now()`, `new Date()` without arguments, `Date()` calls,
  `Date.parse`, process-local getters/setters (`getHours`, `setDate`, …), `getTimezoneOffset`, and
  locale formatting. Caller-provided `Date` objects are never mutated; returned dates are new
  instances.
- **Validation**: invalid `Date` values throw `TypeError`; impossible calendar dates, unsupported
  zones, and out-of-range arguments throw `RangeError`. Rule violations (for example a past due date)
  are returned as result codes, not exceptions.

## Evidence

- Tests cover 2024–2027, the leap day, both 2026 and 2027 DST changes (23- and 25-hour days,
  167- and 169-hour weeks), the repeated 01:00–02:00 hour in November, year-end ISO weeks, and ±1 ms
  boundaries.
- The whole unit suite runs under `TZ=UTC`, `TZ=America/New_York`, and `TZ=Asia/Kolkata`
  (`pnpm test:timezones`), and a test switches `process.env.TZ` at runtime across five zones with
  identical results.

## Consequences

- No date dependency is added. If another time zone is required, it must be added to
  `SUPPORTED_TIME_ZONES` with its own boundary tests, or a maintained library (or `Temporal`, once
  available in all target runtimes) should be proposed instead.
- `APP_TIMEZONE` is validated against `SUPPORTED_TIME_ZONES` in `src/lib/env.ts` (corrected before
  the Phase 3 commit): any other value, including valid IANA zones such as `Europe/London` or `UTC`,
  is a configuration error. The health check then reports `config: "invalid"` (HTTP 503) without
  echoing the value, and the domain helpers still throw for unsupported zones as a second guard.
- Three defensive branches in `time.ts` (incomplete `Intl` parts, the second-pass offset
  correction, and a nonexistent local midnight) cannot be reached with `America/New_York` and are
  reported as uncovered rather than excluded from coverage.
