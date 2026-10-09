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

| Command                 | Purpose                                                    | Needs database | Available from |
| ----------------------- | ---------------------------------------------------------- | -------------- | -------------- |
| `pnpm test`             | unit tests (`--project unit`)                              | no             | Phase 1        |
| `pnpm test:unit`        | same as `pnpm test`                                        | no             | Phase 1        |
| `pnpm check`            | format, lint, typecheck, unit tests, production build      | no             | Phase 1        |
| `pnpm db:test:prepare`  | guard, then `prisma migrate deploy` on `sprikle_ops_test`  | yes            | Phase 2        |
| `pnpm test:integration` | `db:test:prepare`, then integration tests (serial)         | yes            | Phase 2        |
| `pnpm check:full`       | `check` plus `test:integration`                            | yes            | Phase 2        |
| `pnpm test:e2e:smoke`   | Playwright auth/shell smoke suite only                     | yes            | Phase 4B       |
| `pnpm test:e2e`         | smoke suite + work-order journeys (production build, 3100) | yes            | Phase 11       |
| `pnpm perf:explain`     | 5k-row query plans on `sprikle_ops_test` (guarded)         | yes            | Phase 11       |

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

## Browser smoke suite (Phase 4B)

`pnpm test:e2e:smoke` (`playwright.config.ts`, `e2e/`) runs 16 ordered tests in headless Chromium
(Playwright's Chromium headless shell, installed with
`pnpm exec playwright install --only-shell chromium` into `~/Library/Caches/ms-playwright/`).

- **Isolation:** the config validates the original development and test URLs with
  `assertSafeTestDatabase()` first. Only the server under test receives the test database URL. A
  fresh production build is served on `127.0.0.1:3100` with `BETTER_AUTH_URL=http://localhost:3100`,
  so build, server, requests, cookies, and the trusted origin agree; `reuseExistingServer: false`
  makes the run fail if the port is already taken. One worker, no retries, a fresh browser context
  per test, no personal browser profile, no external sites.
- **Test data:** global setup applies migrations (`db:test:prepare`), then
  `scripts/e2e-test-data.ts setup` truncates `sprikle_ops_test` (guarded, `current_database()`
  re-checked) and provisions three synthetic users (`e2e/users.ts`) that exist only in the test
  database, so a successful sign-in also proves the server uses it; one test also counts the session
  row there. The users' password is random per run, held only in the runner's environment, and
  never printed. Global teardown truncates the test database again; it runs after normal test
  failures, but not if the runner process itself is killed (the next run's setup cleans up).
- **Real limiter, paced:** the shared sign-in bucket (5 requests per 60 s gap window, successful
  sign-ins included) is not weakened or bypassed. The suite makes exactly four sign-in requests
  before the last test (invalid, inactive, admin, technician), reuses signed-in state in memory
  through new contexts, and runs the rate-limit test last, stopping at the first 429 (at most six
  attempts).
- **No credentials in artifacts:** traces, videos, and automatic screenshots are off; the reporter
  is `list`. Playwright's failure `error-context.md` snapshots include input values, so global
  teardown replaces the per-run password in every text file under `test-results/e2e`. Review
  screenshots (`.impeccable/review/`, ignored) are taken only with no typed password present.
  Storage state stays in memory and is never written to disk.
- **Covered:** the public landing page (200, honest "In development" status, sample-data labels,
  "Contact details coming soon" with no `mailto:` link, demo link, or form; Sign in reaches login);
  the sample board re-deriving due labels from the keyboard with no scripted animation under
  reduced motion; no horizontal overflow at phone width; signed-out redirect with a safe `next`; login labels, autocomplete, keyboard order,
  visible focus, and empty-submit validation without a request; generic failures for wrong
  password and inactive account (password cleared); admin sign-in with an unsafe `next` → dashboard;
  skip link; role-aware navigation; team-member server denial on `/analytics`; signed-in visit to
  `/login` → requested page; mobile menu (Enter opens, Escape closes and restores focus, no hidden
  focusable links, closes on navigation); 404 state; sign-out failure reported; deactivated user
  sent to login by the keepalive with no redirect loop; sign-out revokes the session server-side;
  429 message.
- Unit: `board-model` (landing sample board: labels and order derived with the domain due-date
  rules), `contact` (only valid `mailto:`/`https:` destinations render a link),
  `rotate-demo-password` (`.env` line handling), `nav-items`, `proxy` (routing decision), `session-monitor` (every keepalive branch:
  valid, expired, inactive, 401, network error, 5xx/429, unexpected body, hidden tab, no overlap).

## Demo-password rotation tests

`tests/integration/rotate-demo-password.test.ts` runs the rotation core against `sprikle_ops_test`
with an in-memory filesystem: only the demo accounts' hashes and sessions change (an unrelated
account and session stay untouched); a real Better Auth sign-in accepts the new password and
rejects the old one; only the `.env` password line changes and stays owner-only; when the `.env`
rename fails after the database commit, the owner-only staged file is kept, the outcome carries no
password, and a second run refuses; a database failure removes the staged file and changes nothing;
a connection to an unexpected database is refused.

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

## Services, API, UI, and metrics (Phases 5–11, 2026-10-09)

| Suite                                                             | Proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/integration/work-order-services.test.ts`                   | Create/edit/transition/comment/list against PostgreSQL: one activity per change in the same transaction; unchanged edits write nothing; stale `version` → `CONFLICT`; a real two-request race where exactly one wins and the loser's note is rolled back; Q6 past due dates; OD-1; NOT_FOUND for out-of-scope team members (also after reassignment); New York due-filter boundaries ±1 ms; literal `%`/`_` in search; Q14; reconciliation of status vs latest event. |
| `tests/integration/api-work-orders.test.ts`                       | `/api/v1` handlers with real Better Auth cookies: 401 JSON, 403 cross-site `Origin`/`Sec-Fetch-Site` before any write, JSON-only and size-limited bodies, 404 for malformed and out-of-scope references, 409/422/400 mapping, deactivation after sign-in → 401, and a 500 that leaks no internals.                                                                                                                                                                    |
| `tests/integration/metrics.test.ts`                               | Every dashboard and analytics value equals the pure definitions in `src/domain/metrics.ts` applied to the same records (including a future-dated record and an inactive user holding work); each dashboard count card equals the total of its linked list for both roles; empty data → `null` (shown as "—").                                                                                                                                                         |
| `tests/integration/demo-seed.test.ts`                             | The demo dataset is produced through the services, covers every status and attention category, never runs past `now`, satisfies reconciliation, and is deterministic.                                                                                                                                                                                                                                                                                                 |
| `tests/unit/format.test.ts`, `validation/analytics-query.test.ts` | Display dates and due labels follow New York (midnight and DST boundaries); analytics query strictness and DST-aware ranges. Run under three process time zones.                                                                                                                                                                                                                                                                                                      |
| `e2e/work-orders.journey.spec.ts`                                 | The supported lifecycle in a real browser on a production build (below).                                                                                                                                                                                                                                                                                                                                                                                              |

### Browser journeys

`pnpm test:e2e` runs the smoke suite and then `e2e/work-orders.journey.spec.ts` in the same
production server. The journeys use three additional synthetic users and two service areas that
exist only in `sprikle_ops_test`. Because the smoke suite ends by tripping the real shared sign-in
limiter, the journey file first waits 61 seconds for that window to pass; it then signs in exactly
three times. The limiter is never weakened or bypassed.

Covered: empty states before any data; create-form validation (focus moves to the error summary,
`aria-invalid`/`aria-describedby`, values kept); create and assign; edit only what changed and
"No changes to save."; team-member scope (list, 403 create, 404 for others' work with a real 404
status, API 403/404); the assignee's start → block (required note in a modal dialog) → unblock →
comment → complete, each visible in the history; a stale page receiving the conflict message;
cancel with confirmation and reason, then restore; an invalid transition through the API (422);
URL-driven search and filters, "No matches" with "Clear filters", invalid filters; dashboard and
analytics values after the lifecycle, including the team member's scoped dashboard and analytics
denial; signed-out API calls (401 JSON).

### Not automated

Automated accessibility scanning (`@axe-core/playwright`, should-have #1) needs a new dependency and
is not installed; accessibility is covered by role/label-based selectors, focus assertions, and
manual review.
