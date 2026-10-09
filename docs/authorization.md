# Authorization

Status: **Implemented.** Pure rules in `src/domain/` (`permissions.ts`, `transitions.ts`,
`work-order-edit.ts`) are enforced with real sessions in every service in `src/server/services/`,
which every page, Server Action, and `/api/v1` handler calls.

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

## Server-side enforcement (Phase 4A)

- `src/server/session.ts` resolves the actor from the Better Auth session on every request:
  `getActor()` / `authorize()` (returns `UNAUTHENTICATED` or `FORBIDDEN`), and the page guards
  `requireUser(returnTo)` (redirects to `/login?next=…`) and `requireRole(role, returnTo)`
  (redirects when signed out; returns `{ forbidden: true }` for the wrong role so the page renders a
  forbidden view with HTTP 200, because Next.js only sets a 403 page status through an experimental
  flag that is not used).
- Every page and server entry point calls these helpers itself; layouts and the Phase 4B proxy are
  not relied on (see "Browser layer" below).
- Sessions are read with refresh disabled, so rendering never refreshes or extends a session and
  never sets cookies. Better Auth may delete an already-expired session row when reading it.
- **Protected API handlers:** every protected application API route handler (and Server Action)
  must call `authorize()` or an equivalent server-side checked entry point before doing any work.
  A response from `/api/auth/get-session` or the presence of a session cookie is not authorization.
- Inactive users are refused at sign-in (same error as a wrong password) and denied on the next
  request after deactivation. Unknown or malformed roles fail closed.
- `?next=` return paths pass through `safeReturnPath()` (`src/lib/return-path.ts`): only
  `/dashboard`, `/work-orders`, `/analytics`, `/profile` and their subpaths; anything else becomes
  `/dashboard`.

## Browser layer (Phase 4B)

None of these is an access boundary; the server-side guards above remain mandatory on every page.

- **Public pages:** `/` (landing) and `/login` are public. The landing page is static and reads no
  session; signed-in visitors reach the app through "Sign in", which `/login` forwards.
- **Proxy (`src/proxy.ts`):** an optimistic redirect only. A request to a protected area with no
  session cookie at all goes straight to `/login?next=…`. It never validates a session; a request
  with any session cookie passes through to the page's own guard.
- **App layout (`src/app/(app)/layout.tsx`):** reads the current user (with `actorFromSession`, so
  inactive or malformed sessions yield nothing) only to render role-aware navigation. It does not
  redirect; each page's guard does, which preserves that page's return path.
- **Navigation:** Analytics is hidden from team members (`navItemsFor`); `/analytics` still denies
  them on the server with the forbidden view.
- **Login page:** an active, authorized session is redirected to its safe `next` path. An inactive or
  expired session is not authorized, so the form renders instead of bouncing between login and
  the dashboard.
- **Visible-tab session keepalive (`src/components/shell/session-keepalive.tsx`,
  `src/lib/session-monitor.ts`):** not inactivity detection. While the shell is mounted it calls
  `GET /api/auth/get-session` (same origin, `cache: "no-store"`) on mount, when the tab becomes
  visible again, and every 15 minutes while the tab is visible; checks never overlap and hidden
  tabs make none. Because this request goes through the HTTP handler, Better Auth rolls a session
  older than one hour forward to a fresh 8 hours (the 4A configuration is unchanged). Only a
  confirmed signed-out answer (`null` session, `401`, or `isActive: false`) sends the user to
  `/login?next=<current path>`; network errors, 5xx, 429, and unexpected bodies are ignored. An idle
  but visible tab keeps the session alive; a hidden or closed tab lets it expire 8 hours after the
  last refresh.
- **Sign-out:** `POST /api/auth/sign-out` (same origin); the browser goes to `/login` only after the
  server confirms, otherwise the failure is shown.

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
   no version increment; `VERSION_LIMIT` applies only to real changes. Administrators may
   edit terminal (`COMPLETED`/`CANCELLED`) work (OD-1, resolved in
   [product-requirements.md](product-requirements.md)).

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
