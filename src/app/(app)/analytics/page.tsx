import type { Metadata, Route } from "next";
import Link from "next/link";
import { PRIORITIES, WORK_ORDER_STATUSES } from "@/domain/enums";
import { Definition, percent } from "@/components/metrics/definition";
import { AlertRegion } from "@/components/ui/alert";
import { BUTTON_BASE, BUTTON_VARIANTS } from "@/components/ui/button";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate, formatDateTime } from "@/lib/format";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/labels";
import { getDb } from "@/server/db";
import { getAnalytics } from "@/server/services/metrics";
import { requireRole } from "@/server/session";
import { analyticsQuerySchema } from "@/validation/analytics-query";

export const metadata: Metadata = { title: "Analytics" };

const DAY = 86_400_000;

function duration(ms: number | null): string {
  if (ms === null) return "—";
  return ms >= DAY ? `${(ms / DAY).toFixed(1)} days` : `${(ms / 3_600_000).toFixed(1)} hours`;
}

/** Decorative bar beside a table value; the number in the table is the accessible content. */
function Bar({ value, max }: { value: number; max: number }) {
  const width = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <span aria-hidden="true" className="block h-2 w-full rounded-full bg-surface-sunken">
      <span className="block h-2 rounded-full bg-ink" style={{ width: `${width}%` }} />
    </span>
  );
}

function Panel({
  id,
  title,
  definition,
  children,
}: {
  id: string;
  title: string;
  definition: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex min-w-0 flex-col gap-3 rounded-sheet border border-line bg-surface p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id={id} className="font-display text-h3 font-bold text-ink">
          {title}
        </h2>
        <Definition>{definition}</Definition>
      </div>
      {children}
    </section>
  );
}

const TH = "px-3 py-2 text-left text-label font-semibold text-ink-secondary";
const TD = "px-3 py-2 text-table text-ink tabular-nums";

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const access = await requireRole("ADMIN", "/analytics");
  if (access.forbidden) {
    return (
      <>
        <PageHeader title="Analytics" />
        <ForbiddenState />
      </>
    );
  }
  const raw = Object.fromEntries(
    Object.entries(await searchParams).filter(([, value]) => value !== undefined && value !== ""),
  ) as Record<string, string | string[]>;
  const query = analyticsQuerySchema.safeParse(raw);
  const options = query.success
    ? query.data
    : { statusRange: null, completionWindowDays: 30 as const, from: undefined, to: undefined };
  const result = await getAnalytics(getDb(), access.actor, new Date(), options);
  if (!result.ok) throw new Error(result.code);
  const data = result.data;
  const statusMax = Math.max(...Object.values(data.byStatus));
  const priorityMax = Math.max(...Object.values(data.activeByPriority));
  const trendMax = Math.max(...data.trend.flatMap((week) => [week.created, week.completed]));
  const totalInRange = Object.values(data.byStatus).reduce((sum, count) => sum + count, 0);

  return (
    <>
      <div className="flex flex-col gap-2">
        <PageHeader
          title="Analytics"
          description="Throughput, workload, and completion across the organization."
        />
        <p className="text-caption text-ink-secondary">
          As of {formatDateTime(data.asOf)}. Every number comes from current work-order records;
          dates use New York time.
        </p>
      </div>

      <form
        method="get"
        action="/analytics"
        aria-label="Analytics options"
        className="flex flex-wrap items-end gap-4 rounded-sheet border border-line bg-surface p-4"
      >
        <label className="flex flex-col gap-1.5 text-label font-semibold text-ink">
          Created from
          <input
            type="date"
            name="from"
            defaultValue={options.from}
            className="min-h-11 rounded-control border border-line-control px-3 text-table font-normal"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-label font-semibold text-ink">
          Created to
          <input
            type="date"
            name="to"
            defaultValue={options.to}
            className="min-h-11 rounded-control border border-line-control px-3 text-table font-normal"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-label font-semibold text-ink">
          Completion window
          <select
            name="window"
            defaultValue={String(options.completionWindowDays)}
            className="min-h-11 rounded-control border border-line-control bg-surface px-3 text-table font-normal"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </label>
        <button type="submit" className={`${BUTTON_BASE} ${BUTTON_VARIANTS.primary}`}>
          Update
        </button>
        <Link href="/analytics" className={`${BUTTON_BASE} ${BUTTON_VARIANTS.secondary}`}>
          Reset
        </Link>
        <p className="basis-full text-caption text-ink-secondary">
          The created-date range applies to “Work by status” only.
        </p>
      </form>
      {!query.success ? (
        <AlertRegion
          message={`Showing defaults: ${query.error.issues.map((issue) => issue.message).join(" ")}`}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Panel
          id="overdue-heading"
          title="Overdue"
          definition="Active work (open, in progress, or blocked) whose due date has passed. Completed and cancelled work is never overdue."
        >
          <p
            className={`font-display text-h1 font-bold ${data.overdue > 0 ? "text-signal-ink" : "text-ink"}`}
          >
            {data.overdue}
          </p>
          <Link
            href={"/work-orders?due=overdue" as Route}
            className="text-table font-semibold text-ink underline underline-offset-4"
          >
            View overdue work orders
          </Link>
        </Panel>
        <Panel
          id="rate-heading"
          title={`Completion rate, last ${data.completionWindowDays} days`}
          definition="Of the work orders created in the window, the share whose current status is Completed. Cancelled work is left out of the denominator. Recent work has had less time to finish, so short windows read low."
        >
          <p className="font-display text-h1 font-bold text-ink">
            {percent(data.completionRate.value)}
          </p>
          <p className="text-caption text-ink-secondary">
            {data.completionRate.denominator === 0
              ? "No work orders were created in this period, so there is no rate."
              : `${data.completionRate.numerator} of ${data.completionRate.denominator} created since ${formatDate(data.completionWindow.start)}.`}
          </p>
        </Panel>
        <Panel
          id="duration-heading"
          title="Average time to completion"
          definition="Mean calendar time from creation to the current completion, for work whose current completion falls in the last 30 days. Includes time spent blocked; reopened work counts to its final completion. A mean is sensitive to outliers."
        >
          <p className="font-display text-h1 font-bold text-ink">
            {duration(data.averageCompletion.meanMs)}
          </p>
          <p className="text-caption text-ink-secondary">
            {data.averageCompletion.n === 0
              ? "No work was completed in the last 30 days."
              : `Across ${data.averageCompletion.n} completed work order${data.averageCompletion.n === 1 ? "" : "s"}.`}
          </p>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          id="status-heading"
          title="Work by status"
          definition={`Count of work orders by current status, created ${data.statusRange ? `${formatDate(data.statusRange.start)} – ${formatDate(new Date(data.statusRange.end.getTime() - 1))}` : "at any time"}. Statuses with no work are shown as 0.`}
        >
          {totalInRange === 0 ? (
            <p className="text-table text-ink-secondary">
              No work orders were created in this range.
            </p>
          ) : null}
          <table className="w-full border-collapse">
            <caption className="sr-only">Work orders by status</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={TH}>
                  Status
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Count
                </th>
                <th scope="col" className={`${TH} w-1/2`}>
                  <span className="sr-only">Bar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {WORK_ORDER_STATUSES.map((status) => (
                <tr key={status} className="border-b border-line last:border-b-0">
                  <th scope="row" className={`${TD} text-left font-normal`}>
                    {STATUS_LABELS[status]}
                  </th>
                  <td className={`${TD} text-right`}>{data.byStatus[status]}</td>
                  <td className={TD}>
                    <Bar value={data.byStatus[status]} max={statusMax} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel
          id="priority-heading"
          title="Active work by priority"
          definition="Count of active work (open, in progress, or blocked) by priority. Priorities with no work are shown as 0."
        >
          <table className="w-full border-collapse">
            <caption className="sr-only">Active work orders by priority</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={TH}>
                  Priority
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Count
                </th>
                <th scope="col" className={`${TH} w-1/2`}>
                  <span className="sr-only">Bar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[...PRIORITIES].reverse().map((priority) => (
                <tr key={priority} className="border-b border-line last:border-b-0">
                  <th scope="row" className={`${TD} text-left font-normal`}>
                    {PRIORITY_LABELS[priority]}
                  </th>
                  <td className={`${TD} text-right`}>{data.activeByPriority[priority]}</td>
                  <td className={TD}>
                    <Bar value={data.activeByPriority[priority]} max={priorityMax} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel
        id="workload-heading"
        title="Workload by assignee"
        definition="Current active work per person, split by status, with overdue and High/Critical counts. Includes every active user (even with no work), an Unassigned row, and any inactive user who still holds active work."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse">
            <caption className="sr-only">Active workload by assignee</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={TH}>
                  Assignee
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Open
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  In progress
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Blocked
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Active
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Overdue
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  High or critical
                </th>
              </tr>
            </thead>
            <tbody>
              {data.workload.map((row) => (
                <tr
                  key={row.user?.id ?? "unassigned"}
                  className="border-b border-line last:border-b-0"
                >
                  <th scope="row" className={`${TD} text-left font-normal`}>
                    {row.user ? (
                      row.user.name
                    ) : (
                      <span className="text-ink-secondary">Unassigned</span>
                    )}
                    {row.user && !row.user.isActive ? (
                      <span className="ml-2 rounded-control bg-warning-tint px-1.5 py-0.5 text-caption font-semibold text-warning">
                        Inactive
                      </span>
                    ) : null}
                  </th>
                  <td className={`${TD} text-right`}>{row.byStatus.OPEN}</td>
                  <td className={`${TD} text-right`}>{row.byStatus.IN_PROGRESS}</td>
                  <td className={`${TD} text-right`}>{row.byStatus.BLOCKED}</td>
                  <td className={`${TD} text-right font-semibold`}>{row.active}</td>
                  <td className={`${TD} text-right`}>{row.overdue}</td>
                  <td className={`${TD} text-right`}>{row.highPriority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        id="trend-heading"
        title="Created and completed, last 12 weeks"
        definition="Per ISO week (Monday to Sunday, New York time): work orders created that week, and work orders whose current completion falls in that week. Reopened work that has not been completed again drops out. The current week is partial."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse">
            <caption className="sr-only">Work orders created and completed per week</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={TH}>
                  Week of
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Created
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Completed
                </th>
                <th scope="col" className={`${TH} w-2/5`}>
                  <span className="sr-only">Bars</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.trend.map((week, index) => (
                <tr key={week.start.toISOString()} className="border-b border-line last:border-b-0">
                  <th scope="row" className={`${TD} text-left font-normal`}>
                    {formatDate(week.start)}
                    {index === data.trend.length - 1 ? (
                      <span className="text-ink-secondary"> (so far)</span>
                    ) : null}
                  </th>
                  <td className={`${TD} text-right`}>{week.created}</td>
                  <td className={`${TD} text-right`}>{week.completed}</td>
                  <td className={TD}>
                    <span className="flex flex-col gap-1">
                      <Bar value={week.created} max={trendMax} />
                      <span
                        aria-hidden="true"
                        className="block h-2 w-full rounded-full bg-surface-sunken"
                      >
                        <span
                          className="block h-2 rounded-full bg-status-completed"
                          style={{
                            width: `${trendMax === 0 ? 0 : Math.round((week.completed / trendMax) * 100)}%`,
                          }}
                        />
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-caption text-ink-secondary">
          Bars: dark = created, green = completed. The numbers in the table are the data.
        </p>
      </Panel>
    </>
  );
}
