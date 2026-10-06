# Product

<!-- impeccable:product-schema 1 -->

> **Derived summary for design work, not a source of truth.** The product source of truth is
> [docs/product-requirements.md](docs/product-requirements.md), together with
> [docs/authorization.md](docs/authorization.md), [docs/metrics.md](docs/metrics.md), and
> [docs/data-model.md](docs/data-model.md). Where this file and those documents disagree, those
> documents win.

## Platform

web

## Users

- **Operations manager (`ADMIN`)** at a small service business: creates, assigns, prioritizes, and
  closes work orders; watches overdue, blocked, and critical work; reviews analytics. Mostly at a
  desk, on desktop.
- **Technician (`TEAM_MEMBER`)**: sees only work currently assigned to them; starts, blocks,
  completes, and comments on it, often on a phone between jobs.

## Product Purpose

One accountable record for operational work: who owns each work order, what is at risk right now,
and how the team is performing, measured from stored records rather than guesswork.

## Positioning

Risk is derived, never typed in. "Overdue" is computed from the due date and status, every change
is attributed in an append-only activity trail, and every metric is defined in a published metrics
dictionary and explainable from the stored records.

## Operating Context

- Work orders carry a human-readable reference (`WO-000123`), title, description, service area,
  priority, due date, assignee, comments, and an activity timeline.
- Statuses: `OPEN`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `CANCELLED`. Priorities: `LOW`, `MEDIUM`,
  `HIGH`, `CRITICAL`.
- Due dates are date-only and interpreted in `America/New_York`; list filters are "Overdue",
  "Due today", and "Due in 7 days".
- Admins see all work; team members see only work currently assigned to them; analytics are
  admin-only.

## Capabilities and Constraints

- Scope, acceptance criteria, and rule decisions: docs/product-requirements.md (must-have scope in
  §4, decisions D1–D13 and Q1–Q17).
- **Metrics:** count metrics (Open, In progress, Blocked, Overdue, High priority) trace to the
  matching records they count. The completion rate is a percentage and must explain its numerator
  and denominator; its link to the eligible cohort is **deferred** (OD-2). Not every metric has a
  working link to its records yet.
- **Open product decisions (unresolved, not approved policy):**
  - **OD-1:** whether admins may edit `COMPLETED` or `CANCELLED` work; to be decided in Phase 5.
  - **OD-2:** the completion-rate cohort link requires the deferred created-date filter.
- Local portfolio demo: no public sign-up, no paid services, no external integrations.

## Brand Commitments

- Name: "Sprikle Ops", set as a text wordmark. No logo asset exists.
- Binding visual brief: a polished, modern operations product with strong typography and
  hierarchy; fast scanning of priorities, due dates, and statuses; readable tables with practical
  mobile alternatives; accessible forms, navigation, focus states, and errors; restrained but
  distinctive color and detail; clear loading, empty, error, forbidden, and no-data states. It must
  not read as a generic generated dashboard or a marketing site.
- Explicitly ruled out: decorative cards around every item; excessive gradients, glass effects, 3D,
  or heavy animation.

## Evidence on Hand

None. There are no customers, testimonials, benchmarks, or integrations, and none may be invented
or implied. Demo data is seeded and synthetic, and is labeled as such.

## Product Principles

1. Status and priority are never conveyed by color alone.
2. Every metric is defined in the metrics dictionary and explainable from stored records.
3. The server decides access; the interface only reflects it.
4. Calm by default; loud only for risk (overdue, blocked, critical).

## Accessibility & Inclusion

Target: WCAG 2.2 AA (a design and testing target, not a claim of compliance). Keyboard operation,
visible focus, labeled controls, accessible error messages, text contrast of at least 4.5:1, and
touch targets of at least 24px (44px for primary mobile controls).
