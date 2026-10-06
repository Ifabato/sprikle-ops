import { getAuth } from "@/server/auth";

// Better Auth HTTP handler (/api/auth/*). Origin/CSRF checks, the login rate limiter, and
// disabled-endpoint 404s all run here. The instance is resolved per request so the build never
// needs auth configuration or a database.

export function GET(request: Request): Promise<Response> {
  return getAuth().handler(request);
}

export function POST(request: Request): Promise<Response> {
  return getAuth().handler(request);
}
