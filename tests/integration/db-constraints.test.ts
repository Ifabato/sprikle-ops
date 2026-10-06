import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import {
  disconnectTestPrisma,
  getTestPrisma,
  truncateTestDatabase,
} from "../helpers/test-database";

const prisma = getTestPrisma();

const NOW = new Date("2026-03-02T15:00:00.000Z");
const LATER = new Date("2026-03-09T15:00:00.000Z");

let adminId: string;
let technicianId: string;
let serviceAreaId: string;

/** Asserts a database error that names the given constraint (or trigger message). */
async function expectDatabaseError(action: Promise<unknown>, expected: string | RegExp) {
  const error = await action.then(
    () => {
      throw new Error("expected the database to reject the operation");
    },
    (reason: unknown) => reason,
  );
  const details = [
    error instanceof Error ? error.message : "",
    JSON.stringify(error, Object.getOwnPropertyNames(error ?? {})),
  ].join("\n");
  expect(details).toMatch(expected);
}

function workOrderData(
  overrides: Partial<Prisma.WorkOrderUncheckedCreateInput> = {},
): Prisma.WorkOrderUncheckedCreateInput {
  return {
    title: "Replace lobby light fixture",
    description: "Fixture flickers; replace ballast and bulbs.",
    serviceAreaId,
    createdById: adminId,
    dueAt: LATER,
    createdAt: NOW,
    ...overrides,
  };
}

beforeEach(async () => {
  await truncateTestDatabase();
  const [admin, technician, area] = await Promise.all([
    prisma.user.create({
      data: { name: "Avery Admin", email: "admin@sprikle.test", role: "ADMIN" },
    }),
    prisma.user.create({ data: { name: "Taylor Tech", email: "tech@sprikle.test" } }),
    prisma.serviceArea.create({ data: { name: "North District" } }),
  ]);
  adminId = admin.id;
  technicianId = technician.id;
  serviceAreaId = area.id;
});

afterAll(async () => {
  await disconnectTestPrisma();
});

describe("test database safety", () => {
  it("is connected to sprikle_ops_test", async () => {
    const rows = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    expect(rows[0]?.db).toBe("sprikle_ops_test");
  });

  it("does not truncate Prisma's migration history", async () => {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
    expect(Number(rows[0]?.count)).toBeGreaterThanOrEqual(1);
  });
});

describe("work_orders", () => {
  it("applies defaults and assigns sequential reference numbers from 1", async () => {
    const first = await prisma.workOrder.create({ data: workOrderData() });
    const second = await prisma.workOrder.create({ data: workOrderData() });

    expect(first).toMatchObject({ number: 1, status: "OPEN", priority: "MEDIUM", version: 0 });
    expect(second.number).toBe(2);
  });

  it("requires completed_at exactly when COMPLETED", async () => {
    await expectDatabaseError(
      prisma.workOrder.create({
        data: workOrderData({ status: "COMPLETED", assigneeId: technicianId }),
      }),
      "work_orders_completed_at_matches_status_check",
    );
    await expectDatabaseError(
      prisma.workOrder.create({ data: workOrderData({ completedAt: LATER }) }),
      "work_orders_completed_at_matches_status_check",
    );
    await expect(
      prisma.workOrder.create({
        data: workOrderData({ status: "COMPLETED", assigneeId: technicianId, completedAt: LATER }),
      }),
    ).resolves.toBeDefined();
  });

  it("requires cancelled_at exactly when CANCELLED", async () => {
    await expectDatabaseError(
      prisma.workOrder.create({ data: workOrderData({ status: "CANCELLED" }) }),
      "work_orders_cancelled_at_matches_status_check",
    );
    await expectDatabaseError(
      prisma.workOrder.create({ data: workOrderData({ cancelledAt: LATER }) }),
      "work_orders_cancelled_at_matches_status_check",
    );
  });

  it.each(["IN_PROGRESS", "BLOCKED"] as const)("requires an assignee for %s", async (status) => {
    await expectDatabaseError(
      prisma.workOrder.create({ data: workOrderData({ status }) }),
      "work_orders_assignee_required_check",
    );
    await expect(
      prisma.workOrder.create({ data: workOrderData({ status, assigneeId: technicianId }) }),
    ).resolves.toBeDefined();
  });

  it("rejects completion or cancellation before creation", async () => {
    const before = new Date(NOW.getTime() - 60_000);
    await expectDatabaseError(
      prisma.workOrder.create({
        data: workOrderData({ status: "COMPLETED", assigneeId: technicianId, completedAt: before }),
      }),
      "work_orders_completed_after_created_check",
    );
    await expectDatabaseError(
      prisma.workOrder.create({
        data: workOrderData({ status: "CANCELLED", cancelledAt: before }),
      }),
      "work_orders_cancelled_after_created_check",
    );
  });

  it("enforces title and description lengths after trimming", async () => {
    await expectDatabaseError(
      prisma.workOrder.create({ data: workOrderData({ title: "  ab  " }) }),
      "work_orders_title_length_check",
    );
    await expectDatabaseError(
      prisma.workOrder.create({ data: workOrderData({ description: "   " }) }),
      "work_orders_description_length_check",
    );
    await expectDatabaseError(
      prisma.workOrder.create({ data: workOrderData({ description: "x".repeat(5001) }) }),
      "work_orders_description_length_check",
    );
  });

  it("rejects a negative version", async () => {
    await expectDatabaseError(
      prisma.workOrder.create({ data: workOrderData({ version: -1 }) }),
      "work_orders_version_nonnegative_check",
    );
  });

  it("restricts deleting referenced users and service areas", async () => {
    await prisma.workOrder.create({ data: workOrderData({ assigneeId: technicianId }) });

    await expectDatabaseError(
      prisma.user.delete({ where: { id: technicianId } }),
      /work_orders_assignee_id_fkey|Foreign key constraint/,
    );
    await expectDatabaseError(
      prisma.serviceArea.delete({ where: { id: serviceAreaId } }),
      /work_orders_service_area_id_fkey|Foreign key constraint/,
    );
  });

  it("sorts priority and status in declaration order", async () => {
    for (const priority of ["CRITICAL", "LOW", "HIGH", "MEDIUM"] as const) {
      await prisma.workOrder.create({ data: workOrderData({ priority }) });
    }
    const rows = await prisma.workOrder.findMany({
      orderBy: { priority: "asc" },
      select: { priority: true },
    });
    expect(rows.map((row) => row.priority)).toEqual(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
  });
});

describe("users", () => {
  it("requires lowercase, unique emails", async () => {
    await expectDatabaseError(
      prisma.user.create({ data: { name: "Mixed Case", email: "Mixed@Sprikle.test" } }),
      "users_email_lowercase_check",
    );
    await expectDatabaseError(
      prisma.user.create({ data: { name: "Duplicate", email: "admin@sprikle.test" } }),
      /Unique constraint|users_email_key/,
    );
  });
});

describe("audit records", () => {
  async function createCommentWithActivity() {
    const workOrder = await prisma.workOrder.create({ data: workOrderData() });
    const comment = await prisma.workOrderComment.create({
      data: { workOrderId: workOrder.id, authorId: adminId, body: "Parts ordered." },
    });
    const activity = await prisma.workOrderActivity.create({
      data: {
        workOrderId: workOrder.id,
        actorId: adminId,
        type: "COMMENT_ADDED",
        description: "Avery Admin added a comment",
        commentId: comment.id,
      },
    });
    return { workOrder, comment, activity };
  }

  it("rejects blank comments and over-long comments", async () => {
    const workOrder = await prisma.workOrder.create({ data: workOrderData() });
    await expectDatabaseError(
      prisma.workOrderComment.create({
        data: { workOrderId: workOrder.id, authorId: adminId, body: "  " },
      }),
      "work_order_comments_body_length_check",
    );
    await expectDatabaseError(
      prisma.workOrderComment.create({
        data: { workOrderId: workOrder.id, authorId: adminId, body: "x".repeat(2001) },
      }),
      "work_order_comments_body_length_check",
    );
  });

  it("requires distinct from/to statuses for STATUS_CHANGED and a comment for COMMENT_ADDED", async () => {
    const workOrder = await prisma.workOrder.create({ data: workOrderData() });
    const base = { workOrderId: workOrder.id, actorId: adminId, description: "change" };

    await expectDatabaseError(
      prisma.workOrderActivity.create({
        data: { ...base, type: "STATUS_CHANGED", fromStatus: "OPEN" },
      }),
      "work_order_activities_status_change_check",
    );
    await expectDatabaseError(
      prisma.workOrderActivity.create({
        data: { ...base, type: "STATUS_CHANGED", fromStatus: "OPEN", toStatus: "OPEN" },
      }),
      "work_order_activities_status_change_check",
    );
    await expectDatabaseError(
      prisma.workOrderActivity.create({ data: { ...base, type: "COMMENT_ADDED" } }),
      "work_order_activities_comment_required_check",
    );
    await expect(
      prisma.workOrderActivity.create({
        data: { ...base, type: "STATUS_CHANGED", fromStatus: "OPEN", toStatus: "CANCELLED" },
      }),
    ).resolves.toBeDefined();
  });

  it("blocks UPDATE and DELETE of comments", async () => {
    const { comment } = await createCommentWithActivity();

    await expectDatabaseError(
      prisma.workOrderComment.update({ where: { id: comment.id }, data: { body: "edited" } }),
      /append-only/,
    );
    await expectDatabaseError(
      prisma.workOrderComment.delete({ where: { id: comment.id } }),
      /append-only|Foreign key constraint/,
    );
  });

  it("blocks UPDATE and DELETE of activity", async () => {
    const { activity } = await createCommentWithActivity();

    await expectDatabaseError(
      prisma.workOrderActivity.update({
        where: { id: activity.id },
        data: { description: "rewritten" },
      }),
      /append-only/,
    );
    await expectDatabaseError(
      prisma.workOrderActivity.delete({ where: { id: activity.id } }),
      /append-only/,
    );
  });

  it("restricts deleting a work order that has audit records", async () => {
    const { workOrder } = await createCommentWithActivity();

    await expectDatabaseError(
      prisma.workOrder.delete({ where: { id: workOrder.id } }),
      /fkey|Foreign key constraint/,
    );
  });
});

describe("schema conventions", () => {
  it("stores every timestamp as timestamptz", async () => {
    const rows = await prisma.$queryRaw<
      { table_name: string; column_name: string; data_type: string }[]
    >`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name LIKE '%_at' AND table_name <> '_prisma_migrations'`;
    expect(rows.length).toBeGreaterThanOrEqual(9);
    for (const row of rows) {
      expect(row.data_type, `${row.table_name}.${row.column_name}`).toBe(
        "timestamp with time zone",
      );
    }
  });

  it("has the planned work-order indexes", async () => {
    const rows = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'work_orders'`;
    expect(rows.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        "work_orders_number_key",
        "work_orders_status_due_at_idx",
        "work_orders_assignee_id_status_idx",
        "work_orders_priority_status_idx",
        "work_orders_service_area_id_idx",
        "work_orders_created_by_id_idx",
        "work_orders_created_at_idx",
        "work_orders_updated_at_idx",
        "work_orders_completed_at_idx",
      ]),
    );
  });
});
