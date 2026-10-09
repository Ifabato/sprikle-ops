import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { loginPathFor } from "@/lib/return-path";

// Optimistic routing convenience ONLY: a request with no session cookie at all is sent straight
// to login. It does not validate the session. Every protected page and server entry point still
// authorizes on the server (src/server/session.ts); this is never the security boundary.

const PROTECTED_AREAS = ["/dashboard", "/work-orders", "/analytics", "/profile"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_AREAS.some((area) => pathname === area || pathname.startsWith(`${area}/`));
}

/** Pure routing decision, exported for unit tests. */
export function proxyRedirectPath(
  pathname: string,
  search: string,
  hasSessionCookie: boolean,
): string | null {
  if (!isProtectedPath(pathname) || hasSessionCookie) {
    return null;
  }
  return loginPathFor(`${pathname}${search}`);
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const target = proxyRedirectPath(pathname, search, Boolean(getSessionCookie(request)));
  return target ? NextResponse.redirect(new URL(target, request.url)) : NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/work-orders/:path*", "/analytics/:path*", "/profile/:path*"],
};
