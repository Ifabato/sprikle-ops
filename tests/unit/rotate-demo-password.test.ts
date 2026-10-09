import { describe, expect, it } from "vitest";
import {
  readPasswordFromEnv,
  replacePasswordLine,
} from "../../scripts/lib/rotate-demo-password.ts";

describe("demo password .env handling", () => {
  const content = "A=1\nSEED_DEMO_PASSWORD=old-value-0001\nB=2\n";

  it("reads the current value", () => {
    expect(readPasswordFromEnv(content)).toBe("old-value-0001");
    expect(readPasswordFromEnv('SEED_DEMO_PASSWORD="quoted-value-01"\n')).toBe("quoted-value-01");
  });

  it("replaces only the password line and keeps every other byte", () => {
    expect(replacePasswordLine(content, "new-value-0002")).toBe(
      "A=1\nSEED_DEMO_PASSWORD=new-value-0002\nB=2\n",
    );
    expect(replacePasswordLine("SEED_DEMO_PASSWORD=x\r\nC=3", "y")).toBe(
      "SEED_DEMO_PASSWORD=y\r\nC=3",
    );
  });

  it("refuses a missing or duplicated password line", () => {
    expect(readPasswordFromEnv("A=1\n")).toBeNull();
    expect(readPasswordFromEnv("SEED_DEMO_PASSWORD=a\nSEED_DEMO_PASSWORD=b\n")).toBeNull();
    expect(() => replacePasswordLine("A=1\n", "x")).toThrow();
  });

  it("does not treat a similarly named key as the password line", () => {
    expect(readPasswordFromEnv("SEED_DEMO_PASSWORD_OLD=a\nSEED_DEMO_PASSWORD=b\n")).toBe("b");
  });
});
