import { parseReference } from "@/domain/reference";
import {
  addComment,
  createWorkOrder,
  editWorkOrder,
  getWorkOrder,
  listActivity,
  listAssignees,
  listComments,
  listServiceAreas,
  listWorkOrders,
  transitionWorkOrder,
} from "@/server/services/work-orders";
import { failure } from "@/server/services/result";
import {
  defaultApiDeps,
  errorResponse,
  json,
  readJson,
  respond,
  withApi,
  type ApiDeps,
} from "./http";

// /api/v1 work-order handlers (docs/api.md). Route files are one-line adapters over these, so the
// integration tests exercise exactly this code with a test database and test auth instance.

/** A malformed reference is indistinguishable from a missing one (404), so nothing can be probed. */
function referenceNumber(ref: string): number | null {
  const parsed = parseReference(ref);
  return parsed.ok ? parsed.value.number : null;
}

const notFound = (requestId: string) =>
  errorResponse(failure("NOT_FOUND", "Work order not found."), requestId);

export function listWorkOrdersHandler(request: Request, deps: ApiDeps = defaultApiDeps()) {
  return withApi(request, deps, async ({ requestId, actor, now }) => {
    const params = new URL(request.url).searchParams;
    const result = await listWorkOrders(deps.db, actor, params, now);
    if (!result.ok) return errorResponse(result, requestId);
    return json({ data: result.data.data, page: result.data.page }, 200, requestId);
  });
}

export function createWorkOrderHandler(request: Request, deps: ApiDeps = defaultApiDeps()) {
  return withApi(request, deps, async ({ requestId, actor, now }) => {
    const body = await readJson(request);
    if (!body.ok) return errorResponse(body, requestId);
    return respond(await createWorkOrder(deps.db, actor, body.value, now), requestId, 201);
  });
}

export function getWorkOrderHandler(
  request: Request,
  ref: string,
  deps: ApiDeps = defaultApiDeps(),
) {
  return withApi(request, deps, async ({ requestId, actor, now }) => {
    const number = referenceNumber(ref);
    if (number === null) return notFound(requestId);
    return respond(await getWorkOrder(deps.db, actor, number, now), requestId);
  });
}

export function editWorkOrderHandler(
  request: Request,
  ref: string,
  deps: ApiDeps = defaultApiDeps(),
) {
  return withApi(request, deps, async ({ requestId, actor, now }) => {
    const number = referenceNumber(ref);
    if (number === null) return notFound(requestId);
    const body = await readJson(request);
    if (!body.ok) return errorResponse(body, requestId);
    const result = await editWorkOrder(deps.db, actor, number, body.value, now);
    if (!result.ok) return errorResponse(result, requestId);
    return json(
      { data: result.data.workOrder, meta: { changed: result.data.kind === "changed" } },
      200,
      requestId,
    );
  });
}

export function transitionHandler(request: Request, ref: string, deps: ApiDeps = defaultApiDeps()) {
  return withApi(request, deps, async ({ requestId, actor, now }) => {
    const number = referenceNumber(ref);
    if (number === null) return notFound(requestId);
    const body = await readJson(request);
    if (!body.ok) return errorResponse(body, requestId);
    return respond(await transitionWorkOrder(deps.db, actor, number, body.value, now), requestId);
  });
}

export function listCommentsHandler(
  request: Request,
  ref: string,
  deps: ApiDeps = defaultApiDeps(),
) {
  return withApi(request, deps, async ({ requestId, actor }) => {
    const number = referenceNumber(ref);
    if (number === null) return notFound(requestId);
    return respond(await listComments(deps.db, actor, number), requestId);
  });
}

export function addCommentHandler(request: Request, ref: string, deps: ApiDeps = defaultApiDeps()) {
  return withApi(request, deps, async ({ requestId, actor, now }) => {
    const number = referenceNumber(ref);
    if (number === null) return notFound(requestId);
    const body = await readJson(request);
    if (!body.ok) return errorResponse(body, requestId);
    return respond(await addComment(deps.db, actor, number, body.value, now), requestId, 201);
  });
}

export function listActivityHandler(
  request: Request,
  ref: string,
  deps: ApiDeps = defaultApiDeps(),
) {
  return withApi(request, deps, async ({ requestId, actor }) => {
    const number = referenceNumber(ref);
    if (number === null) return notFound(requestId);
    return respond(await listActivity(deps.db, actor, number), requestId);
  });
}

export function listAssigneesHandler(request: Request, deps: ApiDeps = defaultApiDeps()) {
  return withApi(request, deps, async ({ requestId, actor }) =>
    respond(await listAssignees(deps.db, actor), requestId),
  );
}

export function listServiceAreasHandler(request: Request, deps: ApiDeps = defaultApiDeps()) {
  return withApi(request, deps, async ({ requestId, actor }) =>
    respond(await listServiceAreas(deps.db, actor), requestId),
  );
}
