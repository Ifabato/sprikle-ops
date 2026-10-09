import { randomBytes } from "node:crypto";
import { runChecked } from "./helpers";

// Applies committed migrations to sprikle_ops_test (non-destructive), then truncates it and
// provisions the E2E users. The password is random per run, lives only in this process
// environment (inherited by the test worker), and is never printed or written to disk.
export default function globalSetup(): void {
  process.env.E2E_USER_PASSWORD = randomBytes(24).toString("base64url");
  runChecked("pnpm", ["-s", "db:test:prepare"]);
  runChecked("node", ["scripts/e2e-test-data.ts", "setup"]);
}
