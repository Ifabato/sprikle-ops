# ADR 0004 — Impeccable-assisted design workflow

- **Status:** Accepted in principle (workflow only); plugin remains **disabled**
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
