import { randomUUID } from "node:crypto";
import type { Actor } from "@/domain/permissions";
import type { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "@/lib/env";
import { getAuth, type Auth } from "@/server/auth";
import { getDb } from "@/server/db";
import {
  failure,
  HTTP_STATUS,
  type ServiceFailure,
  type ServiceResult,
} from "@/server/services/result";
import { getActor } from "@/server/session";

// Thin HTTP adapter shared by every /api/v1 route handler (docs/api.md):
// request ID → same-origin check (unsafe methods) → session → body parsing → service → response.
// Responses are JSON with `Cache-Control: no-store` and an `x-request-id` header. Errors never
// include stack traces or database details.

export interface ApiDeps {
  readonly db: PrismaClient;
  readonly auth: Auth;
  readonly clock: () => Date;
  /** Origin allowed to send state-changing requests (the app's own origin). */
  readonly trustedOrigin: string;
}

export function defaultApiDeps(): ApiDeps {
  return {
    db: getDb(),
    auth: getAuth(),
    clock: () => new Date(),
    trustedOrigin: new URL(getEnv().BETTER_AUTH_URL).origin,
  };
}

export interface ApiContext {
  readonly requestId: string;
  readonly deps: ApiDeps;
  readonly actor: Actor;
  readonly now: Date;
}

const MAX_BODY_BYTES = 32 * 1024;
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function headersFor(requestId: string): HeadersInit {
  return { "Cache-Control": "no-store", "x-request-id": requestId };
}

export function json(body: unknown, status: number, requestId: string): Response {
  return Response.json(body, { status, headers: headersFor(requestId) });
}

export function errorResponse(error: ServiceFailure, requestId: string): Response {
  return json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
        requestId,
      },
    },
    HTTP_STATUS[error.code],
    requestId,
  );
}

/** Maps a service result to `{ data }` with the given success status. */
export function respond<T>(result: ServiceResult<T>, requestId: string, status = 200): Response {
  return result.ok
    ? json({ data: result.data }, status, requestId)
    : errorResponse(result, requestId);
}

/**
 * Cookie-authenticated, state-changing requests must come from the app itself. Browsers send
 * Sec-Fetch-Site and Origin on cross-site requests; either one pointing elsewhere is refused.
 * JSON bodies are also required (see readJson), which a cross-site form cannot send without a
 * CORS preflight that this API never grants.
 */
function crossSiteFailure(request: Request, trustedOrigin: string): ServiceFailure | null {
  if (!UNSAFE_METHODS.has(request.method)) return null;
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin" && site !== "none") {
    return failure("FORBIDDEN", "Cross-site requests are not allowed.");
  }
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== trustedOrigin) {
    return failure("FORBIDDEN", "Cross-site requests are not allowed.");
  }
  return null;
}

/** Parses a JSON request body; returns a VALIDATION_ERROR for anything else. */
export async function readJson(
  request: Request,
): Promise<{ ok: true; value: unknown } | ServiceFailure> {
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(type)) {
    return failure("VALIDATION_ERROR", "Send a JSON body (Content-Type: application/json).");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return failure("VALIDATION_ERROR", "Request body is too large.");
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return failure("VALIDATION_ERROR", "Request body is not valid JSON.");
  }
}

/**
 * Runs an authenticated API handler: assigns a request ID, refuses cross-site writes, resolves
 * the actor from the verified session (401 when missing or inactive), and converts unexpected
 * exceptions into a generic 500 that is logged with the request ID only.
 */
export async function withApi(
  request: Request,
  deps: ApiDeps,
  handler: (context: ApiContext) => Promise<Response>,
): Promise<Response> {
  const requestId = randomUUID();
  try {
    const crossSite = crossSiteFailure(request, deps.trustedOrigin);
    if (crossSite) return errorResponse(crossSite, requestId);
    const actor = await getActor(request.headers, deps.auth);
    if (!actor) {
      return errorResponse(failure("UNAUTHENTICATED", "Sign in to continue."), requestId);
    }
    return await handler({ requestId, deps, actor, now: deps.clock() });
  } catch (error) {
    console.error(
      `[api] request ${requestId} failed: ${error instanceof Error ? error.name : "unknown error"}`,
    );
    return errorResponse(failure("INTERNAL_ERROR", "Something went wrong."), requestId);
  }
}
