import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ApiDeps } from "@/server/api/http";
import {
  addCommentHandler,
  createWorkOrderHandler,
  editWorkOrderHandler,
  getWorkOrderHandler,
  listActivityHandler,
  listAssigneesHandler,
  listCommentsHandler,
  listServiceAreasHandler,
  listWorkOrdersHandler,
  transitionHandler,
} from "@/server/api/work-orders";
import { provisionCredentialUser } from "../../scripts/lib/auth-users.ts";
import {
  createTestAuth,
  provisionTestUsers,
  signIn,
  TEST_BASE_URL,
  TEST_PASSWORD,
  TEST_USERS,
} from "../helpers/auth-test";
import {
  disconnectTestPrisma,
  getTestPrisma,
  truncateTestDatabase,
} from "../helpers/test-database";

// /api/v1 handlers end to end: real Better Auth sessions (cookies from the HTTP sign-in handler),
// real services, real test database. Covers 401/403/404/409/422/400/500 and CSRF refusals.

const prisma = getTestPrisma();
const NOW = new Date("2026-03-02T15:00:00.000Z");
const auth = createTestAuth();
const deps: ApiDeps = { db: prisma, auth, clock: () => NOW, trustedOrigin: TEST_BASE_URL };

const OTHER_TECH = {
  email: "other@sprikle.test",
  name: "Other Tech",
  role: "TEAM_MEMBER",
  isActive: true,
} as const;
const LEAVER = {
  email: "leaver@sprikle.test",
  name: "Leaver",
  role: "TEAM_MEMBER",
  isActive: true,
} as const;

let adminCookie: string;
let techCookie: string;
let otherCookie: string;
let techId: string;
let areaId: string;

interface Call {
  method?: string;
  body?: unknown;
  rawBody?: string;
  cookie?: string | null;
  origin?: string | null;
  site?: string;
  contentType?: string;
}

function request(path: string, call: Call = {}): Request {
  const method = call.method ?? "GET";
  const headers = new Headers();
  if (call.cookie) headers.set("cookie", call.cookie);
  if (call.origin) headers.set("origin", call.origin);
  if (call.site) headers.set("sec-fetch-site", call.site);
  const body = call.rawBody ?? (call.body === undefined ? undefined : JSON.stringify(call.body));
  if (body !== undefined) headers.set("content-type", call.contentType ?? "application/json");
  return new Request(`${TEST_BASE_URL}/api/v1${path}`, { method, headers, body });
}

const write = (cookie: string, body: unknown, method = "POST"): Call => ({
  method,
  body,
  cookie,
  origin: TEST_BASE_URL,
  site: "same-origin",
});

async function errorCode(response: Response) {
  const body = (await response.json()) as { error: { code: string; requestId: string } };
  return body.error.code;
}

async function createAs(cookie: string, overrides: Record<string, unknown> = {}) {
  const response = await createWorkOrderHandler(
    request(
      "/work-orders",
      write(cookie, {
        title: "Replace lobby light fixture",
        description: "Fixture flickers.",
        serviceAreaId: areaId,
        dueDate: "2026-03-06",
        ...overrides,
      }),
    ),
    deps,
  );
  return response;
}

async function createRef(overrides: Record<string, unknown> = {}) {
  const response = await createAs(adminCookie, overrides);
  expect(response.status).toBe(201);
  const body = (await response.json()) as { data: { reference: string; version: number } };
  return body.data;
}

beforeAll(async () => {
  await truncateTestDatabase();
  await provisionTestUsers();
  await provisionCredentialUser(prisma, OTHER_TECH, TEST_PASSWORD);
  await provisionCredentialUser(prisma, LEAVER, TEST_PASSWORD);
  areaId = (await prisma.serviceArea.create({ data: { name: "North District" } })).id;
  techId = (await prisma.user.findUniqueOrThrow({ where: { email: TEST_USERS.tech.email } })).id;
  adminCookie = (await signIn(auth, TEST_USERS.admin.email)).cookie!;
  techCookie = (await signIn(auth, TEST_USERS.tech.email)).cookie!;
  otherCookie = (await signIn(auth, OTHER_TECH.email)).cookie!;
  expect([adminCookie, techCookie, otherCookie].every(Boolean)).toBe(true);
});

afterAll(async () => {
  await disconnectTestPrisma();
});

describe("authentication and transport", () => {
  it("returns 401 JSON (not a redirect) without a session", async () => {
    const response = await listWorkOrdersHandler(request("/work-orders"), deps);
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(await errorCode(response)).toBe("UNAUTHENTICATED");
    expect((await createAs("")).status).toBe(401);
  });

  it("refuses cross-site writes before touching the session or database", async () => {
    const before = await prisma.workOrder.count();
    const body = { title: "Phish", description: "x", serviceAreaId: areaId, dueDate: "2026-03-06" };
    const foreignOrigin = await createWorkOrderHandler(
      request("/work-orders", {
        method: "POST",
        body,
        cookie: adminCookie,
        origin: "https://evil.example",
      }),
      deps,
    );
    const crossSite = await createWorkOrderHandler(
      request("/work-orders", { method: "POST", body, cookie: adminCookie, site: "cross-site" }),
      deps,
    );
    expect([foreignOrigin.status, crossSite.status]).toEqual([403, 403]);
    expect(await prisma.workOrder.count()).toBe(before);
  });

  it("requires a JSON body and rejects malformed JSON", async () => {
    const form = await createWorkOrderHandler(
      request("/work-orders", {
        ...write(adminCookie, undefined),
        rawBody: "title=x",
        contentType: "application/x-www-form-urlencoded",
      }),
      deps,
    );
    const broken = await createWorkOrderHandler(
      request("/work-orders", { ...write(adminCookie, undefined), rawBody: "{not json" }),
      deps,
    );
    const huge = await createWorkOrderHandler(
      request("/work-orders", {
        ...write(adminCookie, undefined),
        rawBody: JSON.stringify({ title: "x".repeat(40_000) }),
      }),
      deps,
    );
    for (const response of [form, broken, huge]) {
      expect(response.status).toBe(400);
      expect(await errorCode(response)).toBe("VALIDATION_ERROR");
    }
  });

  it("maps unexpected failures to a generic 500 with a request ID and no internals", async () => {
    const broken = new Proxy({} as PrismaClient, {
      get: () => {
        throw new Error("connection refused at 10.0.0.5 password=hunter2");
      },
    });
    const response = await listWorkOrdersHandler(request("/work-orders", { cookie: adminCookie }), {
      ...deps,
      db: broken,
    });
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).toContain("INTERNAL_ERROR");
    expect(text).not.toMatch(/10\.0\.0\.5|hunter2|at .*\.ts/);
  });

  it("treats a user deactivated after sign-in as signed out", async () => {
    const leaverCookie = (await signIn(auth, LEAVER.email)).cookie!;
    expect(
      (await listWorkOrdersHandler(request("/work-orders", { cookie: leaverCookie }), deps)).status,
    ).toBe(200);
    await prisma.user.update({ where: { email: LEAVER.email }, data: { isActive: false } });
    expect(
      (await listWorkOrdersHandler(request("/work-orders", { cookie: leaverCookie }), deps)).status,
    ).toBe(401);
  });
});

describe("work orders", () => {
  it("lets admins create (201) and denies team members (403)", async () => {
    const response = await createAs(adminCookie, { assigneeId: techId });
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      data: { reference: string; status: string; dueAt: string };
    };
    expect(body.data).toMatchObject({ status: "OPEN", dueAt: "2026-03-07T04:59:59.999Z" });
    expect(body.data.reference).toMatch(/^WO-\d{6}$/);

    const denied = await createAs(techCookie);
    expect(denied.status).toBe(403);
    expect(await errorCode(denied)).toBe("FORBIDDEN");
  });

  it("returns field errors for invalid input", async () => {
    const response = await createAs(adminCookie, {
      title: "x",
      dueDate: "2026-03-01",
      status: "COMPLETED",
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { fieldErrors: Record<string, string[]> } };
    expect(Object.keys(body.error.fieldErrors).length).toBeGreaterThan(0);
  });

  it("scopes detail access: admin 200, assignee 200, other team member and malformed refs 404", async () => {
    const { reference } = await createRef({ assigneeId: techId });
    expect(
      (
        await getWorkOrderHandler(
          request(`/work-orders/${reference}`, { cookie: adminCookie }),
          reference,
          deps,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await getWorkOrderHandler(
          request(`/work-orders/${reference}`, { cookie: techCookie }),
          reference,
          deps,
        )
      ).status,
    ).toBe(200);
    const hidden = await getWorkOrderHandler(
      request(`/work-orders/${reference}`, { cookie: otherCookie }),
      reference,
      deps,
    );
    expect(hidden.status).toBe(404);
    for (const ref of ["WO-999999", "WO-abc", "../etc", "0"]) {
      const response = await getWorkOrderHandler(
        request(`/work-orders/x`, { cookie: adminCookie }),
        ref,
        deps,
      );
      expect(response.status, ref).toBe(404);
    }
  });

  it("PATCH: reports unchanged edits, 409 on stale versions, 403 for team members", async () => {
    const { reference } = await createRef({ assigneeId: techId });
    const patch = (cookie: string, body: unknown) =>
      editWorkOrderHandler(
        request(`/work-orders/${reference}`, write(cookie, body, "PATCH")),
        reference,
        deps,
      );

    const same = await patch(adminCookie, { version: 0, title: "Replace lobby light fixture" });
    expect(same.status).toBe(200);
    expect(((await same.json()) as { meta: { changed: boolean } }).meta.changed).toBe(false);

    const changed = await patch(adminCookie, { version: 0, priority: "HIGH" });
    expect(((await changed.json()) as { data: { version: number } }).data.version).toBe(1);

    const stale = await patch(adminCookie, { version: 0, priority: "LOW" });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({
      error: {
        code: "CONFLICT",
        message: "This work order was updated by someone else. Reload to see the latest version.",
      },
    });
    expect((await patch(techCookie, { version: 1, priority: "LOW" })).status).toBe(403);
    expect((await patch(otherCookie, { version: 1, priority: "LOW" })).status).toBe(404);
  });

  it("transitions: allowed 200, admin-only 403, invalid 422, same status 422, missing note 400", async () => {
    const { reference } = await createRef({ assigneeId: techId });
    const move = (cookie: string, body: unknown) =>
      transitionHandler(
        request(`/work-orders/${reference}/transitions`, write(cookie, body)),
        reference,
        deps,
      );

    expect((await move(techCookie, { version: 0, toStatus: "IN_PROGRESS" })).status).toBe(200);
    const sameStatus = await move(techCookie, { version: 1, toStatus: "IN_PROGRESS" });
    expect([sameStatus.status, await errorCode(sameStatus)]).toEqual([422, "NO_CHANGE"]);
    const noNote = await move(techCookie, { version: 1, toStatus: "BLOCKED" });
    expect(noNote.status).toBe(400);
    const cancel = await move(techCookie, {
      version: 1,
      toStatus: "CANCELLED",
      note: "Not needed",
    });
    expect([cancel.status, await errorCode(cancel)]).toEqual([403, "FORBIDDEN"]);
    expect(
      (await move(techCookie, { version: 1, toStatus: "COMPLETED", note: "Done" })).status,
    ).toBe(200);
    const invalid = await move(adminCookie, { version: 2, toStatus: "BLOCKED", note: "x" });
    expect([invalid.status, await errorCode(invalid)]).toEqual([422, "INVALID_TRANSITION"]);
    expect((await move(otherCookie, { version: 2, toStatus: "IN_PROGRESS" })).status).toBe(404);
  });

  it("comments and activity are scoped and append to the history", async () => {
    const { reference } = await createRef({ assigneeId: techId });
    const posted = await addCommentHandler(
      request(`/work-orders/${reference}/comments`, write(techCookie, { body: "On site at 2pm" })),
      reference,
      deps,
    );
    expect(posted.status).toBe(201);
    const denied = await addCommentHandler(
      request(`/work-orders/${reference}/comments`, write(otherCookie, { body: "Hi" })),
      reference,
      deps,
    );
    expect(denied.status).toBe(404);

    const comments = await listCommentsHandler(
      request(`/work-orders/${reference}/comments`, { cookie: techCookie }),
      reference,
      deps,
    );
    expect(
      ((await comments.json()) as { data: { body: string }[] }).data.map((c) => c.body),
    ).toEqual(["On site at 2pm"]);
    const activity = await listActivityHandler(
      request(`/work-orders/${reference}/activity`, { cookie: adminCookie }),
      reference,
      deps,
    );
    expect(
      ((await activity.json()) as { data: { type: string }[] }).data.map((a) => a.type),
    ).toEqual(["CREATED", "COMMENT_ADDED"]);
  });

  it("lists with scope and validated parameters", async () => {
    const own = await listWorkOrdersHandler(
      request("/work-orders?status=all", { cookie: techCookie }),
      deps,
    );
    const body = (await own.json()) as {
      data: { assignee: { id: string } | null }[];
      page: { total: number };
    };
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((row) => row.assignee?.id === techId)).toBe(true);
    expect(body.page.total).toBe(body.data.length);
    const bad = await listWorkOrdersHandler(
      request("/work-orders?sort=evil", { cookie: adminCookie }),
      deps,
    );
    expect(bad.status).toBe(400);
  });
});

describe("lookups", () => {
  it("assignees are admin-only; service areas are available to signed-in users", async () => {
    expect(
      (await listAssigneesHandler(request("/assignees", { cookie: techCookie }), deps)).status,
    ).toBe(403);
    const assignees = await listAssigneesHandler(
      request("/assignees", { cookie: adminCookie }),
      deps,
    );
    const names = ((await assignees.json()) as { data: { name: string }[] }).data.map(
      (u) => u.name,
    );
    expect(names).not.toContain(TEST_USERS.inactive.name);
    expect(
      (await listServiceAreasHandler(request("/service-areas", { cookie: techCookie }), deps))
        .status,
    ).toBe(200);
    expect((await listServiceAreasHandler(request("/service-areas"), deps)).status).toBe(401);
  });
});
