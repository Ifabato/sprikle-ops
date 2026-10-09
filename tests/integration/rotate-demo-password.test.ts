import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DEMO_USERS, provisionCredentialUser } from "../../scripts/lib/auth-users.ts";
import {
  readPasswordFromEnv,
  rotateDemoPassword,
  type RotationFs,
} from "../../scripts/lib/rotate-demo-password.ts";
import { createTestAuth, newClient, signIn } from "../helpers/auth-test";
import { TEST_DATABASE_NAME } from "../helpers/database-safety";
import {
  disconnectTestPrisma,
  getTestPrisma,
  truncateTestDatabase,
} from "../helpers/test-database";

// Rotation core against sprikle_ops_test with an in-memory filesystem. Assertions compare booleans
// and counts; no password value is ever part of an assertion message.

const db = getTestPrisma();
const auth = createTestAuth();
const OLD_PASSWORD = "old-demo-password-for-tests-01";
const OTHER = {
  email: "someone.else@sprikle.test",
  name: "Other",
  role: "ADMIN",
  isActive: true,
} as const;
const ENV = "/virtual/.env";
const STAGED = "/virtual/.env.rotate-staged";
const ENV_CONTENT = `APP_TIMEZONE=America/New_York\nSEED_DEMO_PASSWORD=${OLD_PASSWORD}\nBETTER_AUTH_URL=http://localhost:3000\n`;

function memoryFs(options: { failRename?: boolean } = {}) {
  const files = new Map<string, { data: string; mode: number }>([
    [ENV, { data: ENV_CONTENT, mode: 0o600 }],
  ]);
  const fs: RotationFs = {
    readFile: (path) => {
      const file = files.get(path);
      if (!file) throw new Error("missing");
      return file.data;
    },
    writeFileExclusive: (path, data, mode) => {
      if (files.has(path)) throw new Error("exists");
      files.set(path, { data, mode });
    },
    rename: (from, to) => {
      if (options.failRename) throw new Error("EACCES");
      const file = files.get(from);
      if (!file) throw new Error("missing");
      files.set(to, file);
      files.delete(from);
    },
    remove: (path) => {
      files.delete(path);
    },
    exists: (path) => files.has(path),
  };
  return { fs, files };
}

const deps = (
  fs: RotationFs,
  overrides: Partial<Parameters<typeof rotateDemoPassword>[0]> = {},
) => ({
  db,
  fs,
  envPath: ENV,
  stagedPath: STAGED,
  expectedDatabase: TEST_DATABASE_NAME,
  emails: DEMO_USERS.map((user) => user.email),
  generatePassword: () => randomBytes(24).toString("base64url"),
  hashPassword,
  verifyPassword,
  ...overrides,
});

async function addSession(email: string): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
  await db.session.create({
    data: {
      userId: user.id,
      token: randomBytes(16).toString("hex"),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
}

beforeEach(async () => {
  await truncateTestDatabase();
  for (const user of [...DEMO_USERS, OTHER]) {
    await provisionCredentialUser(db, user, OLD_PASSWORD);
  }
  await addSession(DEMO_USERS[0]!.email);
  await addSession(DEMO_USERS[1]!.email);
  await addSession(OTHER.email);
});

afterAll(async () => {
  await disconnectTestPrisma();
});

const otherHash = async () =>
  (await db.account.findFirstOrThrow({ where: { user: { email: OTHER.email } } })).password;

describe("rotateDemoPassword", () => {
  it("rotates only the demo accounts, signs out their sessions, and updates only the .env line", async () => {
    const { fs, files } = memoryFs();
    const otherBefore = await otherHash();

    const outcome = await rotateDemoPassword(deps(fs));

    expect(outcome).toEqual({
      kind: "rotated",
      accountsUpdated: 4,
      sessionsDeleted: 2,
      newPasswordVerifies: true,
      oldPasswordRejected: true,
    });
    const env = files.get(ENV)!;
    const newPassword = readPasswordFromEnv(env.data) ?? "";
    expect(newPassword.length >= 32 && newPassword !== OLD_PASSWORD).toBe(true);
    expect(env.data.split("\n").filter((line) => !line.startsWith("SEED_DEMO_PASSWORD="))).toEqual(
      ENV_CONTENT.split("\n").filter((line) => !line.startsWith("SEED_DEMO_PASSWORD=")),
    );
    expect(env.mode).toBe(0o600);
    expect(files.has(STAGED)).toBe(false);

    // Real sign-in through Better Auth's HTTP handler.
    const admin = DEMO_USERS[0]!.email;
    expect((await signIn(auth, admin, newPassword, newClient())).response.status).toBe(200);
    expect((await signIn(auth, admin, OLD_PASSWORD, newClient())).response.status).toBe(401);

    // Unrelated account and session untouched.
    expect(await otherHash()).toBe(otherBefore);
    expect(await db.session.count({ where: { user: { email: OTHER.email } } })).toBe(1);
  });

  it("keeps the owner-only staged file and reports recovery when .env cannot be replaced", async () => {
    const { fs, files } = memoryFs({ failRename: true });

    const outcome = await rotateDemoPassword(deps(fs));

    expect(outcome).toEqual({
      kind: "env-replace-failed",
      accountsUpdated: 4,
      sessionsDeleted: 2,
      stagedPath: STAGED,
    });
    // .env is untouched; the staged file holds the password the database now uses.
    expect(files.get(ENV)!.data).toBe(ENV_CONTENT);
    const staged = files.get(STAGED)!;
    expect(staged.mode).toBe(0o600);
    const stagedPassword = readPasswordFromEnv(staged.data) ?? "";
    const hash = (
      await db.account.findFirstOrThrow({ where: { user: { email: DEMO_USERS[0]!.email } } })
    ).password!;
    expect(await verifyPassword({ hash, password: stagedPassword })).toBe(true);
    // The outcome never carries a password.
    expect(JSON.stringify(outcome).includes(stagedPassword)).toBe(false);

    // A second run refuses while the staged file exists (no second, unrecoverable rotation).
    const again = await rotateDemoPassword(deps(fs));
    expect(again.kind).toBe("nothing-changed");
    expect(files.get(STAGED)!.data).toBe(staged.data);
  });

  it("changes nothing and removes the staged file when the database step fails", async () => {
    const { fs, files } = memoryFs();
    await db.user.delete({ where: { email: DEMO_USERS[3]!.email } });
    const before = await db.account.findMany({
      select: { id: true, password: true },
      orderBy: { id: "asc" },
    });

    const outcome = await rotateDemoPassword(deps(fs));

    expect(outcome.kind).toBe("nothing-changed");
    expect(files.has(STAGED)).toBe(false);
    expect(files.get(ENV)!.data).toBe(ENV_CONTENT);
    expect(
      await db.account.findMany({ select: { id: true, password: true }, orderBy: { id: "asc" } }),
    ).toEqual(before);
    expect(await db.session.count()).toBe(3);
  });

  it("refuses when connected to a database other than the expected one", async () => {
    const { fs, files } = memoryFs();
    const outcome = await rotateDemoPassword(deps(fs, { expectedDatabase: "sprikle_ops" }));
    expect(outcome.kind).toBe("nothing-changed");
    expect(files.has(STAGED)).toBe(false);
    expect(await db.session.count()).toBe(3);
  });
});
