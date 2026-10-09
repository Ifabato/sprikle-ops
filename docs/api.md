# Routes and API

Status: **Implemented.** Every endpoint below exists and is covered by integration tests
(`tests/integration/api-work-orders.test.ts`) and the browser journeys (`e2e/`).

## Layering

Pages (server components), Server Actions (UI forms), and REST route handlers are thin adapters:

1. Resolve the session (`requireUser()`).
2. Parse input with the shared Zod schema.
3. Call a service function in `src/server/services/` (authorization + business rules + audit).
4. Map the result or a typed domain error to a response.

Business rules live only in `src/domain/` (pure) and `src/server/services/` (I/O).

## Endpoints

| Method and path                                | Access            | Input → Output                                                                                                                                                                              | Phase               |
| ---------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `GET /api/health`                              | public            | → `{status, service, time, checks}`; `503` when unhealthy                                                                                                                                   | 1 (config), 2 (+db) |
| `/api/auth/[...all]`                           | public            | Better Auth handler                                                                                                                                                                         | 4                   |
| `GET /api/v1/work-orders`                      | signed in, scoped | query `page, pageSize≤50, q, status[], priority[], assignee (id\|me\|unassigned), serviceAreaId, due (overdue\|today\|week), sort, order` → `{data, page:{page,pageSize,total,totalPages}}` | 6                   |
| `POST /api/v1/work-orders`                     | `ADMIN`           | `CreateWorkOrderInput` → `201 {data}`                                                                                                                                                       | 6                   |
| `GET /api/v1/work-orders/:ref`                 | scoped            | → `{data}` with assignee, creator, service area                                                                                                                                             | 6                   |
| `PATCH /api/v1/work-orders/:ref`               | `ADMIN`           | `{version, …fields}` → `{data}` (status not accepted here)                                                                                                                                  | 6                   |
| `POST /api/v1/work-orders/:ref/transitions`    | per matrix        | `{version, toStatus, note?}` → `{data}`                                                                                                                                                     | 6                   |
| `GET /api/v1/work-orders/:ref/comments`        | scoped            | → `{data: Comment[]}`                                                                                                                                                                       | 6                   |
| `POST /api/v1/work-orders/:ref/comments`       | scoped            | `{body}` → `201 {data}`                                                                                                                                                                     | 6                   |
| `GET /api/v1/work-orders/:ref/activity`        | scoped            | → `{data: Activity[]}`                                                                                                                                                                      | 6                   |
| `GET /api/v1/metrics/dashboard`                | signed in, scoped | → KPIs, Needs Attention, recent activity, `asOf`                                                                                                                                            | 9                   |
| `GET /api/v1/metrics/analytics?from&to&window` | `ADMIN`           | `from`/`to` (YYYY-MM-DD, New York days, both or neither; creation range for work by status), `window` 7/30/90 → metrics in [metrics.md](metrics.md)                                         | 10                  |
| `GET /api/v1/assignees`                        | `ADMIN`           | → active users for assignment                                                                                                                                                               | 6                   |
| `GET /api/v1/service-areas`                    | signed in         | → active service areas                                                                                                                                                                      | 6                   |

`PATCH` returns `{ data, meta: { changed } }`; `changed: false` means the submitted values equal the
stored ones and nothing was written (no version increment, no activity).

Status changes use a separate command endpoint (`/transitions`) rather than a PATCH field so the
state machine is explicit and every change produces exactly one `STATUS_CHANGED` activity. There is
no DELETE endpoint.

## Conventions

- JSON bodies, camelCase keys, ISO-8601 UTC timestamps (`…Z`).
- Every `/api/v1` response carries `x-request-id` and `Cache-Control: no-store`. Unexpected failures
  return a generic `500 INTERNAL_ERROR` with the request ID; the server log records only the request
  ID and error class.
- **Same-origin writes (CSRF).** `POST`/`PATCH` requests are refused with `403` when
  `Sec-Fetch-Site` is present and not `same-origin`/`none`, or when `Origin` is present and is not
  the app's own origin. Request bodies must be `application/json` (at most 32 KB), which a
  cross-site HTML form cannot send without a CORS preflight that this API never grants. Server
  Actions rely on Next.js's built-in Origin/Host check.
- Signed-out or deactivated callers receive `401` JSON (never a redirect).
- Work orders are addressed by reference (`WO-000123`) in URLs.
- Authenticated responses send `Cache-Control: no-store`. The health endpoint also sends `no-store`.

## Authentication endpoints (implemented, Phase 4A)

Better Auth's handler at `/api/auth/*` (`src/app/api/auth/[...all]/route.ts`). Enabled endpoints
used by the app:

| Method and path                | Purpose                                                                                                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/sign-in/email` | `{ email, password }` → session cookie. Failures: 401 `INVALID_EMAIL_OR_PASSWORD` for unknown email, wrong password, or inactive user (identical); 429 when rate-limited (see below); 403 for an untrusted `Origin` or cross-site Fetch Metadata. |
| `POST /api/auth/sign-out`      | Deletes the session and clears the cookie (same origin checks).                                                                                                                                                                                   |
| `GET /api/auth/get-session`    | Current session (refreshes a session older than one hour). Not application authorization: it still returns a deactivated user with `isActive: false`.                                                                                             |

Sign-up and 16 other unused endpoints return 404 (`DISABLED_AUTH_PATHS` in `src/server/auth.ts`).

**Sign-in rate limiting (local-demo configuration, not deployment-ready):** the limiter counts every request to `POST /api/auth/sign-in/email` that reaches the handler (successful, failed, malformed, or later rejected by the origin check) in one bucket shared by all clients. After 5 allowed requests, each less than 60 s after the previous allowed one, further sign-in requests receive 429 until 60 s have passed since the last allowed request; 429 responses are not counted. No client IP
header is trusted, so client-controlled headers such as `x-forwarded-for` cannot select or bypass
the bucket, but any client can lock out every sign-in for about a minute. Separate per-client buckets
exist only in the test setup. A deployment requires an explicitly trusted proxy/IP configuration.

**Authorization of protected handlers:** every protected application API handler must call
`authorize()` (`src/server/session.ts`) or an equivalent server-side checked entry point. A session
response or a session cookie alone is not authorization.

Details: [ADR 0002](decisions/0002-authentication-library.md).

## Health endpoint (implemented)

`GET /api/health` is public and returns:

```json
{
  "status": "ok",
  "service": "sprikle-ops",
  "time": "2026-10-06T00:51:59.426Z",
  "checks": { "config": "ok", "database": "ok" }
}
```

| `checks.config` | `checks.database`         | HTTP |
| --------------- | ------------------------- | ---- |
| `ok`            | `ok`                      | 200  |
| `ok`            | `unavailable`             | 503  |
| `invalid`       | `skipped` (not attempted) | 503  |

The database check runs `SELECT 1` with a 1 s server-side statement timeout inside a 2 s overall
budget; the pool's connection timeout is 1.5 s. Responses never include error messages, connection
strings, hosts, or credentials; server logs contain only an error class and a short code. Exposing
up/down status publicly is acceptable for this local MVP; a deployed version would restrict or
reduce it.

- Every response carries an `x-request-id` header (from Phase 6).

## List-query rules (`src/validation/work-order-list-query.ts`)

- Unknown parameters are rejected with 400 (Q14); a single-value parameter given twice is rejected.
- `page` 1–10 000 (default 1); `pageSize` 1–50 (default 25); `q` trimmed, ≤ 200 characters, empty
  ignored.
- `status`: repeated and/or comma-separated status names; absent means the active statuses;
  `status=all` (alone) means all five.
- `priority`: repeated and/or comma-separated; `assignee`: `me`, `unassigned`, or a user ID;
  `serviceAreaId`; `due`: `overdue`, `today`, `week` ("Due in 7 days").
- `sort`: `dueAt` (default), `createdAt`, `updatedAt`, `priority`, `status`. Default `order` when
  omitted: `dueAt` asc, `createdAt` desc, `updatedAt` desc, `priority` desc, `status` asc.
- The created-date range filter is deferred (Q15).

Request bodies (create, edit, transition, comment) use strict schemas in `src/validation/`: unknown
fields are rejected, text is trimmed before length checks, and edits apply no defaults to omitted
fields.

## Error shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary",
    "fieldErrors": { "title": ["Must be at least 3 characters"] },
    "requestId": "…"
  }
}
```

| Code                   | HTTP | When                                                    |
| ---------------------- | ---- | ------------------------------------------------------- |
| `VALIDATION_ERROR`     | 400  | Zod parse failure; `fieldErrors` populated              |
| `UNAUTHENTICATED`      | 401  | no valid session                                        |
| `FORBIDDEN`            | 403  | role not permitted for the action                       |
| `NOT_FOUND`            | 404  | missing, or outside the caller's scope                  |
| `CONFLICT`             | 409  | stale `version`                                         |
| `INVALID_TRANSITION`   | 422  | status change not allowed by the matrix                 |
| `NO_CHANGE`            | 422  | transition to the current status                        |
| `ASSIGNEE_REQUIRED`    | 422  | target status needs an assignee (D6, Q16)               |
| `UNASSIGN_NOT_ALLOWED` | 422  | unassigning work that is not `OPEN`                     |
| `VERSION_LIMIT`        | 409  | version counter at its maximum                          |
| `INTERNAL_ERROR`       | 500  | unexpected; details logged server-side with `requestId` |

Domain rules (Phase 3) return result codes rather than throwing: `UNAUTHENTICATED`, `NOT_FOUND`,
`FORBIDDEN`, `VERSION_CONFLICT`, `NO_CHANGE`, `INVALID_TRANSITION`, `ASSIGNEE_REQUIRED`,
`NOTE_REQUIRED`, `NOTE_TOO_LONG`, `CLOCK_SKEW`, `VERSION_LIMIT`, `INVALID_DUE_DATE`,
`DUE_DATE_IN_PAST`, `UNASSIGN_NOT_ALLOWED`, `ASSIGNEE_NOT_FOUND`, `ASSIGNEE_INACTIVE`. One
mapper (`src/server/services/result.ts`, `HTTP_STATUS`) converts them: field-level rule failures
(`NOTE_REQUIRED`, `NOTE_TOO_LONG`, `INVALID_DUE_DATE`, `DUE_DATE_IN_PAST`, `ASSIGNEE_NOT_FOUND`,
`ASSIGNEE_INACTIVE`, and an inactive service area) become `400 VALIDATION_ERROR` with
`fieldErrors` for that field; `VERSION_CONFLICT` becomes `409 CONFLICT`; `CLOCK_SKEW` is a server
fault (`500`). Server Actions return
`{ ok: true, data } | { ok: false, error }` using the same codes. Stack traces and raw database
errors are never returned to clients.
