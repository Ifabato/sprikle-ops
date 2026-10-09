# Query plans on a larger dataset

Requirement: list, dashboard, and analytics queries are index-supported, verified with `EXPLAIN`
against a larger seed (product requirements §6).

## Method

`pnpm perf:explain` (`scripts/explain-queries.ts`) runs only against `sprikle_ops_test`, through the
same fail-closed guard as the tests. It truncates that database, bulk-loads 5,000 synthetic work
orders (20 users, 4 service areas, about a year of creation dates, 60% completed, 10% cancelled,
30% active) and 15,000 activity rows, runs `ANALYZE`, then `EXPLAIN (ANALYZE, BUFFERS)` for each
query shape below, and truncates again. The SQL mirrors the shapes the services issue.

## Result (2026-10-09, local Docker PostgreSQL 16.15 on a macOS development machine)

Single run; times are illustrative of plan quality, not a benchmark.

| Query                                            | Plan (access path)                                                 | Execution time |
| ------------------------------------------------ | ------------------------------------------------------------------ | -------------- |
| List: default (active, due date, first page)     | Bitmap index scan `work_orders_status_due_at_idx`, top-N sort      | 0.571 ms       |
| List: team-member scope (assignee + active)      | Bitmap index scan `work_orders_assignee_id_status_idx`, top-N sort | 0.102 ms       |
| List: overdue count                              | Bitmap index scan `work_orders_status_due_at_idx`                  | 0.338 ms       |
| List: text search (`ILIKE`)                      | Status index, then filter (no trigram index)                       | 1.154 ms       |
| Dashboard: active counts by status               | Bitmap index scan `work_orders_status_due_at_idx`, hash aggregate  | 0.373 ms       |
| Dashboard: completion-rate cohort (last 30 days) | Bitmap index scan `work_orders_created_at_idx`                     | 0.150 ms       |
| Dashboard: recent activity (latest 10)           | Backward index scan `work_order_activities_created_at_idx`         | 0.037 ms       |
| Analytics: completed in the last 12 weeks        | Bitmap index scan `work_orders_completed_at_idx`                   | 0.224 ms       |
| Analytics: workload by assignee and status       | Bitmap index scan `work_orders_status_due_at_idx`, hash aggregate  | 0.425 ms       |

## Notes

- Text search filters within the active-status index rather than using a dedicated text index.
  A `pg_trgm` index with its own `EXPLAIN ANALYZE` comparison is should-have #5 and not built.
- Needs Attention loads all active attention candidates in scope and ranks them in application
  code with the pure `needsAttention` rule; this is fine at small-business scale and would move to
  SQL ordering if candidate counts grew large.
