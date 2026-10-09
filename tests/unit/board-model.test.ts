import { describe, expect, it } from "vitest";
import {
  BOARD_DAYS,
  BOARD_DEFAULT_OFFSET,
  boardDay,
  deriveBoard,
  formatBoardDay,
  overdueCount,
} from "@/components/marketing/board-model";
import { formatDateOnly } from "@/domain/time";

const at = (offset: number) => deriveBoard(boardDay(offset));
const labelOf = (offset: number, reference: string) =>
  at(offset).find((row) => row.reference === reference)?.dueLabel;

describe("sample board model", () => {
  it("covers a fixed eight-day range and clamps the scrubber", () => {
    expect(formatDateOnly(boardDay(0))).toBe("2026-03-08");
    expect(formatDateOnly(boardDay(BOARD_DAYS - 1))).toBe("2026-03-15");
    expect(formatDateOnly(boardDay(-3))).toBe("2026-03-08");
    expect(formatDateOnly(boardDay(99))).toBe("2026-03-15");
    expect(formatBoardDay(boardDay(BOARD_DEFAULT_OFFSET))).toBe("Tue, Mar 10");
  });

  it("derives due labels from the date, not from typed status", () => {
    expect(labelOf(0, "WO-000126")).toBe("Due in 3 days");
    expect(labelOf(2, "WO-000126")).toBe("Due tomorrow");
    expect(labelOf(3, "WO-000126")).toBe("Due today");
    expect(labelOf(4, "WO-000126")).toBe("Overdue 1 day");
    expect(labelOf(6, "WO-000126")).toBe("Overdue 3 days");
  });

  it("never marks finished work overdue", () => {
    const row = at(7).find((r) => r.reference === "WO-000115");
    expect(row).toMatchObject({ dueLabel: "Done", dueTone: "done", overdue: false });
  });

  it("puts overdue work first, then active work by due date, then finished work", () => {
    expect(at(BOARD_DEFAULT_OFFSET).map((row) => row.reference)).toEqual([
      "WO-000118",
      "WO-000121",
      "WO-000126",
      "WO-000124",
      "WO-000127",
      "WO-000115",
    ]);
    expect(at(BOARD_DEFAULT_OFFSET)[0]).toMatchObject({ dueLabel: "Overdue 1 day", overdue: true });
    // On the due date itself (end of day local time) the work is not yet overdue.
    expect(at(2).find((r) => r.reference === "WO-000121")?.dueLabel).toBe("Due today");
  });

  it("counts overdue rows as the day moves forward", () => {
    expect(overdueCount(at(0))).toBe(0);
    expect(overdueCount(at(BOARD_DEFAULT_OFFSET))).toBe(1);
    expect(overdueCount(at(7))).toBe(4);
  });
});
