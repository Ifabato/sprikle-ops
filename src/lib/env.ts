import { z } from "zod";

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Server-side environment schema. New variables (DATABASE_URL, auth secrets, ...)
 * are added here in the phase that introduces them, so a misconfigured
 * environment fails fast with a readable message instead of at first use.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_TIMEZONE: z
    .string()
    .trim()
    .min(1)
    .refine(isValidTimeZone, { message: "must be a valid IANA time zone, e.g. America/New_York" })
    .default("America/New_York"),
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: "must be a postgresql:// connection URL",
  }),
});

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment configuration:\n${issues.map((i) => `  - ${i}`).join("\n")}`);
    this.name = "EnvValidationError";
  }
}

/**
 * Parses an environment source. Error messages name the variable and the
 * rule that failed, but never echo the supplied value (it may be a secret).
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`),
    );
  }
  return result.data;
}

let cached: Env | undefined;

/** Validated process environment, parsed once per server process. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
