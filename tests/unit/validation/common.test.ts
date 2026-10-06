import { describe, expect, it } from "vitest";
import {
  dateOnlySchema,
  idSchema,
  prioritySchema,
  statusSchema,
  titleSchema,
  versionSchema,
} from "@/validation/common";

describe("idSchema", () => {
  it.each(["ckx1y2z3a0000qzrmn8v4w5x6", "a", "user_ABC-123", "x".repeat(64)])(
    "accepts %s",
    (id) => {
      expect(idSchema.safeParse(id).success).toBe(true);
    },
  );

  it.each(["", "x".repeat(65), "has space", "semi;colon", "ünicode", "../etc", 42, null])(
    "rejects %j",
    (id) => {
      expect(idSchema.safeParse(id).success).toBe(false);
    },
  );
});

describe("versionSchema", () => {
  it.each([0, 1, 2_147_483_647])("accepts %i", (value) => {
    expect(versionSchema.parse(value)).toBe(value);
  });

  it.each([-1, 1.5, 2_147_483_648, Number.NaN, "1", null])("rejects %j", (value) => {
    expect(versionSchema.safeParse(value).success).toBe(false);
  });
});

describe("text and enums", () => {
  it("trims before checking length", () => {
    expect(titleSchema.parse("   Fix door   ")).toBe("Fix door");
    expect(titleSchema.safeParse("  ab  ").success).toBe(false);
    expect(titleSchema.safeParse("x".repeat(121)).success).toBe(false);
    expect(titleSchema.parse(` ${"x".repeat(120)} `)).toHaveLength(120);
  });

  it("accepts only known statuses and priorities (case-sensitive)", () => {
    expect(statusSchema.safeParse("IN_PROGRESS").success).toBe(true);
    expect(statusSchema.safeParse("in_progress").success).toBe(false);
    expect(prioritySchema.safeParse("URGENT").success).toBe(false);
  });

  it("accepts only real YYYY-MM-DD dates", () => {
    expect(dateOnlySchema.safeParse("2024-02-29").success).toBe(true);
    expect(dateOnlySchema.safeParse("2026-02-29").success).toBe(false);
    expect(dateOnlySchema.safeParse("2026-10-05T00:00:00Z").success).toBe(false);
    expect(dateOnlySchema.safeParse(20261005).success).toBe(false);
  });
});
