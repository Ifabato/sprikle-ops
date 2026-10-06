# Test Strategy

Status: **Updated in Phase 3.** Expanded as each layer is introduced.

## Goals

- Business rules are proven by fast, deterministic unit tests.
- Authorization and audit behavior are proven against a real PostgreSQL database.
- The five critical user journeys are proven end to end in a real browser.
- Every acceptance criterion in [product-requirements.md](product-requirements.md) maps to at least
  one automated test (test names reference `AC-n`).
- No test depends on wall-clock time, network services, or test execution order.

## Layers

| Layer       | Tool                            | Location             | Database                             | Scope                                                                                                                   | Introduced    |
| ----------- | ------------------------------- | -------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------- |
| Unit        | Vitest                          | `tests/unit/`        | none                                 | Pure logic: env validation, state transitions, overdue/date logic, reference IDs, permissions, metric math, Zod schemas | Phase 1, 3    |
| Integration | Vitest                          | `tests/integration/` | `sprikle_ops_test` (D12)             | Service layer, DB constraints, authorization-sensitive workflows, audit-trail writes, metric queries, route handlers    | Phase 2, 5, 6 |
| End-to-end  | Playwright (Chromium only, D11) | `e2e/`               | `sprikle_ops_test`, reseeded per run | Critical journeys and negative paths through the real UI                                                                | Phase 11      |

## Determinism rules

- Domain functions accept `now` as a parameter; unit tests use fixed instants and `vi.setSystemTime`
  where a framework reads the clock.
- Seed data uses a fixed PRNG seed and dates relative to a configurable anchor.
- Integration tests run serially against `sprikle_ops_test`, truncating tables between files.
- E2E runs against a production build (`next build && next start`) with a freshly reset and seeded
  test database.

## Planned end-to-end journeys

1. Login and protected-route behavior (AC-1).
2. Admin creates a work order (AC-2).
3. Admin assigns and updates a work order (AC-3, AC-4).
4. Team member updates an assigned work order and adds a comment (AC-5, AC-6).
5. Dashboard or analytics reflects changed data (AC-8, AC-9).

Negative paths: invalid form submission, unauthorized route/API access (401/403/404), prohibited
status transition (422), stale version (409).

## Commands

| Command                 | Purpose                                                   | Needs database | Available from |
| ----------------------- | --------------------------------------------------------- | -------------- | -------------- |
| `pnpm test`             | unit tests (`--project unit`)                             | no             | Phase 1        |
| `pnpm test:unit`        | same as `pnpm test`                                       | no             | Phase 1        |
| `pnpm check`            | format, lint, typecheck, unit tests, production build     | no             | Phase 1        |
| `pnpm db:test:prepare`  | guard, then `prisma migrate deploy` on `sprikle_ops_test` | yes            | Phase 2        |
| `pnpm test:integration` | `db:test:prepare`, then integration tests (serial)        | yes            | Phase 2        |
| `pnpm check:full`       | `check` plus `test:integration`                           | yes            | Phase 2        |
| `pnpm test:e2e`         | Playwright suite                                          | yes            | Phase 11       |

## Coverage (Phase 3)

`pnpm test:coverage` measures every file under `src/domain/` and `src/validation/` (including files
no test imports) and fails below these thresholds:

| Scope                       | Lines | Statements | Functions | Branches |
| --------------------------- | ----- | ---------- | --------- | -------- |
| `src/domain/**`             | 90    | 90         | 90        | 85       |
| `src/domain/transitions.ts` | –     | –          | –         | 95       |
| `src/domain/permissions.ts` | –     | –          | –         | 95       |
| `src/validation/**`         | 90    | 90         | –         | –        |

No coverage ignores are used; unreachable defensive branches are reported as uncovered (ADR 0005).

## Domain and validation rules (Phase 3)

- Table-driven: all 25 status pairs × admin, assigned team member, out-of-scope team member,
  unassigned work, and unauthenticated/inactive actors; every permission action × actor kind.
- Precedence: unauthenticated and out-of-scope callers never receive `NO_CHANGE`,
  `INVALID_TRANSITION`, or `VERSION_CONFLICT`.
- Dates: ±1 ms boundaries, DST days and weeks (2024, 2026, 2027), leap day, year-end ISO weeks,
  repeated autumn hour, and independence from the process `TZ`.
- Metrics: empty datasets, zero denominators, cancelled/restored/reopened work, future-dated
  records, negative or non-finite durations, deterministic Needs Attention ties.
- Validation: strict objects (unknown fields rejected), trimming, every length limit, enums, real
  calendar dates, version range, list-query defaults, repeated parameters, and unknown parameters.
- `tests/unit/domain/enums-sync.test.ts` is the only unit test importing generated Prisma code; the
  domain and validation modules themselves are lint-restricted from server-only imports.

## Authentication tests (Phase 4A)

- `tests/integration/auth.test.ts` drives Better Auth's **HTTP handler** (the same path browsers
  use) against `sprikle_ops_test`: cookie attributes and 8-hour expiry; identical generic failures
  (unknown email, wrong password, inactive user); sign-up and the 17 disabled endpoints (404);
  server-owned fields (disabled update endpoint, smuggled sign-in fields, and Better Auth's
  update API), each asserting stored values are unchanged; untrusted `Origin` and cross-site
  Fetch Metadata (403); the login limiter (after 5 allowed sign-in requests, 429, including a correct password; a
  different isolated test identity is not limited) and
  that rotating `x-forwarded-for` does not evade it; expired sessions; rolling refresh via the
  handler but not during server-side reads; deactivation after sign-in; roles; sign-out.
- `tests/integration/auth-provisioning.test.ts`: credential mapping, repeat runs leave users and
  password hashes unchanged, short passwords refused, the four demo accounts.
- Unit: `return-path`, `auth-log` (redaction), `session` (actor mapping, guards, redirect targets).
- **Rate-limit isolation:** Better Auth's memory store is one process-wide map, so separate auth
  instances share buckets. Tests give each test its own client identity through a test-only
  trusted header (`tests/helpers/auth-test.ts`); limits are unchanged. These per-identity buckets
  exist only in tests: the real handler trusts no client-supplied header and uses one shared bucket,
  which the `x-forwarded-for` test exercises with the production identity configuration.
- **No secrets in output:** auth assertions compare booleans and flags, never token, cookie, or
  hash values, so a failing test cannot print a credential.

## Test-database safety

Integration tests never touch the development database (`sprikle_ops`):

1. `tests/integration/setup-env.ts` loads `.env` (without overriding existing variables) and calls
   `assertSafeTestDatabase()` on the **original** `DATABASE_URL` and `TEST_DATABASE_URL` before
   pointing `DATABASE_URL` at the test database. It refuses unless `NODE_ENV=test`, the test
   database is exactly `sprikle_ops_test`, the host is local (`localhost`, `127.0.0.1`, `[::1]`), no
   connection-redirecting query parameters are present, and the two URLs target different databases.
2. `pnpm db:test:prepare` applies the same guard, then only runs `prisma migrate deploy`.
3. Cleanup (`truncateTestDatabase()`) checks `current_database()` on the same transaction
   immediately before `TRUNCATE`, and truncates an explicit table list including the Better Auth
   tables (never `_prisma_migrations`, no `CASCADE`).
4. Integration files run one at a time (`fileParallelism: false`).

All refusal paths are unit-tested (`tests/unit/database-safety.test.ts`). The localhost restriction is
deliberate; CI (Phase 7) will need its own explicit, trusted database-host configuration.

## Current coverage (Phase 2–3)

Unit (no database), Phase 3: 13 new files under `tests/unit/domain/` and `tests/unit/validation/`
(see above). Phase 2:

- `tests/unit/env.test.ts`: defaults, time-zone and `DATABASE_URL` validation, errors never echo values.
- `tests/unit/health-route.test.ts`: 200 when healthy; 503 when the database is unavailable; 503 with
  the database check skipped when configuration is invalid; no leaked values.
- `tests/unit/health-check.test.ts`: ok, error, timeout, late failure after timeout (no unhandled
  rejection), and log redaction.
- `tests/unit/database-safety.test.ts`: every guard refusal path, local hosts, redaction, and the
  `current_database()` check.

Integration (`sprikle_ops_test`):

- `tests/integration/db-constraints.test.ts`: every CHECK constraint, unique and foreign-key
  restrictions, append-only triggers, enum sort order, sequential reference numbers, `timestamptz`
  columns, planned indexes, and that migration history survives cleanup.
- `tests/integration/health-database.test.ts`: application code targets the test database; health
  returns 200; an unreachable database reports `unavailable` within the timeout without details.
