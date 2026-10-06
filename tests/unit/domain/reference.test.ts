import { describe, expect, it } from "vitest";
import {
  formatReference,
  MAX_REFERENCE_NUMBER,
  parseReference,
  parseReferenceSearchTerm,
} from "@/domain/reference";

describe("formatReference", () => {
  it.each([
    [1, "WO-000001"],
    [123, "WO-000123"],
    [999_999, "WO-999999"],
    [1_000_000, "WO-1000000"],
    [MAX_REFERENCE_NUMBER, "WO-2147483647"],
  ])("%i → %s", (value, expected) => {
    expect(formatReference(value)).toBe(expected);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_REFERENCE_NUMBER + 1])(
    "rejects %s",
    (value) => {
      expect(() => formatReference(value)).toThrow(RangeError);
    },
  );
});

describe("parseReference", () => {
  it.each([
    ["WO-000123", 123, true],
    ["WO-1000000", 1_000_000, true],
    ["wo-123", 123, false],
    ["Wo-000123", 123, false],
    ["  WO-000123  ", 123, false],
    ["WO-123", 123, false],
    ["WO-0000000123", 123, false],
  ])("%j → %i (canonical: %s)", (input, number, canonical) => {
    expect(parseReference(input)).toEqual({ ok: true, value: { number, canonical } });
  });

  it.each([
    "WO-0",
    "WO-000000",
    "WO-",
    "WO--5",
    "WO-+7",
    "WO-12.5",
    "WO-1e3",
    "WO-1 2",
    "WO-２３",
    "WO-2147483648",
    "WO-00000000001",
    "WO 000123",
    "000123",
    "123",
    "",
  ])("rejects %j", (input) => {
    expect(parseReference(input)).toMatchObject({ ok: false, code: "INVALID_REFERENCE" });
  });
});

describe("parseReferenceSearchTerm", () => {
  it.each([
    ["123", 123],
    ["000123", 123],
    [" 42 ", 42],
    ["WO-000123", 123],
    ["wo-5", 5],
    ["2147483647", MAX_REFERENCE_NUMBER],
  ])("%j → %i", (term, expected) => {
    expect(parseReferenceSearchTerm(term)).toBe(expected);
  });

  it.each(["0", "-5", "12.5", "1e3", "abc", "", "2147483648", "WO-0", "lobby 123"])(
    "%j is not a reference",
    (term) => {
      expect(parseReferenceSearchTerm(term)).toBeNull();
    },
  );
});
