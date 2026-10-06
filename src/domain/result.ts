/**
 * Outcome of a business rule. Rule violations are values, not exceptions; exceptions are
 * reserved for programmer errors (invalid Date objects, unsupported time zones, corrupt data).
 */
export type RuleResult<T, Code extends string = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: Code; readonly message: string };

export function ok<T>(value: T): { readonly ok: true; readonly value: T } {
  return { ok: true, value };
}

export function fail<Code extends string>(
  code: Code,
  message: string,
): { readonly ok: false; readonly code: Code; readonly message: string } {
  return { ok: false, code, message };
}
