import { z } from "zod";
import { PRIORITIES, WORK_ORDER_STATUSES } from "@/domain/enums";
import { MAX_INT32, TEXT_LIMITS } from "@/domain/limits";
import { parseDateOnly } from "@/domain/time";

// Client-safe Zod building blocks. Field validation only: permissions, existence of referenced
// records, and time-dependent rules (for example "due date not in the past") are checked by
// domain rules and services, not here.

/** cuid IDs and Better Auth IDs: letters, digits, "_" and "-", at most 64 characters. */
export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, { error: "Invalid identifier." });

export const versionSchema = z
  .number({ error: "Version must be a number." })
  .int({ error: "Version must be a whole number." })
  .min(0, { error: "Version cannot be negative." })
  .max(MAX_INT32, { error: "Version is out of range." });

/** Trims, then enforces length limits (the database checks the same trimmed lengths). */
export function trimmedText(label: string, limits: { min: number; max: number }) {
  return z
    .string({ error: `${label} is required.` })
    .trim()
    .min(limits.min, {
      error:
        limits.min === 1
          ? `${label} is required.`
          : `${label} must be at least ${limits.min} characters.`,
    })
    .max(limits.max, { error: `${label} must be at most ${limits.max} characters.` });
}

export const titleSchema = trimmedText("Title", TEXT_LIMITS.title);
export const descriptionSchema = trimmedText("Description", TEXT_LIMITS.description);
export const commentBodySchema = trimmedText("Comment", TEXT_LIMITS.comment);
export const noteSchema = trimmedText("Note", TEXT_LIMITS.comment);

/** Strict `YYYY-MM-DD` that must be a real calendar date. Format only; "not in the past" is a domain rule. */
export const dateOnlySchema = z
  .string({ error: "Date is required." })
  .refine((value) => parseDateOnly(value) !== null, {
    error: "Use a real date in YYYY-MM-DD format.",
  });

export const statusSchema = z.enum(WORK_ORDER_STATUSES, { error: "Unknown status." });
export const prioritySchema = z.enum(PRIORITIES, { error: "Unknown priority." });
