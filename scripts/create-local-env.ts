// Creates or completes the local .env without ever printing or replacing secrets.
//
//   pnpm env:init                 Create .env from .env.example (only if .env does not exist).
//   pnpm env:init --add-missing   Append keys that are missing from an existing .env.
//                                 Existing keys are never modified, even when empty.
//
// Generated values (database password, auth secret, demo password) are random and are never
// printed; output lists key names only. The file is created with owner-only permissions.
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const ENV_PATH = ".env";
const EXAMPLE_PATH = ".env.example";
const addMissing = process.argv.includes("--add-missing");

const example = readFileSync(EXAMPLE_PATH, "utf8");

function readExampleValue(key: string): string {
  const match = example.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!match || match[1] === undefined) {
    throw new Error(`${EXAMPLE_PATH} is missing ${key}`);
  }
  return match[1].trim();
}

// base64url is URL-safe, so generated values need no escaping inside connection URLs.
const randomSecret = (bytes: number) => randomBytes(bytes).toString("base64url");

/** Values generated for keys whose example value is empty. */
const generators: Record<string, () => string> = {
  POSTGRES_PASSWORD: () => randomSecret(24),
  BETTER_AUTH_SECRET: () => randomSecret(32),
  SEED_DEMO_PASSWORD: () => randomSecret(18),
};

if (!addMissing) {
  if (existsSync(ENV_PATH)) {
    console.log(".env already exists; left unchanged. Use --add-missing to append new keys.");
    process.exit(0);
  }

  const user = readExampleValue("POSTGRES_USER");
  const port = readExampleValue("POSTGRES_PORT");
  const password = generators.POSTGRES_PASSWORD!();
  const url = (database: string) =>
    `postgresql://${user}:${password}@127.0.0.1:${port}/${database}`;

  const values: Record<string, string> = {
    POSTGRES_PASSWORD: password,
    DATABASE_URL: url("sprikle_ops"),
    TEST_DATABASE_URL: url("sprikle_ops_test"),
    BETTER_AUTH_SECRET: generators.BETTER_AUTH_SECRET!(),
    SEED_DEMO_PASSWORD: generators.SEED_DEMO_PASSWORD!(),
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
  console.log("Created .env with generated local secrets (values not displayed).");
  process.exit(0);
}

// --add-missing: append example keys absent from .env; never touch existing lines.
if (!existsSync(ENV_PATH)) {
  console.error(".env does not exist; run `pnpm env:init` first.");
  process.exit(1);
}

const current = readFileSync(ENV_PATH, "utf8");
const presentKeys = new Set(
  [...current.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]),
);
const exampleKeys = [...example.matchAll(/^([A-Z][A-Z0-9_]*)=(.*)$/gm)].map((match) => ({
  key: match[1]!,
  value: match[2]!.trim(),
}));

const appended: string[] = [];
const lines: string[] = [];
for (const { key, value } of exampleKeys) {
  if (presentKeys.has(key)) {
    continue;
  }
  const generate = generators[key];
  if (value === "" && !generate) {
    console.error(`Cannot generate a value for ${key}; set it manually in .env.`);
    process.exit(1);
  }
  lines.push(`${key}=${value === "" && generate ? generate() : value}`);
  appended.push(key);
}

if (appended.length === 0) {
  console.log(".env already has every key from .env.example; nothing appended.");
  process.exit(0);
}

const separator = current.endsWith("\n") ? "" : "\n";
appendFileSync(
  ENV_PATH,
  `${separator}\n# Added by \`pnpm env:init --add-missing\`\n${lines.join("\n")}\n`,
);
console.log(`Appended to .env (values not displayed): ${appended.join(", ")}`);
