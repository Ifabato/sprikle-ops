import { z } from "zod";
import {
  compareLocalDates,
  parseDateOnly,
  startOfLocalDay,
  startOfNextLocalDay,
} from "@/domain/time";

// Analytics query (GET /api/v1/metrics/analytics and the /analytics page). Strict: unknown or
// repeated parameters are rejected.
//   from, to — optional creation-date range (YYYY-MM-DD, New York calendar days, inclusive) for
//              "Work by status"; both or neither. Default: all time.
//   window   — completion-rate window in days: 7, 30 (default), or 90.

export const COMPLETION_WINDOW_VALUES = ["7", "30", "90"] as const;

const dateParam = z
  .string({ error: "Dates must appear once." })
  .refine((value) => parseDateOnly(value) !== null, {
    error: "Use a real date in YYYY-MM-DD format.",
  });

export const analyticsQuerySchema = z
  .strictObject({
    from: dateParam.optional(),
    to: dateParam.optional(),
    window: z.enum(COMPLETION_WINDOW_VALUES, { error: "window must be 7, 30, or 90." }).optional(),
  })
  .superRefine((query, context) => {
    if ((query.from === undefined) !== (query.to === undefined)) {
      context.addIssue({
        code: "custom",
        path: ["from"],
        message: "Provide both from and to, or neither.",
      });
      return;
    }
    // Field-level date errors are reported by the field schemas; only compare two real dates.
    const from = query.from ? parseDateOnly(query.from) : null;
    const to = query.to ? parseDateOnly(query.to) : null;
    if (from && to && compareLocalDates(from, to) > 0) {
      context.addIssue({ code: "custom", path: ["to"], message: "to must be on or after from." });
    }
  })
  .transform((query) => ({
    statusRange:
      query.from && query.to
        ? {
            start: startOfLocalDay(parseDateOnly(query.from)!),
            end: startOfNextLocalDay(parseDateOnly(query.to)!),
          }
        : null,
    completionWindowDays: Number(query.window ?? "30") as 7 | 30 | 90,
    from: query.from,
    to: query.to,
  }));

export type AnalyticsQuery = z.output<typeof analyticsQuerySchema>;
