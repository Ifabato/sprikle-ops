import { describe, expect, it } from "vitest";
import { commentSchema } from "@/validation/comment";

describe("commentSchema", () => {
  it("trims the body", () => {
    expect(commentSchema.parse({ body: "  Parts ordered.  " })).toEqual({ body: "Parts ordered." });
  });

  it("accepts exactly 2000 characters after trimming", () => {
    expect(commentSchema.safeParse({ body: ` ${"x".repeat(2000)} ` }).success).toBe(true);
  });

  it.each([
    ["missing body", {}],
    ["blank body", { body: " \n\t " }],
    ["over-long body", { body: "x".repeat(2001) }],
    ["non-string body", { body: 42 }],
    ["unknown field", { body: "ok", authorId: "admin-1" }],
  ])("rejects %s", (_label, input) => {
    expect(commentSchema.safeParse(input).success).toBe(false);
  });
});
