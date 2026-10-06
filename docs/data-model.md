# Data Model

Status: **Approved design.** Implemented in Phase 2 (Prisma schema and migrations). This document is
updated if the implemented schema differs.

Database: PostgreSQL 16. ORM: Prisma 7 (see [ADR 0001](decisions/0001-stack-and-tooling.md)).

## Enums

PostgreSQL orders enum values by declaration order, so `Priority` and `WorkOrderStatus` are declared
in a meaningful order and `ORDER BY priority` / `ORDER BY status` work without a lookup table.

| Enum              | Values                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `Role`            | `ADMIN`, `TEAM_MEMBER`                                                                                                      |
| `WorkOrderStatus` | `OPEN`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `CANCELLED`                                                                  |
| `Priority`        | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`                                                                                         |
| `ActivityType`    | `CREATED`, `STATUS_CHANGED`, `ASSIGNEE_CHANGED`, `PRIORITY_CHANGED`, `DUE_DATE_CHANGED`, `DETAILS_UPDATED`, `COMMENT_ADDED` |

Completion, cancellation, reopening, and restoration are all `STATUS_CHANGED` with typed
`fromStatus` / `toStatus` columns, which keeps reporting queries simple
(`WHERE type = 'STATUS_CHANGED' AND "toStatus" = 'COMPLETED'`).

## Tables

### User (shared with Better Auth)

| Column          | Type        | Notes                                                        |
| --------------- | ----------- | ------------------------------------------------------------ |
| `id`            | text (cuid) | PK                                                           |
| `name`          | text        | required                                                     |
| `email`         | text        | **unique**, stored lowercase                                 |
| `emailVerified` | boolean     | Better Auth field                                            |
| `image`         | text?       | Better Auth field (unused in MVP)                            |
| `role`          | `Role`      | default `TEAM_MEMBER`                                        |
| `isActive`      | boolean     | default `true`; inactive users cannot sign in or be assigned |
| `createdAt`     | timestamptz |                                                              |
| `updatedAt`     | timestamptz |                                                              |

### Session, Account, Verification (Better Auth)

Standard Better Auth tables. `Account` stores the credential password hash. All reference `User`
with cascade delete (users are deactivated, not deleted, in normal operation).

### ServiceArea

| Column      | Type        | Notes          |
| ----------- | ----------- | -------------- |
| `id`        | text (cuid) | PK             |
| `name`      | text        | **unique**     |
| `isActive`  | boolean     | default `true` |
| `createdAt` | timestamptz |                |

Seeded with about five areas. No management UI in the MVP (D5).

### WorkOrder

| Column          | Type              | Notes                                                              |
| --------------- | ----------------- | ------------------------------------------------------------------ |
| `id`            | text (cuid)       | PK (internal)                                                      |
| `number`        | integer           | autoincrement, **unique**; displayed as `WO-` + 6-digit pad        |
| `title`         | varchar(120)      | 3–120 chars                                                        |
| `description`   | text              | 1–5000 chars (required, D6)                                        |
| `status`        | `WorkOrderStatus` | default `OPEN`                                                     |
| `priority`      | `Priority`        | default `MEDIUM`                                                   |
| `serviceAreaId` | text              | FK → ServiceArea, `ON DELETE RESTRICT`                             |
| `dueAt`         | timestamptz       | required (D6); date-only input = end of day in `APP_TIMEZONE` (D7) |
| `assigneeId`    | text?             | FK → User, `ON DELETE RESTRICT`                                    |
| `createdById`   | text              | FK → User, `ON DELETE RESTRICT`                                    |
| `version`       | integer           | default 0; incremented on every mutation                           |
| `createdAt`     | timestamptz       |                                                                    |
| `updatedAt`     | timestamptz       |                                                                    |
| `completedAt`   | timestamptz?      | set when entering `COMPLETED`, cleared when leaving it             |
| `cancelledAt`   | timestamptz?      | set when entering `CANCELLED`, cleared when restored               |

**CHECK constraints** (raw SQL in the migration; Prisma's schema language cannot express them):

- `(status = 'COMPLETED') = ("completedAt" IS NOT NULL)`
- `(status = 'CANCELLED') = ("cancelledAt" IS NOT NULL)`
- `status NOT IN ('IN_PROGRESS','BLOCKED','COMPLETED') OR "assigneeId" IS NOT NULL`
- `char_length(title) BETWEEN 3 AND 120`
- `char_length(description) BETWEEN 1 AND 5000`

"Due date not in the past" is an application rule (it depends on `now` at the time of the change),
not a database constraint.

### WorkOrderComment

| Column        | Type        | Notes                                |
| ------------- | ----------- | ------------------------------------ |
| `id`          | text (cuid) | PK                                   |
| `workOrderId` | text        | FK → WorkOrder, `ON DELETE RESTRICT` |
| `authorId`    | text        | FK → User, `ON DELETE RESTRICT`      |
| `body`        | text        | CHECK 1–2000 chars                   |
| `createdAt`   | timestamptz |                                      |

Immutable in the MVP (D13): no update or delete code path exists.

### WorkOrderActivity

| Column        | Type               | Notes                                                                      |
| ------------- | ------------------ | -------------------------------------------------------------------------- |
| `id`          | text (cuid)        | PK                                                                         |
| `workOrderId` | text               | FK → WorkOrder, `ON DELETE RESTRICT`                                       |
| `actorId`     | text               | FK → User, `ON DELETE RESTRICT`                                            |
| `type`        | `ActivityType`     |                                                                            |
| `fromStatus`  | `WorkOrderStatus`? | for `STATUS_CHANGED`                                                       |
| `toStatus`    | `WorkOrderStatus`? | for `STATUS_CHANGED` (and `CREATED`)                                       |
| `changes`     | jsonb?             | structured before/after, e.g. `{"priority":{"from":"LOW","to":"HIGH"}}`    |
| `description` | text               | human-readable summary                                                     |
| `commentId`   | text?              | FK → WorkOrderComment (for `COMMENT_ADDED`, BLOCKED notes, cancel reasons) |
| `createdAt`   | timestamptz        |                                                                            |

## Indexes

| Index                                           | Supports                                          |
| ----------------------------------------------- | ------------------------------------------------- |
| `WorkOrder(status, dueAt)`                      | overdue count, Needs Attention, default list sort |
| `WorkOrder(assigneeId, status)`                 | "my work", workload by assignee                   |
| `WorkOrder(priority, status)`                   | high-priority KPI, priority filter                |
| `WorkOrder(serviceAreaId)`                      | service-area filter and join                      |
| `WorkOrder(createdAt)`, `WorkOrder(updatedAt)`  | sorting, completion-rate window                   |
| `WorkOrder(completedAt)`                        | completion trend, average time to completion      |
| `WorkOrderActivity(workOrderId, createdAt)`     | timeline                                          |
| `WorkOrderActivity(createdAt)`                  | recent-activity feed                              |
| `WorkOrderComment(workOrderId, createdAt)`      | comment thread                                    |
| Trigram GIN on title, description (should-have) | `ILIKE` search                                    |

Unique indexes: `User.email`, `WorkOrder.number`, `ServiceArea.name`.

## Audit-trail approach

- Every service mutation updates `WorkOrder` and inserts its `WorkOrderActivity` rows inside one
  Prisma transaction. The application writes activity (rather than a database trigger) because it
  knows the acting user; integration tests assert the expected activity for every mutation.
- Activity rows are append-only: no update or delete code path exists. Work orders are never
  hard-deleted.
- Optimistic concurrency: updates use `WHERE id = ? AND version = ?` and increment `version`; zero
  affected rows yields `409 CONFLICT`.
- **Overdue is never stored.** It is always derived:
  `dueAt < now AND status IN ('OPEN','IN_PROGRESS','BLOCKED')`.
