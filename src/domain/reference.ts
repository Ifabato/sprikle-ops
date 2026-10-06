import { MAX_INT32 } from "./limits";
import { fail, ok, type RuleResult } from "./result";

// Human-readable work-order references: WO- + number, zero-padded to at least 6 digits.
// Numbers come from the database sequence; this module never generates them.

export const REFERENCE_PREFIX = "WO-";
export const REFERENCE_MIN_DIGITS = 6;
export const MIN_REFERENCE_NUMBER = 1;
/** PostgreSQL `serial` maximum. */
export const MAX_REFERENCE_NUMBER = MAX_INT32;

function isValidReferenceNumber(value: number): boolean {
  return (
    Number.isSafeInteger(value) && value >= MIN_REFERENCE_NUMBER && value <= MAX_REFERENCE_NUMBER
  );
}

/** 123 → "WO-000123"; numbers above 999999 keep all digits ("WO-1000000"). */
export function formatReference(value: number): string {
  if (!isValidReferenceNumber(value)) {
    throw new RangeError(
      `Reference number must be an integer from ${MIN_REFERENCE_NUMBER} to ${MAX_REFERENCE_NUMBER}.`,
    );
  }
  return `${REFERENCE_PREFIX}${String(value).padStart(REFERENCE_MIN_DIGITS, "0")}`;
}

// ASCII digits only (no `u` flag, so \d is [0-9]); 1–10 digits keeps values parseable exactly.
const REFERENCE_PATTERN = /^WO-(\d{1,10})$/i;
const NUMBER_PATTERN = /^\d{1,10}$/;

export interface ParsedReference {
  readonly number: number;
  /** True when the input is exactly the canonical form (for example "WO-000123"). */
  readonly canonical: boolean;
}

/** Parses "WO-000123" (any case, surrounding whitespace allowed). Plain numbers are not accepted. */
export function parseReference(input: string): RuleResult<ParsedReference, "INVALID_REFERENCE"> {
  const match = REFERENCE_PATTERN.exec(input.trim());
  const value = match?.[1] === undefined ? Number.NaN : Number(match[1]);
  if (!isValidReferenceNumber(value)) {
    return fail("INVALID_REFERENCE", "Work order reference must look like WO-000123.");
  }
  return ok({ number: value, canonical: input === formatReference(value) });
}

/**
 * Interprets a search term as a reference: "WO-000123", "wo-123", or a bare number such as
 * "123". Returns null when the term is not a valid reference (text search still applies).
 */
export function parseReferenceSearchTerm(term: string): number | null {
  const trimmed = term.trim();
  if (NUMBER_PATTERN.test(trimmed)) {
    const value = Number(trimmed);
    return isValidReferenceNumber(value) ? value : null;
  }
  const parsed = parseReference(trimmed);
  return parsed.ok ? parsed.value.number : null;
}
