// Shared limits. The database enforces the same text limits with CHECK constraints
// (see docs/data-model.md); keep both in sync.

/** PostgreSQL `integer` / `serial` maximum: the ceiling for reference numbers and versions. */
export const MAX_INT32 = 2_147_483_647;

export const TEXT_LIMITS = {
  title: { min: 3, max: 120 },
  description: { min: 1, max: 5000 },
  /** Comments, BLOCKED notes, and cancellation reasons (all stored as comments). */
  comment: { min: 1, max: 2000 },
  search: { max: 200 },
} as const;

export const PAGINATION = {
  defaultPageSize: 25,
  maxPageSize: 50,
  maxPage: 10_000,
} as const;

export const NEEDS_ATTENTION_LIMIT = 10;
