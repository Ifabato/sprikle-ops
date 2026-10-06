# Routes and API

Status: **Approved design.** Phase 1 implements only `GET /api/health` (without a database check).

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
- Every response carries an `x-request-id` header (from Phase 6).

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
| `INTERNAL_ERROR`     | 500  | unexpected; details logged server-side with `requestId` |

The domain layer throws typed errors; one mapper converts them to responses. Server Actions return
`{ ok: true, data } | { ok: false, error }` using the same codes. Stack traces and raw database
errors are never returned to clients.
