# Implementation Log

Running checklist and verification record. Each phase is implemented only after explicit approval.

## Phase checklist

| #   | Phase                                           | Status                           |
| --- | ----------------------------------------------- | -------------------------------- |
| 0   | Planning package                                | ✅ Approved 2026-10-05           |
| 1   | Foundation                                      | ✅ Committed `a58aa3d`, pushed   |
| 2   | Database (Compose, Prisma, schema, constraints) | ✅ Committed `6957fc6`, pushed   |
| 3   | Domain logic and validation                     | ✅ Committed `b4d6f80`, pushed   |
| —   | Design setup gate (Impeccable, ADR 0004)        | ✅ Committed `856b248`, pushed   |
| 4A  | Authentication backend                          | ✅ Implemented — awaiting review |
| 4B  | Styled app shell, browser checks, Impeccable    | ⏳ Not started                   |
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

---

## Design setup — Gates A and B (2026-10-05)

### Scope delivered

- Gate A approved: Direction A "Dispatch board" (pinned; no `concept-seed`), Operate mode, light
  theme, system fonts, code-led, `lucide-react` intended for Phase 4 (not installed), text-only
  decision channel, no choice ping.
- Gate B: plugin and engine versions verified, plugin flag enabled, Impeccable `context` run,
  `init` → `PRODUCT.md`, `shape app-shell` brief, pinned direction contract recorded with
  `surface-brief`, generated files inspected.
- Details, commands, and observed network behavior: [ADR 0004](decisions/0004-design-workflow.md).

Not included (by design): DESIGN.md (written from the built interface at the end of Phase 4),
Tailwind tokens, application or UI code, dependency installation, concept-seed, decision pages,
image generation, live mode.

### Files

Created: `PRODUCT.md`, `docs/design/visual-direction.md`, and (written by the engine)
`.impeccable/surfaces/src-app-app-layout-tsx.md`.
Modified: `.gitignore`, `.prettierignore`, `docs/decisions/0004-design-workflow.md`, `docs/implementation-log.md`.
`.gitignore` ignores all `.impeccable/` content except the inspected surface brief (approved after
the read-only review); verified with `git check-ignore` against representative config, design,
cache, review, screenshot, build, mock, critique, live, and log paths.
Ignored, in the repository: `.claude/settings.local.json` (plugin flag; set to `true` during Gate B,
`false` after the user disabled the plugin and reloaded).
Outside the repository: `~/.impeccable/update-check.json` (created by the engine's update check).

### Observations and deviations

- **Hooks:** the plugin flag was enabled, but hooks were not loaded during Gate B because no plugin
  reload occurred; no hook ran (engine reported `MANUAL_DETECTOR_REQUIRED`; the session's hook
  records show none). The user later disabled the plugin and reloaded (0 hooks).
- **Shape confirmation:** the shape brief was saved as the surface brief without a separate
  confirmation round; the user then reviewed it read-only against Direction A (no material
  additions) and approved its `.gitignore` exception.
- **Network:** `impeccable context` opened one outbound HTTPS connection (TCP 443, Cloudflare IPv6
  range) and wrote `~/.impeccable/update-check.json` (`latestVersion: 4.5.0`); most likely the skill
  update check. The payload and complete network behavior were not determined. The surface-brief
  commands showed no sockets, but observation was 50 ms socket polling, which can miss short
  connections; absence of observed sockets is not proof of no traffic.
- **Opt-out variables:** `DO_NOT_TRACK=1` and `IMPECCABLE_NO_TELEMETRY=1` were set for every engine
  command after `context`, but not for `context` itself. Future engine commands receive both from
  the first invocation; they are documented as skipping the choice ping and are not claimed to block
  all network access.
- **Incumbent visual:** the engine classifies the Phase 1 placeholder page as an incumbent visual
  implementation; the pinned direction replaces it in Phase 4.
- **Formatting policy for engine-managed files:** after the `.gitignore` exception un-ignored the
  surface brief, `pnpm format` (Prettier skips only Git-ignored files) added four blank lines to it.
  The brief was restored byte-for-byte from the engine's saved read-back (verified with `cmp`;
  2479 bytes; body identical to the submitted source), and `.impeccable/` was added to
  `.prettierignore`. Engine-managed `.impeccable/` files are never reformatted by project tooling;
  they stay exactly as the engine wrote them and as they were reviewed.

---

## Phase 4A — Authentication backend (2026-10-06)

### Scope delivered

- Better Auth 1.7.7 (`src/server/auth.ts`): email/password with public sign-up disabled, 17 unused
  endpoints disabled, server-owned `role`/`isActive`, database-backed 8-hour rolling sessions
  (1-hour refresh, cookie cache off), explicit CSRF/origin protection, in-memory login limiter
  (one shared bucket of 5 sign-in requests; ADR 0002), no trusted client IP headers, telemetry off, sanitized logging, and inactive users
  refused with the same error as a wrong password. Full rationale: ADR 0002.
- Server-side guards (`src/server/session.ts`), safe return paths (`src/lib/return-path.ts`), the
  `/api/auth/*` handler, and an additive migration for `sessions`, `accounts`, `verifications`.
- Demo-user provisioning (`scripts/lib/auth-users.ts`, `pnpm db:seed:auth`) and
  `pnpm env:init --add-missing`.
- Tests: 3 new unit files, 2 new integration files; test cleanup covers the auth tables.

Not included (by design, Phase 4B): `src/proxy.ts`, login page, app shell, styled placeholders,
Lucide, Playwright, Impeccable. OD-1 and OD-2 remain unresolved.

### Verification results

| Check                                      | Result                                                                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `better-auth@1.7.7` compatibility          | ✅ peers satisfied by Next 16.3.8, React 19.3.0, Prisma 7.10.0, pg 8.23.1, Vitest 5.0.3; one `zod@4.6.5`                                 |
| `env:init --add-missing`                   | ✅ appended 3 keys (names only shown); existing `.env` bytes unchanged; second run appends nothing                                       |
| Migration `20261006020855_add_auth_tables` | ✅ generated SQL reviewed (3 new tables, 5 indexes, 2 FKs; no existing table changed); applied to dev and test; no drift or reset prompt |
| Migration checksums                        | ✅ all 3 migrations match in both databases                                                                                              |
| `pnpm db:seed:auth` (twice)                | ✅ run 1: 4 created; run 2: 4 unchanged; credential mapping verified; hash fingerprints identical across runs                            |
| `pnpm test:integration`                    | ✅ 4 files, 45 tests                                                                                                                     |
| `pnpm check`                               | ✅ format, lint, typecheck, 463 unit tests with coverage (99.28% lines, 98.84% branches) and 3 time-zone runs, build                     |
| Build with the database stopped            | ✅ exit 0; database restarted and healthy                                                                                                |

Behaviors verified through the HTTP handler: HttpOnly/SameSite=Lax/non-Secure cookie with
`Max-Age=28800`; identical 401 for unknown email, wrong password, and inactive user; sign-up and
disabled endpoints 404; smuggled `role`/`isActive` on sign-in ignored (200) with stored values
unchanged; Better Auth's update API rejects `role` with `FIELD_NOT_ALLOWED`; untrusted `Origin`
and cross-site Fetch Metadata 403; 6th sign-in in 60 s → 429 (correct password included), other
isolated test identities limited independently, and with the production identity configuration
rotating `x-forwarded-for` does not evade the single shared bucket; expired session rejected;
rolling refresh through the handler but not during server-side reads; deactivation after sign-in
denied on the next request; role denial; sign-out deletes the session and clears the cookie.

### Issues and deviations

- **`x-forwarded-for` trusted by default:** Better Auth 1.7.7 reads client IP from
  `x-forwarded-for` unless configured; set `ipAddressHeaders: []` so it cannot be spoofed to evade
  the limiter. A proxied deployment must configure a trusted header deliberately.
- **Origin checks skipped in tests by default:** set `disableOriginCheck: false` explicitly.
- **Rate-limit store is process-wide:** separate auth instances share it, so tests isolate clients
  through a test-only trusted header rather than weakening limits.
- **Server-side reads do not refresh sessions** (`disableRefresh`), to avoid writes during
  rendering; rolling refresh happens through the HTTP handler. Phase 4B must ensure the browser
  reaches the handler (for example a session check) for sessions to roll in practice.
- **Raw `get-session` for a deactivated user** returns the session with `isActive: false`; the
  application refuses it. Session revocation on deactivation is deferred to admin user management.
- **Forbidden pages return HTTP 200** with a forbidden view (no experimental `authInterrupts`).
- **Accounts unique (`provider_id`, `account_id`)** was added beyond Better Auth's base schema for
  integrity.
- **Typed routes:** the `/login` redirect is cast to `Route` until the page exists in 4B.
- **`tsx` not needed:** Node 24 type stripping runs the seed script with Prisma's generated client.
- **Interrupted session:** work paused before the diagnostic, provisioning test, seed, final checks,
  and documentation; on resumption the state was inspected first and only those remaining steps
  were completed (the migration was not re-run). Temporary diagnostic tests were deleted after
  recording their results.

### Pre-commit review findings (resolved, documentation and comments only)

The Phase 4A pre-commit review found two inaccurate claims; both were corrected without changing
runtime behavior:

1. **Rate-limit identity.** Earlier wording said "per client" and "other clients unaffected." In the
   pinned Better Auth 1.7.7 limiter, every request to `POST /api/auth/sign-in/email` that reaches the
   handler counts (successful, failed, malformed, or later rejected by the origin check); after 5
   allowed requests, each less than 60 s after the previous allowed one, further requests receive
   429 until 60 s pass since the last allowed request (429 responses are not counted). With no
   trusted IP header, all clients share one bucket (`127.0.0.1` in development and test; Better
   Auth's shared fallback key in production), so client headers cannot bypass it but anyone can
   lock out every sign-in for about a minute. Documented as a local-demo limitation, not
   deployment-ready; separate buckets exist only in the isolated test setup. Corrected in
   `src/server/auth.ts`, ADR 0002, `docs/api.md`, `docs/test-strategy.md`, this log, and two test
   titles/comments in `tests/integration/auth.test.ts`.
2. **Rendering writes.** Earlier wording said rendering "never writes sessions." Server-side reads
   never refresh or extend a session and never set cookies, but Better Auth may delete an
   already-expired session row when reading it. Corrected in `src/server/session.ts`,
   `docs/authorization.md`, and ADR 0002.

Also documented: every protected application API handler must call `authorize()` or an equivalent
server-side checked entry point; a session response or cookie alone is not authorization.

Deferred (not done): a test for expired-row deletion, file-backed verification reruns, Better
Auth's deferred-refresh option, and removal of two non-sensitive Phase 2 logs in `/tmp`.
