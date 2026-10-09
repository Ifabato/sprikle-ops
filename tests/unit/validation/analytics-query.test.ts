import { describe, expect, it } from "vitest";
import { analyticsQuerySchema } from "@/validation/analytics-query";

describe("analyticsQuerySchema", () => {
  it("defaults to all time and a 30-day completion window", () => {
    expect(analyticsQuerySchema.parse({})).toMatchObject({
      statusRange: null,
      completionWindowDays: 30,
    });
  });

  it("turns an inclusive New York date range into a half-open UTC interval (DST start week)", () => {
    const { statusRange } = analyticsQuerySchema.parse({
      from: "2026-03-08",
      to: "2026-03-08",
      window: "7",
    });
    // March 8, 2026 is the 23-hour DST change day in New York.
    expect(statusRange).toEqual({
      start: new Date("2026-03-08T05:00:00.000Z"),
      end: new Date("2026-03-09T04:00:00.000Z"),
    });
  });

  it.each([
    [{ from: "2026-03-01" }, "from"],
    [{ from: "2026-03-05", to: "2026-03-01" }, "to"],
    [{ from: "2026-02-30", to: "2026-03-01" }, "from"],
    [{ window: "14" }, "window"],
    [{ window: ["7", "30"] }, "window"],
    [{ colour: "red" }, ""],
  ])("rejects %j", (input, path) => {
    const result = analyticsQuerySchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success && path)
      expect(result.error.issues.some((i) => i.path[0] === path)).toBe(true);
  });
});
