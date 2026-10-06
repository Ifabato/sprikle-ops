import { z } from "zod";
import { DUE_FILTERS } from "@/domain/due-dates";
import {
  ACTIVE_STATUSES,
  PRIORITIES,
  WORK_ORDER_STATUSES,
  type Priority,
  type WorkOrderStatus,
} from "@/domain/enums";
import { PAGINATION, TEXT_LIMITS } from "@/domain/limits";
import { idSchema } from "./common";

// List-query parameters (GET /api/v1/work-orders and the /work-orders page). Strict: unknown
// parameters are rejected. A repeated single-value parameter (for example two `page` values) is
// also rejected. Multi-value parameters accept repeats and/or comma-separated values.

export const SORT_FIELDS = ["dueAt", "createdAt", "updatedAt", "priority", "status"] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortOrder = "asc" | "desc";

/** Default order per sort field when `order` is omitted. */
export const DEFAULT_ORDER: Readonly<Record<SortField, SortOrder>> = {
  dueAt: "asc",
  createdAt: "desc",
  updatedAt: "desc",
  priority: "desc",
  status: "asc",
};

export type AssigneeFilter =
  | { readonly kind: "me" }
  | { readonly kind: "unassigned" }
  | { readonly kind: "user"; readonly id: string };

export interface WorkOrderListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly q: string | undefined;
  /** Never empty: defaults to the active statuses; `status=all` selects all five. */
  readonly statuses: readonly WorkOrderStatus[];
  readonly priorities: readonly Priority[] | undefined;
  readonly assignee: AssigneeFilter | undefined;
  readonly serviceAreaId: string | undefined;
  readonly due: (typeof DUE_FILTERS)[number] | undefined;
  readonly sort: SortField;
  readonly order: SortOrder;
}

function integerParam(label: string, min: number, max: number) {
  return z
    .string({ error: `${label} must appear once.` })
    .regex(/^\d{1,6}$/, { error: `${label} must be a whole number.` })
    .transform(Number)
    .pipe(
      z
        .number()
        .min(min, { error: `${label} must be at least ${min}.` })
        .max(max, { error: `${label} must be at most ${max}.` }),
    );
}

const multiValue = z.union([z.string(), z.array(z.string())]);

function splitValues(raw: string | string[]): string[] {
  return (Array.isArray(raw) ? raw : [raw])
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function enumList<const T extends string>(label: string, allowed: readonly T[]) {
  return multiValue.transform((raw, context) => {
    const values = splitValues(raw);
    const invalid = values.filter((value) => !(allowed as readonly string[]).includes(value));
    if (values.length === 0 || invalid.length > 0) {
      context.addIssue({ code: "custom", message: `Unknown ${label} value.` });
      return z.NEVER;
    }
    return [...new Set(values)] as T[];
  });
}

const statusParam = multiValue.transform((raw, context) => {
  const values = splitValues(raw);
  if (values.length === 1 && values[0] === "all") {
    return [...WORK_ORDER_STATUSES];
  }
  const invalid = values.filter(
    (value) => !(WORK_ORDER_STATUSES as readonly string[]).includes(value),
  );
  if (values.length === 0 || invalid.length > 0) {
    context.addIssue({
      code: "custom",
      message: 'Unknown status value (use status names, or "all" on its own).',
    });
    return z.NEVER;
  }
  return [...new Set(values)] as WorkOrderStatus[];
});

const assigneeParam = z
  .string({ error: "assignee must appear once." })
  .transform((value, context): AssigneeFilter => {
    if (value === "me" || value === "unassigned") {
      return { kind: value };
    }
    const id = idSchema.safeParse(value);
    if (!id.success) {
      context.addIssue({ code: "custom", message: "Invalid assignee." });
      return z.NEVER;
    }
    return { kind: "user", id: id.data };
  });

const rawQuerySchema = z.strictObject({
  page: integerParam("page", 1, PAGINATION.maxPage).optional(),
  pageSize: integerParam("pageSize", 1, PAGINATION.maxPageSize).optional(),
  q: z
    .string({ error: "q must appear once." })
    .trim()
    .max(TEXT_LIMITS.search.max, {
      error: `Search is limited to ${TEXT_LIMITS.search.max} characters.`,
    })
    .optional(),
  status: statusParam.optional(),
  priority: enumList("priority", PRIORITIES).optional(),
  assignee: assigneeParam.optional(),
  serviceAreaId: z.string({ error: "serviceAreaId must appear once." }).pipe(idSchema).optional(),
  due: z.enum(DUE_FILTERS, { error: "due must be overdue, today, or week." }).optional(),
  sort: z.enum(SORT_FIELDS, { error: "Unknown sort field." }).optional(),
  order: z.enum(["asc", "desc"], { error: "order must be asc or desc." }).optional(),
});

export const workOrderListQuerySchema = rawQuerySchema.transform((raw): WorkOrderListQuery => {
  const sort = raw.sort ?? "dueAt";
  return {
    page: raw.page ?? 1,
    pageSize: raw.pageSize ?? PAGINATION.defaultPageSize,
    q: raw.q === undefined || raw.q === "" ? undefined : raw.q,
    statuses: raw.status ?? [...ACTIVE_STATUSES],
    priorities: raw.priority,
    assignee: raw.assignee,
    serviceAreaId: raw.serviceAreaId,
    due: raw.due,
    sort,
    order: raw.order ?? DEFAULT_ORDER[sort],
  };
});

/** URLSearchParams → plain object; repeated keys become arrays (rejected for single-value params). */
export function searchParamsToRecord(params: URLSearchParams): Record<string, string | string[]> {
  const record: Record<string, string | string[]> = {};
  for (const [key, value] of params) {
    const existing = record[key];
    record[key] =
      existing === undefined
        ? value
        : Array.isArray(existing)
          ? [...existing, value]
          : [existing, value];
  }
  return record;
}
