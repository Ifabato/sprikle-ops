import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CircleDot,
  MessageSquare,
  Pencil,
  RefreshCcw,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { parseReference } from "@/domain/reference";
import { BUTTON_BASE, BUTTON_VARIANTS } from "@/components/ui/button";
import { PriorityLabel, StatusBadge } from "@/components/work-orders/badges";
import { CommentForm } from "@/components/work-orders/comment-form";
import { TransitionControls } from "@/components/work-orders/transition-controls";
import { DueText } from "@/components/work-orders/work-order-table";
import { dueDisplay, formatDateTime } from "@/lib/format";
import { getDb } from "@/server/db";
import { getWorkOrder, listActivity, type ActivityView } from "@/server/services/work-orders";
import { requireUser } from "@/server/session";
import { addCommentAction, transitionAction } from "../actions";

export const metadata: Metadata = { title: "Work order" };

const NOTICES: Record<string, string> = {
  created: "Work order created.",
  updated: "Changes saved.",
};

const ACTIVITY_ICON: Record<string, LucideIcon> = {
  CREATED: CircleDot,
  STATUS_CHANGED: RefreshCcw,
  ASSIGNEE_CHANGED: UserRound,
  COMMENT_ADDED: MessageSquare,
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-label text-ink-secondary">{label}</dt>
      <dd className="text-table text-ink">{children}</dd>
    </div>
  );
}

function Timeline({ items }: { items: readonly ActivityView[] }) {
  return (
    <ol className="flex flex-col">
      {items.map((item) => {
        const Icon = ACTIVITY_ICON[item.type] ?? Pencil;
        return (
          <li
            key={item.id}
            className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-l border-line pb-5 pl-0 last:pb-0"
          >
            <span className="-ml-4 grid size-8 place-items-center rounded-full border border-line bg-surface">
              <Icon aria-hidden="true" className="size-4 text-ink-secondary" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-table text-ink">
                <span className="font-semibold">{item.actor.name}</span>{" "}
                {item.type === "COMMENT_ADDED"
                  ? "commented"
                  : item.description.charAt(0).toLowerCase() + item.description.slice(1)}
              </p>
              <p className="text-caption text-ink-secondary">
                <time dateTime={item.createdAt.toISOString()}>
                  {formatDateTime(item.createdAt)}
                </time>
              </p>
              {item.comment ? (
                <blockquote className="mt-1 rounded-panel border border-line bg-surface-sunken px-3 py-2 text-table whitespace-pre-wrap text-ink">
                  {item.comment.body}
                </blockquote>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default async function WorkOrderPage({
  params,
  searchParams,
}: PageProps<"/work-orders/[ref]">) {
  const { ref } = await params;
  const actor = await requireUser(`/work-orders/${ref}`);
  const parsed = parseReference(ref);
  if (!parsed.ok) notFound();

  const db = getDb();
  const now = new Date();
  const [result, activity] = await Promise.all([
    getWorkOrder(db, actor, parsed.value.number, now),
    listActivity(db, actor, parsed.value.number),
  ]);
  // Missing and out-of-scope work look identical (D3).
  if (!result.ok || !activity.ok) notFound();
  const order = result.data;
  const notice = NOTICES[String((await searchParams).notice ?? "")];

  return (
    <>
      <div className="flex flex-col gap-4">
        <Link
          href="/work-orders"
          className="inline-flex min-h-11 items-center gap-2 self-start text-table font-semibold text-ink-secondary hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          All work orders
        </Link>
        {notice ? (
          <p
            role="status"
            className="rounded-control border border-success/30 bg-success-tint px-3 py-2.5 text-table text-success"
          >
            {notice}
          </p>
        ) : null}
        <header className="flex flex-col gap-3 border-b border-line pb-6">
          <p className="font-mono text-label text-ink-secondary">{order.reference}</p>
          <h1 className="font-display text-h1 font-bold tracking-heading text-balance text-ink">
            {order.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-table">
            <StatusBadge status={order.status} />
            <PriorityLabel priority={order.priority} />
            <DueText due={dueDisplay(order, now)} />
          </div>
        </header>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <section aria-labelledby="actions-heading" className="flex flex-col gap-3">
            <h2 id="actions-heading" className="font-display text-h3 font-bold text-ink">
              Status
            </h2>
            <TransitionControls
              action={transitionAction}
              reference={order.reference}
              version={order.version}
              status={order.status}
              allowed={order.allowedTransitions}
            />
          </section>

          <section aria-labelledby="description-heading" className="flex flex-col gap-2">
            <h2 id="description-heading" className="font-display text-h3 font-bold text-ink">
              Description
            </h2>
            <p className="max-w-[70ch] text-body whitespace-pre-wrap text-ink">
              {order.description}
            </p>
          </section>

          <section aria-labelledby="history-heading" className="flex flex-col gap-4">
            <h2 id="history-heading" className="font-display text-h3 font-bold text-ink">
              History
            </h2>
            <Timeline items={activity.data} />
            <CommentForm action={addCommentAction} reference={order.reference} />
          </section>
        </div>

        <aside
          aria-label="Work order details"
          className="flex flex-col gap-5 self-start rounded-sheet border border-line bg-surface p-5"
        >
          <dl className="flex flex-col gap-4">
            <Fact label="Assignee">
              {order.assignee ? (
                <>
                  {order.assignee.name}
                  {order.assignee.isActive ? null : (
                    <span className="text-ink-secondary"> (inactive)</span>
                  )}
                </>
              ) : (
                <span className="text-ink-secondary">Unassigned</span>
              )}
            </Fact>
            <Fact label="Service area">{order.serviceArea.name}</Fact>
            <Fact label="Due">{formatDateTime(order.dueAt)}</Fact>
            <Fact label="Created">
              {formatDateTime(order.createdAt)} by {order.createdBy.name}
            </Fact>
            {order.completedAt ? (
              <Fact label="Completed">{formatDateTime(order.completedAt)}</Fact>
            ) : null}
            {order.cancelledAt ? (
              <Fact label="Cancelled">{formatDateTime(order.cancelledAt)}</Fact>
            ) : null}
            <Fact label="Last updated">{formatDateTime(order.updatedAt)}</Fact>
          </dl>
          {actor.role === "ADMIN" ? (
            <Link
              href={`/work-orders/${order.reference}/edit` as Route}
              className={`${BUTTON_BASE} ${BUTTON_VARIANTS.secondary}`}
            >
              <Pencil aria-hidden="true" className="size-4" />
              Edit details
            </Link>
          ) : null}
        </aside>
      </div>
    </>
  );
}
