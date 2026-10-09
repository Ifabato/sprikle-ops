import type { z } from "zod";

// Typed outcomes for the service layer (docs/api.md). Rule violations are values; unexpected
// failures throw and are mapped to INTERNAL_ERROR by the adapters (route handlers, Server Actions).
//
// Field-level rule failures (for example a past due date or an inactive assignee) are reported as
// VALIDATION_ERROR with `fieldErrors`, the same shape as a Zod failure, so forms can show them
// inline next to the field.

export type ServiceErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "NO_CHANGE"
  | "INVALID_TRANSITION"
  | "ASSIGNEE_REQUIRED"
  | "UNASSIGN_NOT_ALLOWED"
  | "VERSION_LIMIT"
  | "INTERNAL_ERROR";

export type FieldErrors = Readonly<Record<string, readonly string[]>>;

export interface ServiceFailure {
  readonly ok: false;
  readonly code: ServiceErrorCode;
  readonly message: string;
  readonly fieldErrors?: FieldErrors;
}

export type ServiceResult<T> = { readonly ok: true; readonly data: T } | ServiceFailure;

export function success<T>(data: T): { readonly ok: true; readonly data: T } {
  return { ok: true, data };
}

export function failure(
  code: ServiceErrorCode,
  message: string,
  fieldErrors?: FieldErrors,
): ServiceFailure {
  return fieldErrors ? { ok: false, code, message, fieldErrors } : { ok: false, code, message };
}

export function fieldFailure(field: string, message: string): ServiceFailure {
  return failure("VALIDATION_ERROR", message, { [field]: [message] });
}

/** Zod error → VALIDATION_ERROR with per-field messages ("_form" for object-level issues). */
export function validationFailure(error: z.ZodError): ServiceFailure {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  const count = error.issues.length;
  return failure(
    "VALIDATION_ERROR",
    count === 1 ? "Fix the highlighted field." : `Fix the ${count} highlighted fields.`,
    fieldErrors,
  );
}

/** HTTP status for each service error code (single source for every adapter). */
export const HTTP_STATUS: Readonly<Record<ServiceErrorCode, number>> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VERSION_LIMIT: 409,
  NO_CHANGE: 422,
  INVALID_TRANSITION: 422,
  ASSIGNEE_REQUIRED: 422,
  UNASSIGN_NOT_ALLOWED: 422,
  INTERNAL_ERROR: 500,
};
