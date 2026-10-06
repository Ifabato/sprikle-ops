# Implementation Log

Running checklist and verification record. Each phase is implemented only after explicit approval.

## Phase checklist

| #   | Phase                                           | Status                           |
| --- | ----------------------------------------------- | -------------------------------- |
| 0   | Planning package                                | ✅ Approved 2026-10-05           |
| 1   | Foundation                                      | ✅ Committed `a58aa3d`, pushed   |
| 2   | Database (Compose, Prisma, schema, constraints) | ✅ Committed `6957fc6`, pushed   |
| 3   | Domain logic and validation                     | ✅ Implemented — awaiting review |
| —   | Design setup gate (Impeccable, ADR 0004)        | ⏳ Not started (approval needed) |
| 4   | Authentication and app shell                    | ⏳ Not started                   |
| 5   | Services, audit trail, seed                     | ⏳ Not started                   |
| 6   | REST API                                        | ⏳ Not started                   |
| 7   | CI quality gates                                | ⏳ Not started                   |
| 8   | Work-order UI                                   | ⏳ Not started                   |
| 9   | Dashboard                                       | ⏳ Not started                   |
| 10  | Analytics                                       | ⏳ Not started                   |
| 11  | E2E and accessibility                           | ⏳ Not started                   |
| 12  | Documentation and packaging                     | ⏳ Not started                   |

## Approved decisions

D1–D13 approved on 2026-10-05; recorded in
[product-requirements.md](product-requirements.md#5-approved-product-decisions),
[ADR 0001](decisions/0001-stack-and-tooling.md), and [ADR 0002](decisions/0002-authentication-library.md).
Login rate limiting: Better Auth's built-in in-memory limiter, documented in ADR 0002 (no Redis or
extra infrastructure).

Q1–Q17 (Phase 3) approved on 2026-10-05; recorded in
[product-requirements.md](product-requirements.md#phase-3-rule-decisions-q1q17-approved-2026-10-05)
and [ADR 0005](decisions/0005-time-zones-and-dates.md).

P1–P8 (Phase 2) approved on 2026-10-05; recorded in [ADR 0003](decisions/0003-database-and-prisma.md)
and [ADR 0004](decisions/0004-design-workflow.md).

---

## Phase 1 — Foundation (2026-10-05)

### Scope delivered

- Hand-built Next.js 16.3.8 App Router foundation (no `create-next-app`, D9).
- Strict TypeScript 6.0.3, Tailwind CSS 4.3.3, ESLint 9 flat config (`eslint-config-next`),
  Prettier with the Tailwind plugin, Vitest 5.
- pnpm 10.34.6 via Corepack, pinned in `package.json` (`packageManager`); exact pins for all direct
  dependencies; `pnpm-lock.yaml` committed-ready.
- Zod-validated environment (`src/lib/env.ts`): `NODE_ENV`, `APP_TIMEZONE` (IANA-validated, default
  `America/New_York`). Errors name the variable but never echo values.
- Public `GET /api/health` (no database yet): `200 {status:"ok"}`, or `503` without details if the
  configuration is invalid; always `Cache-Control: no-store`.
- Planning documents and ADRs 0001–0002; minimal README update (D10).

Not included (by design): authentication, database, Docker Compose, Prisma, UI features, work-order
API routes, CI, deployment.

### Files

Created: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json`, `next.config.ts`,
`postcss.config.mjs`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `vitest.config.ts`,
`.gitignore`, `.editorconfig`, `.nvmrc`, `.env.example`, `src/app/layout.tsx`, `src/app/page.tsx`,
`src/app/globals.css`, `src/app/api/health/route.ts`, `src/lib/env.ts`, `tests/unit/env.test.ts`,
`tests/unit/health-route.test.ts`, `docs/*.md` (8 files), `docs/decisions/0001-stack-and-tooling.md`,
`docs/decisions/0002-authentication-library.md`.

Modified: `README.md`.

Generated, gitignored: `node_modules/`, `.next/`, `next-env.d.ts`.

### Verification results

| Command                                            | Result                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `node -v`                                          | v24.6.0                                                                       |
| `pnpm -v`                                          | 10.34.6                                                                       |
| `pnpm install --frozen-lockfile`                   | ✅ up to date                                                                 |
| `pnpm format:check`                                | ✅ all files formatted                                                        |
| `pnpm lint`                                        | ✅ 0 errors, 0 warnings (`--max-warnings=0`)                                  |
| `pnpm typecheck`                                   | ✅ `next typegen` + `tsc --noEmit` clean                                      |
| `pnpm test`                                        | ✅ 2 files, 7 tests passed                                                    |
| `pnpm build`                                       | ✅ compiled; routes `/` (static), `/_not-found`, `/api/health` (dynamic)      |
| `pnpm start` + `curl -i localhost:3100/api/health` | ✅ `200`, `cache-control: no-store`, no `x-powered-by`                        |
| `curl localhost:3100/`                             | ✅ `200`                                                                      |
| `APP_TIMEZONE=Bad/Zone pnpm start` + `curl`        | ✅ `503 {"status":"error",…,"checks":{"config":"invalid"}}`, value not echoed |

### Issues and deviations

- **pnpm 12 → 10.34.6.** Corepack 0.34.0 (bundled with Node 24.6.0) cannot run pnpm 11+
  (`MODULE_NOT_FOUND …/bin/pnpm.cjs`). Pinned pnpm 10.34.6, the newest compatible stable. See ADR 0001.
- **ESLint 9.39.5 is marked "no longer supported" upstream.** ESLint 10 is not yet supported by the
  React/import/jsx-a11y plugins used by `eslint-config-next` 16.3.8. Tracked in ADR 0001.
- **TypeScript 6.0.3, not 7.0.2**, because `typescript-eslint` supports `<6.1.0`.
- **`prisma` `latest` tag is a release candidate (8.0.0-rc.20)**; Phase 2 will pin 7.10.0.
- **Build-script warning in the existing `node_modules`.** The first install recorded `unrs-resolver`
  as an ignored build before `pnpm-workspace.yaml` existed, so the local install still prints the
  warning. A fresh frozen install in a scratch directory printed no warning. The script is a fallback
  native-binary downloader and is intentionally blocked.
- **Global change:** `corepack enable pnpm` created the shim `/opt/homebrew/bin/pnpm` (approved D2).
- **Correction (found in Phase 2):** the Phase 1 report stated that the verification servers on ports
  3100 and 3101 were stopped. `pkill -f "next start …"` stopped only the pnpm wrapper; the child
  process (`next-server`) kept running until Phase 2, where it was found and stopped by PID. Phase 1
  verification results themselves were valid (taken before the stop attempt).

---

## Phase 2 — Database (2026-10-05)

### Scope delivered

- PostgreSQL 16.15 in Docker Compose (`postgres:16.15-alpine3.24` pinned by multi-arch digest,
  arm64 verified), 127.0.0.1-only port, 512 MiB cap, health check, named volume, test database
  created on first init.
- Prisma 7.10 (`prisma-client` generator, `@prisma/adapter-pg`, `prisma.config.ts`), snake_case
  mapping, initial migration with CHECK constraints and append-only triggers, and a follow-up
  migration fixing the trigger SQLSTATE.
- `User` model matching Better Auth 1.7.7's core user schema (checked against its published source;
  auth itself not installed).
- Fail-closed test-database guard, guarded test preparation and cleanup, serial integration tests.
- Database-aware `/api/health` with driver- and server-level timeouts and redacted logging.
- `.env.example` without usable credentials; `pnpm env:init` generates a local `.env`.
- Docs: data model, API health section, test strategy, README setup, ADR 0003 (database), ADR 0004
  (design workflow).

Not included (by design): authentication, Better Auth tables, seed data, services, UI, CI.

### Files

Created: `docker-compose.yml`, `docker/postgres/init/01-create-test-database.sql`,
`prisma.config.ts`, `prisma/schema.prisma`, `prisma/migrations/migration_lock.toml`,
`prisma/migrations/20261006004807_init/migration.sql`,
`prisma/migrations/20261006005042_audit_trigger_error_code/migration.sql`, `src/server/db.ts`,
`src/server/health.ts`, `scripts/create-local-env.ts`, `scripts/db-test-prepare.ts`,
`tests/helpers/database-safety.ts`, `tests/helpers/test-database.ts`,
`tests/integration/setup-env.ts`, `tests/integration/db-constraints.test.ts`,
`tests/integration/health-database.test.ts`, `tests/unit/database-safety.test.ts`,
`tests/unit/health-check.test.ts`, `docs/decisions/0003-database-and-prisma.md`,
`docs/decisions/0004-design-workflow.md`.

Modified: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.env.example`, `.gitignore`,
`.prettierignore`, `eslint.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `src/lib/env.ts`,
`src/app/api/health/route.ts`, `tests/unit/env.test.ts`, `tests/unit/health-route.test.ts`,
`docs/data-model.md`, `docs/api.md`, `docs/test-strategy.md`, `docs/implementation-log.md`,
`docs/decisions/0001-stack-and-tooling.md`, `README.md`.

Local, gitignored: `.env` (mode 0600), `src/generated/prisma/`.

### Verification results

| Check                                                   | Result                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Image index includes `linux/arm64/v8`; container arch   | ✅ `arm64`, PostgreSQL 16.15 on aarch64                                         |
| `docker compose config --quiet`                         | ✅ valid                                                                        |
| `pnpm db:up`                                            | ✅ healthy; memory limit 536870912; port `127.0.0.1:5432`                       |
| Databases                                               | ✅ `sprikle_ops`, `sprikle_ops_test` (no shadow database left behind)           |
| `prisma validate`, `prisma format --check`              | ✅                                                                              |
| `migrate dev --create-only` → review → `migrate dev`    | ✅ applied; no reset prompt; no drift                                           |
| Second `prisma migrate dev`                             | ✅ "Already in sync" (custom SQL not reported as drift)                         |
| `pnpm db:status` (dev)                                  | ✅ 2 migrations, up to date                                                     |
| Test prepare with `TEST_DATABASE_URL` = development URL | ✅ refused, exit 1, no credentials in output; dev database unchanged            |
| `pnpm test:integration`                                 | ✅ 2 files, 23 tests                                                            |
| `pnpm test` (unit)                                      | ✅ 4 files, 41 tests                                                            |
| `pnpm check` (format, lint, typecheck, unit, build)     | ✅                                                                              |
| Unit tests and `pnpm build` with the database stopped   | ✅ pass (no live database needed)                                               |
| Health: database running → stopped → restored           | ✅ 200 → 503 (~5 ms) → 200                                                      |
| Health: database paused (accepts TCP, never answers)    | ✅ 503 in 2.01 s; no leftover active `sprikle-ops` queries afterward            |
| Server log during health checks                         | ✅ only `{ name, code }` (`P1001`, `HEALTH_TIMEOUT`); no password, URL, or host |
| Database healthy at end                                 | ✅                                                                              |

### Issues and deviations

- **Trigger SQLSTATE fix migration.** The initial trigger used `23001` (`restrict_violation`), which
  Prisma reports as `P2003` "Foreign key constraint violated". The applied migration was not edited;
  `20261006005042_audit_trigger_error_code` replaces the function with the default `P0001`.
- **Prisma engine download.** pnpm blocked `@prisma/engines`' postinstall; it was explicitly allowed in
  `pnpm-workspace.yaml` and downloaded `schema-engine-darwin-arm64` (~25.6 MB) from Prisma's binary
  host. `prisma`'s preinstall (Node version check) remains blocked.
- **Prisma 7 does not run `generate` after `migrate dev`**; `postinstall`, `build`, and `typecheck`
  run it explicitly.
- **Health check bug found and fixed during verification:** a database failure arriving after the
  2 s timeout would have been an unhandled rejection; the ping promise now never rejects (unit test
  added).
- **Stale Phase 1 servers** on ports 3100/3101 initially answered the Phase 2 health check with the
  Phase 1 response; those results were discarded, the processes were stopped by PID, and the checks
  were rerun against a fresh server.
- Test database file is `.sql` (as originally proposed), not the `.sh` mentioned before
  implementation.
- Better Auth depends on `@better-auth/telemetry`; its default must be checked and telemetry
  disabled explicitly in Phase 4.

---

## Phase 3 — Domain logic and validation (2026-10-05)

### Scope delivered

- Pure, deterministic domain rules in `src/domain/` (no database, clock reads, Node, framework, or
  Prisma imports; enforced by ESLint):
  - `enums.ts`, `limits.ts`, `result.ts` — shared constants and the `RuleResult` type.
  - `time.ts` — `America/New_York` calendar helpers on `Intl` (ADR 0005).
  - `due-dates.ts` — end-of-day due dates, overdue, "Due today", "Due in 7 days", due-date rule.
  - `reference.ts` — `WO-000123` format/parse and numeric search terms.
  - `permissions.ts` — actor/action/scope decisions with UNAUTHENTICATED → NOT_FOUND → FORBIDDEN
    precedence; assignee eligibility.
  - `transitions.ts` — the approved matrix, preconditions, and a pure transition plan.
  - `work-order-edit.ts` — pure edit diff with normalized "no changes" detection.
  - `metrics.ts` — reporting intervals, ISO-week buckets, completion rate, average completion time,
    Needs Attention ranking, record/event reconciliation.
- Client-safe strict Zod schemas in `src/validation/` (create, edit, transition, comment, reference
  parameter, list query).
- Coverage provider, thresholds, multi-time-zone runs, and lint restrictions; `pnpm check` now
  enforces coverage.
- Docs: metrics clarifications and AC-8 correction, Q1–Q17 decisions, authorization precedence, API
  list-query rules, test strategy, ADR 0005.

Not included (by design): services, database queries, authentication, API handlers, UI, the
created-date filter, schema or migration changes.

### Files

Created (28): `docs/decisions/0005-time-zones-and-dates.md`; `src/domain/{enums,limits,result,time,
due-dates,reference,permissions,transitions,work-order-edit,metrics}.ts`;
`src/validation/{common,work-order,comment,work-order-list-query}.ts`;
`tests/unit/domain/{time,process-timezone,due-dates,reference,permissions,transitions,
work-order-edit,metrics,enums-sync}.test.ts`;
`tests/unit/validation/{common,work-order,comment,work-order-list-query}.test.ts`.

Modified (14): `package.json`, `pnpm-lock.yaml`, `vitest.config.ts`, `eslint.config.mjs`,
`.env.example`, `src/lib/env.ts`, `tests/unit/env.test.ts`, `tests/unit/health-route.test.ts`
(the last four for the approved `APP_TIMEZONE` correction),
`docs/{metrics,product-requirements,authorization,api,test-strategy,implementation-log}.md`.

Dependency added: `@vitest/coverage-v8` 5.0.3 (dev; peer `vitest` 5.0.3 verified against the
installed 5.0.3 before installing; no install scripts). The lockfile re-keyed 8 existing entries
for new optional peers (`magicast`) without changing any versions.

### Verification results

| Check                                                       | Result                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| `pnpm test` (unit)                                          | ✅ 17 files, 402 tests (incl. 6 for APP_TIMEZONE)             |
| `pnpm test:coverage`                                        | ✅ thresholds met — see coverage below                        |
| `pnpm test:timezones` (UTC, America/New_York, Asia/Kolkata) | ✅ 402/402 in each                                            |
| `pnpm format:check`, `pnpm lint`, `pnpm typecheck`          | ✅                                                            |
| Lint restriction probe (stdin, no file written)             | ✅ 7/7 violations reported; `getUTCHours()` allowed           |
| `pnpm build`                                                | ✅                                                            |
| `pnpm check` (all of the above)                             | ✅                                                            |
| `pnpm test:integration` (guarded)                           | ✅ 2 files, 23 tests; no pending migrations; dev DB untouched |

Coverage (v8, all 14 domain/validation files reported):

| File                  | Lines | Branches | Functions |
| --------------------- | ----- | -------- | --------- |
| All files             | 99.28 | 98.84    | 100       |
| `src/domain/time.ts`  | 96.10 | 93.44    | 100       |
| every other file (13) | 100   | 100      | 100       |

Uncovered: `time.ts` lines 189, 232, 243 — defensive branches unreachable with `America/New_York`
(incomplete `Intl` parts, second-pass offset correction, nonexistent local midnight). No coverage
ignores were added.

### Issues and deviations

- **`limits.ts`** was added (not in the proposal's file list) to share text, pagination, and
  integer limits between domain rules and schemas.
- **Simplifications during implementation:** transition timestamps follow the database invariant
  directly (stamp when entering, otherwise null); `countByBucket` was rewritten to remove an
  unreachable fallback branch.
- **Test-helper bug fixed:** a default parameter turned an intended "no note" into a note; the
  helper now uses `null` for "no note".
- **`APP_TIMEZONE` correction (approved before commit):** configuration validation now accepts only
  `America/New_York`; any other zone (including valid IANA zones) makes `/api/health` return 503
  `config: "invalid"` with the database check skipped and no value echoed. Env and health tests
  updated; the custom date implementation was not broadened.
- **Unresolved Phase 5 product decision (OD-1):** the pure edit rules currently permit editing
  `COMPLETED`/`CANCELLED` work (unassigning still requires `OPEN`). This is documented as an open
  question in product-requirements.md, not an approved policy; no restriction was added.
- **HTTP mapping** of rule-specific codes (for example `ASSIGNEE_REQUIRED`, `DUE_DATE_IN_PAST`) is
  left to Phase 6; only `NO_CHANGE → 422` is fixed now.
- **Pre-commit blocker (resolved):** the first Phase 3 pre-commit review found that the "Open product
  decisions" section was missing from product-requirements.md, although authorization.md and this
  log referred to OD-1. A scripted insertion had matched the Q17 table row by exact text after
  Prettier re-padded it, so it silently did nothing. The section (OD-1 terminal-work edits, OD-2
  completion-rate cohort link) was added with a direct edit and verified by reading it back.
  Lesson: verify scripted documentation edits by reading the result, not by assuming a match.
