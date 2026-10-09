// Sample data for the Brindle design experiment (local only; see ../README.md). Synthetic rows,
// derived with the product's real due-date rules. Never read or written by the application.
import {
  BOARD_DEFAULT_OFFSET,
  boardDay,
  deriveBoard,
  formatBoardDay,
  type BoardRow,
} from "@/components/marketing/board-model";
import { dueAtFromDateOnly, matchesDueFilter, type DueFilter } from "@/domain/due-dates";
import { startOfLocalDay } from "@/domain/time";

export type ListFilter = DueFilter | "all";

export const SAMPLE_DAY = boardDay(BOARD_DEFAULT_OFFSET);
export const SAMPLE_DAY_LABEL = formatBoardDay(SAMPLE_DAY);
const SAMPLE_NOW = new Date(startOfLocalDay(SAMPLE_DAY).getTime() + 12 * 3_600_000);

export const SAMPLE_ROWS: readonly BoardRow[] = deriveBoard(SAMPLE_DAY);

/** Rows for a sample day offset from the default (0 = Tue, Mar 10). */
export function rowsOnDay(daysFromDefault: number): BoardRow[] {
  return deriveBoard(boardDay(BOARD_DEFAULT_OFFSET + daysFromDefault));
}

export function dayLabel(daysFromDefault: number): string {
  return formatBoardDay(boardDay(BOARD_DEFAULT_OFFSET + daysFromDefault));
}

export function filterRows(filter: ListFilter): BoardRow[] {
  if (filter === "all") return [...SAMPLE_ROWS];
  return SAMPLE_ROWS.filter((row) =>
    matchesDueFilter({ status: row.status, dueAt: dueAtFromDateOnly(row.due) }, filter, SAMPLE_NOW),
  );
}

/** The one job most concepts follow end to end (sample). */
export const STORY_JOB = SAMPLE_ROWS.find((row) => row.reference === "WO-000126")!;

export const STORY_REQUEST =
  "Hi, there's water leaking from a valve in the boiler room at the Downtown building. It's getting worse. Can someone look at it by tomorrow?";

export const STORY_ACTIVITY = [
  { time: "Mar 9, 08:42", event: "Created", detail: "by the operations manager" },
  { time: "Mar 9, 08:44", event: "Assigned", detail: "to M. Lindqvist" },
  { time: "Mar 10, 13:05", event: "Blocked", detail: "Waiting on a replacement valve kit" },
  { time: "Mar 11, 16:20", event: "Completed", detail: "Valve replaced, pressure tested" },
] as const;

export const PEOPLE = ["T. Reyes", "J. Okafor", "M. Lindqvist"] as const;
export type Person = (typeof PEOPLE)[number];

export const STATUS_LABEL = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const;
