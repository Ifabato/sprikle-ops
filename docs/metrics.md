# Metrics Dictionary

Status: **Approved definitions (D8).** Implemented in Phases 9–10. Queries must match these
definitions; any change is recorded here and in the implementation log.

## Shared definitions

- **Active** status: `OPEN`, `IN_PROGRESS`, or `BLOCKED`. **Terminal**: `COMPLETED`, `CANCELLED`.
- **now**: captured once per request, in UTC, and shown on the page as "as of".
- **Overdue**: `status` is active **and** `dueAt < now`. Never stored (see
  [data-model.md](data-model.md)).
- **Day/week buckets**: computed in `APP_TIMEZONE` (`America/New_York`); weeks are ISO weeks
  (Monday start).
- **Scope**: `ADMIN` sees organization-wide values. `TEAM_MEMBER` dashboard values are restricted to
  work currently assigned to them. Analytics are `ADMIN`-only.
- **Data source**: the `WorkOrder` table unless stated. An integration test reconciles completion
  counts with `WorkOrderActivity` rows where `type = 'STATUS_CHANGED' AND toStatus = 'COMPLETED'`.

## Dashboard KPIs

| Metric          | Formula                                                              | Window       | Edge cases                                                                                                                                                                                |
| --------------- | -------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open            | `count(status = OPEN)`                                               | current      | Means "not started". The dashboard header also shows total Active.                                                                                                                        |
| In progress     | `count(status = IN_PROGRESS)`                                        | current      | –                                                                                                                                                                                         |
| Blocked         | `count(status = BLOCKED)`                                            | current      | –                                                                                                                                                                                         |
| Overdue         | `count(active AND dueAt < now)`                                      | current      | Terminal work is never overdue. Date-only due dates are end of day in `APP_TIMEZONE`.                                                                                                     |
| High priority   | `count(active AND priority IN (HIGH, CRITICAL))`                     | current      | –                                                                                                                                                                                         |
| Completion rate | `COMPLETED ÷ (all − CANCELLED)` among work **created** in the window | last 30 days | Denominator 0 → "—" with "No work orders in this period". Cohort-based: recent cohorts have had less time to finish, so the rate is biased low for short windows; documented on the page. |

Each KPI card links to `/work-orders` with the equivalent filter; the linked list total must equal
the card value (acceptance criterion AC-8).

## Dashboard lists

| List            | Definition                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Needs Attention | Active AND (overdue OR `BLOCKED` OR priority ≥ `HIGH`). Order: overdue first, then `CRITICAL`, then `BLOCKED`, then `HIGH`; ties by `dueAt` ascending. Max 10. |
| Recent activity | Latest 10 `WorkOrderActivity` rows in the viewer's scope, newest first.                                                                                        |

## Analytics (ADMIN only)

| Metric                     | Formula                                                                                                    | Window                                       | Edge cases                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Work by status             | count per each of the 5 statuses                                                                           | created in selected range (default all time) | Zero-count statuses are shown.                                                                                               |
| Work by priority           | count of **active** work per priority                                                                      | current                                      | Zero-count priorities are shown.                                                                                             |
| Overdue count              | as the dashboard KPI                                                                                       | current                                      | –                                                                                                                            |
| Completion rate            | as the dashboard KPI                                                                                       | selectable, default 30 days                  | as above                                                                                                                     |
| Workload by assignee       | per active user: active count split by status, overdue count, high-priority count                          | current                                      | Includes an "Unassigned" row and users with zero work. Inactive users still holding active work are listed with a flag.      |
| Completion trend           | per week: `count(completedAt in week)`, shown alongside `count(createdAt in week)`                         | last 12 weeks                                | Empty weeks are zero-filled. Reopened work that has not been re-completed drops out (only the current `completedAt` counts). |
| Average time to completion | `mean(completedAt − createdAt)` over work with `completedAt` in the window; displayed with sample size _n_ | last 30 days                                 | _n_ = 0 → "—". Calendar time, including time spent blocked. Mean is sensitive to outliers; median is a should-have.          |

## Honesty rules

- No hard-coded, sample, or projected values anywhere in the UI.
- Insufficient data is shown as "—" with an explanation, never as `0%`.
- Each metric on screen links or expands to its definition from this document.
