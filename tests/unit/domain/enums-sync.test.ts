// The ONLY unit test that imports generated Prisma code. Domain and validation modules stay
// client-safe by duplicating enum values; this test fails if they drift from the database enums.
import { describe, expect, it } from "vitest";
import { ACTIVITY_TYPES, PRIORITIES, ROLES, WORK_ORDER_STATUSES } from "@/domain/enums";
import { ActivityType, Priority, Role, WorkOrderStatus } from "@/generated/prisma/enums";

describe("domain enums match the Prisma schema (same values, same order)", () => {
  it.each([
    ["Role", ROLES, Role],
    ["WorkOrderStatus", WORK_ORDER_STATUSES, WorkOrderStatus],
    ["Priority", PRIORITIES, Priority],
    ["ActivityType", ACTIVITY_TYPES, ActivityType],
  ] as const)("%s", (_name, domain, prisma) => {
    expect([...domain]).toEqual(Object.values(prisma));
  });
});
