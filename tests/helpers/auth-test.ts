// Helpers for exercising Better Auth through its HTTP handler against sprikle_ops_test.
//
// Rate-limit isolation: Better Auth's built-in memory store is one process-wide Map, so separate
// auth instances share buckets. Instead of weakening limits, each test identifies itself as a
// distinct client through a test-only trusted IP header. Production configuration trusts no
// client-supplied header (see the x-forwarded-for test).
//
// Assertions avoid printing tokens or cookies: they compare booleans and attribute flags rather
// than raw values, so a failing test cannot echo a credential.
import { createAuth, type Auth } from "@/server/auth";
import { provisionCredentialUser, type CredentialUserSpec } from "../../scripts/lib/auth-users.ts";
import { getTestPrisma } from "./test-database";

export const TEST_BASE_URL = "http://localhost:3000";
/** Test-only values (never used outside the test database). */
export const TEST_AUTH_SECRET = "integration-test-only-secret-0123456789abcdefghij";
export const TEST_PASSWORD = "integration-test-password-0001";
const TEST_CLIENT_HEADER = "x-sprikle-test-client";
export const SESSION_COOKIE_NAME = "better-auth.session_token";

export const TEST_USERS = {
  admin: { email: "admin@sprikle.test", name: "Test Admin", role: "ADMIN", isActive: true },
  tech: { email: "tech@sprikle.test", name: "Test Tech", role: "TEAM_MEMBER", isActive: true },
  inactive: {
    email: "inactive@sprikle.test",
    name: "Test Inactive",
    role: "TEAM_MEMBER",
    isActive: false,
  },
} as const satisfies Record<string, CredentialUserSpec>;

export async function provisionTestUsers(): Promise<void> {
  const db = getTestPrisma();
  for (const spec of Object.values(TEST_USERS)) {
    await provisionCredentialUser(db, spec, TEST_PASSWORD);
  }
}

/** Auth instance identical to production except the test client header used for isolation. */
export function createTestAuth(options: { productionIpConfig?: boolean } = {}): Auth {
  return createAuth({
    db: getTestPrisma(),
    secret: TEST_AUTH_SECRET,
    baseURL: TEST_BASE_URL,
    trustedIpHeader: options.productionIpConfig ? undefined : TEST_CLIENT_HEADER,
  });
}

let clientCounter = 0;
/** A distinct client identity (a valid IP literal, as Better Auth requires). */
export function newClient(): string {
  clientCounter += 1;
  return `10.77.${Math.floor(clientCounter / 250)}.${(clientCounter % 250) + 1}`;
}

interface AuthRequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  cookie?: string | null;
  /** Origin header; pass null to omit it. Defaults to the trusted app origin. */
  origin?: string | null;
  client?: string;
  headers?: Record<string, string>;
}

export function authRequest(path: string, options: AuthRequestOptions = {}): Request {
  const method = options.method ?? "POST";
  const headers = new Headers(options.headers);
  if (options.origin !== null) headers.set("origin", options.origin ?? TEST_BASE_URL);
  if (options.cookie) headers.set("cookie", options.cookie);
  if (options.client) headers.set(TEST_CLIENT_HEADER, options.client);
  if (options.body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${TEST_BASE_URL}/api/auth${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

/** The session Set-Cookie header (attributes included), or null. */
export function sessionSetCookie(response: Response): string | null {
  return (
    response.headers.getSetCookie().find((value) => value.startsWith(`${SESSION_COOKIE_NAME}=`)) ??
    null
  );
}

/** "name=value" for use in a Cookie request header, or null. */
export function sessionCookie(response: Response): string | null {
  return sessionSetCookie(response)?.split(";")[0] ?? null;
}

export async function signIn(
  auth: Auth,
  email: string,
  password: string = TEST_PASSWORD,
  client: string = newClient(),
): Promise<{ response: Response; cookie: string | null }> {
  const response = await auth.handler(
    authRequest("/sign-in/email", { body: { email, password }, client }),
  );
  return { response, cookie: sessionCookie(response) };
}

export async function userIdFor(email: string): Promise<string> {
  const user = await getTestPrisma().user.findUniqueOrThrow({
    where: { email },
    select: { id: true },
  });
  return user.id;
}
