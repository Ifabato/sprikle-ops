# Test Strategy

Status: **Draft (Phase 1).** Expanded as each layer is introduced.

## Goals

- Business rules are proven by fast, deterministic unit tests.
- Authorization and audit behavior are proven against a real PostgreSQL database.
- The five critical user journeys are proven end to end in a real browser.
- Every acceptance criterion in [product-requirements.md](product-requirements.md) maps to at least
  one automated test (test names reference `AC-n`).
- No test depends on wall-clock time, network services, or test execution order.

## Layers

| Layer       | Tool                            | Location             | Database                             | Scope                                                                                                                   | Introduced    |
| ----------- | ------------------------------- | -------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------- |
| Unit        | Vitest                          | `tests/unit/`        | none                                 | Pure logic: env validation, state transitions, overdue/date logic, reference IDs, permissions, metric math, Zod schemas | Phase 1, 3    |
| Integration | Vitest                          | `tests/integration/` | `sprikle_ops_test` (D12)             | Service layer, DB constraints, authorization-sensitive workflows, audit-trail writes, metric queries, route handlers    | Phase 2, 5, 6 |
| End-to-end  | Playwright (Chromium only, D11) | `e2e/`               | `sprikle_ops_test`, reseeded per run | Critical journeys and negative paths through the real UI                                                                | Phase 11      |

## Determinism rules

- Domain functions accept `now` as a parameter; unit tests use fixed instants and `vi.setSystemTime`
  where a framework reads the clock.
- Seed data uses a fixed PRNG seed and dates relative to a configurable anchor.
- Integration tests run serially against `sprikle_ops_test`, truncating tables between files.
- E2E runs against a production build (`next build && next start`) with a freshly reset and seeded
  test database.

## Planned end-to-end journeys

1. Login and protected-route behavior (AC-1).
2. Admin creates a work order (AC-2).
3. Admin assigns and updates a work order (AC-3, AC-4).
4. Team member updates an assigned work order and adds a comment (AC-5, AC-6).
5. Dashboard or analytics reflects changed data (AC-8, AC-9).

Negative paths: invalid form submission, unauthorized route/API access (401/403/404), prohibited
status transition (422), stale version (409).

## Commands

| Command                 | Purpose                              | Available from |
| ----------------------- | ------------------------------------ | -------------- |
| `pnpm test`             | all Vitest suites                    | Phase 1        |
| `pnpm test:unit`        | unit tests only                      | Phase 1        |
| `pnpm test:integration` | integration tests (needs DB)         | Phase 2        |
| `pnpm test:e2e`         | Playwright suite                     | Phase 11       |
| `pnpm check`            | format, lint, typecheck, test, build | Phase 1        |

## Current coverage (Phase 1)

- `tests/unit/env.test.ts`: defaults, valid and invalid time zones, invalid `NODE_ENV`, and that
  error messages never echo supplied values.
- `tests/unit/health-route.test.ts`: `200` with `no-store`, and `503` without leaking configuration
  details when the environment is invalid.
