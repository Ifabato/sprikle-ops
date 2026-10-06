# Metrics Dictionary

Status: **Approved definitions (D8), clarified in Phase 3 (Q7–Q11).** Pure calculations live in
`src/domain/metrics.ts` and `src/domain/due-dates.ts`; database queries (Phases 9–10) must produce
the same results for the same records. Any change is recorded here and in the implementation log.

## Shared definitions

- **Active** status: `OPEN`, `IN_PROGRESS`, or `BLOCKED`. **Terminal**: `COMPLETED`, `CANCELLED`.
- **now**: captured once per request, in UTC, and shown on the page as "as of". Domain functions
  receive it as an argument; they never read the clock.
- **Overdue**: `status` is active **and** `due_at < now` (strict: not overdue at exactly `due_at`).
  Never stored (see [data-model.md](data-model.md)).
- **Date-only due dates** mean the last millisecond of that date in `America/New_York`
  (23:59:59.999 local), so a date-only due date becomes overdue at local midnight.
- **Day/week boundaries**: computed in `APP_TIMEZONE` (`America/New_York`); weeks are ISO weeks
  (Monday 00:00 local). Local days are 23 or 25 hours long on DST change days.
- **Scope**: `ADMIN` sees organization-wide values. `TEAM_MEMBER` dashboard values are restricted to
  work currently assigned to them. Analytics are `ADMIN`-only.
- **Data source**: the `work_orders` table unless stated.

### Records versus events (Q10)

- **Current records**: work orders by their current `status` and current `completed_at`. **Every
  MVP metric uses current records.**
- **Historical events**: `work_order_activities` rows. A work order that is reopened and completed
  again is **one** current completed record but **two** `STATUS_CHANGED → COMPLETED` events. No
  MVP metric counts events; a future "completion events" metric would be defined separately.
- **Reconciliation** (integration tests, Phase 5+): each work order's current status must equal the
  `to_status` of its **latest** `STATUS_CHANGED` activity. Work orders are always created `OPEN`, so
  one with no status-change activity (only `CREATED`, plus any comment, assignment, or detail
  activity) must still be `OPEN`. (`statusMatchesLatestEvent` in `src/domain/metrics.ts`.)

### Reporting intervals (Q9)

All intervals are **half-open**: start inclusive, end exclusive.

| Interval               | Start (inclusive)                                 | End (exclusive)               |
| ---------------------- | ------------------------------------------------- | ----------------------------- |
| Last _N_ days          | local midnight of (today − (_N_ − 1)) in New York | `now` + 1 ms (includes `now`) |
| ISO week bucket        | Monday 00:00 local                                | next Monday 00:00 local       |
| Current (partial) week | Monday 00:00 local                                | `now` + 1 ms                  |

- "Last 30 days" = today plus the 29 previous local calendar days, through now.
- "Last 12 weeks" = 12 ISO weeks including the current partial week, oldest first, zero-filled.
- Timestamps after `now` (future-created or future-completed records) are **excluded** from every
  current reporting interval.

## Due filters (Q7, Q8)

Always combined with "status is active".

| Filter (`due=`) | Label                                     | Rule                                                                      |
| --------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| `overdue`       | Overdue                                   | `due_at < now`                                                            |
| `today`         | Due today                                 | `now ≤ due_at <` start of tomorrow (local)                                |
| `week`          | **Due in 7 days** (never "Due this week") | `now ≤ due_at <` start of (today + 7) local, i.e. today through today + 6 |

## Dashboard KPIs

| Metric          | Formula                                                              | Window       | Edge cases                                                                                                                                                                                |
| --------------- | -------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open            | `count(status = OPEN)`                                               | current      | Means "not started". The dashboard header also shows total Active.                                                                                                                        |
| In progress     | `count(status = IN_PROGRESS)`                                        | current      | –                                                                                                                                                                                         |
| Blocked         | `count(status = BLOCKED)`                                            | current      | –                                                                                                                                                                                         |
| Overdue         | `count(active AND due_at < now)`                                     | current      | Terminal work is never overdue.                                                                                                                                                           |
| High priority   | `count(active AND priority IN (HIGH, CRITICAL))`                     | current      | –                                                                                                                                                                                         |
| Completion rate | `COMPLETED ÷ (all − CANCELLED)` among work **created** in the window | last 30 days | Denominator 0 → "—" with "No work orders in this period". Cohort-based: recent cohorts have had less time to finish, so the rate is biased low for short windows; documented on the page. |

**Completion rate in detail** (`completionRate`, `completionRateForCohort`):

- **Cohort**: work orders with `created_at` in the window (future-created records excluded).
- **Numerator**: cohort records whose **current** status is `COMPLETED`, whenever they were completed.
- **Denominator**: cohort size minus cohort records whose **current** status is `CANCELLED`.
- Cancelled-then-restored work counts by its current status. Reopened work not yet completed again
  counts as not completed.
- Result: `{ numerator, denominator, value }`; `value` is `null` (shown as "—") when the denominator
  is 0, never `0%`.

**KPI links (AC-8, corrected in Phase 3):** each **count** card (Open, In progress, Blocked, Overdue,
High priority) links to `/work-orders` with the equivalent filter, and the linked list total must
equal the card value. The completion-rate card is a percentage: its link shows the **eligible
cohort** (work created in the window) and explains the numerator and denominator. That link requires
the created-date filter, which is **deferred** (Q15) and must be implemented before the link.

## Dashboard lists

| List            | Definition                                                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Needs Attention | Active AND (overdue OR `BLOCKED` OR priority ≥ `HIGH`). Each item ranks by its **first** matching category: overdue → `CRITICAL` → `BLOCKED` → `HIGH`; then `due_at` ascending; then work-order number ascending. Max 10. |
| Recent activity | Latest 10 `work_order_activities` rows in the viewer's scope, newest first.                                                                                                                                               |

## Analytics (ADMIN only)

| Metric                     | Formula                                                                                                                                  | Window                                       | Edge cases                                                                                                                                                                                                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Work by status             | count per each of the 5 statuses                                                                                                         | created in selected range (default all time) | Zero-count statuses are shown.                                                                                                                                                                                                                                                                                   |
| Work by priority           | count of **active** work per priority                                                                                                    | current                                      | Zero-count priorities are shown.                                                                                                                                                                                                                                                                                 |
| Overdue count              | as the dashboard KPI                                                                                                                     | current                                      | –                                                                                                                                                                                                                                                                                                                |
| Completion rate            | as the dashboard KPI                                                                                                                     | selectable, default 30 days                  | as above                                                                                                                                                                                                                                                                                                         |
| Workload by assignee       | per active user: active count split by status, overdue count, high-priority count                                                        | current                                      | Includes an "Unassigned" row and users with zero work. Inactive users still holding active work are listed with a flag.                                                                                                                                                                                          |
| Completion trend           | per ISO week: `count(completed_at in week)`, shown alongside `count(created_at in week)`                                                 | last 12 weeks                                | Empty weeks are zero-filled. Reopened work that has not been re-completed drops out (only the current `completed_at` counts).                                                                                                                                                                                    |
| Average time to completion | `mean(completed_at − created_at)` over records **currently** completed with `completed_at` in the window; displayed with sample size _n_ | last 30 days                                 | _n_ = 0 → "—". Calendar time, including time spent blocked. Reopened-and-recompleted work spans creation to the **final** completion (including the reopened period). Negative or non-finite durations are data errors and are rejected, never averaged. Mean is sensitive to outliers; median is a should-have. |

## Honesty rules

- No hard-coded, sample, or projected values anywhere in the UI.
- Insufficient data is shown as "—" with an explanation, never as `0%`.
- Each metric on screen links or expands to its definition from this document.
- Inconsistent records (for example `completed_at` set on a non-completed work order) cause an
  error, not silent exclusion.
