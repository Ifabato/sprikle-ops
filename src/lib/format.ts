import { isOverdue } from "@/domain/due-dates";
import { isActiveStatus, type WorkOrderStatus } from "@/domain/enums";
import { APP_TIME_ZONE, compareLocalDates, localDateOf } from "@/domain/time";

// Display formatting in the app time zone (D7). Every date the UI shows goes through here, so a
// due date reads the same in the list, the detail page, and the dashboard.

const dateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
});

const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

export function formatDate(instant: Date): string {
  return dateFormat.format(instant);
}

export function formatDateTime(instant: Date): string {
  return dateTimeFormat.format(instant);
}

/** YYYY-MM-DD of an instant in the app time zone (for date inputs). */
export function dateInputValue(instant: Date): string {
  const { year, month, day } = localDateOf(instant);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export type DueTone = "overdue" | "today" | "upcoming" | "closed";

export interface DueDisplay {
  readonly tone: DueTone;
  /** Short text, for example "Overdue · Mar 1, 2026", "Due today", "Due Mar 9, 2026". */
  readonly text: string;
}

/** Due-date wording derived from the same rules as the filters (never stored). */
export function dueDisplay(
  subject: { readonly status: WorkOrderStatus; readonly dueAt: Date },
  now: Date,
): DueDisplay {
  const date = formatDate(subject.dueAt);
  if (!isActiveStatus(subject.status)) {
    return { tone: "closed", text: `Due ${date}` };
  }
  if (isOverdue(subject, now)) {
    return { tone: "overdue", text: `Overdue · due ${date}` };
  }
  if (compareLocalDates(localDateOf(subject.dueAt), localDateOf(now)) === 0) {
    return { tone: "today", text: "Due today" };
  }
  return { tone: "upcoming", text: `Due ${date}` };
}
