# Information Architecture

Status: **Approved plan.** Pages are built in Phases 4 and 8–10; see
[implementation-log.md](implementation-log.md).

## Page map

```
/login                         public
/                              → /dashboard (signed in) or /login
── App shell: top bar (user menu, sign out) + navigation
   Dashboard · Work orders · Analytics [A] · Profile
   (sidebar on desktop, disclosure menu on mobile)
/dashboard                     KPI cards (each → filtered list) · Needs Attention · Recent activity
/work-orders                   filter bar + table (cards on mobile) + pagination; "New" button [A]
/work-orders/new         [A]   create form
/work-orders/[ref]             header (reference, title, status and priority badges), details panel,
                               allowed status actions, comment form, timeline (comments + activity)
/work-orders/[ref]/edit  [A]   edit form (a page, not a modal: simpler focus management)
/analytics               [A]   Status & priority · Workload · Throughput & speed · Definitions
/profile                       name, email, role (password change is a should-have)
not-found / forbidden / error  shared state pages
```

`[A]` = `ADMIN` only. `[ref]` is the human-readable reference (for example `WO-000123`), resolved to
the record's numeric `number`.

## Navigation rules

- Navigation is role-aware (Analytics hidden for `TEAM_MEMBER`), but hiding a link is never the
  security boundary; every page and service enforces authorization on the server.
- List filters, sort, search, and page live in URL search parameters so views are shareable,
  bookmarkable, server-rendered, and reachable from dashboard KPI cards.

## Responsive behavior

- Desktop: persistent sidebar; data tables.
- Mobile (< 768px): top bar with menu button; tables become stacked cards; filters collapse into a
  disclosure panel; primary actions remain reachable without horizontal scrolling.

## Accessibility conventions

- One `<h1>` per page; landmark regions (`header`, `nav`, `main`).
- Status and priority badges pair color with text (and an icon where useful).
- Forms: visible labels, `aria-describedby` for hints and errors, error summary that receives focus.
- Dialogs (cancel confirmation): focus trapped and restored, `Esc` closes.
- Live region for success and error toasts.
