import { describe, expect, it } from "vitest";
import { CONTACT, CONTACT_DESTINATION, resolveContact } from "@/config/contact";

describe("contact destination", () => {
  it("is not configured yet, so no link is rendered", () => {
    expect(CONTACT_DESTINATION).toBeNull();
    expect(CONTACT).toBeNull();
  });

  it("accepts a mailto address", () => {
    expect(resolveContact("mailto:hello@example.com")).toEqual({
      href: "mailto:hello@example.com",
      display: "hello@example.com",
      kind: "email",
    });
  });

  it("accepts an https URL", () => {
    expect(resolveContact("https://www.example.com/contact")).toEqual({
      href: "https://www.example.com/contact",
      display: "example.com",
      kind: "web",
    });
  });

  it.each([
    ["empty", ""],
    ["http", "http://example.com"],
    ["javascript", "javascript:alert(1)"],
    ["credentials", "https://user:pass@example.com"],
    ["malformed mailto", "mailto:not-an-email"],
    ["mailto with query", "mailto:a@example.com?subject=x"],
    ["no host dot", "https://localhost/contact"],
    ["plain text", "contact me"],
  ])("refuses %s", (_label, value) => {
    expect(resolveContact(value)).toBeNull();
  });
});
