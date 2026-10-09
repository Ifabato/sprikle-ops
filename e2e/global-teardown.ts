import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runChecked } from "./helpers";

const RESULTS_DIR = "test-results/e2e";

/**
 * Playwright writes an error-context.md page snapshot for failed tests, and that snapshot includes
 * input values. Replace the per-run password in every text artifact before anything else.
 */
function scrubPasswordFromResults(password: string | undefined): void {
  if (!password) return;
  let entries: string[];
  try {
    entries = readdirSync(RESULTS_DIR, { recursive: true, encoding: "utf8" });
  } catch {
    return; // no results directory
  }
  for (const entry of entries) {
    if (!/\.(md|json|txt|log)$/.test(entry)) continue;
    const file = path.join(RESULTS_DIR, entry);
    const text = readFileSync(file, "utf8");
    if (text.includes(password)) {
      writeFileSync(file, text.replaceAll(password, "[redacted]"));
    }
  }
}

// Runs after the suite, including when tests fail. It cannot run if the runner process itself
// is killed; in that case the next run's setup truncates the leftover test data first.
export default function globalTeardown(): void {
  try {
    scrubPasswordFromResults(process.env.E2E_USER_PASSWORD);
  } finally {
    runChecked("node", ["scripts/e2e-test-data.ts", "teardown"]);
  }
}
