// Creates a local .env from .env.example with a freshly generated PostgreSQL password.
// - Never overwrites an existing .env (opened with the exclusive "wx" flag).
// - Never prints the password; the file is created with owner-only permissions.
// Run with: pnpm env:init
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ENV_PATH = ".env";
const EXAMPLE_PATH = ".env.example";

if (existsSync(ENV_PATH)) {
  console.log(".env already exists; left unchanged.");
  process.exit(0);
}

const example = readFileSync(EXAMPLE_PATH, "utf8");

function readExampleValue(key: string): string {
  const match = example.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!match || match[1] === undefined) {
    throw new Error(`${EXAMPLE_PATH} is missing ${key}`);
  }
  return match[1].trim();
}

const user = readExampleValue("POSTGRES_USER");
const port = readExampleValue("POSTGRES_PORT");
// base64url is URL-safe, so the password needs no escaping inside connection URLs.
const password = randomBytes(24).toString("base64url");
const url = (database: string) => `postgresql://${user}:${password}@127.0.0.1:${port}/${database}`;

const values: Record<string, string> = {
  POSTGRES_PASSWORD: password,
  DATABASE_URL: url("sprikle_ops"),
  TEST_DATABASE_URL: url("sprikle_ops_test"),
};

let content = example;
for (const [key, value] of Object.entries(values)) {
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (!pattern.test(content)) {
    throw new Error(`${EXAMPLE_PATH} is missing ${key}`);
  }
  content = content.replace(pattern, () => `${key}=${value}`);
}

writeFileSync(ENV_PATH, content, { flag: "wx", mode: 0o600 });
console.log("Created .env with a generated local PostgreSQL password (not displayed).");
