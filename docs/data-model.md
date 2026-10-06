# Data Model

Status: **Implemented in Phase 2** (`prisma/schema.prisma`, migrations in `prisma/migrations/`).
Better Auth's session, account, and verification tables are added in Phase 4.

Database: PostgreSQL 16.15. ORM: Prisma 7.10 with the `@prisma/adapter-pg` driver adapter
(see [ADR 0003](decisions/0003-database-and-prisma.md)).

## Naming

Prisma models and fields use camelCase (`WorkOrder.dueAt`); database objects use snake_case via
`@@map` / `@map` (`work_orders.due_at`) so hand-written SQL (constraints now, analytics later) reads
naturally. Better Auth's Prisma adapter works with Prisma model and field names, so the mapping is
transparent to it.

## Enums

PostgreSQL orders enum values by declaration order, so `ORDER BY priority` and `ORDER BY status`
work without a lookup table (verified by an integration test).

| Prisma enum / DB type                   | Values                                                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `Role` / `role`                         | `ADMIN`, `TEAM_MEMBER`                                                                                                      |
| `WorkOrderStatus` / `work_order_status` | `OPEN`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `CANCELLED`                                                                  |
| `Priority` / `priority`                 | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`                                                                                         |
| `ActivityType` / `activity_type`        | `CREATED`, `STATUS_CHANGED`, `ASSIGNEE_CHANGED`, `PRIORITY_CHANGED`, `DUE_DATE_CHANGED`, `DETAILS_UPDATED`, `COMMENT_ADDED` |

Completion, cancellation, reopening, and restoration are all `STATUS_CHANGED` with typed
`from_status` / `to_status` columns.

All timestamps are `timestamptz(3)` (stored in UTC).

## Tables

### users (`User`)

Better Auth 1.7.7 core user fields (verified against its source before the initial migration) plus
domain fields.

| Column           | Type        | Notes                                                                            |
| ---------------- | ----------- | -------------------------------------------------------------------------------- |
| `id`             | text        | PK; Better Auth supplies its own IDs, `cuid()` default otherwise                 |
| `name`           | text        | required                                                                         |
| `email`          | text        | **unique**; CHECK lowercase (Better Auth lowercases on sign-up and sign-in)      |
| `email_verified` | boolean     | default `false`                                                                  |
| `image`          | text?       | unused in the MVP                                                                |
| `role`           | `role`      | default `TEAM_MEMBER` (Better Auth additional field, `input: false`, in Phase 4) |
| `is_active`      | boolean     | default `true`; inactive users cannot sign in or be assigned                     |
| `created_at`     | timestamptz |                                                                                  |
| `updated_at`     | timestamptz |                                                                                  |

Index: `(role, is_active)`.

### service_areas (`ServiceArea`)

| Column       | Type        | Notes                       |
| ------------ | ----------- | --------------------------- |
| `id`         | text        | PK                          |
| `name`       | varchar(80) | **unique**; CHECK not blank |
| `is_active`  | boolean     | default `true`              |
| `created_at` | timestamptz |                             |

### work_orders (`WorkOrder`)

| Column            | Type                | Notes                                                                      |
| ----------------- | ------------------- | -------------------------------------------------------------------------- |
| `id`              | text                | PK (internal)                                                              |
| `number`          | serial              | **unique**; displayed as `WO-` + 6-digit pad                               |
| `title`           | varchar(120)        | CHECK 3–120 chars after trimming                                           |
| `description`     | text                | CHECK 1–5000 chars after trimming (required, D6)                           |
| `status`          | `work_order_status` | default `OPEN`                                                             |
| `priority`        | `priority`          | default `MEDIUM`                                                           |
| `service_area_id` | text                | FK → service_areas, `ON DELETE RESTRICT`                                   |
| `due_at`          | timestamptz         | required (D6); "not in the past" is an application rule (depends on `now`) |
| `assignee_id`     | text?               | FK → users, `ON DELETE RESTRICT`                                           |
| `created_by_id`   | text                | FK → users, `ON DELETE RESTRICT`                                           |
| `version`         | integer             | default 0; CHECK ≥ 0; optimistic concurrency token                         |
| `created_at`      | timestamptz         |                                                                            |
| `updated_at`      | timestamptz         | set by Prisma (`@updatedAt`)                                               |
| `completed_at`    | timestamptz?        |                                                                            |
| `cancelled_at`    | timestamptz?        |                                                                            |

### work_order_comments (`WorkOrderComment`)

| Column          | Type        | Notes                                  |
| --------------- | ----------- | -------------------------------------- |
| `id`            | text        | PK                                     |
| `work_order_id` | text        | FK → work_orders, `ON DELETE RESTRICT` |
| `author_id`     | text        | FK → users, `ON DELETE RESTRICT`       |
| `body`          | text        | CHECK 1–2000 chars after trimming      |
| `created_at`    | timestamptz |                                        |

Append-only (trigger). Comments are immutable in the MVP (D13).

### work_order_activities (`WorkOrderActivity`)

| Column          | Type                 | Notes                                                                         |
| --------------- | -------------------- | ----------------------------------------------------------------------------- |
| `id`            | text                 | PK                                                                            |
| `work_order_id` | text                 | FK → work_orders, `ON DELETE RESTRICT`                                        |
| `actor_id`      | text                 | FK → users, `ON DELETE RESTRICT`                                              |
| `type`          | `activity_type`      |                                                                               |
| `from_status`   | `work_order_status`? |                                                                               |
| `to_status`     | `work_order_status`? |                                                                               |
| `changes`       | jsonb?               | structured before/after, e.g. `{"priority":{"from":"LOW","to":"HIGH"}}`       |
| `description`   | varchar(500)         | CHECK not blank                                                               |
| `comment_id`    | text?                | **unique** FK → work_order_comments (comment, BLOCKED note, or cancel reason) |
| `created_at`    | timestamptz          |                                                                               |

Append-only (trigger).

### sessions, accounts, verifications (Better Auth, Phase 4A)

Added by the additive migration `20261006020855_add_auth_tables`; no existing table changed.
Field names match Better Auth 1.7.7's core schema; columns are snake_case `timestamptz(3)`.

| Table           | Key columns                                                                             | Constraints                                                                             |
| --------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `sessions`      | `token` (opaque cookie value), `expires_at`, `ip_address`, `user_agent`, `user_id`      | `token` unique; `user_id` indexed, FK → users `ON DELETE CASCADE`                       |
| `accounts`      | `provider_id`, `account_id`, `password` (hash), OAuth token columns (unused), `user_id` | unique (`provider_id`, `account_id`); `user_id` indexed, FK → users `ON DELETE CASCADE` |
| `verifications` | `identifier`, `value`, `expires_at`                                                     | `identifier` indexed (unused in the MVP)                                                |

Email/password users have one `accounts` row with `provider_id = 'credential'` and
`account_id = users.id`. Users are deactivated rather than deleted (domain tables restrict deletes).

## Constraints added in migration SQL

Prisma's schema language cannot express CHECK constraints, functions, or triggers, so they are
hand-written in `prisma/migrations/20261006004807_init/migration.sql` (and the follow-up
`20261006005042_audit_trigger_error_code`). Each is covered by `tests/integration/db-constraints.test.ts`.

| Constraint                                          | Rule                                                             |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `users_email_lowercase_check`                       | `email = lower(email)`                                           |
| `service_areas_name_not_blank_check`                | trimmed name not empty                                           |
| `work_orders_title_length_check`                    | trimmed title 3–120 chars                                        |
| `work_orders_description_length_check`              | trimmed description 1–5000 chars                                 |
| `work_orders_version_nonnegative_check`             | `version >= 0`                                                   |
| `work_orders_completed_at_matches_status_check`     | `completed_at` set exactly when `COMPLETED`                      |
| `work_orders_cancelled_at_matches_status_check`     | `cancelled_at` set exactly when `CANCELLED`                      |
| `work_orders_assignee_required_check`               | `IN_PROGRESS`, `BLOCKED`, `COMPLETED` require `assignee_id` (D6) |
| `work_orders_completed_after_created_check`         | `completed_at >= created_at`                                     |
| `work_orders_cancelled_after_created_check`         | `cancelled_at >= created_at`                                     |
| `work_order_comments_body_length_check`             | trimmed body 1–2000 chars                                        |
| `work_order_activities_status_change_check`         | `STATUS_CHANGED` needs distinct `from_status` and `to_status`    |
| `work_order_activities_comment_required_check`      | `COMMENT_ADDED` needs `comment_id`                               |
| `work_order_activities_description_not_blank_check` | trimmed description not empty                                    |

### Append-only triggers (P3)

`work_order_comments_append_only` and `work_order_activities_append_only` run
`prevent_audit_record_mutation()` `BEFORE UPDATE OR DELETE … FOR EACH ROW`, raising
`<table> rows are append-only (<operation> is not allowed)` with SQLSTATE `P0001`.

**Limits:** row triggers do not fire for `TRUNCATE` (used by guarded test cleanup), and any role
with sufficient privileges can disable or drop them. They protect against application bugs and
accidental edits; they are **not** a tamper-proof audit system. A tamper-evident trail would need
separate privileges, hash chaining, or external log shipping (out of scope for the MVP).

### Prisma and custom SQL

- Prisma does not model these objects: it neither generates nor removes them, and `prisma db pull`
  will not reproduce them in `schema.prisma`.
- Observed in Phase 2: after applying the migrations, a second `prisma migrate dev` reported "Already
  in sync", because the shadow database replays the same migration files.
- Not guaranteed: if someone changes or drops these objects directly in a database, Prisma's drift
  detection may not report it. Schema-only workflows (`prisma db push`, `migrate diff` from the
  schema file) would create a database **without** them. The project therefore uses migrations only
  (never `db push`), and the integration tests are the authoritative check that the constraints and
  triggers exist and behave.

## Indexes

| Index                                                      | Supports                                           |
| ---------------------------------------------------------- | -------------------------------------------------- |
| `work_orders_status_due_at_idx`                            | overdue count, Needs Attention, default list sort  |
| `work_orders_assignee_id_status_idx`                       | "my work", workload by assignee                    |
| `work_orders_priority_status_idx`                          | high-priority KPI, priority filter                 |
| `work_orders_service_area_id_idx`                          | service-area filter and join                       |
| `work_orders_created_by_id_idx`                            | FK lookups (restrict checks on user changes)       |
| `work_orders_created_at_idx`, `work_orders_updated_at_idx` | sorting, completion-rate window                    |
| `work_orders_completed_at_idx`                             | completion trend, average time to completion       |
| `work_order_comments_work_order_id_created_at_idx`         | comment thread                                     |
| `work_order_comments_author_id_idx`                        | FK lookups                                         |
| `work_order_activities_work_order_id_created_at_idx`       | timeline                                           |
| `work_order_activities_created_at_idx`                     | recent-activity feed                               |
| `work_order_activities_type_to_status_created_at_idx`      | completion reconciliation, status-change reporting |
| `work_order_activities_actor_id_idx`                       | FK lookups                                         |
| `users_role_is_active_idx`                                 | assignee lookup (active team members)              |

Unique: `users_email_key`, `work_orders_number_key`, `service_areas_name_key`,
`work_order_activities_comment_id_key`. Trigram search index: deferred (should-have #5).

## Audit-trail approach

- Every service mutation (Phase 5) updates `work_orders` and inserts its `work_order_activities` rows
  in one Prisma transaction. The application writes activity (not a database trigger) because it
  knows the acting user; integration tests will assert the expected activity for every mutation.
- Activity and comments are append-only (application has no update/delete paths; triggers block
  them at the database). Work orders are never hard-deleted (`ON DELETE RESTRICT` from audit rows).
- Optimistic concurrency: updates use `WHERE id = ? AND version = ?` and increment `version`; zero
  affected rows yields `409 CONFLICT`.
- **Overdue is never stored.** It is always derived:
  `due_at < now AND status IN ('OPEN','IN_PROGRESS','BLOCKED')`.
