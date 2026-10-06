import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DISABLED_AUTH_PATHS, SESSION_EXPIRES_IN_SECONDS, SIGN_IN_RATE_LIMIT } from "@/server/auth";
import { authorize, getActor } from "@/server/session";
import {
  authRequest,
  createTestAuth,
  newClient,
  provisionTestUsers,
  sessionSetCookie,
  signIn,
  TEST_PASSWORD,
  TEST_USERS,
  userIdFor,
} from "../helpers/auth-test";
import {
  disconnectTestPrisma,
  getTestPrisma,
  truncateTestDatabase,
} from "../helpers/test-database";

const db = getTestPrisma();
const auth = createTestAuth();
const HOUR_MS = 3_600_000;
const GENERIC_FAILURE = { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" };

beforeEach(async () => {
  await truncateTestDatabase();
  await provisionTestUsers();
});

afterAll(async () => {
  await disconnectTestPrisma();
});

const headersWith = (cookie: string) => new Headers({ cookie });
const sessionCount = async (email: string) =>
  db.session.count({ where: { userId: await userIdFor(email) } });

describe("sign-in over HTTP", () => {
  it("issues an HttpOnly, SameSite=Lax, non-Secure (local http) cookie and an 8-hour session", async () => {
    const before = Date.now();
    const { response } = await signIn(auth, TEST_USERS.admin.email);

    expect(response.status).toBe(200);
    const setCookie = sessionSetCookie(response) ?? "";
    expect(setCookie.length > 0).toBe(true);
    expect(/;\s*HttpOnly/i.test(setCookie)).toBe(true);
    expect(/;\s*SameSite=Lax/i.test(setCookie)).toBe(true);
    expect(/;\s*Secure/i.test(setCookie)).toBe(false);
    expect(/;\s*Max-Age=28800/i.test(setCookie)).toBe(true);

    const session = await db.session.findFirstOrThrow({
      where: { userId: await userIdFor(TEST_USERS.admin.email) },
    });
    const expectedExpiry = before + SESSION_EXPIRES_IN_SECONDS * 1000;
    expect(Math.abs(session.expiresAt.getTime() - expectedExpiry)).toBeLessThan(60_000);
  });

  it("returns an identical generic failure for unknown email, wrong password, and inactive user", async () => {
    const attempts = [
      { email: "nobody@sprikle.test", password: TEST_PASSWORD },
      { email: TEST_USERS.tech.email, password: "wrong-password-0000" },
      { email: TEST_USERS.inactive.email, password: TEST_PASSWORD },
    ];
    const results = [];
    for (const body of attempts) {
      const response = await auth.handler(
        authRequest("/sign-in/email", { body, client: newClient() }),
      );
      results.push({
        status: response.status,
        body: await response.json(),
        cookie: sessionSetCookie(response),
      });
    }

    for (const result of results) {
      expect(result).toEqual({ status: 401, body: GENERIC_FAILURE, cookie: null });
    }
    expect(await sessionCount(TEST_USERS.inactive.email)).toBe(0);
  });
});

describe("sign-up and unused endpoints", () => {
  it("rejects public sign-up over HTTP and through the server API, creating nobody", async () => {
    const body = { email: "new@sprikle.test", password: TEST_PASSWORD, name: "New", role: "ADMIN" };
    const response = await auth.handler(
      authRequest("/sign-up/email", { body, client: newClient() }),
    );
    expect(response.status).toBe(404);

    await expect(auth.api.signUpEmail({ body })).rejects.toMatchObject({ status: "BAD_REQUEST" });
    expect(await db.user.count({ where: { email: "new@sprikle.test" } })).toBe(0);
  });

  it("answers 404 for every disabled endpoint, even with a valid session", async () => {
    const { cookie } = await signIn(auth, TEST_USERS.admin.email);
    for (const path of DISABLED_AUTH_PATHS) {
      const response = await auth.handler(
        authRequest(path, { body: {}, cookie, client: newClient() }),
      );
      expect({ path, status: response.status }).toEqual({ path, status: 404 });
    }
  });
});

describe("server-owned fields", () => {
  const storedFields = async (email: string) =>
    db.user.findUniqueOrThrow({
      where: { email },
      select: { role: true, isActive: true, name: true },
    });

  it("cannot be written through the (disabled) update-user HTTP endpoint", async () => {
    const before = await storedFields(TEST_USERS.tech.email);
    const { cookie } = await signIn(auth, TEST_USERS.tech.email);

    const response = await auth.handler(
      authRequest("/update-user", {
        body: { role: "ADMIN", isActive: true, name: "x" },
        cookie,
        client: newClient(),
      }),
    );

    expect(response.status).toBe(404);
    expect(await storedFields(TEST_USERS.tech.email)).toEqual(before);
  });

  it("are ignored when smuggled into a sign-in request", async () => {
    const before = await storedFields(TEST_USERS.tech.email);
    const response = await auth.handler(
      authRequest("/sign-in/email", {
        body: {
          email: TEST_USERS.tech.email,
          password: TEST_PASSWORD,
          role: "ADMIN",
          isActive: true,
        },
        client: newClient(),
      }),
    );

    // Better Auth 1.7.7 accepts the sign-in and ignores the extra fields.
    expect(response.status).toBe(200);
    expect(await storedFields(TEST_USERS.tech.email)).toEqual(before);
    const cookie = sessionSetCookie(response)?.split(";")[0] ?? "";
    const actor = await getActor(headersWith(cookie), auth);
    expect(actor?.role).toBe("TEAM_MEMBER");
  });

  it("are rejected by Better Auth's update API (defense in depth behind the disabled endpoint)", async () => {
    const before = await storedFields(TEST_USERS.tech.email);
    const { cookie } = await signIn(auth, TEST_USERS.tech.email);

    await expect(
      auth.api.updateUser({ headers: headersWith(cookie!), body: { role: "ADMIN" } as never }),
    ).rejects.toMatchObject({ body: { code: "FIELD_NOT_ALLOWED" } });
    expect(await storedFields(TEST_USERS.tech.email)).toEqual(before);
  });
});

describe("origin and CSRF protection on the HTTP handler", () => {
  it("rejects sign-in from an untrusted Origin without creating a session", async () => {
    const response = await auth.handler(
      authRequest("/sign-in/email", {
        body: { email: TEST_USERS.admin.email, password: TEST_PASSWORD },
        origin: "https://evil.example",
        client: newClient(),
      }),
    );

    expect(response.status).toBe(403);
    expect(sessionSetCookie(response)).toBeNull();
    expect(await sessionCount(TEST_USERS.admin.email)).toBe(0);
  });

  it("rejects a cross-site sign-in that omits Origin (Fetch Metadata check)", async () => {
    const response = await auth.handler(
      authRequest("/sign-in/email", {
        body: { email: TEST_USERS.admin.email, password: TEST_PASSWORD },
        origin: null,
        headers: { "sec-fetch-site": "cross-site", "sec-fetch-mode": "cors" },
        client: newClient(),
      }),
    );

    expect(response.status).toBe(403);
    expect(sessionSetCookie(response)).toBeNull();
    expect(await sessionCount(TEST_USERS.admin.email)).toBe(0);
  });

  it("rejects a cross-site sign-out and keeps the session valid", async () => {
    const { cookie } = await signIn(auth, TEST_USERS.admin.email);
    const response = await auth.handler(
      authRequest("/sign-out", {
        body: {},
        cookie,
        origin: "https://evil.example",
        client: newClient(),
      }),
    );

    expect(response.status).toBe(403);
    expect(await getActor(headersWith(cookie!), auth)).not.toBeNull();
  });
});

describe("login rate limiting on the HTTP handler", () => {
  it(`allows ${SIGN_IN_RATE_LIMIT.max} sign-in requests per isolated test identity, then answers 429`, async () => {
    const client = newClient();
    const attempt = (password: string) =>
      auth.handler(
        authRequest("/sign-in/email", { body: { email: TEST_USERS.tech.email, password }, client }),
      );

    for (let i = 0; i < SIGN_IN_RATE_LIMIT.max; i += 1) {
      expect((await attempt("wrong-password-0000")).status).toBe(401);
    }
    expect((await attempt("wrong-password-0000")).status).toBe(429);
    // Even the correct password is refused while limited.
    const limited = await attempt(TEST_PASSWORD);
    expect(limited.status).toBe(429);
    expect(sessionSetCookie(limited)).toBeNull();

    // A different isolated test identity has its own bucket (test-only; production shares one).
    const other = await auth.handler(
      authRequest("/sign-in/email", {
        body: { email: TEST_USERS.tech.email, password: "wrong-password-0000" },
        client: newClient(),
      }),
    );
    expect(other.status).toBe(401);
  });
});

describe("session lifetime", () => {
  it("rejects an expired session", async () => {
    const { cookie } = await signIn(auth, TEST_USERS.tech.email);
    await db.session.updateMany({
      where: { userId: await userIdFor(TEST_USERS.tech.email) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await getActor(headersWith(cookie!), auth)).toBeNull();
    const response = await auth.handler(authRequest("/get-session", { method: "GET", cookie }));
    expect(await response.json()).toBeNull();
  });

  it("rolls the expiry forward through the auth handler, but never during server-side reads", async () => {
    const { cookie } = await signIn(auth, TEST_USERS.tech.email);
    const userId = await userIdFor(TEST_USERS.tech.email);
    // Simulate a session last refreshed two hours ago (older than the one-hour update age).
    const aged = new Date(Date.now() + SESSION_EXPIRES_IN_SECONDS * 1000 - 2 * HOUR_MS);
    await db.session.updateMany({ where: { userId }, data: { expiresAt: aged } });

    // Server-side read (as in Server Components): no refresh, no write.
    expect(await getActor(headersWith(cookie!), auth)).not.toBeNull();
    const afterRead = await db.session.findFirstOrThrow({ where: { userId } });
    expect(afterRead.expiresAt.getTime()).toBe(aged.getTime());

    // HTTP session endpoint: refreshes the database expiry and re-issues the cookie.
    const before = Date.now();
    const response = await auth.handler(authRequest("/get-session", { method: "GET", cookie }));
    expect(response.status).toBe(200);
    expect(/;\s*Max-Age=28800/i.test(sessionSetCookie(response) ?? "")).toBe(true);
    const refreshed = await db.session.findFirstOrThrow({ where: { userId } });
    const expected = before + SESSION_EXPIRES_IN_SECONDS * 1000;
    expect(Math.abs(refreshed.expiresAt.getTime() - expected)).toBeLessThan(60_000);
  });
});

describe("inactive users", () => {
  it("are denied by the application immediately after deactivation, even with a live session", async () => {
    const { cookie } = await signIn(auth, TEST_USERS.tech.email);
    expect(await getActor(headersWith(cookie!), auth)).not.toBeNull();

    await db.user.update({ where: { email: TEST_USERS.tech.email }, data: { isActive: false } });

    expect(await getActor(headersWith(cookie!), auth)).toBeNull();
    await expect(authorize(headersWith(cookie!), {}, auth)).resolves.toEqual({
      ok: false,
      reason: "UNAUTHENTICATED",
    });

    // The raw session endpoint still describes the stored session (it is not application
    // authorization); it reports the account as inactive, which the application refuses.
    const raw = await auth.handler(authRequest("/get-session", { method: "GET", cookie }));
    const payload = (await raw.json()) as { user?: { isActive?: unknown } } | null;
    expect(raw.status).toBe(200);
    expect(payload?.user?.isActive).toBe(false);

    // And the user cannot sign in again.
    const again = await signIn(auth, TEST_USERS.tech.email);
    expect(again.response.status).toBe(401);
  });
});

describe("roles", () => {
  it("authorize() denies the wrong role and allows the right one", async () => {
    const tech = await signIn(auth, TEST_USERS.tech.email);
    const admin = await signIn(auth, TEST_USERS.admin.email);

    await expect(authorize(headersWith(tech.cookie!), { role: "ADMIN" }, auth)).resolves.toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });
    await expect(
      authorize(headersWith(admin.cookie!), { role: "ADMIN" }, auth),
    ).resolves.toMatchObject({
      ok: true,
      actor: { role: "ADMIN" },
    });
  });

  it("rejects requests with no session cookie", async () => {
    await expect(authorize(new Headers(), {}, auth)).resolves.toEqual({
      ok: false,
      reason: "UNAUTHENTICATED",
    });
  });
});

describe("sign-out", () => {
  it("deletes the session and invalidates the cookie", async () => {
    const { cookie } = await signIn(auth, TEST_USERS.admin.email);
    const response = await auth.handler(
      authRequest("/sign-out", { body: {}, cookie, client: newClient() }),
    );

    expect(response.status).toBe(200);
    expect(/;\s*Max-Age=0/i.test(sessionSetCookie(response) ?? "")).toBe(true);
    expect(await sessionCount(TEST_USERS.admin.email)).toBe(0);
    expect(await getActor(headersWith(cookie!), auth)).toBeNull();
  });
});

// Production identity configuration: client-supplied forwarding headers are NOT trusted, so
// rotating x-forwarded-for cannot evade the limiter. Kept last: it fills the shared local bucket.
describe("rate-limit identity (production configuration)", () => {
  it("ignores rotating x-forwarded-for values", async () => {
    const productionAuth = createTestAuth({ productionIpConfig: true });
    const statuses: number[] = [];
    for (let i = 0; i <= SIGN_IN_RATE_LIMIT.max; i += 1) {
      const response = await productionAuth.handler(
        authRequest("/sign-in/email", {
          body: { email: TEST_USERS.tech.email, password: "wrong-password-0000" },
          headers: { "x-forwarded-for": `203.0.113.${i + 1}` },
        }),
      );
      statuses.push(response.status);
    }
    expect(statuses).toEqual([...Array(SIGN_IN_RATE_LIMIT.max).fill(401), 429]);
  });
});
