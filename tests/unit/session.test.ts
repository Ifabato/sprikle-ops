import { beforeEach, describe, expect, it, vi } from "vitest";

// Next.js request APIs are mocked: redirect() throws like the real one, so execution stops.
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const getSession = vi.fn();
vi.mock("@/server/auth", () => ({ getAuth: () => ({ api: { getSession } }) }));

const { actorFromSession, authorize, getActor, requireRole, requireUser } =
  await import("@/server/session");

const session = (user: Record<string, unknown>) => ({ session: { id: "s1" }, user });
const admin = { id: "admin-1", role: "ADMIN", isActive: true };
const tech = { id: "tech-1", role: "TEAM_MEMBER", isActive: true };

beforeEach(() => {
  getSession.mockReset();
  redirect.mockClear();
});

describe("actorFromSession", () => {
  it("maps an active user to a domain actor", () => {
    expect(actorFromSession(session(admin))).toEqual(admin);
  });

  it.each([
    ["no session", null],
    ["inactive user", session({ ...tech, isActive: false })],
    ["missing isActive", session({ id: "tech-1", role: "TEAM_MEMBER" })],
    ["truthy but not boolean isActive", session({ ...tech, isActive: "true" })],
    ["unknown role", session({ ...tech, role: "SUPERUSER" })],
    ["missing role", session({ id: "tech-1", isActive: true })],
    ["empty id", session({ ...tech, id: "" })],
    ["non-string id", session({ ...tech, id: 42 })],
  ])("fails closed for %s", (_label, input) => {
    expect(actorFromSession(input as Parameters<typeof actorFromSession>[0])).toBeNull();
  });
});

describe("getActor / authorize", () => {
  it("reads the session with refresh disabled (no writes during rendering)", async () => {
    getSession.mockResolvedValue(session(admin));
    const headers = new Headers({ cookie: "x=y" });

    await getActor(headers);

    expect(getSession).toHaveBeenCalledWith({ headers, query: { disableRefresh: true } });
  });

  it("returns UNAUTHENTICATED without a usable session", async () => {
    getSession.mockResolvedValue(null);
    await expect(authorize(new Headers())).resolves.toEqual({
      ok: false,
      reason: "UNAUTHENTICATED",
    });

    getSession.mockResolvedValue(session({ ...admin, isActive: false }));
    await expect(authorize(new Headers(), { role: "ADMIN" })).resolves.toEqual({
      ok: false,
      reason: "UNAUTHENTICATED",
    });
  });

  it("returns FORBIDDEN when the role does not match", async () => {
    getSession.mockResolvedValue(session(tech));
    await expect(authorize(new Headers(), { role: "ADMIN" })).resolves.toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });
  });

  it("allows matching roles and role-free checks", async () => {
    getSession.mockResolvedValue(session(admin));
    await expect(authorize(new Headers(), { role: "ADMIN" })).resolves.toEqual({
      ok: true,
      actor: admin,
    });
    getSession.mockResolvedValue(session(tech));
    await expect(authorize(new Headers())).resolves.toEqual({ ok: true, actor: tech });
  });
});

describe("page guards", () => {
  it("requireUser redirects signed-out users to login with a safe return path", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireUser("/work-orders?status=OPEN")).rejects.toThrow(
      "NEXT_REDIRECT:/login?next=%2Fwork-orders%3Fstatus%3DOPEN",
    );
  });

  it("requireUser never redirects to an unsafe return path", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireUser("https://evil.example")).rejects.toThrow(
      "NEXT_REDIRECT:/login?next=%2Fdashboard",
    );
  });

  it("requireUser redirects deactivated users and returns active actors", async () => {
    getSession.mockResolvedValue(session({ ...tech, isActive: false }));
    await expect(requireUser("/profile")).rejects.toThrow("NEXT_REDIRECT:/login?next=%2Fprofile");

    getSession.mockResolvedValue(session(tech));
    await expect(requireUser("/profile")).resolves.toEqual(tech);
  });

  it("requireRole redirects signed-out users and reports forbidden for the wrong role", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireRole("ADMIN", "/analytics")).rejects.toThrow(
      "NEXT_REDIRECT:/login?next=%2Fanalytics",
    );

    getSession.mockResolvedValue(session(tech));
    await expect(requireRole("ADMIN", "/analytics")).resolves.toEqual({ forbidden: true });
    expect(redirect).toHaveBeenCalledTimes(1);

    getSession.mockResolvedValue(session(admin));
    await expect(requireRole("ADMIN", "/analytics")).resolves.toEqual({
      forbidden: false,
      actor: admin,
    });
  });
});
