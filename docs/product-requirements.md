# Product Requirements — Sprikle Ops MVP

Status: **Approved** (planning package, 2026-10-05). Source of truth for scope; changes are recorded in
[implementation-log.md](implementation-log.md) and, when architectural, in [decisions/](decisions/).

## 1. Problem

Small service businesses track operational work across texts, spreadsheets, and memory. Assignments
are unclear, work is forgotten, overdue items are hard to spot, leaders cannot see workload
distribution, and performance is judged by guesswork rather than data.

## 2. Goals

| ID  | Goal                                                                         |
| --- | ---------------------------------------------------------------------------- |
| G1  | One trustworthy record for every operational work order.                     |
| G2  | Overdue, blocked, and critical work is visible within one screen of login.   |
| G3  | Every change is attributable: who changed what, and when.                    |
| G4  | Every number on screen is explainable from stored records (no fake metrics). |

**Non-goals (MVP):** customer portal, billing, scheduling/routing, multi-tenant organizations,
notifications, deployment.

## 3. Users

| Role          | Persona                  | Summary                                                                               |
| ------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| `ADMIN`       | Operations manager       | Creates, assigns, prioritizes, and closes work; monitors risk; reviews analytics.     |
| `TEAM_MEMBER` | Technician / team member | Sees only work currently assigned to them; updates status; records progress comments. |

Permissions: see [authorization.md](authorization.md).

## 4. Scope

### Must-have (MVP)

1. Credential authentication (Better Auth), roles `ADMIN` / `TEAM_MEMBER`, protected routes,
   server-side authorization in every service call, seeded demo accounts, public sign-up disabled.
2. Work orders: create / read / update / cancel (no hard delete); human-readable reference
   (`WO-000123`); server-enforced state machine; Zod validation on client and server; database CHECK
   constraints; optimistic concurrency via a `version` column.
3. Work-order list: pagination; search (reference, title, description); filters (status, priority,
   assignee, service area, due state); sort (due, created, updated, priority, status); state in URL.
4. Work-order detail: full fields, allowed status actions, comments, activity timeline.
5. Append-only activity audit trail written in the same transaction as each mutation.
6. Dashboard: six KPI cards linking to the matching filtered list, Needs Attention list, recent
   activity. Team members get a personal, assignment-scoped dashboard.
7. Analytics (ADMIN only): metrics in [metrics.md](metrics.md) from real PostgreSQL data, table-first
   with text alternatives and on-page definitions.
8. UX states and accessibility: loading, empty, error, forbidden, not-found; keyboard support,
   labels, visible focus, non-color-only status indicators.
9. Quality: unit, integration, and Playwright E2E tests including negative paths; Docker Compose
   PostgreSQL; CI (lint, typecheck, unit/integration, build).
10. Documentation: README, docs/, ADRs, implementation log.

### Should-have (priority order)

1. Automated accessibility checks (`@axe-core/playwright`).
2. Playwright E2E as a separate CI job.
3. Required note when moving work to `BLOCKED` (stored as comment + activity).
4. Median time to completion; on-time completion rate.
5. Trigram index for search with a documented `EXPLAIN ANALYZE` comparison on a 5k-row seed.
6. Created-date range filter.
7. Password change on profile.
8. Production `Dockerfile`.
9. CSV export of the filtered list.

### Later phases

User and service-area administration, organization settings, multi-tenancy, notifications,
SLA policies and escalation, attachments, recurring work, customer/site entities, saved filters,
time-in-status analytics, keyset pagination, deployment.

## 5. Approved product decisions

| ID  | Decision                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D3  | `TEAM_MEMBER` users view and act only on work **currently** assigned to them. Out-of-scope work-order URLs return **404**.                                        |
| D4  | Analytics are `ADMIN`-only. Team members get a personal, work-focused dashboard.                                                                                  |
| D5  | Service areas are a seeded `ServiceArea` table, not an enum (business data; adding one must not need a migration). No management UI in the MVP.                   |
| D6  | Description and due date are required. Assignee is optional for `OPEN` and required for `IN_PROGRESS`, `BLOCKED`, `COMPLETED`. A due date may not be in the past. |
| D7  | `APP_TIMEZONE=America/New_York`. A date-only due date means the end of that date in that time zone. Timestamps are stored in UTC.                                 |
| D8  | State-transition matrix ([authorization.md](authorization.md)), derived overdue logic, and metric definitions ([metrics.md](metrics.md)).                         |
| D13 | Single organization. Comments are immutable. Optimistic concurrency is a must-have. Demo accounts use `@sprikle.test` with password from `SEED_DEMO_PASSWORD`.    |

## 6. Non-functional requirements

- **Accessibility:** WCAG 2.2 AA target; semantic HTML; labelled controls; accessible error
  messages; visible focus; sufficient contrast; status and priority never conveyed by color alone.
- **Time:** all timestamps stored in UTC (`timestamptz`); displayed in `APP_TIMEZONE`; pages state
  the "as of" time for computed metrics.
- **Security:** httpOnly session cookies; authorization enforced on the server; no account
  enumeration on login; login rate limiting (see [ADR 0002](decisions/0002-authentication-library.md));
  no secrets in the repository (only `.env.example`).
- **Performance:** list, dashboard, and analytics queries are index-supported; verified with
  `EXPLAIN` against a larger seed.
- **Determinism:** domain logic receives `now` as a parameter; seed data uses a fixed PRNG seed;
  tests never depend on wall-clock time or external services.

## 7. Acceptance criteria

IDs are referenced by tests (see [test-strategy.md](test-strategy.md)).

**AC-1 Login**

- Valid credentials redirect to `/dashboard`.
- Invalid credentials and deactivated accounts show the same message: "Email or password is
  incorrect."
- Visiting a protected route while signed out redirects to `/login?next=<path>`; after login the user
  returns to `next` only if it is a same-origin relative path.
- Sign-out ends the session; protected pages then redirect to `/login`.

**AC-2 Admin creates a work order**

- Required: title (3–120 chars), description (1–5000 chars), service area, priority (default
  `MEDIUM`), due date (today or later in `APP_TIMEZONE`). Assignee optional.
- Success: redirect to the detail page showing the new reference; a `CREATED` activity exists.
- Invalid input: inline field errors linked with `aria-describedby`; focus moves to an error summary;
  entered values are preserved.
- A team member visiting `/work-orders/new` sees a 403 page; the corresponding API call returns 403.

**AC-3 Admin updates or reassigns**

- Only changed fields produce activity entries; saving without changes reports "No changes" and
  writes nothing.
- Inactive users cannot be assigned.
- A stale `version` returns 409 with "This work order was updated by someone else. Reload to see the
  latest version."

**AC-4 Status transitions**

- Only transitions in the matrix are allowed; the UI shows only allowed actions; the server rejects
  others with 422 `INVALID_TRANSITION`.
- Entering `COMPLETED` sets `completedAt`; leaving it clears `completedAt`.
- Cancelling requires a confirmation dialog and a reason; sets `cancelledAt`.
- `IN_PROGRESS`, `BLOCKED`, and `COMPLETED` require an assignee.

**AC-5 Team member works an assignment**

- List and dashboard show only work currently assigned to them.
- They can start, block, unblock, and complete their own work and add comments.
- Another user's work-order URL returns 404.
- Attempting admin-only field changes returns 403.

**AC-6 Comments**

- Body is 1–2000 characters after trimming.
- Shown with author and timestamp; appears in the timeline; creates a `COMMENT_ADDED` activity.
- Comments cannot be edited or deleted in the MVP.

**AC-7 List**

- Default: active work, sorted by due date ascending, 25 per page.
- All filters, sort, search, and page are reflected in the URL.
- Search matches `WO-000123`, `123`, and title/description text, case-insensitively.
- "No work orders yet" and "No matches for these filters" are distinct empty states; the latter offers
  "Clear filters".

**AC-8 Dashboard**

- Each KPI count equals the total of the filtered list it links to.
- Needs Attention shows at most 10 items, ordered per [metrics.md](metrics.md).
- Shows an "as of" time. Team members see their own scope only.

**AC-9 Analytics**

- `ADMIN` only (team members receive 403).
- Every chart has a table or text alternative; every metric has a "How is this calculated?"
  definition.
- Insufficient data is stated explicitly rather than shown as `0%`.

**AC-10 States and errors**

- Loading skeletons; an error page with retry and a request ID (no stack traces); 403 and 404 pages.
- Success and error messages are announced to assistive technology.
