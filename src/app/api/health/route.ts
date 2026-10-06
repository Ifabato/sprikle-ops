import { getEnv } from "@/lib/env";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * Liveness check. Phase 1 reports application and configuration status only;
 * a database check is added in Phase 2.
 */
export function GET(): Response {
  const time = new Date().toISOString();

  try {
    getEnv();
  } catch (error) {
    // Variable names and rules are logged server-side only; never returned to callers.
    console.error(error);
    return Response.json(
      { status: "error", service: "sprikle-ops", time, checks: { config: "invalid" } },
      { status: 503, headers: NO_STORE },
    );
  }

  return Response.json(
    { status: "ok", service: "sprikle-ops", time, checks: { config: "ok" } },
    { status: 200, headers: NO_STORE },
  );
}
