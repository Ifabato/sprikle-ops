// Rotates the shared password of the synthetic demo accounts in the LOCAL DEVELOPMENT database
// (sprikle_ops) and signs out their sessions. The new password is written only to .env and is
// never printed, logged, or passed on a command line. See scripts/lib/rotate-demo-password.ts.
// Run with: pnpm db:rotate:demo-password
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { DEMO_USERS } from "./lib/auth-users.ts";
import { rotateDemoPassword } from "./lib/rotate-demo-password.ts";

const ENV_PATH = ".env";
const STAGED_PATH = ".env.rotate-staged";
const DEVELOPMENT_DATABASE = "sprikle_ops";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function fail(message: string): never {
  console.error(`Refusing to rotate: ${message}.`);
  process.exit(1);
}

if (!existsSync(ENV_PATH)) fail(".env does not exist");
process.loadEnvFile(ENV_PATH);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) fail("DATABASE_URL is not set");
let target: URL;
try {
  target = new URL(databaseUrl);
} catch {
  fail("DATABASE_URL is not a valid URL");
}
if (!LOCAL_HOSTS.has(target.hostname.toLowerCase())) fail("the database host is not local");
if (decodeURIComponent(target.pathname.slice(1)) !== DEVELOPMENT_DATABASE) {
  fail(`the target database is not '${DEVELOPMENT_DATABASE}'`);
}
if ([...target.searchParams.keys()].some((key) => key !== "schema")) {
  fail("unexpected connection parameters");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl, max: 1 }) });
try {
  const outcome = await rotateDemoPassword({
    db,
    fs: {
      readFile: (path) => readFileSync(path, "utf8"),
      writeFileExclusive: (path, data, mode) => writeFileSync(path, data, { flag: "wx", mode }),
      rename: renameSync,
      remove: (path) => rmSync(path, { force: true }),
      exists: existsSync,
    },
    envPath: ENV_PATH,
    stagedPath: STAGED_PATH,
    expectedDatabase: DEVELOPMENT_DATABASE,
    emails: DEMO_USERS.map((user) => user.email),
    generatePassword: () => randomBytes(24).toString("base64url"),
    hashPassword,
    verifyPassword,
  });

  switch (outcome.kind) {
    case "rotated":
      console.log(`Demo accounts updated: ${outcome.accountsUpdated}`);
      console.log(`Demo-user sessions signed out: ${outcome.sessionsDeleted}`);
      console.log(`New password in .env verifies: ${outcome.newPasswordVerifies}`);
      console.log(`Old password rejected: ${outcome.oldPasswordRejected}`);
      if (!outcome.newPasswordVerifies || !outcome.oldPasswordRejected) process.exitCode = 1;
      break;
    case "nothing-changed":
      console.error(`Nothing changed: ${outcome.reason}.`);
      process.exitCode = 1;
      break;
    case "env-replace-failed":
      console.error(
        [
          `The database now uses a NEW demo password (${outcome.accountsUpdated} accounts; ${outcome.sessionsDeleted} sessions signed out),`,
          `but .env could not be replaced. The new value is preserved, owner-only, in ${outcome.stagedPath}.`,
          `Recover with:  mv ${outcome.stagedPath} ${ENV_PATH}`,
          "Do not print or share that file. The old password no longer works.",
        ].join("\n"),
      );
      process.exitCode = 2;
      break;
  }
} finally {
  await db.$disconnect();
}
