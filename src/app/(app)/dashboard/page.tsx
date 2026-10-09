import type { Metadata, Route } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Definition, percent } from "@/components/metrics/definition";
import { PageHeader } from "@/components/ui/page-header";
import { PriorityLabel, StatusBadge } from "@/components/work-orders/badges";
import { DueText } from "@/components/work-orders/work-order-table";
import { dueDisplay, formatDate, formatDateTime } from "@/lib/format";
import { getDb } from "@/server/db";
import { getDashboard, type AttentionItem } from "@/server/services/metrics";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Dashboard" };

const CATEGORY_LABEL: Record<AttentionItem["category"], string> = {
  OVERDUE: "Overdue",
  CRITICAL: "Critical",
  BLOCKED: "Blocked",
  HIGH: "High priority",
};

function CountCard({
  risk = false,
  label,
  value,
  href,
  definition,
}: {
  risk?: boolean;
  label: string;
  value: number;
  href: Route;
  definition: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-sheet border border-line bg-surface p-4">
      <Link href={href} className="group flex flex-col gap-1 rounded-control">
        <span className="text-label font-semibold text-ink-secondary">{label}</span>
        <span
          className={`font-display text-h1 font-bold ${risk && value > 0 ? "text-signal-ink" : "text-ink"}`}
        >
          {value}
        </span>
        <span className="inline-flex items-center gap-1 text-caption font-semibold text-ink underline-offset-4 group-hover:underline">
          View {value === 1 ? "it" : `these ${value}`}
          <ArrowRight aria-hidden="true" className="size-3.5" />
          <span className="sr-only">{label.toLowerCase()} work orders</span>
        </span>
      </Link>
      <Definition>{definition}</Definition>
    </div>
  );
}

export default async function DashboardPage() {
  const actor = await requireUser("/dashboard");
  const result = await getDashboard(getDb(), actor, new Date());
  if (!result.ok) throw new Error(result.code);
  const { kpis, needsAttention, recentActivity, asOf, scope } = result.data;
  const mine = scope === "assigned";
  const rate = kpis.completionRate;

  return (
    <>
      <div className="flex flex-col gap-2">
        <PageHeader
          title="Dashboard"
          description={
            mine
              ? "Your assigned work at a glance."
              : "Operational risk and workload across the team."
          }
        />
        <p className="text-caption text-ink-secondary">
          As of {formatDateTime(asOf)} · {kpis.active} active work order
          {kpis.active === 1 ? "" : "s"}
          {mine ? " assigned to you" : ""}
        </p>
      </div>

      <section aria-labelledby="kpi-heading" className="flex flex-col gap-3">
        <h2 id="kpi-heading" className="sr-only">
          Key numbers
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CountCard
            label="Open"
            value={kpis.open}
            href={"/work-orders?status=OPEN" as Route}
            definition="Work orders whose current status is Open (not started)."
          />
          <CountCard
            label="In progress"
            value={kpis.inProgress}
            href={"/work-orders?status=IN_PROGRESS" as Route}
            definition="Work orders whose current status is In progress."
          />
          <CountCard
            label="Blocked"
            value={kpis.blocked}
            href={"/work-orders?status=BLOCKED" as Route}
            definition="Work orders whose current status is Blocked."
          />
          <CountCard
            label="Overdue"
            risk
            value={kpis.overdue}
            href={"/work-orders?due=overdue" as Route}
            definition="Active work (open, in progress, or blocked) whose due date has passed. A date-only due date ends at midnight, New York time. Completed and cancelled work is never overdue."
          />
          <CountCard
            label="High priority"
            value={kpis.highPriority}
            href={"/work-orders?priority=HIGH,CRITICAL" as Route}
            definition="Active work with priority High or Critical."
          />
          <div className="flex flex-col gap-2 rounded-sheet border border-line bg-surface p-4">
            <span className="text-label font-semibold text-ink-secondary">
              Completion rate, last 30 days
            </span>
            <span className="font-display text-h1 font-bold text-ink">{percent(rate.value)}</span>
            <span className="text-caption text-ink-secondary">
              {rate.denominator === 0
                ? "No work orders in this period."
                : `${rate.numerator} of ${rate.denominator} work orders created since ${formatDate(kpis.completionWindow.start)} are completed.`}
            </span>
            <Definition>
              Of the work orders created in the last 30 days (New York calendar days, including
              today), the share whose current status is Completed. Cancelled work is left out of the
              denominator. Recent work has had less time to finish, so short windows read low. Shown
              as “—” when no work was created in the period.
            </Definition>
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="attention-heading" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="attention-heading" className="font-display text-h3 font-bold text-ink">
              Needs attention
            </h2>
            <Definition>
              Active work that is overdue, blocked, or High/Critical priority, ranked overdue first,
              then Critical, Blocked, and High; then by due date. At most 10 items.
            </Definition>
          </div>
          {needsAttention.length === 0 ? (
            <p className="rounded-sheet border border-dashed border-line-strong p-6 text-body text-ink-secondary">
              Nothing needs attention right now.
            </p>
          ) : (
            <ol className="flex flex-col divide-y divide-line rounded-sheet border border-line bg-surface">
              {needsAttention.map((item) => (
                <li key={item.reference}>
                  <Link
                    href={`/work-orders/${item.reference}` as Route}
                    className="flex flex-col gap-1.5 p-4 hover:bg-surface-sunken/60"
                  >
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-caption font-semibold ${item.category === "OVERDUE" ? "bg-signal-tint text-signal-ink" : "bg-surface-sunken text-ink"}`}
                      >
                        {CATEGORY_LABEL[item.category]}
                      </span>
                      <span className="font-mono text-caption text-ink-secondary">
                        {item.reference}
                      </span>
                    </span>
                    <span className="font-semibold text-ink">{item.title}</span>
                    <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption">
                      <StatusBadge status={item.status} />
                      <PriorityLabel priority={item.priority} />
                      <DueText due={dueDisplay(item, asOf)} />
                      <span className="text-ink-secondary">
                        {item.assignee?.name ?? "Unassigned"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="recent-heading" className="flex min-w-0 flex-col gap-3">
          <h2 id="recent-heading" className="font-display text-h3 font-bold text-ink">
            Recent activity
          </h2>
          {recentActivity.length === 0 ? (
            <p className="rounded-sheet border border-dashed border-line-strong p-6 text-body text-ink-secondary">
              No activity yet.
            </p>
          ) : (
            <ol className="flex flex-col gap-4">
              {recentActivity.map((item) => (
                <li key={item.id} className="flex flex-col gap-0.5 border-l-2 border-line pl-3">
                  <p className="text-table text-ink">
                    <span className="font-semibold">{item.actor.name}</span> ·{" "}
                    <Link
                      href={`/work-orders/${item.workOrder.reference}` as Route}
                      className="font-mono text-caption underline underline-offset-2"
                    >
                      {item.workOrder.reference}
                    </Link>
                  </p>
                  <p className="text-table text-ink-secondary">{item.description}</p>
                  <p className="text-caption text-ink-secondary">
                    <time dateTime={item.createdAt.toISOString()}>
                      {formatDateTime(item.createdAt)}
                    </time>
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
