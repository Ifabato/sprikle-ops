import type { PrismaClient } from "@/generated/prisma/client";
import { getDb } from "@/server/db";

export type DatabaseStatus = "ok" | "unavailable";

/** Overall budget for the health endpoint's database check. */
export const DATABASE_HEALTH_TIMEOUT_MS = 2_000;

type HealthClient = Pick<PrismaClient, "$transaction" | "$executeRaw" | "$queryRaw">;

/**
 * Runs `SELECT 1` with a 1 s server-side statement timeout (SET LOCAL applies only to
 * this transaction). Combined with the pool's 1.5 s connection timeout, abandoned work
 * is bounded by the database and driver, not only by the Promise race below.
 */
async function pingDatabase(client: HealthClient): Promise<void> {
  await client.$transaction([
    client.$executeRaw`SET LOCAL statement_timeout = 1000`,
    client.$queryRaw`SELECT 1`,
  ]);
}

/** Logs only an error class and a short machine code: never messages, URLs, or hosts. */
function logDatabaseFailure(reason: unknown): void {
  const name = reason instanceof Error ? reason.name : "UnknownError";
  const rawCode = (reason as { code?: unknown } | null)?.code;
  const code =
    typeof rawCode === "string" && /^[A-Z0-9_]{1,32}$/i.test(rawCode) ? rawCode : undefined;
  console.error("[health] database check failed", { name, code });
}

export async function checkDatabase(
  client: HealthClient = getDb(),
  timeoutMs: number = DATABASE_HEALTH_TIMEOUT_MS,
): Promise<DatabaseStatus> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });

  // Never rejects: a failure that arrives after the timeout has already won the race
  // must not surface as an unhandled rejection.
  const ping = pingDatabase(client).then(
    () => ({ ok: true as const }),
    (error: unknown) => ({ ok: false as const, error }),
  );

  try {
    const outcome = await Promise.race([ping, timeout]);
    if (outcome === "timeout") {
      logDatabaseFailure(
        Object.assign(new Error("timeout"), { name: "TimeoutError", code: "HEALTH_TIMEOUT" }),
      );
      return "unavailable";
    }
    if (!outcome.ok) {
      logDatabaseFailure(outcome.error);
      return "unavailable";
    }
    return "ok";
  } finally {
    clearTimeout(timer);
  }
}
