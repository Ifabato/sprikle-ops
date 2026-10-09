import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ROLES, type Role } from "@/domain/enums";
import { authenticatedActor, type Actor } from "@/domain/permissions";
import { loginPathFor } from "@/lib/return-path";
import { getAuth, type Auth } from "@/server/auth";

// Server-side session verification. This is the security boundary for pages and server entry
// points; any proxy redirect is only a routing convenience (Phase 4B).
//
// Reads never refresh or extend a session and never set cookies: sessions are read with refresh
// disabled and no cookie plugin is configured. If the stored session has already expired, Better
// Auth may delete that expired session row during the read. Rolling refresh happens only through
// the auth HTTP handler.
//
// Every protected page, API handler, and Server Action must call these helpers (or an equivalent
// server-side checked entry point). A session response or a session cookie alone is not
// authorization.

interface SessionUserFields {
  id?: unknown;
  role?: unknown;
  isActive?: unknown;
}

/** Maps a Better Auth session to a domain actor; fails closed on anything unexpected. */
export function actorFromSession(
  session: { user: SessionUserFields } | null | undefined,
): Actor | null {
  if (!session) {
    return null;
  }
  const { id, role, isActive } = session.user;
  if (
    typeof id !== "string" ||
    !(ROLES as readonly unknown[]).includes(role) ||
    isActive !== true
  ) {
    return null;
  }
  // authenticatedActor applies the domain rule: missing or inactive actors are unauthenticated.
  return authenticatedActor({ id, role: role as Role, isActive: true });
}

export async function getActor(
  requestHeaders: Headers,
  auth: Auth = getAuth(),
): Promise<Actor | null> {
  const session = await auth.api.getSession({
    headers: requestHeaders,
    query: { disableRefresh: true },
  });
  return actorFromSession(session);
}

export type Authorization =
  | { readonly ok: true; readonly actor: Actor }
  | { readonly ok: false; readonly reason: "UNAUTHENTICATED" | "FORBIDDEN" };

export async function authorize(
  requestHeaders: Headers,
  options: { role?: Role } = {},
  auth: Auth = getAuth(),
): Promise<Authorization> {
  const actor = await getActor(requestHeaders, auth);
  if (!actor) {
    return { ok: false, reason: "UNAUTHENTICATED" };
  }
  if (options.role && actor.role !== options.role) {
    return { ok: false, reason: "FORBIDDEN" };
  }
  return { ok: true, actor };
}

/** Pages: redirect signed-out (or deactivated) users to login with a safe return path. */
export async function requireUser(returnTo: string): Promise<Actor> {
  const result = await authorize(await headers());
  if (!result.ok) {
    redirect(loginPathFor(returnTo));
  }
  return result.actor;
}

/**
 * Pages that need a role: signed-out users are redirected to login; signed-in users without the
 * role receive { forbidden: true } so the page can render its forbidden state.
 */
export async function requireRole(
  role: Role,
  returnTo: string,
): Promise<{ readonly forbidden: false; readonly actor: Actor } | { readonly forbidden: true }> {
  const result = await authorize(await headers(), { role });
  if (!result.ok) {
    if (result.reason === "UNAUTHENTICATED") {
      redirect(loginPathFor(returnTo));
    }
    return { forbidden: true };
  }
  return { forbidden: false, actor: result.actor };
}
