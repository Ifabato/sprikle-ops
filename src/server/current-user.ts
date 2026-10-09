import type { Actor } from "@/domain/permissions";
import { getAuth, type Auth } from "@/server/auth";
import { actorFromSession } from "@/server/session";

// Display details for the signed-in user (shell and profile). Authorization still comes from the
// 4A helpers: the actor is derived with actorFromSession, so inactive or malformed sessions yield
// null. Reads use disableRefresh, like every other render-time read.

export interface CurrentUser {
  readonly actor: Actor;
  readonly name: string;
  readonly email: string;
}

export async function getCurrentUser(
  requestHeaders: Headers,
  auth: Auth = getAuth(),
): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({
    headers: requestHeaders,
    query: { disableRefresh: true },
  });
  const actor = actorFromSession(session);
  if (!actor || !session) {
    return null;
  }
  return { actor, name: session.user.name, email: session.user.email };
}
