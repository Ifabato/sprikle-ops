import { getAnalytics, getDashboard } from "@/server/services/metrics";
import { validationFailure } from "@/server/services/result";
import { analyticsQuerySchema } from "@/validation/analytics-query";
import { searchParamsToRecord } from "@/validation/work-order-list-query";
import { defaultApiDeps, errorResponse, respond, withApi, type ApiDeps } from "./http";

export function dashboardHandler(request: Request, deps: ApiDeps = defaultApiDeps()) {
  return withApi(request, deps, async ({ requestId, actor, now }) => {
    if (new URL(request.url).searchParams.size > 0) {
      return errorResponse(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "This endpoint takes no query parameters.",
        },
        requestId,
      );
    }
    return respond(await getDashboard(deps.db, actor, now), requestId);
  });
}

export function analyticsHandler(request: Request, deps: ApiDeps = defaultApiDeps()) {
  return withApi(request, deps, async ({ requestId, actor, now }) => {
    const parsed = analyticsQuerySchema.safeParse(
      searchParamsToRecord(new URL(request.url).searchParams),
    );
    if (!parsed.success) return errorResponse(validationFailure(parsed.error), requestId);
    return respond(
      await getAnalytics(deps.db, actor, now, {
        statusRange: parsed.data.statusRange,
        completionWindowDays: parsed.data.completionWindowDays,
      }),
      requestId,
    );
  });
}
