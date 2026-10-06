# Routes and API

Status: **Approved design.** Implemented so far: `GET /api/health` (configuration and database checks, Phase 2).

## Layering

Pages (server components), Server Actions (UI forms), and REST route handlers are thin adapters:

1. Resolve the session (`requireUser()`).
2. Parse input with the shared Zod schema.
3. Call a service function in `src/server/services/` (authorization + business rules + audit).
4. Map the result or a typed domain error to a response.

Business rules live only in `src/domain/` (pure) and `src/server/services/` (I/O).

## Endpoints

| Method and path                             | Access            | Input → Output                                                                                                                                                                              | Phase               |
| ------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `GET /api/health`                           | public            | → `{status, service, time, checks}`; `503` when unhealthy                                                                                                                                   | 1 (config), 2 (+db) |
| `/api/auth/[...all]`                        | public            | Better Auth handler                                                                                                                                                                         | 4                   |
| `GET /api/v1/work-orders`                   | signed in, scoped | query `page, pageSize≤50, q, status[], priority[], assignee (id\|me\|unassigned), serviceAreaId, due (overdue\|today\|week), sort, order` → `{data, page:{page,pageSize,total,totalPages}}` | 6                   |
| `POST /api/v1/work-orders`                  | `ADMIN`           | `CreateWorkOrderInput` → `201 {data}`                                                                                                                                                       | 6                   |
| `GET /api/v1/work-orders/:ref`              | scoped            | → `{data}` with assignee, creator, service area                                                                                                                                             | 6                   |
| `PATCH /api/v1/work-orders/:ref`            | `ADMIN`           | `{version, …fields}` → `{data}` (status not accepted here)                                                                                                                                  | 6                   |
| `POST /api/v1/work-orders/:ref/transitions` | per matrix        | `{version, toStatus, note?}` → `{data}`                                                                                                                                                     | 6                   |
| `GET /api/v1/work-orders/:ref/comments`     | scoped            | → `{data: Comment[]}`                                                                                                                                                                       | 6                   |
| `POST /api/v1/work-orders/:ref/comments`    | scoped            | `{body}` → `201 {data}`                                                                                                                                                                     | 6                   |
| `GET /api/v1/work-orders/:ref/activity`     | scoped            | → `{data: Activity[]}`                                                                                                                                                                      | 6                   |
| `GET /api/v1/metrics/dashboard`             | signed in, scoped | → KPIs, Needs Attention, recent activity, `asOf`                                                                                                                                            | 9                   |
| `GET /api/v1/metrics/analytics?from&to`     | `ADMIN`           | → metrics in [metrics.md](metrics.md)                                                                                                                                                       | 10                  |
| `GET /api/v1/assignees`                     | `ADMIN`           | → active users for assignment                                                                                                                                                               | 6                   |
| `GET /api/v1/service-areas`                 | signed in         | → active service areas                                                                                                                                                                      | 6                   |

Status changes use a separate command endpoint (`/transitions`) rather than a PATCH field so the
state machine is explicit and every change produces exactly one `STATUS_CHANGED` activity. There is
no DELETE endpoint.

## Conventions

- JSON bodies, camelCase keys, ISO-8601 UTC timestamps (`…Z`).
- Work orders are addressed by reference (`WO-000123`) in URLs.
- Authenticated responses send `Cache-Control: no-store`. The health endpoint also sends `no-store`.

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

| Code                 | HTTP | When                                                    |
| -------------------- | ---- | ------------------------------------------------------- |
| `VALIDATION_ERROR`   | 400  | Zod parse failure; `fieldErrors` populated              |
| `UNAUTHENTICATED`    | 401  | no valid session                                        |
| `FORBIDDEN`          | 403  | role not permitted for the action                       |
| `NOT_FOUND`          | 404  | missing, or outside the caller's scope                  |
| `CONFLICT`           | 409  | stale `version`                                         |
| `INVALID_TRANSITION` | 422  | status change not allowed by the matrix                 |
| `NO_CHANGE`          | 422  | transition to the current status                        |
| `INTERNAL_ERROR`     | 500  | unexpected; details logged server-side with `requestId` |

Domain rules (Phase 3) return result codes rather than throwing: `UNAUTHENTICATED`, `NOT_FOUND`,
`FORBIDDEN`, `VERSION_CONFLICT`, `NO_CHANGE`, `INVALID_TRANSITION`, `ASSIGNEE_REQUIRED`,
`NOTE_REQUIRED`, `NOTE_TOO_LONG`, `CLOCK_SKEW`, `VERSION_LIMIT`, `INVALID_DUE_DATE`,
`DUE_DATE_IN_PAST`, `UNASSIGN_NOT_ALLOWED`, `ASSIGNEE_NOT_FOUND`, `ASSIGNEE_INACTIVE`. The exact
HTTP mapping of the rule-specific codes is decided with the route handlers in Phase 6; one mapper
converts them to responses. Server Actions return
`{ ok: true, data } | { ok: false, error }` using the same codes. Stack traces and raw database
errors are never returned to clients.
