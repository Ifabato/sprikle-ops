# Sprikle Ops

Sprikle Ops is an operations intelligence and workflow management platform for small service
businesses. It gives an operations manager one accountable system for tracking work orders,
assigning work, monitoring service execution, spotting risk (overdue, blocked, and high-priority
work), and measuring performance with data rather than guesswork.

> **Status: work in progress.** Phase 1 (project foundation) is complete. Authentication, the
> database, work orders, the dashboard, and analytics are added in later phases. See
> [docs/implementation-log.md](docs/implementation-log.md) for progress and verification results.

## Prerequisites (macOS)

- Node.js 24 (see `.nvmrc`)
- pnpm 10.34.6 through Corepack: `corepack enable pnpm` (version pinned in `package.json`)
- Docker Desktop with 2–3 GB of memory allocated (required from Phase 2 for PostgreSQL)

## Local setup (work in progress)

These steps cover the current foundation only; database and sign-in setup will be added as those
phases land.

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm dev                       # http://localhost:3000
curl http://localhost:3000/api/health
pnpm check                     # format, lint, typecheck, tests, production build
```

## Documentation

- [Product requirements](docs/product-requirements.md)
- [Information architecture](docs/information-architecture.md)
- [Data model](docs/data-model.md)
- [Authorization](docs/authorization.md)
- [Routes and API](docs/api.md)
- [Metrics dictionary](docs/metrics.md)
- [Test strategy](docs/test-strategy.md)
- [Architecture decision records](docs/decisions/)
