import { describe, expect, it } from "vitest";
import { WORK_ORDER_STATUSES, type WorkOrderStatus } from "@/domain/enums";
import { MAX_INT32 } from "@/domain/limits";
import type { Actor, MaybeActor } from "@/domain/permissions";
import { allowedTargets, planTransition, type TransitionSubject } from "@/domain/transitions";

const admin: Actor = { id: "admin-1", role: "ADMIN", isActive: true };
const tech: Actor = { id: "tech-1", role: "TEAM_MEMBER", isActive: true };
const otherTech: Actor = { id: "tech-2", role: "TEAM_MEMBER", isActive: true };

const CREATED = new Date("2026-03-01T15:00:00.000Z");
const EARLIER = new Date("2026-03-02T15:00:00.000Z");
const NOW = new Date("2026-03-05T15:00:00.000Z");

/**
 * Independent restatement of the approved matrix (docs/authorization.md):
 * "-" same status, "AT" admin or assigned team member, "A" admin only, "x" nobody.
 */
const EXPECTED: Record<WorkOrderStatus, Record<WorkOrderStatus, "-" | "AT" | "A" | "x">> = {
  OPEN: { OPEN: "-", IN_PROGRESS: "AT", BLOCKED: "A", COMPLETED: "A", CANCELLED: "A" },
  IN_PROGRESS: { OPEN: "A", IN_PROGRESS: "-", BLOCKED: "AT", COMPLETED: "AT", CANCELLED: "A" },
  BLOCKED: { OPEN: "A", IN_PROGRESS: "AT", BLOCKED: "-", COMPLETED: "x", CANCELLED: "A" },
  COMPLETED: { OPEN: "x", IN_PROGRESS: "A", BLOCKED: "x", COMPLETED: "-", CANCELLED: "x" },
  CANCELLED: { OPEN: "A", IN_PROGRESS: "x", BLOCKED: "x", COMPLETED: "x", CANCELLED: "-" },
};

function subject(
  status: WorkOrderStatus,
  overrides: Partial<TransitionSubject> = {},
): TransitionSubject {
  return {
    status,
    assigneeId: tech.id,
    version: 4,
    createdAt: CREATED,
    completedAt: status === "COMPLETED" ? EARLIER : null,
    cancelledAt: status === "CANCELLED" ? EARLIER : null,
    ...overrides,
  };
}

/** `null` means "no note" (a default parameter would replace an explicit undefined). */
const request = (toStatus: WorkOrderStatus, note: string | null = "Waiting on parts") => ({
  toStatus,
  expectedVersion: 4,
  note: note ?? undefined,
});

const pairs = WORK_ORDER_STATUSES.flatMap((from) =>
  WORK_ORDER_STATUSES.map((to) => [from, to, EXPECTED[from][to]] as const),
);

describe("transition matrix (all 25 pairs × actors)", () => {
  it.each(pairs)("%s → %s (%s)", (from, to, rule) => {
    const adminResult = planTransition(admin, subject(from), request(to), NOW);
    const techResult = planTransition(tech, subject(from), request(to), NOW);

    const expectedFor = (allowed: boolean) =>
      rule === "-"
        ? "NO_CHANGE"
        : rule === "x"
          ? "INVALID_TRANSITION"
          : allowed
            ? "OK"
            : "FORBIDDEN";
    const outcome = (result: ReturnType<typeof planTransition>) => (result.ok ? "OK" : result.code);

    expect(outcome(adminResult)).toBe(expectedFor(true));
    expect(outcome(techResult)).toBe(expectedFor(rule === "AT"));

    // Out of scope and unauthenticated actors learn nothing, whatever the pair.
    expect(outcome(planTransition(otherTech, subject(from), request(to), NOW))).toBe("NOT_FOUND");
    expect(
      outcome(planTransition(tech, subject(from, { assigneeId: null }), request(to), NOW)),
    ).toBe("NOT_FOUND");
    for (const actor of [null, undefined, { ...admin, isActive: false }] as MaybeActor[]) {
      expect(outcome(planTransition(actor, subject(from), request(to), NOW))).toBe(
        "UNAUTHENTICATED",
      );
    }
  });
});

describe("allowedTargets", () => {
  it("matches the matrix for each role", () => {
    for (const from of WORK_ORDER_STATUSES) {
      const forAdmin = WORK_ORDER_STATUSES.filter((to) => ["A", "AT"].includes(EXPECTED[from][to]));
      const forTech = WORK_ORDER_STATUSES.filter((to) => EXPECTED[from][to] === "AT");
      expect(allowedTargets("ADMIN", from).sort()).toEqual([...forAdmin].sort());
      expect(allowedTargets("TEAM_MEMBER", from).sort()).toEqual([...forTech].sort());
    }
  });
});

describe("preconditions", () => {
  it.each(["IN_PROGRESS", "BLOCKED", "COMPLETED"] as const)("%s requires an assignee", (to) => {
    const result = planTransition(admin, subject("OPEN", { assigneeId: null }), request(to), NOW);
    expect(result).toMatchObject({ ok: false, code: "ASSIGNEE_REQUIRED" });
  });

  it("admin quick close OPEN → COMPLETED requires an existing assignee (Q16)", () => {
    expect(planTransition(admin, subject("OPEN"), request("COMPLETED"), NOW).ok).toBe(true);
  });

  it.each(["CANCELLED", "OPEN"] as const)("%s does not require an assignee", (to) => {
    const from = to === "OPEN" ? "CANCELLED" : "OPEN";
    expect(planTransition(admin, subject(from, { assigneeId: null }), request(to), NOW).ok).toBe(
      true,
    );
  });

  it.each([
    ["BLOCKED", "IN_PROGRESS", "A note explaining the block is required."],
    ["CANCELLED", "OPEN", "A cancellation reason is required."],
  ] as const)("%s requires a note", (to, from, message) => {
    for (const note of [null, "", "   \n\t "]) {
      expect(planTransition(admin, subject(from), request(to, note), NOW)).toEqual({
        ok: false,
        code: "NOTE_REQUIRED",
        message,
      });
    }
  });

  it("rejects notes longer than 2000 characters after trimming", () => {
    expect(
      planTransition(admin, subject("OPEN"), request("CANCELLED", ` ${"x".repeat(2001)} `), NOW),
    ).toMatchObject({
      ok: false,
      code: "NOTE_TOO_LONG",
    });
    expect(
      planTransition(admin, subject("OPEN"), request("CANCELLED", ` ${"x".repeat(2000)} `), NOW).ok,
    ).toBe(true);
  });

  it("detects stale versions before revealing transition rules", () => {
    const stale = { ...request("OPEN"), expectedVersion: 3 };
    expect(planTransition(admin, subject("OPEN"), stale, NOW)).toMatchObject({
      code: "VERSION_CONFLICT",
    });
  });

  it("rejects a clock earlier than creation", () => {
    const before = new Date(CREATED.getTime() - 1);
    expect(planTransition(admin, subject("OPEN"), request("CANCELLED"), before)).toMatchObject({
      code: "CLOCK_SKEW",
    });
  });

  it("refuses to exceed the database integer limit for version", () => {
    const atLimit = subject("OPEN", { version: MAX_INT32 });
    expect(
      planTransition(
        admin,
        atLimit,
        { ...request("IN_PROGRESS"), expectedVersion: MAX_INT32 },
        NOW,
      ),
    ).toMatchObject({ code: "VERSION_LIMIT" });
    const belowLimit = subject("OPEN", { version: MAX_INT32 - 1 });
    const result = planTransition(
      admin,
      belowLimit,
      { ...request("IN_PROGRESS"), expectedVersion: MAX_INT32 - 1 },
      NOW,
    );
    expect(result.ok && result.value.nextVersion).toBe(MAX_INT32);
  });

  it("rejects invalid Date inputs", () => {
    expect(() =>
      planTransition(admin, subject("OPEN"), request("CANCELLED"), new Date(Number.NaN)),
    ).toThrow(TypeError);
    expect(() =>
      planTransition(
        admin,
        subject("OPEN", { createdAt: new Date(Number.NaN) }),
        request("CANCELLED"),
        NOW,
      ),
    ).toThrow(TypeError);
  });
});

describe("precedence", () => {
  it("unauthenticated beats every other outcome, including NO_CHANGE", () => {
    expect(planTransition(null, subject("OPEN"), request("OPEN"), NOW)).toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(
      planTransition(null, subject("OPEN"), { ...request("OPEN"), expectedVersion: 0 }, NOW),
    ).toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("out-of-scope team members get NOT_FOUND, never NO_CHANGE, VERSION_CONFLICT, or INVALID_TRANSITION", () => {
    expect(planTransition(otherTech, subject("OPEN"), request("OPEN"), NOW)).toMatchObject({
      code: "NOT_FOUND",
    });
    expect(planTransition(otherTech, subject("BLOCKED"), request("COMPLETED"), NOW)).toMatchObject({
      code: "NOT_FOUND",
    });
    expect(
      planTransition(
        otherTech,
        subject("OPEN"),
        { ...request("IN_PROGRESS"), expectedVersion: 0 },
        NOW,
      ),
    ).toMatchObject({ code: "NOT_FOUND" });
  });

  it("an assigned team member reopening completed work gets FORBIDDEN, not INVALID_TRANSITION", () => {
    expect(planTransition(tech, subject("COMPLETED"), request("IN_PROGRESS"), NOW)).toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("an assigned team member moving BLOCKED → COMPLETED gets INVALID_TRANSITION (nobody may)", () => {
    expect(planTransition(tech, subject("BLOCKED"), request("COMPLETED"), NOW)).toMatchObject({
      code: "INVALID_TRANSITION",
    });
  });
});

describe("planned side effects", () => {
  it("completion stamps completedAt with now and records the status change", () => {
    const result = planTransition(tech, subject("IN_PROGRESS"), request("COMPLETED", null), NOW);
    expect(result).toEqual({
      ok: true,
      value: {
        status: "COMPLETED",
        completedAt: NOW,
        cancelledAt: null,
        nextVersion: 5,
        activity: { type: "STATUS_CHANGED", fromStatus: "IN_PROGRESS", toStatus: "COMPLETED" },
        comment: null,
      },
    });
  });

  it("reopening clears completedAt", () => {
    const result = planTransition(admin, subject("COMPLETED"), request("IN_PROGRESS", null), NOW);
    expect(result.ok && [result.value.completedAt, result.value.cancelledAt]).toEqual([null, null]);
  });

  it("cancellation stamps cancelledAt and stores the trimmed reason as a comment", () => {
    const result = planTransition(
      admin,
      subject("BLOCKED"),
      request("CANCELLED", "  Customer withdrew  "),
      NOW,
    );
    expect(result.ok && result.value).toMatchObject({
      status: "CANCELLED",
      cancelledAt: NOW,
      completedAt: null,
      comment: { body: "Customer withdrew" },
    });
  });

  it("restoration clears cancelledAt", () => {
    const result = planTransition(admin, subject("CANCELLED"), request("OPEN", null), NOW);
    expect(result.ok && [result.value.status, result.value.cancelledAt]).toEqual(["OPEN", null]);
  });

  it("keeps an optional note on transitions that do not require one", () => {
    const result = planTransition(tech, subject("OPEN"), request("IN_PROGRESS", "On site"), NOW);
    expect(result.ok && result.value.comment).toEqual({ body: "On site" });
  });

  it("never returns or mutates the caller's Date instances", () => {
    const now = new Date(NOW.getTime());
    const start = subject("IN_PROGRESS");
    const result = planTransition(tech, start, request("COMPLETED"), now);
    expect(result.ok && result.value.completedAt).not.toBe(now);
    expect(now.getTime()).toBe(NOW.getTime());

    const blocked = planTransition(admin, subject("COMPLETED"), request("IN_PROGRESS"), now);
    expect(blocked.ok).toBe(true);
    const fromBlocked = subject("BLOCKED", { completedAt: null });
    const kept = planTransition(admin, fromBlocked, request("OPEN"), now);
    expect(kept.ok && kept.value.completedAt).toBeNull();
  });
});
