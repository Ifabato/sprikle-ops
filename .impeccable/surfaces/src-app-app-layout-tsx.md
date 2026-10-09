---
version: 1
slug: "src-app-app-layout-tsx"
primary_target: "src/app/(app)/layout.tsx"
related_targets: ["src/app/(public)/login/page.tsx"]
---

# App shell (authenticated layout)

## Scope and mode
- Target: the authenticated application shell (navigation, page frame, profile, and shared states) and the split-screen sign-in, revised in Phase 4B to match the "Signal Board" world of the public landing page.
- Visitor mode: Operate.

## Audience, job, and constraints
- ADMIN operations managers (desktop-first) and TEAM_MEMBER technicians (often on phones).
- Job: reach the right work area immediately and see risk without hunting; the shell itself carries no operational data in Phase 4.
- Role-aware navigation (Analytics for admins only); the server remains the access boundary.
- Honest "not available in this build yet" states for Dashboard, Work orders, and Analytics that say what is planned for the area in words; no sample data, numbers, or skeletons for unbuilt areas.
- Light theme only for the application. Self-hosted Schibsted Grotesk (headings) and JetBrains Mono (references, dates, metadata); system UI for body text. No image generation; code-led build.
- Product truth: PRODUCT.md and docs/product-requirements.md. Design targets: docs/design/visual-direction.md, superseded where this brief differs.

## Unresolved decisions
- OD-1 (terminal-work edits) and OD-2 (completion-rate cohort link) remain open and do not affect the shell.

## Direction contract
THESIS: The dispatcher's job board: a confident product shell where urgency appears only where work is at risk. Refuses the default of a grey admin template with identical cards on an empty field.
OWN-WORLD: Deep service-navy rail and frame on a cool grey field; white sheets ruled with hairlines; navy filled primary actions; one hi-vis safety orange reserved for risk and the current-location marker; Schibsted Grotesk headings set heavy and tight; JetBrains Mono for references, dates, and metadata; status always icon plus text.
STORY: The user signs in on a split screen that already speaks the product's language, lands in a rail-and-sheet layout, sees which areas exist for their role, and trusts that anything shown is real.
FIRST VIEWPORT: Left 240px navy rail with the wordmark and mark, role-appropriate navigation with an orange current marker, and the signed-in user at the bottom; the content area holds a heavy page title with a mono metadata line and the page's honest state. On mobile, a navy top bar with a menu button expands navigation in place. Sign-in: navy brand panel beside the form; on mobile the panel collapses to a navy band.
FORM: Pinned by the user (Direction A "Dispatch board", revised to Concept A "Signal Board"); no concept-seed roll and no seed key. Signature move: the fixed-width due column with relative due labels, shown on the landing page's sample board and built for real work-order lists in Phase 8.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
