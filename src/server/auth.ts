import { betterAuth, BASE_ERROR_CODES, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import type { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "@/lib/env";
import { logAuthEvent } from "@/server/auth-log";
import { getDb } from "@/server/db";

// Better Auth 1.7.7 configuration. Every security-relevant option is set explicitly
// (see docs/decisions/0002-authentication-library.md for sources and rationale).

/** Rolling expiry: each refresh extends the session by this much. Not a hard maximum lifetime. */
export const SESSION_EXPIRES_IN_SECONDS = 8 * 60 * 60;
/** A session older than this is extended when it is next refreshed through the auth handler. */
export const SESSION_UPDATE_AGE_SECONDS = 60 * 60;
/**
 * Sign-in limiter, enforced by the HTTP handler: allowed sign-in requests (any outcome) per window
 * (seconds). With the current configuration every client shares one bucket (see trustedIpHeader).
 */
export const SIGN_IN_RATE_LIMIT = { window: 60, max: 5 } as const;

/** Better Auth endpoints the MVP does not use; the HTTP handler answers 404 for them. */
export const DISABLED_AUTH_PATHS = [
  "/sign-up/email",
  "/update-user",
  "/change-email",
  "/change-password",
  "/request-password-reset",
  "/reset-password",
  "/send-verification-email",
  "/verify-email",
  "/sign-in/social",
  "/link-social",
  "/unlink-account",
  "/refresh-token",
  "/get-access-token",
  "/account-info",
  "/update-session",
  "/verify-password",
  "/delete-user",
] as const;

type RateLimitOptions = NonNullable<BetterAuthOptions["rateLimit"]>;

export interface AuthDependencies {
  db: PrismaClient;
  secret: string;
  baseURL: string;
  /**
   * Header used to identify clients for rate limiting. Production code passes nothing: no
   * client-supplied header (including x-forwarded-for) is trusted, so every client shares one
   * sign-in bucket (127.0.0.1 in development/test; Better Auth's shared fallback key in
   * production). Client headers cannot select or bypass it, but anyone can exhaust it for
   * everyone: a local-demo limitation, not deployment-ready. A deployment needs an explicitly
   * trusted proxy/IP configuration. Only tests pass a header, to isolate each test's bucket.
   */
  trustedIpHeader?: string;
}

export function createAuth({ db, secret, baseURL, trustedIpHeader }: AuthDependencies) {
  const rateLimit: RateLimitOptions = {
    enabled: true,
    storage: "memory",
    customRules: { "/sign-in/email": { ...SIGN_IN_RATE_LIMIT } },
  };

  return betterAuth({
    appName: "Sprikle Ops",
    secret,
    baseURL,
    basePath: "/api/auth",
    trustedOrigins: [new URL(baseURL).origin],
    database: prismaAdapter(db, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      autoSignIn: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    user: {
      additionalFields: {
        // Server-owned: Better Auth rejects client input for these fields.
        role: { type: "string", required: false, input: false, defaultValue: "TEAM_MEMBER" },
        isActive: { type: "boolean", required: false, input: false, defaultValue: true },
      },
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
      // Every session read hits the database, so deactivation takes effect immediately.
      cookieCache: { enabled: false },
    },
    rateLimit,
    advanced: {
      useSecureCookies: baseURL.startsWith("https://"),
      disableCSRFCheck: false,
      // Better Auth skips origin checks in test environments unless this is set explicitly.
      disableOriginCheck: false,
      ipAddress: { ipAddressHeaders: trustedIpHeader ? [trustedIpHeader] : [] },
    },
    disabledPaths: [...DISABLED_AUTH_PATHS],
    telemetry: { enabled: false },
    logger: { level: "warn", log: logAuthEvent },
    databaseHooks: {
      session: {
        create: {
          // Inactive users cannot obtain a session. The error is identical to a wrong password,
          // so the response does not reveal that the account exists or that the password matched.
          before: async (session) => {
            const user = await db.user.findUnique({
              where: { id: session.userId },
              select: { isActive: true },
            });
            if (!user?.isActive) {
              throw APIError.from("UNAUTHORIZED", BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD);
            }
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { sprikleOpsAuth?: Auth };

/** Lazily created so builds and unit tests never need auth configuration or a database. */
export function getAuth(): Auth {
  if (!globalForAuth.sprikleOpsAuth) {
    const { BETTER_AUTH_SECRET, BETTER_AUTH_URL } = getEnv();
    globalForAuth.sprikleOpsAuth = createAuth({
      db: getDb(),
      secret: BETTER_AUTH_SECRET,
      baseURL: BETTER_AUTH_URL,
    });
  }
  return globalForAuth.sprikleOpsAuth;
}
