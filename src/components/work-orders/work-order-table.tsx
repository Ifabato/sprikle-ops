import Link from "next/link";
import type { Route } from "next";
import { Clock, Flag } from "lucide-react";
import { dueDisplay, type DueDisplay } from "@/lib/format";
import type { WorkOrderSummary } from "@/server/services/work-orders";
import { PriorityLabel, StatusBadge } from "./badges";

/**
 * Due label by risk (DESIGN.md): mono, semibold; Signal Ink with an orange-filled flag when overdue,
 * amber with a clock for "Due today", ink otherwise. Never color alone.
 */
export function DueText({ due }: { due: DueDisplay }) {
  if (due.tone === "overdue") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-signal-ink">
        <Flag aria-hidden="true" className="size-3.5 shrink-0 fill-signal text-signal" />
        {due.text}
      </span>
    );
  }
  if (due.tone === "today") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-warning">
        <Clock aria-hidden="true" className="size-3.5 shrink-0" />
        {due.text}
      </span>
    );
  }
  return (
    <span className={`font-mono ${due.tone === "closed" ? "text-ink-secondary" : "text-ink"}`}>
      {due.text}
    </span>
  );
}

function href(row: WorkOrderSummary): Route {
  return `/work-orders/${row.reference}` as Route;
}

/** Table on wide screens, stacked cards on phones. Same data, same order. */
export function WorkOrderTable({ rows, now }: { rows: readonly WorkOrderSummary[]; now: Date }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-sheet border border-line bg-surface md:block">
        <table className="w-full border-collapse text-left text-table">
          <caption className="sr-only">Work orders</caption>
          <thead className="border-b border-line bg-surface-sunken text-label text-ink-secondary">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                Work order
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Status
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Priority
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Due
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Assignee
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.reference}
                className="border-b border-line last:border-b-0 hover:bg-surface-sunken/60"
              >
                <td className="px-4 py-3">
                  <Link href={href(row)} className="group flex flex-col rounded-control">
                    <span className="font-mono text-caption text-ink-secondary">
                      {row.reference}
                    </span>
                    <span className="font-semibold text-ink underline-offset-4 group-hover:underline">
                      {row.title}
                    </span>
                    <span className="text-caption text-ink-secondary">{row.serviceArea.name}</span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3">
                  <PriorityLabel priority={row.priority} />
                </td>
                <td className="px-4 py-3">
                  <DueText due={dueDisplay(row, now)} />
                </td>
                <td className="px-4 py-3 text-ink">
                  {row.assignee ? (
                    row.assignee.name
                  ) : (
                    <span className="text-ink-secondary">Unassigned</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li key={row.reference}>
            <Link
              href={href(row)}
              className="flex flex-col gap-2 rounded-sheet border border-line bg-surface p-4 hover:border-line-strong"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-mono text-caption text-ink-secondary">{row.reference}</span>
                <StatusBadge status={row.status} />
              </span>
              <span className="font-semibold text-ink">{row.title}</span>
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption">
                <PriorityLabel priority={row.priority} />
                <DueText due={dueDisplay(row, now)} />
              </span>
              <span className="text-caption text-ink-secondary">
                {row.assignee ? row.assignee.name : "Unassigned"} · {row.serviceArea.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
