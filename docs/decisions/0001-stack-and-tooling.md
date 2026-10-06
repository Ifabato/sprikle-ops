# ADR 0001 — Stack, tooling, and pinned versions

- **Status:** Accepted
- **Date:** 2026-10-05
- **Phase:** 1 (Foundation)

## Context

Sprikle Ops is a single-repository full-stack portfolio application developed on an M1 MacBook Air
(8 GB RAM). The stack was fixed by the project definition: Next.js App Router, strict TypeScript,
pnpm, PostgreSQL 16 in Docker Compose, Prisma, Better Auth (ADR 0002), Zod, Tailwind CSS, Vitest,
Playwright, ESLint, Prettier, and GitHub Actions. Constraints: stable releases only (no canary, beta,
RC, experimental, or pre-release packages), exact pins for direct dependencies, a frozen lockfile,
and no global project dependencies.

## Decision

### Runtime and package manager

| Tool    | Version         | Notes                                                                                                               |
| ------- | --------------- | ------------------------------------------------------------------------------------------------------------------- |
| Node.js | 24.x (`.nvmrc`) | Local: 24.6.0. `engines.node` is `>=24.0.0 <25`. Satisfies Next.js (`>=20.9`), Vitest 5 (`^24`), Prisma 7 (`>=24`). |
| pnpm    | **10.34.6**     | Pinned via `packageManager` and run through Corepack (D2). See "Version holds" for why not pnpm 12.                 |

### Direct dependencies installed in Phase 1 (exact pins)

| Package                               | Version | Role                                               |
| ------------------------------------- | ------- | -------------------------------------------------- |
| `next`                                | 16.3.8  | App Router framework                               |
| `react`, `react-dom`                  | 19.3.0  | UI runtime (Next.js peer `^19`)                    |
| `zod`                                 | 4.6.5   | Runtime validation (env now; inputs later)         |
| `typescript`                          | 6.0.3   | Type checking (strict)                             |
| `@types/node`                         | 24.19.1 | Matches the Node 24 runtime                        |
| `@types/react`, `@types/react-dom`    | 19.3.0  | React types                                        |
| `tailwindcss`, `@tailwindcss/postcss` | 4.3.3   | Styling (CSS-first config)                         |
| `eslint`                              | 9.39.5  | Linting (flat config)                              |
| `eslint-config-next`                  | 16.3.8  | Next.js, React, a11y, TypeScript rules             |
| `prettier`                            | 3.9.9   | Formatting                                         |
| `prettier-plugin-tailwindcss`         | 0.8.1   | Class ordering                                     |
| `vitest`                              | 5.0.3   | Unit and integration tests                         |
| `vite`                                | 8.3.2   | Required peer of Vitest 5 (`^6.4 \|\| ^7 \|\| ^8`) |

### Versions selected for later phases (verified compatible, not yet installed)

| Package                                          | Version                                      | Phase | Compatibility evidence                                                                                      |
| ------------------------------------------------ | -------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------- |
| `prisma`, `@prisma/client`, `@prisma/adapter-pg` | 7.10.0 (**installed in Phase 2**)            | 2     | Requires Node `>=24` (ok) and TypeScript `>=5.4` (ok). Better Auth 1.7.7 peer: `prisma ^5 \|\| ^6 \|\| ^7`. |
| `better-auth`                                    | 1.7.7                                        | 4     | Peers: `next ^16`, `react ^19`, `@prisma/client ^7`, `vitest ^5`.                                           |
| `@playwright/test`                               | 1.63.0                                       | 11    | Next.js optional peer `^1.51.1`; Node `>=20`.                                                               |
| PostgreSQL                                       | 16.15 (`postgres:16.15-alpine3.24` + digest) | 2     | **Installed in Phase 2**; see ADR 0003.                                                                     |

Versions are re-checked with `npm view <pkg> dist-tags` at the start of the phase that installs them;
any change is recorded here.

### Version holds (newer `latest` tag deliberately not used)

| Package       | `latest` tag on 2026-10-05 | Chosen  | Reason                                                                                                                                                                                                                     |
| ------------- | -------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typescript`  | 7.0.2                      | 6.0.3   | `typescript-eslint` (a dependency of `eslint-config-next`) supports `>=4.8.4 <6.1.0`. 6.0.3 is the newest stable release inside that range.                                                                                |
| `eslint`      | 10.12.0                    | 9.39.5  | `eslint-config-next` depends on `eslint-plugin-react` (peer `eslint ^…\|\| ^9.7`), `eslint-plugin-import` and `eslint-plugin-jsx-a11y` (peer up to `^9`). **ESLint 9.x is marked unsupported upstream**; see Consequences. |
| `prisma`      | 8.0.0-rc.20                | 7.10.0  | The CLI's `latest` dist-tag points to a release candidate (prohibited). 7.10.0 is the newest stable and matches `@prisma/client` / `@prisma/adapter-pg` `latest`.                                                          |
| `pnpm`        | 12.9.1                     | 10.34.6 | pnpm 11+ ships `bin/pnpm.mjs`; the Corepack bundled with Node 24.6.0 (0.34.0) expects `bin/pnpm.cjs` and fails with `MODULE_NOT_FOUND`. 10.34.6 is the newest stable release that works with the approved Corepack setup.  |
| `@types/node` | 26.6.4                     | 24.19.1 | Types should match the Node 24 runtime, not a newer Node major.                                                                                                                                                            |

### Configuration choices

- **Hand-built Next.js foundation (D9)** instead of `create-next-app`: avoids its boilerplate and the
  conflict with the existing `README.md`; every file is intentional.
- **TypeScript:** `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`; `moduleResolution: bundler`; `types: ["node"]` (TypeScript 6 no longer
  includes all `@types/*` by default). `pnpm typecheck` runs `next typegen` first so Next.js route
  and asset types exist without a full build.
- **Next.js:** `typedRoutes: true` (compile-time checked links), `poweredByHeader: false`.
  Next.js 16 removed `next lint`, so ESLint runs directly with the flat config from
  `eslint-config-next`.
- **Tailwind CSS 4:** CSS-first configuration in `src/app/globals.css`; no `tailwind.config` file.
- **pnpm build scripts:** pnpm 10 blocks dependency lifecycle scripts by default. `unrs-resolver`'s
  postinstall (a fallback native-binary downloader) is explicitly listed in
  `pnpm-workspace.yaml` → `ignoredBuiltDependencies`; the prebuilt `darwin-arm64` binding installs
  as a normal optional dependency.
- **Environment:** a single `.env` file (gitignored), created from `.env.example`. Next.js loads it
  natively; Prisma 7 loads it explicitly in `prisma.config.ts` (ADR 0003). All variables are
  validated by `src/lib/env.ts` (Zod).
- **Local resources (D11):** Docker Desktop memory 2–3 GB (set by the developer); PostgreSQL capped
  at ~512 MB in Compose; Playwright runs Chromium only. No Redis, queues, or other services.

## Consequences

- **ESLint 9 end of support.** ESLint 9.39.5 is the last 9.x release and is flagged "no longer
  supported" on npm. The Next.js lint plugin ecosystem has not declared ESLint 10 support, so
  upgrading now would mean unsupported peer combinations. Follow-up: move to ESLint 10 once
  `eslint-config-next`'s plugins declare support. Lint is a development-time tool and is not shipped
  in the application bundle.
- **TypeScript 7** (native compiler) is deferred until `typescript-eslint` supports it.
- **pnpm 10** is in maintenance relative to pnpm 12. Upgrading requires either a newer Corepack
  (bundled with a newer Node 24.x) or installing Corepack/pnpm differently; revisit when Node is
  upgraded.
- Exact pins plus `pnpm-lock.yaml` and `pnpm install --frozen-lockfile` make installs reproducible
  locally and in CI.
