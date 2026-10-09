import type { Metadata, Route } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PRIORITIES, WORK_ORDER_STATUSES } from "@/domain/enums";
import { AlertRegion } from "@/components/ui/alert";
import { BUTTON_BASE, BUTTON_VARIANTS } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { WorkOrderTable } from "@/components/work-orders/work-order-table";
import { formatDateTime } from "@/lib/format";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/labels";
import { getDb } from "@/server/db";
import { listAssignees, listServiceAreas, listWorkOrders } from "@/server/services/work-orders";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Work orders" };

type Params = Record<string, string | string[] | undefined>;

const SORT_LABELS = {
  dueAt: "Due date",
  createdAt: "Newest",
  updatedAt: "Recently updated",
  priority: "Priority",
  status: "Status",
} as const;

/** A GET form submits empty controls as `name=`; drop them so they mean "no filter". */
function cleaned(params: Params): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    const kept = (Array.isArray(value) ? value : [value]).filter((item) => item.trim() !== "");
    if (kept.length > 0) result[key] = kept.length === 1 ? kept[0]! : kept;
  }
  return result;
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value.join(",") : (value ?? "");
}

function pageHref(params: Record<string, string | string[]>, page: number): Route {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page") continue;
    for (const item of Array.isArray(value) ? value : [value]) search.append(key, item);
  }
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return (query ? `/work-orders?${query}` : "/work-orders") as Route;
}

function Select({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: readonly (readonly [string, string])[];
}) {
  // Keep a combined value (for example priority=HIGH,CRITICAL from a dashboard link) selectable.
  const all = options.some(([option]) => option === value)
    ? options
    : [...options, [value, value] as const];
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-label font-semibold text-ink">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="min-h-11 rounded-control border border-line-control bg-surface px-3 text-table font-normal text-ink hover:border-ink"
      >
        {all.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function WorkOrdersPage({ searchParams }: PageProps<"/work-orders">) {
  const actor = await requireUser("/work-orders");
  const admin = actor.role === "ADMIN";
  const db = getDb();
  const now = new Date();
  const params = cleaned(await searchParams);

  const [result, areas, assignees] = await Promise.all([
    listWorkOrders(db, actor, params, now),
    listServiceAreas(db, actor),
    admin ? listAssignees(db, actor) : Promise.resolve(null),
  ]);
  const filtered = Object.keys(params).some(
    (key) => key !== "page" && key !== "sort" && key !== "order",
  );
  // Distinguish "nothing exists yet" from "nothing matches" (AC-7).
  const anyInScope =
    result.ok && result.data.page.total === 0
      ? await listWorkOrders(db, actor, { status: "all", pageSize: "1" }, now).then(
          (scope) => scope.ok && scope.data.page.total > 0,
        )
      : true;

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="Work orders"
          description={
            admin
              ? "Every work order across the organization."
              : "Work orders currently assigned to you."
          }
        />
        {admin ? (
          <Link
            href="/work-orders/new"
            className={`${BUTTON_BASE} ${BUTTON_VARIANTS.primary} self-start sm:self-auto`}
          >
            <Plus aria-hidden="true" className="size-4" />
            New work order
          </Link>
        ) : null}
      </div>

      <form
        method="get"
        action="/work-orders"
        role="search"
        aria-label="Filter work orders"
        className="flex flex-col gap-4 rounded-sheet border border-line bg-surface p-4"
      >
        <label className="flex flex-col gap-1.5 text-label font-semibold text-ink">
          Search
          <input
            type="search"
            name="q"
            defaultValue={first(params.q)}
            maxLength={200}
            placeholder="Reference, title, or description"
            className="min-h-11 rounded-control border border-line-control bg-surface px-3 text-table font-normal text-ink placeholder:text-ink-secondary hover:border-ink"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select
            label="Status"
            name="status"
            value={first(params.status)}
            options={[
              ["", "Active (open, in progress, blocked)"],
              ["all", "All statuses"],
              ...WORK_ORDER_STATUSES.map((s) => [s, STATUS_LABELS[s]] as const),
            ]}
          />
          <Select
            label="Priority"
            name="priority"
            value={first(params.priority)}
            options={[
              ["", "Any priority"],
              ...PRIORITIES.map((p) => [p, PRIORITY_LABELS[p]] as const),
            ]}
          />
          <Select
            label="Due"
            name="due"
            value={first(params.due)}
            options={[
              ["", "Any due date"],
              ["overdue", "Overdue"],
              ["today", "Due today"],
              ["week", "Due in 7 days"],
            ]}
          />
          {assignees?.ok ? (
            <Select
              label="Assignee"
              name="assignee"
              value={first(params.assignee)}
              options={[
                ["", "Anyone"],
                ["me", "Assigned to me"],
                ["unassigned", "Unassigned"],
                ...assignees.data.map((u) => [u.id, u.name] as const),
              ]}
            />
          ) : null}
          {areas.ok ? (
            <Select
              label="Service area"
              name="serviceAreaId"
              value={first(params.serviceAreaId)}
              options={[
                ["", "All service areas"],
                ...areas.data.map((a) => [a.id, a.name] as const),
              ]}
            />
          ) : null}
          <Select
            label="Sort by"
            name="sort"
            value={first(params.sort)}
            options={Object.entries(SORT_LABELS).map(
              ([key, text]) => [key === "dueAt" ? "" : key, text] as const,
            )}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={`${BUTTON_BASE} ${BUTTON_VARIANTS.primary}`}>
            Apply filters
          </button>
          {filtered ? (
            <Link href="/work-orders" className={`${BUTTON_BASE} ${BUTTON_VARIANTS.secondary}`}>
              Clear filters
            </Link>
          ) : null}
        </div>
      </form>

      {!result.ok ? (
        <div className="flex flex-col items-start gap-3">
          <AlertRegion
            message={`These filters are not valid. ${Object.values(result.fieldErrors ?? {})
              .flat()
              .join(" ")}`}
          />
          <Link href="/work-orders" className={`${BUTTON_BASE} ${BUTTON_VARIANTS.secondary}`}>
            Clear filters
          </Link>
        </div>
      ) : result.data.page.total === 0 ? (
        <section
          aria-labelledby="empty-heading"
          className="flex flex-col items-start gap-3 rounded-sheet border border-dashed border-line-strong p-8"
        >
          {anyInScope ? (
            <>
              <h2 id="empty-heading" className="font-display text-h3 font-bold text-ink">
                No matches for these filters
              </h2>
              <p className="text-body text-ink-secondary">
                Try a different search or remove a filter.
              </p>
              <Link href="/work-orders" className={`${BUTTON_BASE} ${BUTTON_VARIANTS.secondary}`}>
                Clear filters
              </Link>
            </>
          ) : (
            <>
              <h2 id="empty-heading" className="font-display text-h3 font-bold text-ink">
                No work orders yet
              </h2>
              <p className="text-body text-ink-secondary">
                {admin
                  ? "Create the first work order to start tracking work."
                  : "Work assigned to you will appear here."}
              </p>
              {admin ? (
                <Link
                  href="/work-orders/new"
                  className={`${BUTTON_BASE} ${BUTTON_VARIANTS.primary}`}
                >
                  New work order
                </Link>
              ) : null}
            </>
          )}
        </section>
      ) : (
        <section aria-labelledby="results-heading" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="results-heading" role="status" className="text-table font-semibold text-ink">
              {result.data.page.total} work order{result.data.page.total === 1 ? "" : "s"}
            </h2>
            <p className="text-caption text-ink-secondary">As of {formatDateTime(now)}</p>
          </div>
          <WorkOrderTable rows={result.data.data} now={now} />
          {result.data.page.totalPages > 1 ? (
            <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
              {result.data.page.page > 1 ? (
                <Link
                  href={pageHref(params, result.data.page.page - 1)}
                  className={`${BUTTON_BASE} ${BUTTON_VARIANTS.secondary}`}
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <p className="text-table text-ink-secondary">
                Page {result.data.page.page} of {result.data.page.totalPages}
              </p>
              {result.data.page.page < result.data.page.totalPages ? (
                <Link
                  href={pageHref(params, result.data.page.page + 1)}
                  className={`${BUTTON_BASE} ${BUTTON_VARIANTS.secondary}`}
                >
                  Next
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </section>
      )}
    </>
  );
}
