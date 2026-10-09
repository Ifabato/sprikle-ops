// Local-demo password rotation (core logic, dependency-injected for tests).
//
// Better Auth's in-app password routes are disabled (ADR 0002) and provisioning never changes an
// existing account, so editing .env alone would not change any stored password. This rotates the
// shared demo password end to end:
//
//   1. stage a copy of .env with only the SEED_DEMO_PASSWORD line replaced (owner-only, exclusive);
//   2. in one database transaction: update the credential password hash of the demo accounts and
//      delete those users' sessions (signing out every browser using the old password);
//   3. rename the staged file over .env;
//   4. verify the stored hashes against the password now in .env (booleans only).
//
// A database commit and a file rename cannot be one atomic operation. If step 3 fails after step 2
// committed, the staged file is kept (owner-only) and the caller reports how to move it into place;
// the password is never printed. If step 2 fails, the staged file is removed and nothing changed.
import type { PrismaClient } from "../../src/generated/prisma/client.ts";
import { CREDENTIAL_PROVIDER_ID, MIN_DEMO_PASSWORD_LENGTH } from "./auth-users.ts";

export const PASSWORD_KEY = "SEED_DEMO_PASSWORD";

export interface RotationFs {
  readFile(path: string): string;
  /** Creates the file with the given mode; fails if it already exists. */
  writeFileExclusive(path: string, data: string, mode: number): void;
  rename(from: string, to: string): void;
  remove(path: string): void;
  exists(path: string): boolean;
}

export interface RotationDependencies {
  db: PrismaClient;
  fs: RotationFs;
  envPath: string;
  stagedPath: string;
  /** The database the transaction must be connected to (re-checked inside it). */
  expectedDatabase: string;
  emails: readonly string[];
  generatePassword: () => string;
  hashPassword: (password: string) => Promise<string>;
  verifyPassword: (input: { hash: string; password: string }) => Promise<boolean>;
}

export type RotationOutcome =
  | {
      kind: "rotated";
      accountsUpdated: number;
      sessionsDeleted: number;
      newPasswordVerifies: boolean;
      oldPasswordRejected: boolean;
    }
  | { kind: "nothing-changed"; reason: string }
  | {
      kind: "env-replace-failed";
      accountsUpdated: number;
      sessionsDeleted: number;
      stagedPath: string;
    };

interface EnvLine {
  lines: string[];
  index: number;
  value: string;
}

function findPasswordLine(content: string): EnvLine | null {
  const lines = content.split(/(?<=\n)/);
  const matches = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.startsWith(`${PASSWORD_KEY}=`));
  if (matches.length !== 1) return null;
  const { line, index } = matches[0]!;
  let value = line.slice(PASSWORD_KEY.length + 1).replace(/\r?\n$/, "");
  if (/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1);
  return { lines, index, value };
}

/** Reads the current demo password from .env content; null when absent or ambiguous. */
export function readPasswordFromEnv(content: string): string | null {
  return findPasswordLine(content)?.value ?? null;
}

/** Returns the .env content with only the password line replaced (all other bytes unchanged). */
export function replacePasswordLine(content: string, password: string): string {
  const found = findPasswordLine(content);
  if (!found) throw new Error(`.env must contain exactly one ${PASSWORD_KEY} line.`);
  const lines = [...found.lines];
  const ending = lines[found.index]!.match(/\r?\n$/)?.[0] ?? "";
  lines[found.index] = `${PASSWORD_KEY}=${password}${ending}`;
  return lines.join("");
}

export async function rotateDemoPassword(deps: RotationDependencies): Promise<RotationOutcome> {
  const { db, fs } = deps;

  if (fs.exists(deps.stagedPath)) {
    return {
      kind: "nothing-changed",
      reason: "a staged file from an earlier rotation exists; resolve it first (see the docs)",
    };
  }
  const original = fs.readFile(deps.envPath);
  const oldPassword = readPasswordFromEnv(original);
  if (oldPassword === null) {
    return {
      kind: "nothing-changed",
      reason: `.env must contain exactly one ${PASSWORD_KEY} line`,
    };
  }
  const newPassword = deps.generatePassword();
  if (
    newPassword.length < MIN_DEMO_PASSWORD_LENGTH ||
    newPassword === oldPassword ||
    /\s/.test(newPassword)
  ) {
    return { kind: "nothing-changed", reason: "the generated password was not usable" };
  }

  fs.writeFileExclusive(deps.stagedPath, replacePasswordLine(original, newPassword), 0o600);

  let accountsUpdated = 0;
  let sessionsDeleted = 0;
  try {
    const newHash = await deps.hashPassword(newPassword);
    await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
      if (rows[0]?.current_database !== deps.expectedDatabase) {
        throw new Error("connected to an unexpected database");
      }
      const users = await tx.user.findMany({
        where: { email: { in: [...deps.emails] } },
        select: { id: true },
      });
      if (users.length !== deps.emails.length) {
        throw new Error("not every demo account exists");
      }
      for (const user of users) {
        const result = await tx.account.updateMany({
          where: { userId: user.id, providerId: CREDENTIAL_PROVIDER_ID, accountId: user.id },
          data: { password: newHash },
        });
        if (result.count !== 1) throw new Error("a demo account has no single credential record");
        accountsUpdated += 1;
      }
      const deleted = await tx.session.deleteMany({
        where: { userId: { in: users.map((user) => user.id) } },
      });
      sessionsDeleted = deleted.count;
    });
  } catch (error) {
    fs.remove(deps.stagedPath);
    const reason = error instanceof Error ? error.message : "database update failed";
    return { kind: "nothing-changed", reason: `database unchanged: ${reason}` };
  }

  try {
    fs.rename(deps.stagedPath, deps.envPath);
  } catch {
    // The database already uses the new password; keep the staged file so it can be moved into
    // place. It stays owner-only and its value is never printed.
    return {
      kind: "env-replace-failed",
      accountsUpdated,
      sessionsDeleted,
      stagedPath: deps.stagedPath,
    };
  }

  const current = readPasswordFromEnv(fs.readFile(deps.envPath)) ?? "";
  const accounts = await db.account.findMany({
    where: { providerId: CREDENTIAL_PROVIDER_ID, user: { email: { in: [...deps.emails] } } },
    select: { password: true },
  });
  let newPasswordVerifies = accounts.length === deps.emails.length;
  let oldPasswordRejected = true;
  for (const { password: hash } of accounts) {
    if (!hash || !(await deps.verifyPassword({ hash, password: current })))
      newPasswordVerifies = false;
    if (hash && (await deps.verifyPassword({ hash, password: oldPassword })))
      oldPasswordRejected = false;
  }
  return {
    kind: "rotated",
    accountsUpdated,
    sessionsDeleted,
    newPasswordVerifies,
    oldPasswordRejected,
  };
}
