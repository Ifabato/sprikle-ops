// Records the portfolio demo walkthrough (docs/demo.md) against a RUNNING local app
// (`pnpm dev`, http://localhost:3000) that has the demo data (`pnpm db:seed:demo`).
//
// - Sign-in happens in separate, unrecorded browser contexts; only the resulting in-memory session
//   state is reused, so no password is ever typed on camera, printed, or written to disk.
// - It adds ONE new work order to the development database (titled "Demo: …") and moves it through
//   its lifecycle, exactly as a person following docs/demo.md would. Nothing is deleted or reset.
// - Output: docs/media/demo-walkthrough.webm (and a few PNG stills in docs/screenshots/).
//
// Run with: pnpm demo:record
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";

if (existsSync(".env")) process.loadEnvFile(".env");
const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error("Refusing: the demo recorder only runs against a local app.");
  process.exit(1);
}
const password = process.env.SEED_DEMO_PASSWORD ?? "";
if (password.length < 12) {
  console.error("Refusing: SEED_DEMO_PASSWORD is not set in .env.");
  process.exit(1);
}

type State = Awaited<ReturnType<BrowserContext["storageState"]>>;
const VIEWPORT = { width: 1280, height: 800 };
const pause = (page: Page, ms = 900) => page.waitForTimeout(ms);

async function signIn(browser: Browser, email: string): Promise<State> {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard", { timeout: 60_000 });
  const state = await context.storageState();
  await context.close();
  return state;
}

function nyDate(days: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(
    new Date(),
  );
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

mkdirSync("docs/media", { recursive: true });
mkdirSync("docs/screenshots", { recursive: true });
const videoDir = "docs/media/.recording";
rmSync(videoDir, { recursive: true, force: true });

const browser = await chromium.launch();
try {
  const adminState = await signIn(browser, "admin@sprikle.test");
  const techState = await signIn(browser, "tech.one@sprikle.test");
  const context = await browser.newContext({
    viewport: VIEWPORT,
    storageState: adminState,
    recordVideo: { dir: videoDir, size: VIEWPORT },
  });
  const page = await context.newPage();
  const shot = (name: string) => page.screenshot({ path: `docs/screenshots/${name}.png` });

  // 1. Admin dashboard: risk at a glance, computed from stored records.
  await page.goto(`${BASE}/dashboard`);
  await pause(page, 2200);
  await shot("dashboard");

  // 2. Create and assign a work order.
  await page.goto(`${BASE}/work-orders/new`);
  await page
    .getByLabel("Title")
    .pressSequentially("Demo: replace lobby door closer", { delay: 25 });
  await page
    .getByLabel("Description")
    .fill("Lobby door slams shut. Replace the closer and adjust the sweep speed.");
  await page.getByLabel("Service area").selectOption({ label: "Downtown" });
  await page.getByLabel("Priority").selectOption({ label: "High" });
  await page.getByLabel("Due date").fill(nyDate(2));
  await page.getByLabel("Assignee").selectOption({ label: "Taylor Tech (demo)" });
  await pause(page);
  await page.getByRole("button", { name: "Create work order" }).click();
  await page.waitForURL(/\/work-orders\/WO-\d{6}/);
  const reference = page.url().match(/WO-\d{6}/)![0];
  await pause(page, 1800);

  // 3. The technician works it (same recording, technician session).
  await context.clearCookies();
  await context.addCookies(techState.cookies);
  await page.goto(`${BASE}/work-orders/${reference}`);
  await pause(page, 1200);
  await page.getByRole("button", { name: "Start work" }).click();
  await pause(page, 1400);
  await page.getByRole("button", { name: "Mark blocked" }).click();
  await page
    .getByLabel("What is blocking this work?")
    .pressSequentially("Waiting on the replacement closer.", { delay: 20 });
  await pause(page, 600);
  await page.getByRole("dialog").getByRole("button", { name: "Mark blocked" }).click();
  await pause(page, 1600);
  await page.getByRole("button", { name: "Unblock" }).click();
  await pause(page, 1200);
  await page
    .getByLabel("Add a comment")
    .pressSequentially("Closer installed; sweep set to 5 seconds.", { delay: 20 });
  await page.getByRole("button", { name: "Post comment" }).click();
  await pause(page, 1200);
  await page.getByRole("button", { name: "Mark completed" }).click();
  await pause(page, 1500);
  await page.mouse.wheel(0, 700);
  await pause(page, 1800);
  await shot("work-order-history");

  // 4. Back to the admin: the dashboard and analytics reflect the change.
  await context.clearCookies();
  await context.addCookies(adminState.cookies);
  await page.goto(`${BASE}/work-orders?due=overdue`);
  await pause(page, 1800);
  await shot("work-orders-overdue");
  await page.goto(`${BASE}/analytics`);
  await pause(page, 1600);
  await shot("analytics");
  await page.mouse.wheel(0, 900);
  await pause(page, 1800);

  const video = page.video();
  await context.close();
  renameSync(await video!.path(), "docs/media/demo-walkthrough.webm");
  rmSync(videoDir, { recursive: true, force: true });
  console.log(`Recorded docs/media/demo-walkthrough.webm (work order ${reference}).`);
} finally {
  await browser.close();
}
