# Naming and legacy identifiers

The product is **Brindle** (repository: https://github.com/Ifabato/brindle). It was developed
under the working name "Sprikle Ops" until 2026-10-09. Every product-facing name (interface text,
page titles and metadata, accessible labels, the wordmark, the package name, the health endpoint's
`service` field, and current documentation) uses Brindle.

A few **implementation identifiers** keep the earlier `sprikle` spelling on purpose. Renaming them
would detach or recreate existing local data, or would break accounts that already exist, for no
user-visible benefit. They are not the product name.

| Identifier                                                        | Where                                                                               | Why it stays                                                                                                                                                                                  |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Databases `sprikle_ops` (development), `sprikle_ops_test` (tests) | `.env.example`, `docker/postgres/init/`, CI, seed and data scripts                  | Existing local databases have these names. The test-database guard (`tests/helpers/database-safety.ts`) requires exactly `sprikle_ops_test`; changing it would weaken a verified safety rule. |
| Database user `sprikle`                                           | `.env.example` (`POSTGRES_USER`), CI                                                | Created when the local data volume was first initialized; existing `.env` files and containers use it.                                                                                        |
| Compose project `sprikle-ops` and volume `sprikle-ops_pgdata`     | `docker-compose.yml` (`name:`)                                                      | Changing the project name would start a new, empty database and orphan the existing volume.                                                                                                   |
| Demo and test account emails `*@sprikle.test`                     | `scripts/lib/auth-users.ts`, `e2e/users.ts`, tests, README                          | The demo accounts already exist in local databases with these emails; `.test` is a reserved, non-routable domain.                                                                             |
| Prisma migrations                                                 | `prisma/migrations/`                                                                | Applied migrations are immutable history; none contains the product name in schema objects.                                                                                                   |
| Historical records                                                | Git history, `docs/implementation-log.md` entries before 2026-10-09, ADRs 0001–0003 | Records of what was decided and done at the time; not rewritten.                                                                                                                              |

Identifiers that had no stored state were renamed with the product: in-process singleton keys
(`brindleAuth`, `brindlePrisma`), the PostgreSQL `application_name` connection label (`brindle`), the
test-only client header (`x-brindle-test-client`), the test-process variable
`BRINDLE_DEVELOPMENT_DATABASE_URL`, and the URL-parsing placeholder host (`brindle.invalid`).
