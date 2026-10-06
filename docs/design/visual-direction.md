# Visual Direction — "Dispatch board"

Status: **Approved at Design setup Gate A (2026-10-05).** These are **design targets** for Phase 4
onward, not a description of a built interface and not a claim of WCAG compliance. `DESIGN.md` is
written later, from the built interface, by Impeccable's documenter (see
[ADR 0004](../decisions/0004-design-workflow.md)). No tokens are applied to code until Phase 4 is
approved.

Product context: [PRODUCT.md](../../PRODUCT.md) (derived summary) and
[product-requirements.md](../product-requirements.md) (source of truth).

## Decisions

| Decision   | Choice                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------ |
| Direction  | **A — Dispatch board**, pinned by the user (no `concept-seed` roll, no challengers)              |
| Mode       | Operate (a working product first; the world lends type, palette, density, one signature move)    |
| Theme      | Light only for the MVP; no dark mode without approval                                            |
| Fonts      | System UI font stack only; no downloads, no bundled font files                                   |
| Icons      | `lucide-react` intended for Phase 4, subject to version and React 19 checks then (not installed) |
| Build path | Code-led (no image generation available or used)                                                 |

## World and signature move

- **World:** the service dispatcher's job board. A calm shell; urgency appears only in the due and
  status columns.
- **Signature move — the due column:** every work-order list has a fixed-width due column with a
  relative text label ("3d overdue", "Due today", "In 4d", "Oct 19") plus an icon. Only overdue cells
  receive the danger tint; rows are never colored as a whole.

## Typography

- One family: the platform system UI stack
  (`system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`).
- Fixed rem scale (ratio ≈1.2): 12 / 13 / 14 / 16 / 19 / 23 / 28 px. Tables use 14px; forms and
  body text 16px.
- Tabular numerals for references, dates, counts, and percentages. No monospace costume.

## Color (semantic tokens)

Measured contrast ratios are listed as design targets (computed during Gate A).

| Token                      | Value                 | Use                       | Contrast target            |
| -------------------------- | --------------------- | ------------------------- | -------------------------- |
| `surface-page`             | `#F4F6F8`             | page background           | –                          |
| `surface`                  | `#FFFFFF`             | tables, forms, panels     | –                          |
| `surface-sunken`           | `#EEF1F4`             | table header, toolbars    | –                          |
| `text`                     | `#16212C`             | primary text              | 16.3 on surface            |
| `text-secondary`           | `#4A5A6A`             | secondary text, labels    | 7.1 on surface, 6.3 sunken |
| `border`                   | `#D5DCE3`             | dividers                  | decorative                 |
| `border-control`           | `#7A8896`             | input and control borders | 3.6 (non-text ≥ 3)         |
| `rail`                     | `#13283D`             | navigation rail           | –                          |
| `rail-active`              | `#1F3B57`             | current navigation item   | –                          |
| `rail-text` / `rail-muted` | `#E8EEF4` / `#9FB3C8` | rail labels               | 12.9 / 7.0 on rail         |
| `action`                   | `#1D5FB8`             | primary buttons, links    | 6.2 (white text 6.2)       |
| `focus-ring`               | `#1D5FB8`             | 2px solid, 2px offset     | 6.2 vs surface             |
| `focus-ring-on-rail`       | `#8DBBFF`             | focus inside the rail     | 7.6 vs rail                |
| `danger` / `danger-tint`   | `#B42318` / `#FEF0EE` | overdue, critical, errors | 6.6 / 5.9 on tint          |
| `warning`                  | `#A64B00`             | due today, high priority  | 5.8                        |
| `success`                  | `#066A42`             | success messages          | 6.7                        |

### Status and priority (never color alone)

| Value          | Icon (intended)        | Text / background                             | Contrast |
| -------------- | ---------------------- | --------------------------------------------- | -------- |
| Open           | dashed circle          | `#3F4D5C` / `#EEF1F4`                         | 7.6      |
| In progress    | half-filled circle     | `#1849A9` / `#EAF1FD`                         | 7.2      |
| Blocked        | octagon                | `#8A3A0A` / `#FEF3E2`                         | 7.1      |
| Completed      | check circle           | `#066A42` / `#E8F7EE`                         | 6.0      |
| Cancelled      | slashed circle         | `#5A6573` / `#F2F4F7`                         | 5.4      |
| Low → Critical | 1–4 signal bars + name | neutral / neutral / `warning` / `danger` text | ≥ 5.8    |

## Spacing, shape, depth

- Spacing: 4px base — 4, 8, 12, 16, 24, 32, 48.
- Radii: 4px controls, 6px panels, full for status pills.
- Borders: 1px. No colored left/right accent borders.
- Elevation: none for page content; one soft offset shadow for menus and dialogs only.

## Components (targets)

- **Navigation:** desktop 240px rail (wordmark; Dashboard, Work orders, Analytics for admins only;
  user name, role, Sign out at the bottom); active item has `aria-current` and a 3px indicator.
  Mobile (< 768px): top bar with a menu button that expands an in-flow navigation panel
  (`aria-expanded`, Escape closes, focus returns to the button).
- **Tables:** sticky header; sortable headers are buttons with `aria-sort`; tabular numerals; numbers
  right-aligned; no zebra striping; 44px rows. Mobile: two-line list rows (reference + title; status,
  priority, due), not cards.
- **Forms:** labels above fields; required marked in text; inline errors with an icon linked by
  `aria-describedby`; an error summary that receives focus; one primary action per form.
- **Badges:** status = icon + text in a tinted pill; priority = signal-bar icon + text.
- **Feedback:** 150–200ms color and opacity transitions only; no page-load animation;
  `prefers-reduced-motion` respected; success and error toasts in a live region.
- **States:** layout-shaped skeletons for loading; distinct empty states ("No work orders yet" vs
  "No matches for these filters"); 403, 404 (same copy for missing and out-of-scope), and error
  pages with retry and a request ID.

## Phase 4 app-shell boundaries

- Login: product name, email and password, generic error message; no demo credentials on the page
  (README only) and no links to features that do not exist.
- Profile: read-only name, email, role, and account status; no disabled controls for deferred
  features.
- Dashboard, Work orders, and Analytics pages render an honest "not available in this build yet"
  state with no sample data, skeletons, or numbers; Analytics still enforces admin-only access.

## Ruled out

Decorative cards around every item; nested cards; hero-metric tiles; eyebrow/kicker labels;
gradients, glass, 3D, heavy animation; emoji or Unicode characters as icons; invented metrics,
customers, testimonials, integrations, or benchmarks.
