# Sprikle Ops

Sprikle Ops is an operations intelligence and workflow management platform for small service
businesses. It gives an operations manager one accountable system for tracking work orders,
assigning work, monitoring service execution, spotting risk (overdue, blocked, and high-priority
work), and measuring performance with data rather than guesswork.

> **Status: work in progress.** Phases 1–3, the design context, and the authentication backend
> (Phase 4A) are complete. The app shell, work orders, the dashboard, and analytics are added in
> later phases. See
> [docs/implementation-log.md](docs/implementation-log.md) for progress and verification results.

## Prerequisites (macOS)

- Node.js 24 (see `.nvmrc`)
- pnpm 10.34.6 through Corepack: `corepack enable pnpm` (version pinned in `package.json`)
- Docker Desktop with 2–3 GB of memory allocated (PostgreSQL 16 runs in Docker Compose)

## Local setup (work in progress)

These steps cover the foundation, database, and authentication backend; the sign-in page and app
shell arrive in Phase 4B.

```bash
pnpm install --frozen-lockfile   # also generates the Prisma client
pnpm env:init                    # creates .env with a random local DB password; never overwrites
pnpm db:up                       # starts PostgreSQL on 127.0.0.1 and waits until healthy
pnpm env:init --add-missing      # appends new keys (auth secret, demo password) to an existing .env
pnpm db:migrate                  # applies migrations to the development database
pnpm db:seed:auth                # creates the demo accounts below (existing accounts are left unchanged)
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

## Demo accounts (local only)

`pnpm db:seed:auth` creates these synthetic accounts in the local development database:

| Email                   | Role        | Status                        |
| ----------------------- | ----------- | ----------------------------- |
| `admin@sprikle.test`    | Admin       | active                        |
| `tech.one@sprikle.test` | Team member | active                        |
| `tech.two@sprikle.test` | Team member | active                        |
| `inactive@sprikle.test` | Team member | inactive (sign-in is refused) |

They share one password, generated into your ignored `.env` as `SEED_DEMO_PASSWORD`; it is never
committed. View it locally with `grep '^SEED_DEMO_PASSWORD=' .env`. The sign-in page arrives in
Phase 4B.

## Documentation

- [Product requirements](docs/product-requirements.md)
- [Information architecture](docs/information-architecture.md)
- [Data model](docs/data-model.md)
- [Authorization](docs/authorization.md)
- [Routes and API](docs/api.md)
- [Metrics dictionary](docs/metrics.md)
- [Test strategy](docs/test-strategy.md)
- [Architecture decision records](docs/decisions/)
