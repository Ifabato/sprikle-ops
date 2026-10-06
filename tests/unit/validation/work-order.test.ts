import { describe, expect, it } from "vitest";
import {
  createWorkOrderSchema,
  editWorkOrderSchema,
  transitionSchema,
  workOrderReferenceParamSchema,
} from "@/validation/work-order";

const validCreate = {
  title: "  Replace lobby light  ",
  description: " Ballast failing. ",
  serviceAreaId: "area-north",
  dueDate: "2026-10-09",
};

describe("createWorkOrderSchema", () => {
  it("trims text and defaults priority to MEDIUM", () => {
    expect(createWorkOrderSchema.parse(validCreate)).toEqual({
      title: "Replace lobby light",
      description: "Ballast failing.",
      serviceAreaId: "area-north",
      dueDate: "2026-10-09",
      priority: "MEDIUM",
    });
  });

  it("accepts an optional or null assignee", () => {
    expect(createWorkOrderSchema.parse({ ...validCreate, assigneeId: "tech-1" }).assigneeId).toBe(
      "tech-1",
    );
    expect(createWorkOrderSchema.parse({ ...validCreate, assigneeId: null }).assigneeId).toBeNull();
  });

  it.each([
    ["missing title", { ...validCreate, title: undefined }],
    ["short title", { ...validCreate, title: " ab " }],
    ["blank description", { ...validCreate, description: "   " }],
    ["long description", { ...validCreate, description: "x".repeat(5001) }],
    ["missing due date", { ...validCreate, dueDate: undefined }],
    ["impossible due date", { ...validCreate, dueDate: "2026-02-30" }],
    ["due date with time", { ...validCreate, dueDate: "2026-10-09T10:00" }],
    ["bad service area id", { ...validCreate, serviceAreaId: "a b" }],
    ["unknown priority", { ...validCreate, priority: "URGENT" }],
    ["unexpected status field", { ...validCreate, status: "COMPLETED" }],
    ["unexpected createdById", { ...validCreate, createdById: "admin-1" }],
    ["unexpected version", { ...validCreate, version: 0 }],
  ])("rejects %s", (_label, input) => {
    expect(createWorkOrderSchema.safeParse(input).success).toBe(false);
  });
});

describe("editWorkOrderSchema", () => {
  it("does not apply create-time defaults to omitted fields", () => {
    expect(editWorkOrderSchema.parse({ version: 3, title: " New title " })).toEqual({
      version: 3,
      title: "New title",
    });
  });

  it("accepts null assignee as an explicit unassign", () => {
    expect(editWorkOrderSchema.parse({ version: 3, assigneeId: null })).toEqual({
      version: 3,
      assigneeId: null,
    });
  });

  it.each([
    ["only version", { version: 3 }],
    ["missing version", { title: "New title" }],
    ["negative version", { version: -1, title: "New title" }],
    ["status change", { version: 3, status: "COMPLETED" }],
    ["unknown field", { version: 3, title: "New title", extra: true }],
    ["explicit undefined only", { version: 3, title: undefined }],
    ["blank description", { version: 3, description: "  " }],
  ])("rejects %s", (_label, input) => {
    expect(editWorkOrderSchema.safeParse(input).success).toBe(false);
  });
});

describe("transitionSchema", () => {
  it("accepts a transition with an optional trimmed note", () => {
    expect(transitionSchema.parse({ version: 1, toStatus: "IN_PROGRESS" })).toEqual({
      version: 1,
      toStatus: "IN_PROGRESS",
    });
    expect(
      transitionSchema.parse({ version: 1, toStatus: "BLOCKED", note: "  Waiting on parts " }).note,
    ).toBe("Waiting on parts");
  });

  it.each([
    [
      "BLOCKED without note",
      { version: 1, toStatus: "BLOCKED" },
      "A note explaining the block is required.",
    ],
    [
      "CANCELLED without reason",
      { version: 1, toStatus: "CANCELLED" },
      "A cancellation reason is required.",
    ],
  ])("rejects %s", (_label, input, message) => {
    const result = transitionSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(message);
  });

  it.each([
    ["whitespace-only note", { version: 1, toStatus: "CANCELLED", note: "   " }],
    ["over-long note", { version: 1, toStatus: "BLOCKED", note: "x".repeat(2001) }],
    ["unknown status", { version: 1, toStatus: "DONE" }],
    ["missing version", { toStatus: "OPEN" }],
    ["unknown field", { version: 1, toStatus: "OPEN", completedAt: "2026-01-01" }],
  ])("rejects %s", (_label, input) => {
    expect(transitionSchema.safeParse(input).success).toBe(false);
  });
});

describe("workOrderReferenceParamSchema", () => {
  it("parses references to numbers", () => {
    expect(workOrderReferenceParamSchema.parse("WO-000123")).toBe(123);
    expect(workOrderReferenceParamSchema.parse("wo-5")).toBe(5);
  });

  it.each(["123", "WO-0", "WO-12.5", "", "WO-2147483648"])("rejects %j", (value) => {
    expect(workOrderReferenceParamSchema.safeParse(value).success).toBe(false);
  });
});
