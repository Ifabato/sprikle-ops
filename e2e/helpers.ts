import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";

/** Runs a local command, inheriting the environment; output is never captured into reports. */
export function runChecked(command: string, args: string[]): string {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args[0] ?? ""} failed (exit ${String(result.status)}).`);
  }
  return result.stdout.trim();
}

/** Password of the per-run E2E users (set by global setup). */
export function e2ePassword(): string {
  const value = process.env.E2E_USER_PASSWORD;
  if (!value) {
    throw new Error("E2E_USER_PASSWORD is not set; run through the Playwright config.");
  }
  return value;
}

export const SIGN_IN_PATH = "/api/auth/sign-in/email";

/** Fills and submits the login form; resolves with the sign-in response status. */
export async function submitLogin(page: Page, email: string, password: string): Promise<number> {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith(SIGN_IN_PATH) && r.request().method() === "POST"),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
  return response.status();
}

const SCREENSHOT_DIR = ".impeccable/review";

/** Viewport screenshot for design review (ignored directory). Never taken with a typed password. */
export async function reviewScreenshot(
  page: Page,
  name: string,
  options: { fullPage?: boolean } = {},
): Promise<void> {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    animations: "disabled",
    fullPage: options.fullPage ?? false,
  });
}
