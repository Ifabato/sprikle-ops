import { getEnv } from "@/lib/env";
import { checkDatabase, type DatabaseStatus } from "@/server/health";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * Public health check: configuration and database reachability.
 * Responds 200 only when every check passes, otherwise 503. Responses never include
 * error messages, connection strings, hosts, or credentials.
 */
export async function GET(): Promise<Response> {
  const time = new Date().toISOString();

  let config: "ok" | "invalid" = "ok";
  try {
    getEnv();
  } catch (error) {
    // Variable names and rules are logged server-side only; never returned to callers.
    console.error(error);
    config = "invalid";
  }

  const database: DatabaseStatus | "skipped" = config === "ok" ? await checkDatabase() : "skipped";
  const healthy = config === "ok" && database === "ok";

  return Response.json(
    {
      status: healthy ? "ok" : "error",
      service: "brindle",
      time,
      checks: { config, database },
    },
    { status: healthy ? 200 : 503, headers: NO_STORE },
  );
}
