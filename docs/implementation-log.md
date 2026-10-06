# Implementation Log

Running checklist and verification record. Each phase is implemented only after explicit approval.

## Phase checklist

| #   | Phase                                           | Status                           |
| --- | ----------------------------------------------- | -------------------------------- |
| 0   | Planning package                                | ✅ Approved 2026-10-05           |
| 1   | Foundation                                      | ✅ Implemented — awaiting review |
| 2   | Database (Compose, Prisma, schema, constraints) | ⏳ Not started                   |
| 3   | Domain logic and validation                     | ⏳ Not started                   |
| 4   | Authentication and app shell                    | ⏳ Not started                   |
| 5   | Services, audit trail, seed                     | ⏳ Not started                   |
| 6   | REST API                                        | ⏳ Not started                   |
| 7   | CI quality gates                                | ⏳ Not started                   |
| 8   | Work-order UI                                   | ⏳ Not started                   |
| 9   | Dashboard                                       | ⏳ Not started                   |
| 10  | Analytics                                       | ⏳ Not started                   |
| 11  | E2E and accessibility                           | ⏳ Not started                   |
| 12  | Documentation and packaging                     | ⏳ Not started                   |

## Approved decisions

D1–D13 approved on 2026-10-05; recorded in
[product-requirements.md](product-requirements.md#5-approved-product-decisions),
[ADR 0001](decisions/0001-stack-and-tooling.md), and [ADR 0002](decisions/0002-authentication-library.md).
Login rate limiting: Better Auth's built-in in-memory limiter, documented in ADR 0002 (no Redis or
extra infrastructure).

---

## Phase 1 — Foundation (2026-10-05)

### Scope delivered

- Hand-built Next.js 16.3.8 App Router foundation (no `create-next-app`, D9).
- Strict TypeScript 6.0.3, Tailwind CSS 4.3.3, ESLint 9 flat config (`eslint-config-next`),
  Prettier with the Tailwind plugin, Vitest 5.
- pnpm 10.34.6 via Corepack, pinned in `package.json` (`packageManager`); exact pins for all direct
  dependencies; `pnpm-lock.yaml` committed-ready.
- Zod-validated environment (`src/lib/env.ts`): `NODE_ENV`, `APP_TIMEZONE` (IANA-validated, default
  `America/New_York`). Errors name the variable but never echo values.
- Public `GET /api/health` (no database yet): `200 {status:"ok"}`, or `503` without details if the
  configuration is invalid; always `Cache-Control: no-store`.
- Planning documents and ADRs 0001–0002; minimal README update (D10).

Not included (by design): authentication, database, Docker Compose, Prisma, UI features, work-order
API routes, CI, deployment.

### Files

Created: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json`, `next.config.ts`,
`postcss.config.mjs`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `vitest.config.ts`,
`.gitignore`, `.editorconfig`, `.nvmrc`, `.env.example`, `src/app/layout.tsx`, `src/app/page.tsx`,
`src/app/globals.css`, `src/app/api/health/route.ts`, `src/lib/env.ts`, `tests/unit/env.test.ts`,
`tests/unit/health-route.test.ts`, `docs/*.md` (8 files), `docs/decisions/0001-stack-and-tooling.md`,
`docs/decisions/0002-authentication-library.md`.

Modified: `README.md`.

Generated, gitignored: `node_modules/`, `.next/`, `next-env.d.ts`.

### Verification results

| Command                                            | Result                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `node -v`                                          | v24.6.0                                                                       |
| `pnpm -v`                                          | 10.34.6                                                                       |
| `pnpm install --frozen-lockfile`                   | ✅ up to date                                                                 |
| `pnpm format:check`                                | ✅ all files formatted                                                        |
| `pnpm lint`                                        | ✅ 0 errors, 0 warnings (`--max-warnings=0`)                                  |
| `pnpm typecheck`                                   | ✅ `next typegen` + `tsc --noEmit` clean                                      |
| `pnpm test`                                        | ✅ 2 files, 7 tests passed                                                    |
| `pnpm build`                                       | ✅ compiled; routes `/` (static), `/_not-found`, `/api/health` (dynamic)      |
| `pnpm start` + `curl -i localhost:3100/api/health` | ✅ `200`, `cache-control: no-store`, no `x-powered-by`                        |
| `curl localhost:3100/`                             | ✅ `200`                                                                      |
| `APP_TIMEZONE=Bad/Zone pnpm start` + `curl`        | ✅ `503 {"status":"error",…,"checks":{"config":"invalid"}}`, value not echoed |

### Issues and deviations

- **pnpm 12 → 10.34.6.** Corepack 0.34.0 (bundled with Node 24.6.0) cannot run pnpm 11+
  (`MODULE_NOT_FOUND …/bin/pnpm.cjs`). Pinned pnpm 10.34.6, the newest compatible stable. See ADR 0001.
- **ESLint 9.39.5 is marked "no longer supported" upstream.** ESLint 10 is not yet supported by the
  React/import/jsx-a11y plugins used by `eslint-config-next` 16.3.8. Tracked in ADR 0001.
- **TypeScript 6.0.3, not 7.0.2**, because `typescript-eslint` supports `<6.1.0`.
- **`prisma` `latest` tag is a release candidate (8.0.0-rc.20)**; Phase 2 will pin 7.10.0.
- **Build-script warning in the existing `node_modules`.** The first install recorded `unrs-resolver`
  as an ignored build before `pnpm-workspace.yaml` existed, so the local install still prints the
  warning. A fresh frozen install in a scratch directory printed no warning. The script is a fallback
  native-binary downloader and is intentionally blocked.
- **Global change:** `corepack enable pnpm` created the shim `/opt/homebrew/bin/pnpm` (approved D2).
