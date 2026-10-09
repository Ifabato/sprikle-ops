# Demo script (about 5 minutes)

A reproducible walkthrough of the supported lifecycle on a local machine. Everything shown is
real application behavior over data stored in PostgreSQL; the demo data is synthetic.

Recording of this script: [`docs/media/demo-walkthrough.webm`](media/demo-walkthrough.webm)
(production build, recorded with `pnpm demo:record`).

## 0. Prepare (once)

Follow the README setup through `pnpm db:seed:auth`, then add the demo work orders:

```bash
pnpm db:seed:demo   # 37 work orders over ~12 weeks, created through the real services
pnpm dev            # or: pnpm build && pnpm start
```

`db:seed:demo` only adds data: it refuses to run if any work order already exists, never changes
users, and never deletes anything. Demo accounts share the password stored as `SEED_DEMO_PASSWORD`
in your local `.env`.

Use two browser windows (for example a normal window and a private one) so the administrator and
the technician can be signed in at the same time.

## 1. Administrator: see risk at a glance

1. Sign in as `admin@sprikle.test` → **Dashboard**.
2. Point out: every count links to the exact filtered list behind it (Overdue opens
   `/work-orders?due=overdue` with the same number of rows); "How is this calculated?" shows each
   definition;
   the completion rate shows its numerator and denominator; the page states its "as of" time.
3. **Needs attention** ranks overdue → critical → blocked → high priority.

## 2. Administrator: create and assign

1. **Work orders → New work order**. Submit empty once: focus moves to the error summary and each
   field explains itself; nothing is saved.
2. Fill in a title, description, service area **Downtown**, priority **High**, a due date two days
   out, and assignee **Taylor Tech (demo)** → **Create work order**.
3. The detail page shows the reference (`WO-0000NN`) and the first history entry: "created and
   assigned to Taylor Tech (demo)".

## 3. Technician: work the assignment

1. In the second window, sign in as `tech.one@sprikle.test`. The list and dashboard show only work
   assigned to Taylor; there is no "New work order" button and no Analytics link.
2. Open the new work order → **Start work**.
3. **Mark blocked** → the dialog requires a note ("Waiting on the replacement closer.").
4. **Unblock** → **Post comment** ("Closer installed; sweep set to 5 seconds.") → **Mark completed**.
5. The history shows each change with who made it and when (New York time). Notes and comments
   are immutable.

## 4. Rules the server enforces (optional, 1 minute)

- As Taylor, open another technician's work order URL: **404**, the same as a missing reference.
- As Taylor, visit `/work-orders/new` or `/analytics`: the forbidden view (checked on the server).
- Open the same work order as the administrator in two tabs, change its status in one, then try in
  the other: "This work order was updated by someone else. Reload to see the latest version."

## 5. Administrator: the numbers moved

1. Back in the administrator window, reload **Dashboard**: recent activity lists the steps above.
2. **Analytics**: the completed count, the current week's "Completed" row, and the average time to
   completion include the new work order. Every chart has a table and a definition.

## What this demo does not claim

No customers, users, or business results exist; the data is synthetic. There is no AI capability,
notification, billing, scheduling, or multi-tenant feature. See the README's
"Known limitations" for the full list.
