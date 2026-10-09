import {
  ACTIVE_STATUSES,
  PRIORITIES,
  WORK_ORDER_STATUSES,
  type Priority,
  type WorkOrderStatus,
} from "@/domain/enums";
import {
  averageCompletionTime,
  completionRate,
  countByBucket,
  isoWeekBuckets,
  needsAttention,
  reportingWindow,
  type AttentionCategory,
  type Interval,
  type MeanDuration,
  type Rate,
  attentionCategory,
} from "@/domain/metrics";
import { decide, workOrderScopeFor, type Actor } from "@/domain/permissions";
import { formatReference } from "@/domain/reference";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { failure, success, type ServiceResult } from "./result";

// Dashboard and analytics metrics (docs/metrics.md). Counts are SQL aggregates over CURRENT
// work-order records; day/week windows come from the pure domain helpers (New York calendar,
// DST-aware). tests/integration/metrics.test.ts checks every value against the pure helpers applied
// to the same records.

type Db = PrismaClient;

const ACTIVE = [...ACTIVE_STATUSES] as WorkOrderStatus[];
const HIGH_PRIORITIES: Priority[] = ["HIGH", "CRITICAL"];

function scopeWhere(actor: Actor): Prisma.WorkOrderWhereInput {
  const scope = workOrderScopeFor(actor);
  if (!scope.ok) throw new Error("metrics require an authenticated actor");
  return scope.value.kind === "assignedTo" ? { assigneeId: scope.value.userId } : {};
}

async function cohortRate(
  db: Db,
  where: Prisma.WorkOrderWhereInput,
  window: Interval,
): Promise<Rate> {
  const groups = await db.workOrder.groupBy({
    by: ["status"],
    where: { ...where, createdAt: { gte: window.start, lt: window.end } },
    _count: { _all: true },
  });
  const count = (status: WorkOrderStatus) =>
    groups.find((g) => g.status === status)?._count._all ?? 0;
  const total = groups.reduce((sum, g) => sum + g._count._all, 0);
  return completionRate({ total, completed: count("COMPLETED"), cancelled: count("CANCELLED") });
}

// ---------------------------------------------------------------------------
// Dashboard (AC-8)
// ---------------------------------------------------------------------------

export interface DashboardKpis {
  readonly open: number;
  readonly inProgress: number;
  readonly blocked: number;
  readonly overdue: number;
  readonly highPriority: number;
  readonly active: number;
  /** Last 30 days, cohort by creation date. */
  readonly completionRate: Rate;
  readonly completionWindow: Interval;
}

export interface AttentionItem {
  readonly reference: string;
  readonly number: number;
  readonly title: string;
  readonly status: WorkOrderStatus;
  readonly priority: Priority;
  readonly dueAt: Date;
  readonly category: AttentionCategory;
  readonly assignee: { readonly id: string; readonly name: string } | null;
}

export interface RecentActivityItem {
  readonly id: string;
  readonly description: string;
  readonly type: string;
  readonly actor: { readonly id: string; readonly name: string };
  readonly workOrder: { readonly reference: string; readonly title: string };
  readonly createdAt: Date;
}

export interface Dashboard {
  readonly asOf: Date;
  readonly scope: "organization" | "assigned";
  readonly kpis: DashboardKpis;
  readonly needsAttention: readonly AttentionItem[];
  readonly recentActivity: readonly RecentActivityItem[];
}

export async function getDashboard(
  db: Db,
  actor: Actor | null,
  now: Date,
): Promise<ServiceResult<Dashboard>> {
  const decision = decide(actor, "dashboard.view");
  if (!decision.allowed) return failure(decision.reason, "Sign in to continue.");
  const scope = scopeWhere(decision.actor);
  const active = { ...scope, status: { in: ACTIVE } };
  const window = reportingWindow(now, 30);

  const [byStatus, overdue, highPriority, rate, candidates, recent] = await Promise.all([
    db.workOrder.groupBy({ by: ["status"], where: active, _count: { _all: true } }),
    db.workOrder.count({ where: { ...active, dueAt: { lt: now } } }),
    db.workOrder.count({ where: { ...active, priority: { in: HIGH_PRIORITIES } } }),
    cohortRate(db, scope, window),
    db.workOrder.findMany({
      where: {
        ...active,
        OR: [{ dueAt: { lt: now } }, { status: "BLOCKED" }, { priority: { in: HIGH_PRIORITIES } }],
      },
      select: {
        number: true,
        title: true,
        status: true,
        priority: true,
        dueAt: true,
        assignee: { select: { id: true, name: true } },
      },
    }),
    db.workOrderActivity.findMany({
      where: { workOrder: scope },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
      select: {
        id: true,
        type: true,
        description: true,
        createdAt: true,
        actor: { select: { id: true, name: true } },
        workOrder: { select: { number: true, title: true } },
      },
    }),
  ]);
  const statusCount = (status: WorkOrderStatus) =>
    byStatus.find((g) => g.status === status)?._count._all ?? 0;

  return success({
    asOf: now,
    scope: decision.actor.role === "ADMIN" ? "organization" : "assigned",
    kpis: {
      open: statusCount("OPEN"),
      inProgress: statusCount("IN_PROGRESS"),
      blocked: statusCount("BLOCKED"),
      overdue,
      highPriority,
      active: byStatus.reduce((sum, g) => sum + g._count._all, 0),
      completionRate: rate,
      completionWindow: window,
    },
    needsAttention: needsAttention(candidates, now).map((item) => ({
      reference: formatReference(item.number),
      number: item.number,
      title: item.title,
      status: item.status,
      priority: item.priority,
      dueAt: item.dueAt,
      category: attentionCategory(item, now)!,
      assignee: item.assignee,
    })),
    recentActivity: recent.map((row) => ({
      id: row.id,
      type: row.type,
      description: row.description,
      actor: row.actor,
      workOrder: { reference: formatReference(row.workOrder.number), title: row.workOrder.title },
      createdAt: row.createdAt,
    })),
  });
}

// ---------------------------------------------------------------------------
// Analytics (AC-9, ADMIN only)
// ---------------------------------------------------------------------------

export const COMPLETION_WINDOWS = [7, 30, 90] as const;
export type CompletionWindowDays = (typeof COMPLETION_WINDOWS)[number];

export interface WorkloadRow {
  /** null for the "Unassigned" row. */
  readonly user: { readonly id: string; readonly name: string; readonly isActive: boolean } | null;
  readonly byStatus: Readonly<Record<"OPEN" | "IN_PROGRESS" | "BLOCKED", number>>;
  readonly active: number;
  readonly overdue: number;
  readonly highPriority: number;
}

export interface TrendWeek {
  readonly start: Date;
  readonly end: Date;
  readonly created: number;
  readonly completed: number;
}

export interface Analytics {
  readonly asOf: Date;
  readonly statusRange: Interval | null;
  readonly byStatus: Readonly<Record<WorkOrderStatus, number>>;
  readonly activeByPriority: Readonly<Record<Priority, number>>;
  readonly overdue: number;
  readonly completionRate: Rate;
  readonly completionWindow: Interval;
  readonly completionWindowDays: CompletionWindowDays;
  readonly workload: readonly WorkloadRow[];
  readonly trend: readonly TrendWeek[];
  readonly averageCompletion: MeanDuration;
  readonly averageWindow: Interval;
}

export interface AnalyticsOptions {
  /** Creation-date range for "Work by status"; null means all time. */
  readonly statusRange?: Interval | null;
  readonly completionWindowDays?: CompletionWindowDays;
}

export async function getAnalytics(
  db: Db,
  actor: Actor | null,
  now: Date,
  options: AnalyticsOptions = {},
): Promise<ServiceResult<Analytics>> {
  const decision = decide(actor, "analytics.view");
  if (!decision.allowed) {
    return failure(
      decision.reason,
      decision.reason === "FORBIDDEN"
        ? "Analytics is available to administrators only."
        : "Sign in to continue.",
    );
  }
  const statusRange = options.statusRange ?? null;
  const completionDays = options.completionWindowDays ?? 30;
  const completionWindow = reportingWindow(now, completionDays);
  const averageWindow = reportingWindow(now, 30);
  const weeks = isoWeekBuckets(now, 12);
  const trendStart = weeks[0]!.start;
  const active = { status: { in: ACTIVE } };

  const [
    statusGroups,
    priorityGroups,
    overdue,
    rate,
    workloadGroups,
    overdueGroups,
    highGroups,
    users,
    created,
    completed,
    recentlyCompleted,
  ] = await Promise.all([
    db.workOrder.groupBy({
      by: ["status"],
      where: statusRange ? { createdAt: { gte: statusRange.start, lt: statusRange.end } } : {},
      _count: { _all: true },
    }),
    db.workOrder.groupBy({ by: ["priority"], where: active, _count: { _all: true } }),
    db.workOrder.count({ where: { ...active, dueAt: { lt: now } } }),
    cohortRate(db, {}, completionWindow),
    db.workOrder.groupBy({ by: ["assigneeId", "status"], where: active, _count: { _all: true } }),
    db.workOrder.groupBy({
      by: ["assigneeId"],
      where: { ...active, dueAt: { lt: now } },
      _count: { _all: true },
    }),
    db.workOrder.groupBy({
      by: ["assigneeId"],
      where: { ...active, priority: { in: HIGH_PRIORITIES } },
      _count: { _all: true },
    }),
    db.user.findMany({
      select: { id: true, name: true, isActive: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    db.workOrder.findMany({
      where: { createdAt: { gte: trendStart, lte: now } },
      select: { createdAt: true },
    }),
    db.workOrder.findMany({
      where: { status: "COMPLETED", completedAt: { gte: trendStart } },
      select: { completedAt: true },
    }),
    db.workOrder.findMany({
      where: {
        status: "COMPLETED",
        completedAt: { gte: averageWindow.start, lt: averageWindow.end },
      },
      select: { status: true, createdAt: true, completedAt: true },
    }),
  ]);

  const byStatus = Object.fromEntries(
    WORK_ORDER_STATUSES.map((status) => [
      status,
      statusGroups.find((g) => g.status === status)?._count._all ?? 0,
    ]),
  ) as Record<WorkOrderStatus, number>;
  const activeByPriority = Object.fromEntries(
    PRIORITIES.map((priority) => [
      priority,
      priorityGroups.find((g) => g.priority === priority)?._count._all ?? 0,
    ]),
  ) as Record<Priority, number>;

  // Active users (including those with no work), the Unassigned row, and inactive users who still
  // hold active work (flagged by isActive: false).
  const holders = new Set(workloadGroups.map((g) => g.assigneeId));
  const listed = users.filter((user) => user.isActive || holders.has(user.id));
  const row = (id: string | null): Omit<WorkloadRow, "user"> => {
    const count = (status: "OPEN" | "IN_PROGRESS" | "BLOCKED") =>
      workloadGroups.find((g) => g.assigneeId === id && g.status === status)?._count._all ?? 0;
    const byStatus = {
      OPEN: count("OPEN"),
      IN_PROGRESS: count("IN_PROGRESS"),
      BLOCKED: count("BLOCKED"),
    };
    return {
      byStatus,
      active: byStatus.OPEN + byStatus.IN_PROGRESS + byStatus.BLOCKED,
      overdue: overdueGroups.find((g) => g.assigneeId === id)?._count._all ?? 0,
      highPriority: highGroups.find((g) => g.assigneeId === id)?._count._all ?? 0,
    };
  };
  const workload: WorkloadRow[] = [
    ...listed.map((user) => ({ user, ...row(user.id) })),
    { user: null, ...row(null) },
  ];

  // Timestamps after `now` are excluded by the bucket ends (the current week ends at now + 1 ms).
  const createdCounts = countByBucket(
    created.map((r) => r.createdAt),
    weeks,
  );
  const completedCounts = countByBucket(
    completed.map((r) => r.completedAt!),
    weeks,
  );

  return success({
    asOf: now,
    statusRange,
    byStatus,
    activeByPriority,
    overdue,
    completionRate: rate,
    completionWindow,
    completionWindowDays: completionDays,
    workload,
    trend: weeks.map((week, index) => ({
      start: week.start,
      end: week.end,
      created: createdCounts[index]!,
      completed: completedCounts[index]!,
    })),
    averageCompletion: averageCompletionTime(recentlyCompleted, averageWindow),
    averageWindow,
  });
}
