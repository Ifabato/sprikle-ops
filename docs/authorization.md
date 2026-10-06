# Authorization

Status: **Approved design.** Enforced from Phase 4 (session) and Phase 5 (service layer).

## Principles

- **The server is the boundary.** `src/proxy.ts` performs only an optimistic session-cookie redirect.
  Every page, Server Action, route handler, and service function re-checks the session and the
  permission (`requireUser()` / `assertCan(user, action, resource)`). Middleware-only authorization is
  insufficient: CVE-2025-29927 allowed requests to bypass Next.js middleware entirely.
- **Out-of-scope resources are invisible.** A `TEAM_MEMBER` requesting a work order not currently
  assigned to them receives **404**, not 403, so references cannot be enumerated (D3).
- **Role-aware UI is a convenience, not a control.** Hidden buttons are always backed by server checks.
- Signed-out requests: pages redirect to `/login?next=…`; API calls return `401 UNAUTHENTICATED`.

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
- Entering `BLOCKED` requires a note (should-have #3; stored as a comment).
- Unassigning is only allowed while the work order is `OPEN`.
- Every transition writes a `STATUS_CHANGED` activity with `fromStatus` / `toStatus` and increments
  `version`.
- Disallowed transitions return `422 INVALID_TRANSITION`; disallowed actors return `403 FORBIDDEN`
  (or `404` when the work order is outside their scope).
