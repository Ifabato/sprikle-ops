import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  CREDENTIAL_PROVIDER_ID,
  DEMO_USERS,
  provisionCredentialUser,
} from "../../scripts/lib/auth-users.ts";
import { createTestAuth, newClient, signIn, TEST_PASSWORD } from "../helpers/auth-test";
import {
  disconnectTestPrisma,
  getTestPrisma,
  truncateTestDatabase,
} from "../helpers/test-database";

const db = getTestPrisma();
const auth = createTestAuth();
const OTHER_PASSWORD = "a-different-password-0002";
const spec = {
  email: "Provisioned.Admin@Sprikle.test",
  name: "Provisioned Admin",
  role: "ADMIN",
  isActive: true,
} as const;

beforeEach(async () => {
  await truncateTestDatabase();
});

afterAll(async () => {
  await disconnectTestPrisma();
});

const snapshot = async (email: string) => {
  const user = await db.user.findUniqueOrThrow({
    where: { email },
    select: { id: true, name: true, role: true, isActive: true, accounts: true },
  });
  return user;
};

describe("provisionCredentialUser", () => {
  it("creates a lowercase user with the credential account Better Auth's email sign-in expects", async () => {
    await expect(provisionCredentialUser(db, spec, TEST_PASSWORD)).resolves.toBe("created");

    const user = await snapshot("provisioned.admin@sprikle.test");
    expect(user).toMatchObject({ role: "ADMIN", isActive: true, name: "Provisioned Admin" });
    expect(user.accounts).toHaveLength(1);
    const account = user.accounts[0]!;
    expect(account.providerId).toBe(CREDENTIAL_PROVIDER_ID);
    expect(account.accountId === user.id).toBe(true);
    // A hash is stored, never the password (compared as booleans so nothing is printed).
    expect(typeof account.password === "string" && account.password.length > 0).toBe(true);
    expect(account.password === TEST_PASSWORD).toBe(false);

    const { response } = await signIn(
      auth,
      "provisioned.admin@sprikle.test",
      TEST_PASSWORD,
      newClient(),
    );
    expect(response.status).toBe(200);
  });

  it("leaves an existing user completely unchanged on a repeat run", async () => {
    await provisionCredentialUser(db, spec, TEST_PASSWORD);
    const before = await snapshot("provisioned.admin@sprikle.test");

    const outcome = await provisionCredentialUser(
      db,
      { ...spec, name: "Renamed", role: "TEAM_MEMBER", isActive: false },
      OTHER_PASSWORD,
    );

    expect(outcome).toBe("unchanged");
    const after = await snapshot("provisioned.admin@sprikle.test");
    expect(
      after.name === before.name &&
        after.role === before.role &&
        after.isActive === before.isActive,
    ).toBe(true);
    expect(after.accounts.length).toBe(1);
    expect(after.accounts[0]!.password === before.accounts[0]!.password).toBe(true);

    // The original password still works; the repeat run's password was never applied.
    expect(
      (await signIn(auth, spec.email.toLowerCase(), TEST_PASSWORD, newClient())).response.status,
    ).toBe(200);
    expect(
      (await signIn(auth, spec.email.toLowerCase(), OTHER_PASSWORD, newClient())).response.status,
    ).toBe(401);
  });

  it("refuses passwords shorter than 12 characters and creates nothing", async () => {
    await expect(provisionCredentialUser(db, spec, "short-pass")).rejects.toThrow(/at least 12/);
    expect(await db.user.count()).toBe(0);
  });

  it("provisions the four synthetic demo accounts, and the inactive one cannot sign in", async () => {
    for (const demo of DEMO_USERS) {
      await expect(provisionCredentialUser(db, demo, TEST_PASSWORD)).resolves.toBe("created");
    }
    const users = await db.user.findMany({
      select: { email: true, role: true, isActive: true },
      orderBy: { email: "asc" },
    });
    expect(users).toEqual([
      { email: "admin@sprikle.test", role: "ADMIN", isActive: true },
      { email: "inactive@sprikle.test", role: "TEAM_MEMBER", isActive: false },
      { email: "tech.one@sprikle.test", role: "TEAM_MEMBER", isActive: true },
      { email: "tech.two@sprikle.test", role: "TEAM_MEMBER", isActive: true },
    ]);
    expect(users.every((user) => user.email.endsWith("@sprikle.test"))).toBe(true);

    const inactive = await signIn(auth, "inactive@sprikle.test", TEST_PASSWORD, newClient());
    expect(inactive.response.status).toBe(401);
    expect(inactive.cookie).toBeNull();
  });
});
