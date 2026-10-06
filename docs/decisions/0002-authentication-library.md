# ADR 0002 — Authentication library and login rate limiting

- **Status:** Accepted; implemented in Phase 4A (backend). UI follows in Phase 4B.
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
rule for the email sign-in endpoint. The initial target was 5 attempts per 60 seconds per client
IP; as implemented in Phase 4A there is **no per-client identity**: all clients share one bucket
(see "Implementation" below).

Documented limitations:

- In-memory counters reset on server restart and are not shared between processes. This is
  acceptable for a single-process local demo, not for a horizontally scaled deployment.
- No client IP header is trusted, so every client shares one sign-in bucket: anyone can lock out
  all sign-ins for about a minute (shared lockout risk). This is a local-demo limitation; a
  deployment must configure a trusted proxy header and `trustedProxies` explicitly.
- Tests do not raise the limit: each test uses an isolated test-only identity header, and a
  dedicated test exercises the production identity configuration.

**Production-hardening follow-up:** move counters to shared storage (Better Auth supports database
or secondary storage) and add per-account lockout and alerting.

## Consequences

- One maintained library covers sessions, password hashing, CSRF protections, and rate limiting.
- Better Auth defines its own `user`, `session`, `account`, and `verification` tables; the domain
  `User` model extends Better Auth's user table rather than duplicating it.
- If Phase 4 reveals an incompatibility with Next.js 16.3 or Prisma 7.10 that changes this design,
  work stops for a decision before proceeding.

## Implementation (Phase 4A, Better Auth 1.7.7)

Configuration lives in `src/server/auth.ts`. Every option below was checked against the pinned
1.7.7 source and its option types, and against the Better Auth documentation (options
reference, Next.js integration, database hooks).

| Concern             | Setting                                                                                                      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in / sign-up   | `emailAndPassword.enabled`, `disableSignUp: true`, `minPasswordLength: 12`                                   | Sign-up also returns 404 through `disabledPaths`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Unused endpoints    | `disabledPaths` (17 paths, `DISABLED_AUTH_PATHS`)                                                            | Includes `/update-user`, `/change-password`, `/change-email`, password reset, verification, social, token, and `/delete-user`; the handler answers 404. Server-side `auth.api` calls bypass `disabledPaths`, so field protection does not rely on it alone.                                                                                                                                                                                                                                                                                                                                                                         |
| Server-owned fields | `user.additionalFields.role` / `isActive` with `input: false`                                                | Better Auth rejects truthy client input with `FIELD_NOT_ALLOWED`; extra fields on sign-in are ignored (stored values unchanged).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Generic failures    | built in                                                                                                     | Unknown email, missing password, and wrong password all return 401 `INVALID_EMAIL_OR_PASSWORD`; the unknown-user path still hashes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Inactive users      | `databaseHooks.session.create.before` throws the same `INVALID_EMAIL_OR_PASSWORD` error                      | Identical response to a wrong password. Users deactivated after sign-in are denied on the next request by `src/server/session.ts` (no cookie cache; every read hits the database).                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Sessions            | `expiresIn: 8h`, `updateAge: 1h`, `cookieCache: { enabled: false }`                                          | **Rolling, not a hard maximum lifetime:** the auth HTTP handler (for example `GET /api/auth/get-session`) extends a session older than one hour to a fresh 8 hours and re-issues the cookie. Server-side reads use `disableRefresh`, so rendering never refreshes or extends a session and never sets cookies; Better Auth may delete an already-expired session row when reading it.                                                                                                                                                                                                                                               |
| Cookies             | HttpOnly, `SameSite=Lax`; `useSecureCookies` = `BETTER_AUTH_URL` is `https://`                               | Local `http://localhost`: no `Secure` attribute. Production HTTPS: `Secure` with the `__Secure-` name prefix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| CSRF / origin       | `trustedOrigins: [origin of BETTER_AUTH_URL]`, `disableCSRFCheck: false`, `disableOriginCheck: false`        | Set explicitly because Better Auth skips origin checks in test environments by default. Untrusted `Origin` and cross-site Fetch-Metadata requests receive 403.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Login rate limit    | `rateLimit: { enabled: true, storage: "memory", customRules: { "/sign-in/email": { window: 60, max: 5 } } }` | Enforced only by the HTTP handler (not by server-side `auth.api` calls), which is why login must post to `/api/auth/sign-in/email`. In the pinned limiter, the limiter counts every request to `POST /api/auth/sign-in/email` that reaches the handler (successful, failed, malformed, or later rejected by the origin check) in one bucket shared by all clients. After 5 allowed requests, each less than 60 s after the previous allowed one, further sign-in requests receive 429 until 60 s have passed since the last allowed request; 429 responses are not counted.                                                         |
| Client identity     | `advanced.ipAddress.ipAddressHeaders: []`                                                                    | Better Auth trusts `x-forwarded-for` by default; here no client-supplied header is trusted, so headers cannot select or bypass the limiter key. Consequence: **one bucket shared by all clients** (`127.0.0.1` in development and test; Better Auth's shared fallback key in production, with a one-time warning), so any client can lock out every sign-in for about a minute. Local-demo limitation, **not deployment-ready**: a deployment needs an explicitly trusted proxy/IP configuration (trusted header plus `trustedProxies`). Separate per-client buckets exist only in tests, which inject a test-only identity header. |
| Telemetry           | `telemetry: { enabled: false }`                                                                              | Already off by default in 1.7.7 unless `BETTER_AUTH_TELEMETRY` is set; never set here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Logging             | `logger: { level: "warn", log: logAuthEvent }`                                                               | Extra log arguments are dropped; messages are scrubbed of URLs with credentials, emails, and long opaque values (`src/server/auth-log.ts`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

Provisioning (`scripts/lib/auth-users.ts`) uses Better Auth's public `hashPassword`
(`better-auth/crypto`) and the mapping its email sign-in requires: an `accounts` row with
`providerId = "credential"` and `accountId = users.id`. No sign-up path is re-enabled.

Limits: the in-memory limiter is per process, resets on restart, and is shared by all clients
(shared lockout risk, see above); the raw
`GET /api/auth/get-session` endpoint still returns a deactivated user's session data (with
`isActive: false`), which application authorization refuses. Revoking sessions on deactivation
belongs with admin user management (later phase). Every protected application API handler must
call `authorize()` or an equivalent server-side checked entry point; a session response or cookie
alone is not authorization.
