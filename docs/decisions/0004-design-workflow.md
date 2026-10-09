# ADR 0004 — Impeccable-assisted design workflow

- **Status:** Accepted. Design setup Gate A approved and Gate B executed on 2026-10-05 (see
  "Design setup record" below); the plugin is to be disabled again before Phase 4 planning.
- **Date:** 2026-10-05
- **Decision:** P8

## Context

The Impeccable Claude Code plugin (`impeccable@impeccable` v4.5.0, commit `62f461d`) is installed at
local scope for design work. Inspection of its installed files showed:

- Enabling the plugin also loads its hooks (SessionStart, PostToolUse on Edit/Write, Stop). Each hook
  runs the plugin launcher, which runs a native engine binary (downloaded from the project's GitHub
  releases if absent).
- `/impeccable hooks off` (or `IMPECCABLE_HOOK_DISABLED`) is read **by the engine**; the hooks still
  fire and the launcher and engine still execute.
- The design commands themselves call the engine (`context`, `detect`, `critique-storage`,
  `surface-brief`, `build-phase`, …). The installed version does not offer a skills-only mode.

On 2026-10-05 the Stop hook ran once while the plugin was enabled, downloading the engine
(v0.1.11) to `~/.impeccable/bin/0.1.11/`. The plugin was then disabled.

## Decision

- Keep Impeccable **disabled** during Phases 2–3 and all other non-UI work.
- Add a separate **Design setup** approval gate immediately before Phase 4 (app shell). At that gate,
  present the exact plugin/engine execution, file changes, and commands for approval before enabling
  or running anything.
- Use **Operate** mode and a **code-first** workflow (`buildPath: "code"`).
- No image generation, live mode, browser injection, CSP changes, paid services, or unnecessary
  dependencies.
- Design setup first proposes PRODUCT.md, DESIGN.md, the visual direction, and design tokens. No
  tokens are applied and no UI code changes until the direction is approved.
- `PRODUCT.md` is a derived summary; `docs/product-requirements.md` remains the product source of
  truth. Product requirements and security rules stay authoritative.
- Before committing anything under `.impeccable/`, inspect it for machine-specific or sensitive values
  and propose exactly which files are committed versus ignored.
- Fonts: distinguish `next/font/google` (downloads at build time) from `next/font/local` (committed
  font files). Ask before any font download or font asset, considering reproducible builds.
- Design commands must not change domain logic, database schemas, validation, authorization, or API
  behavior.
- Automatic design findings are review inputs, not instructions to make unapproved changes.

## Design goal

A polished, modern, distinctive operations application: strong typography and hierarchy,
consistent spacing, scanability, readable tables, accessible forms, clear statuses and priorities,
responsive layouts, and restrained visual detail. Avoid generic decorative dashboard cards,
excessive gradients, animation, glass effects, and 3D.

## Planned use by phase

| Phase                   | Use                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| Design setup (before 4) | `init` → PRODUCT.md; `shape app-shell` (brief only); direction round → proposal for approval          |
| 4, 8, 9, 10 (UI phases) | `shape <surface>` → implement → `audit <route>` (report only) → in-scope fixes → one bounded `polish` |
| 11 (E2E/accessibility)  | `audit` across routes alongside Playwright/axe; at most one `critique`                                |
| 12 (documentation)      | `document` refreshes DESIGN.md from shipped code                                                      |

Not used: `overdrive`, `delight`, `animate`, `bolder`, `live`, `generate`, image generation, pinned
shortcuts.

## Design setup record (2026-10-05)

### Gate A decisions

- Direction **A — "Dispatch board"**, **pinned** by the user: `concept-seed` was not run, no random
  challengers, no choice ping. Details and design targets:
  [docs/design/visual-direction.md](../design/visual-direction.md).
- Operate mode, light theme only, system fonts only (no downloads), code-led build path.
- `lucide-react` is the intended icon library for Phase 4, subject to version and React
  compatibility checks then; not installed.
- Decision channel: text and structured questions only. `serve-question`, decision web pages, and
  local helper servers are not used.
- `PRODUCT.md` approved with the correction that count metrics trace to matching records, the
  completion rate explains its numerator and denominator, and its cohort link stays deferred (OD-2).

### Gate B execution

Verified before enabling (all matched the approved values): plugin `impeccable@impeccable` 4.5.0 at
commit `62f461d629d9c5080a83513b1d24ed9389b2c12f`; expected engine 0.1.11; cached engine
`~/.impeccable/bin/0.1.11/impeccable` with SHA-256
`7427918d6e75507401a1b7b691eefe58a7c01a2fc63b712016ffc5a0ac1c05e6`. No download or update ran.

| Step                                          | Engine run | Result                                                                                                                                                                                                                                                    |
| --------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enable plugin flag                            | no         | `impeccable@impeccable` set to `true` in `.claude/settings.local.json`. **Hooks were not loaded during Gate B because no plugin reload occurred**, so no hook ran (the engine reported `MANUAL_DETECTOR_REQUIRED`; the session's hook records show none). |
| `impeccable context`                          | yes        | Routed to `init`; reported no PRODUCT.md/DESIGN.md and no active hook. Run **without** the opt-out variables. One outbound HTTPS connection was observed (below).                                                                                         |
| `init`                                        | no         | `PRODUCT.md` written from the approved draft. No image generation, so no build-path question; live-mode setup declined.                                                                                                                                   |
| `shape app-shell`                             | no         | Brief derived from the Gate A approvals and **saved as the surface brief without a separate confirmation round**; the user reviewed it afterwards (below).                                                                                                |
| `surface-brief path`, `list`, `write`, `read` | yes        | Run with both opt-out variables. Brief stored at `.impeccable/surfaces/src-app-app-layout-tsx.md`; all six contract blocks verified; no seed key (pinned). No sockets observed.                                                                           |

### Network observations

- During `impeccable context`, the engine opened **one outbound HTTPS connection** (TCP 443 to an
  IPv6 address in a Cloudflare range) and then wrote `~/.impeccable/update-check.json`
  (`lastCheck`, `latestVersion: 4.5.0`). The most likely interpretation is the skill's update check.
  **The payload and the engine's complete network behavior were not determined.**
- Observation method: polling the open sockets of the engine process tree every 50 ms. Very short
  connections can be missed, and the absence of observed sockets does not prove the absence of
  traffic.
- Opt-outs: `DO_NOT_TRACK=1` and `IMPECCABLE_NO_TELEMETRY=1` were set for every engine command after
  `context` (not for `context` itself). The engine binary documents them as skipping its choice ping
  (`concept-seed --kind`, never run here). They are **not** known to block other network activity,
  such as the update check.
- **Rule for future engine commands:** pass both opt-out variables from the first invocation, observe
  sockets where practical, and report results without claiming the opt-outs prevent all network
  access.

### After Gate B

- The user disabled the plugin and reloaded plugins (0 hooks loaded).
- The surface brief was reviewed read-only against Direction A: all six blocks match; no material
  additions. It was approved for version control through a single `.gitignore` exception; every
  other `.impeccable/` path remains ignored.

### Files

- Repository, committed candidates: `PRODUCT.md`, `docs/design/visual-direction.md`, `.gitignore`,
  this ADR, `docs/implementation-log.md`, and `.impeccable/surfaces/src-app-app-layout-tsx.md`
  (the only `.impeccable/` exception).
- Repository, ignored: all other `.impeccable/` content; `.claude/settings.local.json` (local plugin
  flag, now `false`).
- Outside the repository: `~/.impeccable/update-check.json` (update-check cache).

`DESIGN.md` is intentionally not written: for a new visual world, Impeccable's documenter writes it
from the built interface at the end of Phase 4.

## Phase 4B record (2026-10-06)

The plugin stayed disabled throughout (no hooks). The engine ran exactly twice, manually, each
time with `DO_NOT_TRACK=1` and `IMPECCABLE_NO_TELEMETRY=1`, and with `IMPECCABLE_BIN` pointing at
the cached binary so the launcher could not reach its download branch. Before the first call,
plugin 4.5.0 at commit `62f461d629d9c5080a83513b1d24ed9389b2c12f`, engine 0.1.11, and the cached
binary's SHA-256 (`7427918d…c05e6`) were re-verified; the hash was checked again before `detect`.

| Step                                        | Engine | Result                                                                                                |
| ------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| `context --target src/app/(app)/layout.tsx` | yes    | loaded PRODUCT.md and the surface brief; no files written                                             |
| `detect --json` (25 changed UI files)       | yes    | `[]`, exit 0 (clean); browser-overlay step skipped (needs the prohibited live server)                 |
| Audit (`audit.md`, `craft-floor.md`)        | no     | text checklist in the build thread; report only                                                       |
| Finish review                               | no     | fresh read-only subagent following `degraded/finish-reviewer.md`: `disposition: fix`, 7 fixes         |
| One bounded polish round                    | no     | all 7 fixes applied (presentation only), plus touch-target and landmark items from the audit          |
| Verdict pass (same reviewer)                | no     | 6 resolved, 1 partial (caret/accent color not visible in captures); 2 regressions; `disposition: fix` |
| Documenter                                  | no     | fresh subagent following `degraded/documenter.md`: wrote `DESIGN.md` and `.impeccable/design.json`    |

- **Engine directives not followed:** `context` asked for a live interview/decision-page probe and
  pre-authorized the skill's subagents. The decision server is prohibited and Direction A was already
  pinned, so no probe was made; only the two user-approved subagents ran. The `buildPath` notice
  applies only when image generation exists, so it was not raised.
- **Network:** a 50 ms socket sampler saw no engine sockets during either call, and
  `~/.impeccable/update-check.json` did not change. Short connections can fall between samples, so
  this is not a claim of zero network access.
- **Screenshots:** captured by the Playwright smoke suite from the production build (desktop
  1440×900, mobile 390×844) into the ignored `.impeccable/review/`, and opened by the reviewer as
  images. They were retaken after the polish round, so `DESIGN.md` describes the final interface.
- **Open after the bounded round (not fixed, for user decision):** R1, the public band's wordmark is
  not aligned with the content column on desktop; R2, the sign-in (384px) and not-found (448px)
  columns differ. `DESIGN.md` records both as "not yet standardized", not as rules.
- **Files:** `DESIGN.md` is a candidate for version control and is excluded from Prettier
  (documenter-managed). `.impeccable/design.json` stays ignored until its contents and a specific
  Git exception are separately reviewed. Everything else under `.impeccable/` remains ignored.

## Phase 4B visual revision record (2026-10-06)

After viewing the first 4B interface, the user found it too plain and approved a revision: Concept A
"Signal Board", a public landing page at `/`, a split-screen sign-in, and a coordinated app-shell
redesign. The system-font-only rule and heading weight/size caps were lifted (self-hosted Schibsted
Grotesk and JetBrains Mono, OFL-1.1); the app stays light-only. R1 and R2 above were superseded by
the redesign (the public header and content now share one container).

| Step                                                        | Engine | Result                                                                              |
| ----------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| `context --target src/app/(public)/page.tsx`                | yes    | no surface brief yet; product context loaded                                        |
| `surface-brief write` landing (`src/app/(public)/page.tsx`) | yes    | new brief, six contract blocks (ignored pending a Git exception decision)           |
| `surface-brief write` app shell + sign-in                   | yes    | committed shell brief updated to "Signal Board" (tracked change)                    |
| `detect --json` (37 UI files)                               | yes    | 3 findings: off-ramp arbitrary font sizes; fixed with named type tokens             |
| Fresh reviewer (finish + anti-generic critique)             | no     | `disposition: fix`, 8 material fixes                                                |
| Polish round 1                                              | no     | all 8 applied; verdict: 6 resolved, 2 partial, 2 regressions                        |
| Polish round 2                                              | no     | remaining items and regressions addressed (final verdict in the implementation log) |
| Documenter                                                  | no     | rewrote `DESIGN.md` and `.impeccable/design.json` from the final build              |

- Each engine call was preceded by the version/hash check and received both opt-outs and the pinned
  `IMPECCABLE_BIN`. A 50 ms socket sampler saw no engine sockets and `update-check.json` did not
  change; this is not a claim of zero network access. One attempted brief write failed in the
  shell before reaching the engine (unsplit command variable) and was rerun.
- No second detector pass was run (the three findings were mechanical token fixes).
- Not run: `concept-seed`, `serve-question`, the decision server, `live-server`,
  `critique-storage`, `comp-diff`, `build-phase`, image generation, updates. Engine directives to
  probe the user or open a decision page were not followed; the concept was pinned by the user.
