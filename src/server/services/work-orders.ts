import { dueFilterBounds, isOverdue, validateNewDueDate } from "@/domain/due-dates";
import { ACTIVE_STATUSES, type Priority, type WorkOrderStatus } from "@/domain/enums";
import {
  checkAssignee,
  decide,
  decideOnWorkOrder,
  workOrderScopeFor,
  type Actor,
  type WorkOrderAction,
} from "@/domain/permissions";
import { formatReference, parseReferenceSearchTerm } from "@/domain/reference";
import { localDateOf, formatDateOnly } from "@/domain/time";
import { allowedTargets, planTransition } from "@/domain/transitions";
import { planWorkOrderEdit, type EditActivity } from "@/domain/work-order-edit";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/labels";
import { commentSchema } from "@/validation/comment";
import {
  createWorkOrderSchema,
  editWorkOrderSchema,
  transitionSchema,
} from "@/validation/work-order";
import {
  searchParamsToRecord,
  workOrderListQuerySchema,
  type WorkOrderListQuery,
} from "@/validation/work-order-list-query";
import {
  failure,
  fieldFailure,
  success,
  validationFailure,
  type ServiceFailure,
  type ServiceResult,
} from "./result";

// Work-order services (docs/api.md, docs/authorization.md). Every function:
//  1. re-checks the actor with the pure permission rules (callers pass the actor resolved from a
//     verified session; this layer never trusts the client),
//  2. validates input with the shared Zod schemas,
//  3. applies the pure domain plan, and
//  4. writes the change and its append-only activity in ONE transaction, guarded by `version`.
// `now` is injected so behavior is deterministic and testable.

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Data shapes returned to adapters
// ---------------------------------------------------------------------------

export interface UserRef {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
}

export interface WorkOrderSummary {
  readonly reference: string;
  readonly number: number;
  readonly title: string;
  readonly status: WorkOrderStatus;
  readonly priority: Priority;
  readonly serviceArea: { readonly id: string; readonly name: string };
  readonly dueAt: Date;
  readonly overdue: boolean;
  readonly assignee: UserRef | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface WorkOrderDetail extends WorkOrderSummary {
  readonly id: string;
  readonly description: string;
  readonly createdBy: UserRef;
  readonly version: number;
  readonly completedAt: Date | null;
  readonly cancelledAt: Date | null;
  /** Statuses the viewing actor may move this work order to (UI hint; re-checked on submit). */
  readonly allowedTransitions: readonly WorkOrderStatus[];
}

export interface CommentView {
  readonly id: string;
  readonly body: string;
  readonly author: UserRef;
  readonly createdAt: Date;
}

export interface ActivityView {
  readonly id: string;
  readonly type: string;
  readonly fromStatus: WorkOrderStatus | null;
  readonly toStatus: WorkOrderStatus | null;
  readonly description: string;
  readonly changes: unknown;
  readonly actor: UserRef;
  /** Comment, BLOCKED note, or cancellation reason attached to this activity. */
  readonly comment: { readonly id: string; readonly body: string } | null;
  readonly createdAt: Date;
}

export interface Page<T> {
  readonly data: readonly T[];
  readonly page: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

const userRefSelect = { id: true, name: true, isActive: true } as const;

const detailInclude = {
  serviceArea: { select: { id: true, name: true } },
  assignee: { select: userRefSelect },
  createdBy: { select: userRefSelect },
} as const;

type WorkOrderRow = Prisma.WorkOrderGetPayload<{ include: typeof detailInclude }>;

function toSummary(row: WorkOrderRow, now: Date): WorkOrderSummary {
  return {
    reference: formatReference(row.number),
    number: row.number,
    title: row.title,
    status: row.status,
    priority: row.priority,
    serviceArea: row.serviceArea,
    dueAt: row.dueAt,
    overdue: isOverdue(row, now),
    assignee: row.assignee,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDetail(row: WorkOrderRow, actor: Actor, now: Date): WorkOrderDetail {
  return {
    ...toSummary(row, now),
    id: row.id,
    description: row.description,
    createdBy: row.createdBy,
    version: row.version,
    completedAt: row.completedAt,
    cancelledAt: row.cancelledAt,
    allowedTransitions: allowedTargets(actor.role, row.status),
  };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Thrown inside a transaction to roll it back when the optimistic-concurrency guard fails. */
class VersionConflict extends Error {
  constructor() {
    super("version conflict");
    this.name = "VersionConflict";
  }
}

const CONFLICT_MESSAGE =
  "This work order was updated by someone else. Reload to see the latest version.";

const ACTIVITY_DESCRIPTION_MAX = 500;

function describe(text: string): string {
  return text.length <= ACTIVITY_DESCRIPTION_MAX
    ? text
    : `${text.slice(0, ACTIVITY_DESCRIPTION_MAX - 1)}…`;
}

function dateLabel(instant: Date): string {
  return formatDateOnly(localDateOf(instant));
}

/** Maps a pure-rule failure code to a service failure. */
function ruleFailure(code: string, message: string): ServiceFailure {
  switch (code) {
    case "UNAUTHENTICATED":
    case "NOT_FOUND":
    case "FORBIDDEN":
    case "NO_CHANGE":
    case "INVALID_TRANSITION":
    case "ASSIGNEE_REQUIRED":
    case "UNASSIGN_NOT_ALLOWED":
    case "VERSION_LIMIT":
      return failure(code, message);
    case "VERSION_CONFLICT":
      return failure("CONFLICT", message);
    case "NOTE_REQUIRED":
    case "NOTE_TOO_LONG":
      return fieldFailure("note", message);
    case "INVALID_DUE_DATE":
    case "DUE_DATE_IN_PAST":
      return fieldFailure("dueDate", message);
    case "ASSIGNEE_NOT_FOUND":
    case "ASSIGNEE_INACTIVE":
      return fieldFailure("assigneeId", message);
    default:
      // CLOCK_SKEW and anything unexpected are server faults, never user errors.
      throw new Error(`Unexpected rule failure: ${code}`);
  }
}

const ACCESS_MESSAGES = {
  UNAUTHENTICATED: "Sign in to continue.",
  FORBIDDEN: "You do not have permission to do that.",
  NOT_FOUND: "Work order not found.",
} as const;

function accessFailure(reason: keyof typeof ACCESS_MESSAGES): ServiceFailure {
  return failure(reason, ACCESS_MESSAGES[reason]);
}

async function loadByNumber(db: Db | Tx, number: number): Promise<WorkOrderRow | null> {
  return db.workOrder.findUnique({ where: { number }, include: detailInclude });
}

/**
 * Loads a work order the actor may perform `action` on. Out-of-scope work for a team member is
 * NOT_FOUND, exactly like a missing number, so references cannot be probed (D3, Q17).
 */
async function loadForAction(
  db: Db | Tx,
  actor: Actor | null,
  number: number,
  action: WorkOrderAction,
): Promise<ServiceResult<WorkOrderRow>> {
  if (!actor) {
    return accessFailure("UNAUTHENTICATED");
  }
  const row = await loadByNumber(db, number);
  if (!row) {
    return accessFailure("NOT_FOUND");
  }
  const decision = decideOnWorkOrder(actor, action, row);
  if (!decision.allowed) {
    return accessFailure(decision.reason);
  }
  return success(row);
}

async function activeServiceArea(db: Db | Tx, id: string): Promise<boolean> {
  const area = await db.serviceArea.findUnique({ where: { id }, select: { isActive: true } });
  return area?.isActive === true;
}

async function userName(db: Db | Tx, id: string | null): Promise<string | null> {
  if (id === null) return null;
  const user = await db.user.findUnique({ where: { id }, select: { name: true } });
  return user?.name ?? null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getWorkOrder(
  db: Db,
  actor: Actor | null,
  number: number,
  now: Date,
): Promise<ServiceResult<WorkOrderDetail>> {
  const loaded = await loadForAction(db, actor, number, "workOrder.view");
  if (!loaded.ok) return loaded;
  return success(toDetail(loaded.data, actor!, now));
}

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** Prisma filter for a validated list query, always intersected with the actor's scope. */
export function listWhere(
  actor: Actor,
  query: WorkOrderListQuery,
  now: Date,
): Prisma.WorkOrderWhereInput {
  const and: Prisma.WorkOrderWhereInput[] = [];
  const scope = workOrderScopeFor(actor);
  if (!scope.ok) throw new Error("listWhere requires an authenticated actor");
  if (scope.value.kind === "assignedTo") {
    and.push({ assigneeId: scope.value.userId });
  }

  // Due filters always mean "active and ..." (metrics.md), so terminal statuses drop out.
  const statuses = query.due
    ? query.statuses.filter((status) => (ACTIVE_STATUSES as readonly string[]).includes(status))
    : query.statuses;
  and.push({ status: { in: [...statuses] } });

  if (query.priorities) and.push({ priority: { in: [...query.priorities] } });
  if (query.serviceAreaId) and.push({ serviceAreaId: query.serviceAreaId });
  if (query.assignee) {
    const assignee = query.assignee;
    and.push({
      assigneeId:
        assignee.kind === "me" ? actor.id : assignee.kind === "unassigned" ? null : assignee.id,
    });
  }
  if (query.due) {
    const bounds = dueFilterBounds(query.due, now);
    and.push(
      bounds.kind === "overdue"
        ? { dueAt: { lt: bounds.overdueBefore } }
        : { dueAt: { gte: bounds.notBefore, lt: bounds.before } },
    );
  }
  if (query.q) {
    const pattern = escapeLike(query.q);
    const or: Prisma.WorkOrderWhereInput[] = [
      { title: { contains: pattern, mode: "insensitive" } },
      { description: { contains: pattern, mode: "insensitive" } },
    ];
    const number = parseReferenceSearchTerm(query.q);
    if (number !== null) or.unshift({ number });
    and.push({ OR: or });
  }
  return { AND: and };
}

/** Lists work orders. `params` is the raw query (URLSearchParams or a plain record). */
export async function listWorkOrders(
  db: Db,
  actor: Actor | null,
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  now: Date,
): Promise<ServiceResult<Page<WorkOrderSummary> & { query: WorkOrderListQuery }>> {
  const decision = decide(actor, "workOrder.list");
  if (!decision.allowed) return accessFailure(decision.reason);

  const record =
    params instanceof URLSearchParams
      ? searchParamsToRecord(params)
      : Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined));
  const parsed = workOrderListQuerySchema.safeParse(record);
  if (!parsed.success) return validationFailure(parsed.error);
  const query = parsed.data;

  const where = listWhere(decision.actor, query, now);
  // Two pool reads, not a batch transaction (see createWorkOrder on include + transactions).
  const [total, rows] = await Promise.all([
    db.workOrder.count({ where }),
    db.workOrder.findMany({
      where,
      include: detailInclude,
      orderBy: [{ [query.sort]: query.order }, { number: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return success({
    data: rows.map((row) => toSummary(row, now)),
    page: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
    query,
  });
}

export async function listComments(
  db: Db,
  actor: Actor | null,
  number: number,
): Promise<ServiceResult<CommentView[]>> {
  const loaded = await loadForAction(db, actor, number, "workOrder.view");
  if (!loaded.ok) return loaded;
  const rows = await db.workOrderComment.findMany({
    where: { workOrderId: loaded.data.id },
    include: { author: { select: userRefSelect } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return success(
    rows.map((row) => ({
      id: row.id,
      body: row.body,
      author: row.author,
      createdAt: row.createdAt,
    })),
  );
}

export async function listActivity(
  db: Db,
  actor: Actor | null,
  number: number,
): Promise<ServiceResult<ActivityView[]>> {
  const loaded = await loadForAction(db, actor, number, "workOrder.view");
  if (!loaded.ok) return loaded;
  const rows = await db.workOrderActivity.findMany({
    where: { workOrderId: loaded.data.id },
    include: { actor: { select: userRefSelect }, comment: { select: { id: true, body: true } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return success(
    rows.map((row) => ({
      id: row.id,
      type: row.type,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      description: row.description,
      changes: row.changes,
      actor: row.actor,
      comment: row.comment,
      createdAt: row.createdAt,
    })),
  );
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createWorkOrder(
  db: Db,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<ServiceResult<WorkOrderDetail>> {
  const decision = decide(actor, "workOrder.create");
  if (!decision.allowed) return accessFailure(decision.reason);
  const current = decision.actor;

  const parsed = createWorkOrderSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const data = parsed.data;

  const due = validateNewDueDate(data.dueDate, now);
  if (!due.ok) return ruleFailure(due.code, due.message);
  if (!(await activeServiceArea(db, data.serviceAreaId))) {
    return fieldFailure("serviceAreaId", "Choose an active service area.");
  }

  let assigneeName: string | null = null;
  if (data.assigneeId) {
    const candidate = await db.user.findUnique({
      where: { id: data.assigneeId },
      select: { id: true, isActive: true, name: true },
    });
    const check = checkAssignee(candidate);
    if (!check.ok) return ruleFailure(check.code, check.message);
    assigneeName = candidate!.name;
  }

  // Transactions only write; results are read after commit (Prisma resolves `include` with
  // concurrent queries, which a single transaction connection must not run).
  const createdNumber = await db.$transaction(async (tx) => {
    const row = await tx.workOrder.create({
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority,
        serviceAreaId: data.serviceAreaId,
        dueAt: due.value,
        assigneeId: data.assigneeId ?? null,
        createdById: current.id,
        createdAt: now,
        updatedAt: now,
      },
      select: { id: true, number: true },
    });
    await tx.workOrderActivity.create({
      data: {
        workOrderId: row.id,
        actorId: current.id,
        type: "CREATED",
        description: describe(
          assigneeName ? `Created and assigned to ${assigneeName}` : "Created work order",
        ),
        changes: assigneeName ? { assigneeId: { from: null, to: data.assigneeId } } : undefined,
        createdAt: now,
      },
    });
    return row.number;
  });
  return success(toDetail((await loadByNumber(db, createdNumber))!, current, now));
}

async function describeEditActivity(db: Db | Tx, activity: EditActivity): Promise<string> {
  switch (activity.type) {
    case "DETAILS_UPDATED": {
      const fields = Object.keys(activity.changes).map((key) =>
        key === "serviceAreaId" ? "service area" : key,
      );
      const list =
        fields.length <= 1
          ? fields.join("")
          : `${fields.slice(0, -1).join(", ")} and ${fields[fields.length - 1]}`;
      return `Updated ${list}`;
    }
    case "PRIORITY_CHANGED": {
      const { from, to } = activity.changes.priority;
      return `Priority changed from ${PRIORITY_LABELS[from]} to ${PRIORITY_LABELS[to]}`;
    }
    case "DUE_DATE_CHANGED": {
      const { from, to } = activity.changes.dueAt;
      return `Due date changed from ${dateLabel(new Date(from))} to ${dateLabel(new Date(to))}`;
    }
    case "ASSIGNEE_CHANGED": {
      const { from, to } = activity.changes.assigneeId;
      // Sequential: one transaction connection must not run concurrent queries.
      const fromName = await userName(db, from);
      const toName = await userName(db, to);
      if (to === null) return `Unassigned (was ${fromName ?? "unknown user"})`;
      if (from === null) return `Assigned to ${toName ?? "unknown user"}`;
      return `Reassigned from ${fromName ?? "unknown user"} to ${toName ?? "unknown user"}`;
    }
  }
}

export type EditOutcome =
  | { readonly kind: "unchanged"; readonly workOrder: WorkOrderDetail }
  | { readonly kind: "changed"; readonly workOrder: WorkOrderDetail };

/** Admin edit of details and/or assignment (status changes use transitionWorkOrder). */
export async function editWorkOrder(
  db: Db,
  actor: Actor | null,
  number: number,
  input: unknown,
  now: Date,
): Promise<ServiceResult<EditOutcome>> {
  const loaded = await loadForAction(db, actor, number, "workOrder.editDetails");
  if (!loaded.ok) return loaded;
  const current = actor!;
  const row = loaded.data;

  const parsed = editWorkOrderSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const edit = parsed.data;

  const newAssignee =
    edit.assigneeId && edit.assigneeId !== row.assigneeId
      ? await db.user.findUnique({
          where: { id: edit.assigneeId },
          select: { id: true, isActive: true },
        })
      : null;
  const plan = planWorkOrderEdit(current, row, edit, { now, newAssignee });
  if (!plan.ok) return ruleFailure(plan.code, plan.message);
  if (plan.value.kind === "unchanged") {
    return success({ kind: "unchanged", workOrder: toDetail(row, current, now) });
  }
  const changes = plan.value;
  if (changes.data.serviceAreaId && !(await activeServiceArea(db, changes.data.serviceAreaId))) {
    return fieldFailure("serviceAreaId", "Choose an active service area.");
  }

  try {
    await db.$transaction(async (tx) => {
      const result = await tx.workOrder.updateMany({
        where: { id: row.id, version: row.version },
        data: { ...changes.data, version: changes.nextVersion, updatedAt: now },
      });
      if (result.count !== 1) throw new VersionConflict();
      for (const activity of changes.activities) {
        await tx.workOrderActivity.create({
          data: {
            workOrderId: row.id,
            actorId: current.id,
            type: activity.type,
            changes: activity.changes as Prisma.InputJsonValue,
            description: describe(await describeEditActivity(tx, activity)),
            createdAt: now,
          },
        });
      }
    });
    const updated = (await loadByNumber(db, number))!;
    return success({ kind: "changed", workOrder: toDetail(updated, current, now) });
  } catch (error) {
    if (error instanceof VersionConflict) return failure("CONFLICT", CONFLICT_MESSAGE);
    throw error;
  }
}

export async function transitionWorkOrder(
  db: Db,
  actor: Actor | null,
  number: number,
  input: unknown,
  now: Date,
): Promise<ServiceResult<WorkOrderDetail>> {
  // Scope first: out-of-scope callers learn nothing, not even validation details.
  const loaded = await loadForAction(db, actor, number, "workOrder.transition");
  if (!loaded.ok) return loaded;
  const current = actor!;
  const row = loaded.data;

  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const request = parsed.data;

  const plan = planTransition(
    current,
    row,
    { toStatus: request.toStatus, expectedVersion: request.version, note: request.note },
    now,
  );
  if (!plan.ok) return ruleFailure(plan.code, plan.message);
  const change = plan.value;

  try {
    await db.$transaction(async (tx) => {
      const result = await tx.workOrder.updateMany({
        where: { id: row.id, version: row.version },
        data: {
          status: change.status,
          completedAt: change.completedAt,
          cancelledAt: change.cancelledAt,
          version: change.nextVersion,
          updatedAt: now,
        },
      });
      if (result.count !== 1) throw new VersionConflict();
      const comment = change.comment
        ? await tx.workOrderComment.create({
            data: {
              workOrderId: row.id,
              authorId: current.id,
              body: change.comment.body,
              createdAt: now,
            },
            select: { id: true },
          })
        : null;
      const { fromStatus, toStatus } = change.activity;
      await tx.workOrderActivity.create({
        data: {
          workOrderId: row.id,
          actorId: current.id,
          type: "STATUS_CHANGED",
          fromStatus,
          toStatus,
          commentId: comment?.id ?? null,
          description: describe(
            `Status changed from ${STATUS_LABELS[fromStatus]} to ${STATUS_LABELS[toStatus]}`,
          ),
          createdAt: now,
        },
      });
    });
    const updated = (await loadByNumber(db, number))!;
    return success(toDetail(updated, current, now));
  } catch (error) {
    if (error instanceof VersionConflict) return failure("CONFLICT", CONFLICT_MESSAGE);
    throw error;
  }
}

export async function addComment(
  db: Db,
  actor: Actor | null,
  number: number,
  input: unknown,
  now: Date,
): Promise<ServiceResult<CommentView>> {
  const loaded = await loadForAction(db, actor, number, "comment.create");
  if (!loaded.ok) return loaded;
  const current = actor!;

  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const commentId = await db.$transaction(async (tx) => {
    const created = await tx.workOrderComment.create({
      data: {
        workOrderId: loaded.data.id,
        authorId: current.id,
        body: parsed.data.body,
        createdAt: now,
      },
      select: { id: true },
    });
    await tx.workOrderActivity.create({
      data: {
        workOrderId: loaded.data.id,
        actorId: current.id,
        type: "COMMENT_ADDED",
        commentId: created.id,
        description: "Added a comment",
        createdAt: now,
      },
    });
    return created.id;
  });
  const comment = await db.workOrderComment.findUniqueOrThrow({
    where: { id: commentId },
    include: { author: { select: userRefSelect } },
  });
  return success({
    id: comment.id,
    body: comment.body,
    author: comment.author,
    createdAt: comment.createdAt,
  });
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export interface AssigneeOption {
  readonly id: string;
  readonly name: string;
  readonly role: "ADMIN" | "TEAM_MEMBER";
}

/** Active users who may be assigned work (Q3). ADMIN only. */
export async function listAssignees(
  db: Db,
  actor: Actor | null,
): Promise<ServiceResult<AssigneeOption[]>> {
  const decision = decide(actor, "assignees.list");
  if (!decision.allowed) return accessFailure(decision.reason);
  const users = await db.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return success(users);
}

export interface ServiceAreaOption {
  readonly id: string;
  readonly name: string;
}

export async function listServiceAreas(
  db: Db,
  actor: Actor | null,
): Promise<ServiceResult<ServiceAreaOption[]>> {
  const decision = decide(actor, "workOrder.list");
  if (!decision.allowed) return accessFailure(decision.reason);
  const areas = await db.serviceArea.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return success(areas);
}
