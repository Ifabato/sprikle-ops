# Sprikle Ops

Sprikle Ops is an operations intelligence and workflow management platform for small service
businesses. It gives an operations manager one accountable system for tracking work orders,
assigning work, monitoring service execution, spotting risk (overdue, blocked, and high-priority
work), and measuring performance with data rather than guesswork.

> **Status: work in progress.** Phases 1–2 (foundation and database) are complete.
> Authentication, work orders, the dashboard, and analytics are added in later phases. See
> [docs/implementation-log.md](docs/implementation-log.md) for progress and verification results.

## Prerequisites (macOS)

- Node.js 24 (see `.nvmrc`)
- pnpm 10.34.6 through Corepack: `corepack enable pnpm` (version pinned in `package.json`)
- Docker Desktop with 2–3 GB of memory allocated (PostgreSQL 16 runs in Docker Compose)

## Local setup (work in progress)

These steps cover the foundation and database; sign-in setup will be added in Phase 4.

```bash
pnpm install --frozen-lockfile   # also generates the Prisma client
pnpm env:init                    # creates .env with a random local DB password; never overwrites
pnpm db:up                       # starts PostgreSQL on 127.0.0.1 and waits until healthy
pnpm db:migrate                  # applies migrations to the development database
pnpm dev                         # http://localhost:3000 (keep running; use a second terminal below)
curl http://localhost:3000/api/health
```

Checks:

```bash
pnpm check                       # format, lint, typecheck, unit tests, build (no database needed)
pnpm test:integration            # integration tests against sprikle_ops_test (database must be up)
pnpm check:full                  # both
```

> **Warning:** `pnpm db:migrate` runs `prisma migrate dev`, which may ask to reset the development
> database if it detects schema drift. Decline the reset and investigate the drift; never approve it
> automatically.

Database commands read credentials from `.env` themselves; nothing needs to be exported into your
shell. Stop the database with `pnpm db:stop` (data is kept). Do not use `docker compose down -v`,
which deletes the data volume. If the data volume existed before the test database was introduced,
create it once with
`docker compose exec db sh -c 'createdb -U "$POSTGRES_USER" sprikle_ops_test'`.

## Documentation

- [Product requirements](docs/product-requirements.md)
- [Information architecture](docs/information-architecture.md)
- [Data model](docs/data-model.md)
- [Authorization](docs/authorization.md)
- [Routes and API](docs/api.md)
- [Metrics dictionary](docs/metrics.md)
- [Test strategy](docs/test-strategy.md)
- [Architecture decision records](docs/decisions/)
