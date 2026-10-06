# ADR 0002 — Authentication library and login rate limiting

- **Status:** Accepted (implementation in Phase 4)
- **Date:** 2026-10-05
- **Decision:** D1

## Context

The MVP needs credential (email and password) login with two roles, database-backed sessions,
seeded demo accounts, and no public sign-up. The project definition named Auth.js "or an equally
well-maintained Next.js-compatible credential authentication solution."

In September 2025 the Auth.js project announced it is now part of Better Auth. Auth.js receives
security patches only, and its maintainers recommend Better Auth for new projects unless stateless
(database-less) sessions are required. Sprikle Ops uses database sessions, so that exception does not
apply.

## Decision

Use **Better Auth 1.7.7** (verified peers: `next ^16`, `react ^19`, `@prisma/client ^7`):

- Email-and-password authentication with Better Auth's built-in password hashing.
- Database-backed sessions stored in PostgreSQL through the Prisma adapter; session cookie is
  httpOnly and `SameSite=Lax`, `Secure` in production.
- Public sign-up **disabled**; accounts are created only by the seed script (and by admin user
  management in a later phase).
- Additional user fields `role` (`ADMIN` | `TEAM_MEMBER`) and `isActive`. Inactive users cannot sign
  in.
- Authorization is enforced by the application ([authorization.md](../authorization.md)), not by the
  auth library.
- Demo accounts use `@sprikle.test` addresses (a reserved test TLD) with the password read from
  `SEED_DEMO_PASSWORD`; credentials appear only in the README.

## Login rate limiting

Requirement: no Redis, third-party service, or extra persistent infrastructure.

**Decision:** use Better Auth's built-in rate limiter with **in-memory storage**, with a stricter
rule for the email sign-in endpoint (initial target: 5 attempts per 60 seconds per client IP;
final values recorded in Phase 4 after verification against Better Auth 1.7.7's API).

Documented limitations:

- In-memory counters reset on server restart and are not shared between processes. This is
  acceptable for a single-process local demo, not for a horizontally scaled deployment.
- Client identification relies on the request IP; behind a proxy, a trusted forwarding header must
  be configured.
- Test environments may raise the limit so E2E runs (many logins from one IP) stay deterministic; a
  dedicated test proves the limiter triggers.

**Production-hardening follow-up:** move counters to shared storage (Better Auth supports database
or secondary storage) and add per-account lockout and alerting.

## Consequences

- One maintained library covers sessions, password hashing, CSRF protections, and rate limiting.
- Better Auth defines its own `user`, `session`, `account`, and `verification` tables; the domain
  `User` model extends Better Auth's user table rather than duplicating it.
- If Phase 4 reveals an incompatibility with Next.js 16.3 or Prisma 7.10 that changes this design,
  work stops for a decision before proceeding.
