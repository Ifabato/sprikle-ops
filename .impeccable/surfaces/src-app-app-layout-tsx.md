---
version: 1
slug: "src-app-app-layout-tsx"
primary_target: "src/app/(app)/layout.tsx"
related_targets: []
---

# App shell (authenticated layout)

## Scope and mode
- Target: the authenticated application shell (navigation, page frame, sign-in, profile, and shared states) built in Phase 4.
- Visitor mode: Operate.

## Audience, job, and constraints
- ADMIN operations managers (desktop-first) and TEAM_MEMBER technicians (often on phones).
- Job: reach the right work area immediately and see risk without hunting; the shell itself never carries operational data in Phase 4.
- Role-aware navigation (Analytics for admins only); the server remains the access boundary.
- Honest "not available in this build yet" states for Dashboard, Work orders, and Analytics; no sample data, numbers, or skeletons for unbuilt areas.
- System fonts only; light theme only; no image generation; code-led build.
- Product truth: PRODUCT.md and docs/product-requirements.md. Design targets: docs/design/visual-direction.md.

## Unresolved decisions
- OD-1 (terminal-work edits) and OD-2 (completion-rate cohort link) remain open and do not affect the shell.
- Screenshot tooling for inspection rounds is decided at the Phase 4 gate.

## Direction contract
THESIS: The dispatcher's job board: a calm, standard product shell where urgency appears only where work is at risk. Refuses the default of a grey dashboard of identical stat cards.
OWN-WORLD: Deep service-navy navigation rail on a cool neutral page; white work surfaces; one action blue; red and amber reserved for overdue, critical, due-today, and high-priority signals; system sans with tabular numerals; status always icon plus text.
STORY: The user signs in, lands in a familiar rail-and-content layout, sees which areas exist for their role, and trusts that anything shown is real.
FIRST VIEWPORT: Left 240px rail with the text wordmark, role-appropriate navigation, and the signed-in user at the bottom; the content area holds a page title and the current page's honest state. On mobile, a top bar with a menu button expands navigation in place.
FORM: Pinned by the user at Gate A (Direction A, "Dispatch board"); no concept-seed roll and no seed key. Signature move: the fixed-width due column with relative due labels, introduced when work-order lists are built.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
