# Authorization

Status: **Approved design.** Pure rules implemented in Phase 3 (`src/domain/permissions.ts`,
`src/domain/transitions.ts`, `src/domain/work-order-edit.ts`); enforced with real sessions from
Phase 4 and in services from Phase 5.

## Principles

- **The server is the boundary.** `src/proxy.ts` performs only an optimistic session-cookie redirect.
  Every page, Server Action, route handler, and service function re-checks the session and the
  permission (`requireUser()` / `assertCan(user, action, resource)`). Middleware-only authorization is
  insufficient: CVE-2025-29927 allowed requests to bypass Next.js middleware entirely.
- **Out-of-scope resources are invisible.** A `TEAM_MEMBER` requesting a work order not currently
  assigned to them receives **404**, not 403, so references cannot be enumerated (D3).
- **Role-aware UI is a convenience, not a control.** Hidden buttons are always backed by server checks.
- Signed-out requests: pages redirect to `/login?next=…`; API calls return `401 UNAUTHENTICATED`.
- **Inactive actors are unauthenticated** (Q4), even if they still hold a session.
- **Pure rules are not session checks.** The domain helpers decide what an already-identified actor
  may do; they never verify a session themselves.

## Decision precedence

Every rule entry point checks in this order and returns the first failure, so unauthenticated or
out-of-scope callers learn nothing about a work order:

1. `UNAUTHENTICATED` — missing or inactive actor.
2. `NOT_FOUND` — team member and the work order is not **currently** assigned to them (Q17),
   regardless of the action requested.
3. `VERSION_CONFLICT` (transitions and edits) — stale `version`.
4. Transitions only: `NO_CHANGE` (same status) → `INVALID_TRANSITION` (✗ for everyone) →
   `FORBIDDEN` (allowed only for `ADMIN`) → `ASSIGNEE_REQUIRED` → `NOTE_REQUIRED` /
   `NOTE_TOO_LONG` → `CLOCK_SKEW` → `VERSION_LIMIT`.
5. Edits only: `FORBIDDEN` (team members cannot edit or assign) precedes the version check; field
   rules (`INVALID_DUE_DATE`, `DUE_DATE_IN_PAST`, `UNASSIGN_NOT_ALLOWED`, `ASSIGNEE_NOT_FOUND`,
   `ASSIGNEE_INACTIVE`) follow; an edit with no normalized change returns "unchanged" and requests
   no version increment; `VERSION_LIMIT` applies only to real changes. Whether terminal
   (`COMPLETED`/`CANCELLED`) work may be edited is an **open product decision** (OD-1 in
   [product-requirements.md](product-requirements.md)); the pure rules currently allow it.

## Permission matrix

| Action                                                    | `ADMIN`                 | `TEAM_MEMBER`                                                                  |
| --------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------ |
| View dashboard                                            | organization-wide       | own assigned work only                                                         |
| List / search / view detail / timeline                    | all work orders         | work currently assigned to them; otherwise **404**                             |
| Create work order                                         | ✅                      | ❌ 403                                                                         |
| Edit title, description, service area, priority, due date | ✅                      | ❌ 403                                                                         |
| Assign / reassign (active users only)                     | ✅                      | ❌ 403                                                                         |
| Change status                                             | any allowed transition  | `OPEN→IN_PROGRESS`, `IN_PROGRESS↔BLOCKED`, `IN_PROGRESS→COMPLETED` on own work |
| Cancel / reopen / restore                                 | ✅                      | ❌ 403                                                                         |
| Add comment                                               | ✅ any work order       | own assigned work                                                              |
| Edit or delete comments                                   | ❌ (not available, D13) | ❌                                                                             |
| Hard-delete work orders                                   | ❌ (not available)      | ❌                                                                             |
| View analytics                                            | ✅                      | ❌ 403 (D4)                                                                    |
| Assignee lookup                                           | ✅                      | ❌ 403                                                                         |
| View own profile                                          | ✅                      | ✅                                                                             |
| Manage users / organization settings                      | later phase             | ❌                                                                             |

## Status-transition matrix (D8)

`A` = `ADMIN`; `T` = the currently assigned `TEAM_MEMBER`; `✗` = not allowed for anyone.

| From ↓ / To → | OPEN        | IN_PROGRESS | BLOCKED | COMPLETED | CANCELLED |
| ------------- | ----------- | ----------- | ------- | --------- | --------- |
| `OPEN`        | –           | A, T        | A       | A         | A         |
| `IN_PROGRESS` | A           | –           | A, T    | A, T      | A         |
| `BLOCKED`     | A           | A, T        | –       | ✗         | A         |
| `COMPLETED`   | ✗           | A (reopen)  | ✗       | –         | ✗         |
| `CANCELLED`   | A (restore) | ✗           | ✗       | ✗         | –         |

### Transition side effects and preconditions

- Target `IN_PROGRESS`, `BLOCKED`, or `COMPLETED` requires an assignee (D6).
- Entering `COMPLETED` sets `completedAt = now`; leaving it (reopen) clears `completedAt`.
- Entering `CANCELLED` requires a reason (stored as a comment) and sets `cancelledAt = now`;
  restoring clears `cancelledAt`.
- Entering `BLOCKED` requires a note (Q1; stored as a comment). Notes and reasons are 1–2000
  characters after trimming; any transition may carry an optional note.
- A transition to the current status is rejected as `NO_CHANGE` (Q2).
- Admin quick close (`OPEN → COMPLETED`) needs an assignee already set (Q16).
- Unassigning is only allowed while the work order is `OPEN`.
- Every transition writes a `STATUS_CHANGED` activity with `fromStatus` / `toStatus` and increments
  `version`.
- Disallowed transitions return `422 INVALID_TRANSITION`; disallowed actors return `403 FORBIDDEN`
  (or `404` when the work order is outside their scope).
