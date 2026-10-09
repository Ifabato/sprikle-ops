"use client";

import { Flag } from "lucide-react";
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  BOARD_DAYS,
  BOARD_DEFAULT_OFFSET,
  boardDay,
  deriveBoard,
  formatBoardDay,
  overdueCount,
  type DueTone,
} from "./board-model";
import { PriorityLabel, StatusBadge } from "@/components/work-orders/badges";

const DUE_TONE: Record<DueTone, string> = {
  overdue: "text-signal-ink",
  today: "text-warning",
  soon: "text-ink",
  later: "text-ink-secondary",
  done: "text-success",
};

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Position of day `index` along the ruler, in percent. */
const at = (index: number) => `${(index / (BOARD_DAYS - 1)) * 100}%`;

/**
 * Day ruler: eight ticked days with an orange "today" marker. A native range input sits on top
 * (transparent) so pointer, touch, and keyboard behave exactly like a standard slider.
 */
function DayRuler({
  offset,
  onChange,
  id,
}: {
  offset: number;
  onChange: (value: number) => void;
  id: string;
}) {
  const days = Array.from({ length: BOARD_DAYS }, (_, index) => boardDay(index));
  return (
    <div className="relative mx-3 h-16 rounded-control has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-4 has-[input:focus-visible]:outline-focus-ring">
      <span aria-hidden="true" className="absolute inset-x-0 top-[1.375rem] h-px bg-line-strong" />
      {days.map((day, index) => {
        const past = index < offset;
        const today = index === offset;
        return (
          <span
            key={index}
            aria-hidden="true"
            className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: at(index) }}
          >
            <span
              className={`h-[1.375rem] w-px ${today ? "bg-transparent" : past ? "bg-line-strong" : "bg-line-control"}`}
            />
            <span
              className={`mt-2 font-mono text-micro leading-tight ${today ? "font-semibold text-ink" : "text-ink-secondary"}`}
            >
              {WEEKDAY.format(new Date(Date.UTC(day.year, day.month - 1, day.day, 12)))}
            </span>
            <span
              className={`font-mono text-caption leading-tight ${today ? "font-semibold text-ink" : "text-ink-secondary"}`}
            >
              {day.day}
            </span>
          </span>
        );
      })}
      <span
        aria-hidden="true"
        className="absolute top-0 flex -translate-x-1/2 flex-col items-center transition-[left] duration-200 ease-out"
        style={{ left: at(offset) }}
      >
        <span className="h-[1.375rem] w-[3px] rounded-full bg-signal" />
        <span className="-mt-[1.6rem] size-3 rounded-full border-2 border-surface bg-signal shadow-sheet" />
      </span>
      <input
        id={id}
        type="range"
        min={0}
        max={BOARD_DAYS - 1}
        step={1}
        value={offset}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-valuetext={formatBoardDay(boardDay(offset))}
        className="absolute inset-y-0 -left-3 h-full w-[calc(100%+1.5rem)] cursor-pointer opacity-0"
      />
    </div>
  );
}

/**
 * Working sample board for the landing page. Moving the sample day re-derives every due label with
 * the product's due-date rules and re-sorts the rows by risk. All rows are synthetic sample data.
 */
export function SampleBoard({ compact = false }: { compact?: boolean }) {
  const [offset, setOffset] = useState(BOARD_DEFAULT_OFFSET);
  const day = boardDay(offset);
  const rows = useMemo(() => deriveBoard(boardDay(offset)), [offset]);
  const overdue = overdueCount(rows);
  const sliderId = useId();
  const listRef = useRef<HTMLOListElement>(null);
  const positions = useRef(new Map<string, number>());

  // FLIP: animate rows from their previous position to the new one (skipped for reduced motion).
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = Array.from(list.querySelectorAll<HTMLElement>("[data-ref]"));
    const reduce = prefersReducedMotion();
    for (const item of items) {
      const ref = item.dataset.ref ?? "";
      const top = item.offsetTop;
      const before = positions.current.get(ref);
      positions.current.set(ref, top);
      if (reduce || before === undefined || before === top) continue;
      item.animate(
        [{ transform: `translateY(${before - top}px)` }, { transform: "translateY(0)" }],
        {
          duration: 420,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        },
      );
    }
  }, [rows]);

  const visible = compact ? rows.slice(0, 3) : rows;
  const columns = compact ? "" : "md:grid-cols-[minmax(0,1fr)_7.5rem_8.5rem]";

  return (
    <div className="flex flex-col overflow-hidden rounded-sheet border border-line bg-surface text-ink shadow-sheet">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3 sm:px-5">
        <p className="text-table font-semibold text-ink">Work orders, most at risk first</p>
        <p className="rounded-full bg-surface-sunken px-2.5 py-0.5 font-mono text-caption text-ink-secondary">
          Sample data · illustrative
        </p>
      </div>

      {compact ? null : (
        <div className="flex flex-col gap-3 border-b border-line bg-surface-page/60 px-4 pt-4 pb-3 sm:px-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label htmlFor={sliderId} className="text-label font-semibold text-ink">
              Move the sample day
            </label>
            <p aria-live="polite" className="font-mono text-label text-ink">
              <span className="font-semibold">{formatBoardDay(day)}</span>
              <span className="text-ink-secondary"> · </span>
              <span
                className={overdue > 0 ? "font-semibold text-signal-ink" : "text-ink-secondary"}
              >
                {overdue === 0 ? "nothing overdue" : `${overdue} overdue`}
              </span>
            </p>
          </div>
          <DayRuler id={sliderId} offset={offset} onChange={setOffset} />
        </div>
      )}

      {compact ? null : (
        <div
          aria-hidden="true"
          className="hidden grid-cols-[minmax(0,1fr)_7.5rem_8.5rem] gap-x-4 border-b border-line px-5 py-2 text-caption font-semibold text-ink-secondary md:grid"
        >
          <span>Job</span>
          <span>Status · priority</span>
          <span className="text-right">Due</span>
        </div>
      )}

      <ol
        ref={listRef}
        aria-label="Sample work orders, most at risk first"
        className="relative divide-y divide-line"
      >
        {visible.map((row) => (
          <li
            key={row.reference}
            data-ref={row.reference}
            className={`relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 transition-colors duration-300 sm:px-5 ${columns} ${
              row.overdue ? "bg-signal-tint" : "bg-surface"
            }`}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-table font-semibold text-ink md:truncate">{row.title}</span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-caption text-ink-secondary md:flex-nowrap">
                <span className="shrink-0 font-mono whitespace-nowrap">{row.reference}</span>
                <span className="truncate">
                  {row.area} · {row.assignee}
                </span>
              </span>
            </span>
            <span
              className={compact ? "hidden" : "hidden md:flex md:flex-col md:items-start md:gap-1"}
            >
              <StatusBadge status={row.status} />
              <PriorityLabel priority={row.priority} />
            </span>
            <span
              className={`flex items-center justify-end gap-1.5 text-right font-mono text-caption font-semibold whitespace-nowrap ${DUE_TONE[row.dueTone]}`}
            >
              {row.overdue ? (
                <Flag aria-hidden="true" className="size-3.5 fill-signal stroke-signal-ink" />
              ) : null}
              {row.dueLabel}
            </span>
            {compact ? null : (
              <span className="col-span-2 flex flex-wrap gap-2 md:hidden">
                <StatusBadge status={row.status} />
                <PriorityLabel priority={row.priority} />
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
