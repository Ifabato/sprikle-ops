import { z } from "zod";
import { parseReference } from "@/domain/reference";
import { STATUSES_REQUIRING_NOTE } from "@/domain/transitions";
import {
  dateOnlySchema,
  descriptionSchema,
  idSchema,
  noteSchema,
  prioritySchema,
  statusSchema,
  titleSchema,
  versionSchema,
} from "./common";

// Strict objects: unknown fields are rejected, never silently dropped.

export const createWorkOrderSchema = z.strictObject({
  title: titleSchema,
  description: descriptionSchema,
  serviceAreaId: idSchema,
  priority: prioritySchema.default("MEDIUM"),
  dueDate: dateOnlySchema,
  assigneeId: idSchema.nullable().optional(),
});
export type CreateWorkOrderInput = z.output<typeof createWorkOrderSchema>;

const EDITABLE_FIELDS = [
  "title",
  "description",
  "serviceAreaId",
  "priority",
  "dueDate",
  "assigneeId",
] as const;

/**
 * Partial edit. No defaults: an omitted field means "unchanged" (create-time defaults such as
 * priority MEDIUM must never be applied here). `assigneeId: null` means "unassign". Status is
 * changed only through transitions.
 */
export const editWorkOrderSchema = z
  .strictObject({
    version: versionSchema,
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    serviceAreaId: idSchema.optional(),
    priority: prioritySchema.optional(),
    dueDate: dateOnlySchema.optional(),
    assigneeId: idSchema.nullable().optional(),
  })
  .refine((input) => EDITABLE_FIELDS.some((field) => input[field] !== undefined), {
    error: "Provide at least one field to change.",
  });
export type EditWorkOrderInput = z.output<typeof editWorkOrderSchema>;

export const transitionSchema = z
  .strictObject({
    version: versionSchema,
    toStatus: statusSchema,
    note: noteSchema.optional(),
  })
  .superRefine((input, context) => {
    if (STATUSES_REQUIRING_NOTE.includes(input.toStatus) && input.note === undefined) {
      context.addIssue({
        code: "custom",
        path: ["note"],
        message:
          input.toStatus === "CANCELLED"
            ? "A cancellation reason is required."
            : "A note explaining the block is required.",
      });
    }
  });
export type TransitionInput = z.output<typeof transitionSchema>;

/** Route/API reference parameter ("WO-000123") → reference number. */
export const workOrderReferenceParamSchema = z.string().transform((value, context) => {
  const parsed = parseReference(value);
  if (!parsed.ok) {
    context.addIssue({ code: "custom", message: parsed.message });
    return z.NEVER;
  }
  return parsed.value.number;
});
