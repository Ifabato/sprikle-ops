# Project evidence sheet

Factual inventory for tailoring a résumé or answering interview questions. Every row points to code
and tests in this repository; "measured result" is what was observed locally on 2026-10-09. There
are no users, customers, production traffic, or business outcomes to report, and none are implied.

| Capability                                   | Technology                                                  | Source                                                                                         | Test evidence                                                                                                 | Measured result                                                                                                                                                                              |
| -------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Work-order state machine with role rules     | TypeScript (pure functions)                                 | `src/domain/transitions.ts`, `src/domain/permissions.ts`                                       | `tests/unit/domain/transitions.test.ts`, `permissions.test.ts` (all 25 status pairs × actor kinds)            | Branch coverage threshold 95% on both files enforced by `pnpm check` (passing)                                                                                                               |
| Server-side authorization and object scope   | Next.js Server Actions, route handlers, Better Auth         | `src/server/services/work-orders.ts`, `src/server/session.ts`, `src/server/api/http.ts`        | `tests/integration/work-order-services.test.ts`, `api-work-orders.test.ts`, `e2e/work-orders.journey.spec.ts` | Team member → 404 for others' work (real HTTP 404 in the browser), 403 for admin-only actions                                                                                                |
| Audit trail in the same transaction          | PostgreSQL transactions, Prisma 7, DB triggers              | `src/server/services/work-orders.ts`, `prisma/migrations/*`                                    | Integration: one activity per change; reconciliation of status vs latest event                                | Append-only enforced by triggers (UPDATE/DELETE rejected, `tests/integration/db-constraints.test.ts`)                                                                                        |
| Optimistic concurrency                       | `version` column, conditional `updateMany`                  | `src/server/services/work-orders.ts`                                                           | Concurrent-requests test (exactly one wins; loser's note rolled back); E2E stale-page conflict                | 409 with a reload message; no partial writes                                                                                                                                                 |
| REST API with consistent errors              | Next.js route handlers, Zod 4                               | `src/app/api/v1/**`, `src/server/api/*`, `src/server/services/result.ts`                       | `tests/integration/api-work-orders.test.ts` (13 tests)                                                        | 401/400/403/404/409/422/500 mapping; request IDs; 500 responses leak no internals                                                                                                            |
| CSRF protection for cookie-authenticated API | Origin / Sec-Fetch-Site checks, JSON-only bodies            | `src/server/api/http.ts`                                                                       | Cross-site `Origin` and `Sec-Fetch-Site` → 403 before any write                                               | Verified in tests and against the dev server (`curl` with a foreign Origin → 403)                                                                                                            |
| Time-zone-correct due dates and windows      | `Intl` + custom DST-aware calendar math                     | `src/domain/time.ts`, `src/domain/due-dates.ts`, `src/lib/format.ts`                           | Unit tests at ±1 ms boundaries and DST days, run under UTC, America/New_York, Asia/Kolkata                    | 538 unit tests pass in each of the three time zones                                                                                                                                          |
| Metrics checked against definitions          | SQL aggregates (Prisma `groupBy`/`count`)                   | `src/server/services/metrics.ts`, `src/domain/metrics.ts`                                      | `tests/integration/metrics.test.ts` recomputes every value from raw records                                   | All dashboard and analytics values equal the pure definitions; card counts equal linked list totals                                                                                          |
| Index-supported queries                      | PostgreSQL 16 indexes, `EXPLAIN ANALYZE`                    | `prisma/schema.prisma`, `scripts/explain-queries.ts`                                           | `pnpm perf:explain` on 5,000 rows ([performance.md](performance.md))                                          | 9 query shapes use index scans; 0.04–1.2 ms execution each (single local run)                                                                                                                |
| Accessible, server-rendered UI               | React 19 Server Components, Tailwind CSS 4                  | `src/app/(app)/**`, `src/components/**`                                                        | Playwright role/label selectors, focus assertions, mobile overflow checks                                     | Error summary receives focus; inline errors linked by `aria-describedby`; status never color-only                                                                                            |
| Test isolation and safe data scripts         | Fail-closed URL guard, `current_database()` re-check        | `tests/helpers/database-safety.ts`, `scripts/seed-demo-data.ts`, `scripts/e2e-test-data.ts`    | `tests/unit/database-safety.test.ts`, `tests/integration/demo-seed.test.ts`                                   | Tests touch only `sprikle_ops_test`; demo seed is additive and refuses non-empty data                                                                                                        |
| Automated quality gates                      | Vitest 5, Playwright 1.63, ESLint, Prettier, GitHub Actions | `package.json` scripts, `vitest.config.ts`, `playwright.config.ts`, `.github/workflows/ci.yml` | —                                                                                                             | Local: 538 unit (×4 runs), 101 integration, 27 browser tests passing; coverage 99.36% statements / 98.96% branches on domain and validation code. CI workflow written, not yet run on GitHub |
| Reproducible demo                            | Seed through services, Playwright recording                 | `scripts/lib/demo-work-orders.ts`, `scripts/record-demo.ts`, [demo.md](demo.md)                | Seed determinism test                                                                                         | 37 seeded work orders / 102 activity entries; walkthrough video recorded from a production build                                                                                             |

## Scope of the code

- **Core product:** everything under `src/` except `src/app/prototypes/`, plus `prisma/`, `scripts/`,
  `tests/`, and `e2e/`.
- **Optional design experiment:** `src/app/prototypes/brindle/` (GSAP/Lenis marketing-hero study over
  sample data, served only by `pnpm dev`). It is not evidence of product functionality.

## Database migrations in the release

`20261006004807_init`, `20261006005042_audit_trigger_error_code`, `20261006020855_add_auth_tables`
(three in total; contents in the README). No migration was added after the authentication phase.

## Counts (2026-10-09)

- Application source (excluding generated Prisma client and design prototypes): see
  `git ls-files src | grep -v -e generated -e prototypes`.
- Tests: 28 unit test files (538 tests), 9 integration test files (101 tests), 2 browser spec files
  (27 tests).

## What not to claim

- No public deployment exists; no users, customers, uptime, traffic, or performance at scale.
- No AI or machine-learning capability.
- The CI workflow has not run on GitHub yet.
- Query timings are a single local `EXPLAIN ANALYZE` run on 5,000 synthetic rows, not a benchmark.
- `pnpm audit` is not clean: four advisories are documented in [security-advisories.md](security-advisories.md).
