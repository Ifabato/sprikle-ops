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
3. ~~Required note when moving work to `BLOCKED`~~ — promoted to must-have in Phase 3 (Q1).
4. Median time to completion; on-time completion rate.
5. Trigram index for search with a documented `EXPLAIN ANALYZE` comparison on a 5k-row seed.
6. Created-date range filter (deferred; also required to link the completion-rate KPI to its
   cohort — see [metrics.md](metrics.md)).
7. Password change on profile.
8. Production `Dockerfile`.
9. CSV export of the filtered list.

### Later phases

User and service-area administration, organization settings, multi-tenancy, notifications,
SLA policies and escalation, attachments, recurring work, customer/site entities, saved filters,
time-in-status analytics, keyset pagination, deployment.

## 5. Approved product decisions

| ID  | Decision                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D3  | `TEAM_MEMBER` users view and act only on work **currently** assigned to them. Out-of-scope work-order URLs return **404**.                                                                              |
| D4  | Analytics are `ADMIN`-only. Team members get a personal, work-focused dashboard.                                                                                                                        |
| D5  | Service areas are a seeded `ServiceArea` table, not an enum (business data; adding one must not need a migration). No management UI in the MVP.                                                         |
| D6  | Description and due date are required. Assignee is optional for `OPEN` and required for `IN_PROGRESS`, `BLOCKED`, `COMPLETED`. A due date may not be in the past.                                       |
| D7  | `APP_TIMEZONE=America/New_York` (the only supported value in the MVP; others are rejected at startup). A date-only due date means the end of that date in that time zone. Timestamps are stored in UTC. |
| D8  | State-transition matrix ([authorization.md](authorization.md)), derived overdue logic, and metric definitions ([metrics.md](metrics.md)).                                                               |
| D13 | Single organization. Comments are immutable. Optimistic concurrency is a must-have. Demo accounts use `@sprikle.test` with password from `SEED_DEMO_PASSWORD`.                                          |

### Phase 3 rule decisions (Q1–Q17, approved 2026-10-05)

| ID  | Decision                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Entering `BLOCKED` requires a note; entering `CANCELLED` requires a reason (both stored as comments).                                                          |
| Q2  | A transition to the current status is rejected as `NO_CHANGE` (HTTP 422).                                                                                      |
| Q3  | Any **active** user, including an `ADMIN`, may be assigned work.                                                                                               |
| Q4  | A signed-in but inactive actor is treated as unauthenticated.                                                                                                  |
| Q5  | Due-date input is date-only (`YYYY-MM-DD`); no time of day in the MVP.                                                                                         |
| Q6  | "Not in the past" applies only when the due date **changes**; an unchanged past due date is preserved during unrelated edits, and overdue work stays editable. |
| Q7  | `due=week` = today through today + 6 local calendar days, excluding overdue. UI label: **"Due in 7 days"** (never "Due this week").                            |
| Q8  | Due today = active, not overdue, due on today's local date.                                                                                                    |
| Q9  | Reporting windows use New York calendar boundaries (see [metrics.md](metrics.md)).                                                                             |
| Q10 | Metrics use current work-order records, not lifetime completion-event counts; reconciliation compares each record with its latest status event.                |
| Q11 | Needs Attention ranks by the first matching category, then `dueAt`, then work-order number.                                                                    |
| Q12 | The pure edit-diff helper is part of the domain layer.                                                                                                         |
| Q13 | `pnpm check` enforces coverage thresholds.                                                                                                                     |
| Q14 | Unknown API list-query parameters are rejected (400).                                                                                                          |
| Q15 | The created-date range filter is deferred.                                                                                                                     |
| Q16 | Admin quick close (`OPEN → COMPLETED`) requires an existing assignee.                                                                                          |
| Q17 | Team members acting on work not currently assigned to them always receive `NOT_FOUND`.                                                                         |

### Open product decisions

- **OD-1 — Editing `COMPLETED` or `CANCELLED` work.** Whether admins may edit completed or cancelled
  work is **unresolved and will be decided in Phase 5**. The current pure rules
  (`src/domain/work-order-edit.ts`) allow these edits, with unassigning restricted to `OPEN` work.
  This behavior is **not an approved permanent product policy**.
- **OD-2 — Completion-rate cohort link.** The completion-rate card's link to its eligible cohort
  requires the deferred created-date filter (Q15). Do not implement the link or the filter until
  that dependency is resolved in an approved phase (see [metrics.md](metrics.md)).

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
  others with 422 `INVALID_TRANSITION`, and a transition to the current status with 422 `NO_CHANGE`.
- Entering `COMPLETED` sets `completedAt`; leaving it clears `completedAt`.
- Cancelling requires a confirmation dialog and a reason; sets `cancelledAt`. Restoring clears it.
- Moving to `BLOCKED` requires a note explaining the block.
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
- Due filters: "Overdue", "Due today", and "Due in 7 days" (today through today + 6, local dates).
- "No work orders yet" and "No matches for these filters" are distinct empty states; the latter offers
  "Clear filters".

**AC-8 Dashboard**

- Each **count** KPI card (Open, In progress, Blocked, Overdue, High priority) equals the total of
  the filtered list it links to.
- The completion-rate card is a percentage, not a count: its link shows the eligible cohort (work
  created in the window) and explains the numerator and denominator. That link needs the
  created-date filter, which is deferred to a later phase.
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
