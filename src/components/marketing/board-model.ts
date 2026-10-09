import { isActiveStatus, type Priority, type WorkOrderStatus } from "@/domain/enums";
import { dueAtFromDateOnly, isOverdue } from "@/domain/due-dates";
import { formatReference } from "@/domain/reference";
import {
  addLocalDays,
  compareLocalDates,
  formatDateOnly,
  parseDateOnly,
  startOfLocalDay,
  type LocalDate,
} from "@/domain/time";

// Landing-page sample board. Every row is SYNTHETIC sample data (labeled as such on the page).
// Due labels and ordering are derived with the product's real domain rules: a date-only due date
// is the end of that day in America/New_York, and only active work can be overdue. Fixed dates,
// no clock reads, so server and client render identically.

export interface SampleWorkOrder {
  readonly number: number;
  readonly title: string;
  readonly area: string;
  readonly priority: Priority;
  readonly status: WorkOrderStatus;
  readonly due: string; // YYYY-MM-DD
  readonly assignee: string;
}

export const SAMPLE_WORK_ORDERS: readonly SampleWorkOrder[] = [
  {
    number: 118,
    title: "Rooftop condenser inspection",
    area: "North district",
    priority: "HIGH",
    status: "IN_PROGRESS",
    due: "2026-03-09",
    assignee: "T. Reyes",
  },
  {
    number: 121,
    title: "Replace kitchen exhaust fan belt",
    area: "Downtown",
    priority: "CRITICAL",
    status: "BLOCKED",
    due: "2026-03-10",
    assignee: "J. Okafor",
  },
  {
    number: 124,
    title: "Quarterly backflow test",
    area: "East side",
    priority: "MEDIUM",
    status: "OPEN",
    due: "2026-03-12",
    assignee: "T. Reyes",
  },
  {
    number: 126,
    title: "Leaking valve in boiler room",
    area: "Downtown",
    priority: "HIGH",
    status: "OPEN",
    due: "2026-03-11",
    assignee: "M. Lindqvist",
  },
  {
    number: 127,
    title: "Irrigation zone 3 not watering",
    area: "West side",
    priority: "LOW",
    status: "OPEN",
    due: "2026-03-16",
    assignee: "J. Okafor",
  },
  {
    number: 115,
    title: "Thermostat recalibration",
    area: "North district",
    priority: "MEDIUM",
    status: "COMPLETED",
    due: "2026-03-08",
    assignee: "M. Lindqvist",
  },
];

/** The scrubber's range: the sample "today" can move from the first to the last of these days. */
export const BOARD_START = "2026-03-08";
export const BOARD_DAYS = 8;
export const BOARD_DEFAULT_OFFSET = 2; // 2026-03-10

export type DueTone = "overdue" | "today" | "soon" | "later" | "done";

export interface BoardRow extends SampleWorkOrder {
  readonly reference: string;
  readonly dueLabel: string;
  readonly dueTone: DueTone;
  readonly overdue: boolean;
}

function local(value: string): LocalDate {
  const parsed = parseDateOnly(value);
  if (!parsed) throw new RangeError(`Invalid sample date ${value}`);
  return parsed;
}

function daysBetween(from: LocalDate, to: LocalDate): number {
  const ms =
    Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day);
  return Math.round(ms / 86_400_000);
}

/** The sample day for a scrubber offset (0 = BOARD_START). */
export function boardDay(offset: number): LocalDate {
  const clamped = Math.min(Math.max(Math.trunc(offset), 0), BOARD_DAYS - 1);
  return addLocalDays(local(BOARD_START), clamped);
}

const DAY_FORMAT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** e.g. "Tue, Mar 10" (formatted from the date-only value, so no time-zone drift). */
export function formatBoardDay(day: LocalDate): string {
  return DAY_FORMAT.format(new Date(Date.UTC(day.year, day.month - 1, day.day, 12)));
}

/**
 * Derived rows for a sample "today": viewed at midday local time on that day. Order: overdue first
 * (most overdue first), then active work by due date, then finished work; ties by reference.
 */
export function deriveBoard(
  today: LocalDate,
  orders: readonly SampleWorkOrder[] = SAMPLE_WORK_ORDERS,
): BoardRow[] {
  const now = new Date(startOfLocalDay(today).getTime() + 12 * 3_600_000);
  const rows = orders.map((order): BoardRow => {
    const dueDay = local(order.due);
    const dueAt = dueAtFromDateOnly(dueDay);
    const overdue = isOverdue({ status: order.status, dueAt }, now);
    const days = daysBetween(today, dueDay);
    let dueLabel: string;
    let dueTone: DueTone;
    if (!isActiveStatus(order.status)) {
      dueLabel = order.status === "COMPLETED" ? "Done" : "Cancelled";
      dueTone = "done";
    } else if (overdue) {
      const late = -days;
      dueLabel = `Overdue ${late} ${late === 1 ? "day" : "days"}`;
      dueTone = "overdue";
    } else if (days === 0) {
      dueLabel = "Due today";
      dueTone = "today";
    } else if (days === 1) {
      dueLabel = "Due tomorrow";
      dueTone = "soon";
    } else {
      dueLabel = `Due in ${days} days`;
      dueTone = days <= 3 ? "soon" : "later";
    }
    return { ...order, reference: formatReference(order.number), dueLabel, dueTone, overdue };
  });

  const rank = (row: BoardRow) => (row.overdue ? 0 : isActiveStatus(row.status) ? 1 : 2);
  return rows.sort(
    (a, b) =>
      rank(a) - rank(b) || compareLocalDates(local(a.due), local(b.due)) || a.number - b.number,
  );
}

export function overdueCount(rows: readonly BoardRow[]): number {
  return rows.filter((row) => row.overdue).length;
}

export { formatDateOnly };
