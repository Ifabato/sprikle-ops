import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { e2ePassword, reviewScreenshot, submitLogin } from "./helpers";
import { E2E_FIELD, E2E_FIELD_TWO, E2E_LEAD } from "./users";

// End-to-end work-order lifecycle through the real UI, production build, and test database
// (AC-2 … AC-9, D3). Runs after the smoke suite in the same server.
//
// The real sign-in limiter is shared by every client (5 requests per 60 s gap) and the smoke
// suite ends by tripping it, so this file first waits for that window to pass instead of
// weakening or bypassing the limiter. It then signs in exactly three times.

test.describe.configure({ mode: "serial" });

type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;
let leadState: StorageState;
let fieldState: StorageState;
let fieldTwoState: StorageState;
let reference = "";
let otherReference = "";

/** YYYY-MM-DD for today + `days` in New York (the app time zone). */
function nyDate(days = 0): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(
    new Date(),
  );
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function signInAs(browser: Browser, email: string): Promise<StorageState> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  expect(await submitLogin(page, email, e2ePassword())).toBe(200);
  await page.waitForURL("**/dashboard");
  const state = await context.storageState();
  await context.close();
  return state;
}

async function as(
  browser: Browser,
  state: StorageState,
  viewport?: { width: number; height: number },
) {
  const context = await browser.newContext({
    storageState: state,
    ...(viewport ? { viewport } : {}),
  });
  return { context, page: await context.newPage() };
}

async function createWorkOrder(page: Page, title: string, assignee: string, priority = "Medium") {
  await page.goto("/work-orders/new");
  await page.getByLabel("Title").fill(title);
  await page
    .getByLabel("Description")
    .fill("Pressure-relief valve on boiler 2 is dripping steadily.");
  await page.getByLabel("Service area").selectOption({ label: "Harbor" });
  await page.getByLabel("Priority").selectOption({ label: priority });
  await page.getByLabel("Due date").fill(nyDate(2));
  await page.getByLabel("Assignee").selectOption({ label: assignee });
  await page.getByRole("button", { name: "Create work order" }).click();
  await page.waitForURL(/\/work-orders\/WO-\d{6}\?notice=created/);
  return page.url().match(/WO-\d{6}/)![0];
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(150_000);
  await new Promise((resolve) => setTimeout(resolve, 61_000)); // limiter window from the smoke suite
  leadState = await signInAs(browser, E2E_LEAD.email); // sign-in 1
  fieldState = await signInAs(browser, E2E_FIELD.email); // sign-in 2
  fieldTwoState = await signInAs(browser, E2E_FIELD_TWO.email); // sign-in 3
});

test("an empty organization shows the honest empty states", async ({ browser }) => {
  const { context, page } = await as(browser, leadState);
  await page.goto("/work-orders");
  await expect(page.getByRole("heading", { name: "No work orders yet" })).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByText("Nothing needs attention right now.")).toBeVisible();
  await expect(page.getByText("No work orders in this period.")).toBeVisible();
  await context.close();
});

test("admin create form reports every problem, keeps values, and moves focus (AC-2)", async ({
  browser,
}) => {
  const { context, page } = await as(browser, leadState);
  await page.goto("/work-orders/new");
  await page.getByLabel("Title").fill("ab");
  await page.getByRole("button", { name: "Create work order" }).click();
  const summary = page.getByRole("alert").filter({ hasText: "highlighted" });
  await expect(summary).toBeFocused();
  await expect(page.getByText("Title must be at least 3 characters.")).toBeVisible();
  await expect(page.getByText("Description is required.")).toBeVisible();
  await expect(page.getByText("Service area is required.")).toBeVisible();
  await expect(page.getByText("Due date is required.")).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("ab");
  await expect(page.getByLabel("Title")).toHaveAttribute("aria-invalid", "true");
  const describedBy = await page.getByLabel("Title").getAttribute("aria-describedby");
  expect(describedBy).toContain("error");
  await context.close();
});

test("admin creates and assigns a work order; history records it (AC-2)", async ({ browser }) => {
  const { context, page } = await as(browser, leadState);
  reference = await createWorkOrder(page, "Leaking valve in boiler room", E2E_FIELD.name);
  await expect(page.getByRole("status").filter({ hasText: "Work order created." })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Leaking valve in boiler room" }),
  ).toBeVisible();
  await expect(
    page.getByText(`${E2E_LEAD.name} created and assigned to ${E2E_FIELD.name}`),
  ).toBeVisible();
  otherReference = await createWorkOrder(
    page,
    "Inspect rooftop condenser",
    E2E_FIELD_TWO.name,
    "Low",
  );
  await context.close();
});

test("admin edits only what changed; an unchanged save writes nothing (AC-3)", async ({
  browser,
}) => {
  const { context, page } = await as(browser, leadState);
  await page.goto(`/work-orders/${reference}/edit`);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "No changes to save." })).toBeVisible();
  await page.getByLabel("Priority").selectOption({ label: "High" });
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForURL(`**/work-orders/${reference}?notice=updated`);
  await expect(page.getByText("Priority changed from Medium to High")).toBeVisible();
  await expect(page.locator("ol > li")).toHaveCount(2); // created + one priority change
  await context.close();
});

test("a team member sees only their work and cannot create, edit, or open others' work (AC-5, D3)", async ({
  browser,
}) => {
  const { context, page } = await as(browser, fieldState);
  await page.goto("/work-orders");
  await expect(page.getByRole("status").filter({ hasText: "1 work order" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Leaking valve/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "New work order" })).toHaveCount(0);

  await page.goto("/work-orders/new");
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page." }),
  ).toBeVisible();
  const outside = await page.goto(`/work-orders/${otherReference}`);
  expect(outside?.status()).toBe(404);

  // The API enforces the same rules.
  expect((await page.request.post("/api/v1/work-orders", { data: {} })).status()).toBe(403);
  expect((await page.request.get(`/api/v1/work-orders/${otherReference}`)).status()).toBe(404);
  const edit = await page.request.patch(`/api/v1/work-orders/${reference}`, {
    data: { version: 1, priority: "LOW" },
  });
  expect(edit.status()).toBe(403);
  await context.close();

  // ...while the assignee of that other work order can open it.
  const owner = await as(browser, fieldTwoState);
  const own = await owner.page.goto(`/work-orders/${otherReference}`);
  expect(own?.status()).toBe(200);
  await expect(
    owner.page.getByRole("heading", { level: 1, name: "Inspect rooftop condenser" }),
  ).toBeVisible();
  await owner.context.close();
});

test("the assignee starts, blocks with a note, unblocks, comments, and completes (AC-4, AC-6)", async ({
  browser,
}) => {
  const { context, page } = await as(browser, fieldState);
  await page.goto(`/work-orders/${reference}`);
  await expect(page.getByRole("link", { name: "Edit details" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel work order" })).toHaveCount(0);

  await page.getByRole("button", { name: "Start work" }).click();
  await expect(page.getByText("In progress", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText(`${E2E_FIELD.name} status changed from Open to In progress`),
  ).toBeVisible();

  await page.getByRole("button", { name: "Mark blocked" }).click();
  const dialog = page.getByRole("dialog", { name: "Move to Blocked" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("What is blocking this work?")).toBeFocused();
  await dialog.getByRole("button", { name: "Mark blocked" }).click();
  await expect(dialog.getByText("A note is required.")).toBeVisible();
  await dialog
    .getByLabel("What is blocking this work?")
    .fill("Waiting on a replacement valve kit.");
  await dialog.getByRole("button", { name: "Mark blocked" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Waiting on a replacement valve kit.")).toBeVisible();

  await page.getByRole("button", { name: "Unblock" }).click();
  await expect(
    page.getByText(`${E2E_FIELD.name} status changed from Blocked to In progress`),
  ).toBeVisible();

  await page.getByLabel("Add a comment").fill("Kit arrived; installing now.");
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Comment added." })).toBeVisible();
  await expect(page.getByText("Kit arrived; installing now.")).toBeVisible();

  await page.getByRole("button", { name: "Mark completed" }).click();
  await expect(
    page.getByText(`${E2E_FIELD.name} status changed from In progress to Completed`),
  ).toBeVisible();
  await expect(
    page.getByText("No status changes are available to you for this work order."),
  ).toBeVisible();
  await reviewScreenshot(page, "app/journey-detail-completed", { fullPage: true });
  await context.close();
});

test("a stale page gets the conflict message instead of overwriting (AC-3)", async ({
  browser,
}) => {
  const stale = await as(browser, leadState);
  await stale.page.goto(`/work-orders/${otherReference}`);
  // Someone else moves it first.
  const fresh = await as(browser, leadState);
  await fresh.page.goto(`/work-orders/${otherReference}`);
  await fresh.page.getByRole("button", { name: "Start work" }).click();
  await expect(fresh.page.getByText("status changed from Open to In progress")).toBeVisible();

  await stale.page.getByRole("button", { name: "Start work" }).click();
  await expect(
    stale.page.getByText(
      "This work order was updated by someone else. Reload to see the latest version.",
    ),
  ).toBeVisible();
  await expect(stale.page.getByRole("link", { name: "Reload" })).toBeVisible();
  await stale.context.close();
  await fresh.context.close();
});

test("admin cancels with a confirmed reason and restores; invalid moves are refused (AC-4)", async ({
  browser,
}) => {
  const { context, page } = await as(browser, leadState);
  await page.goto(`/work-orders/${otherReference}`);
  await page.getByRole("button", { name: "Cancel work order" }).click();
  const dialog = page.getByRole("dialog", { name: "Cancel this work order?" });
  await dialog.getByRole("button", { name: "Keep work order" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("In progress", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Cancel work order" }).click();
  await dialog.getByLabel("Reason for cancelling").fill("Duplicate request.");
  await dialog.getByRole("button", { name: "Cancel work order" }).click();
  await expect(page.getByText("Duplicate request.")).toBeVisible();
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("status changed from Cancelled to Open")).toBeVisible();

  const completed = await page.request.get(`/api/v1/work-orders/${reference}`);
  const { data } = (await completed.json()) as { data: { version: number } };
  const invalid = await page.request.post(`/api/v1/work-orders/${reference}/transitions`, {
    data: { version: data.version, toStatus: "BLOCKED", note: "x" },
  });
  expect(invalid.status()).toBe(422);
  expect(((await invalid.json()) as { error: { code: string } }).error.code).toBe(
    "INVALID_TRANSITION",
  );
  await context.close();
});

test("list search, filters, and empty results live in the URL (AC-7)", async ({ browser }) => {
  const { context, page } = await as(browser, leadState);
  await page.goto("/work-orders");
  await page.getByLabel("Search").fill(reference);
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption({ label: "All statuses" });
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(new RegExp(`q=${reference}`));
  await expect(page.getByRole("status").filter({ hasText: "1 work order" })).toBeVisible();

  await page.goto("/work-orders?q=no-such-thing");
  await expect(page.getByRole("heading", { name: "No matches for these filters" })).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).first().click();
  await expect(page).toHaveURL(/\/work-orders$/);

  await page.goto("/work-orders?colour=red");
  await expect(page.getByText(/These filters are not valid/)).toBeVisible();
  await context.close();
});

test("dashboard and analytics reflect the persisted lifecycle (AC-8, AC-9)", async ({
  browser,
}) => {
  const { context, page } = await as(browser, leadState);
  await page.goto("/dashboard");
  // Two created in the window: one completed, one restored to Open (cancellation undone).
  await expect(page.getByText("1 of 2 work orders created since")).toBeVisible();
  await expect(page.getByText("50%", { exact: true })).toBeVisible();
  const openCard = page.getByRole("link", { name: /^Open/ });
  await expect(openCard).toContainText("1");
  await openCard.click();
  await expect(page.getByRole("status").filter({ hasText: "1 work order" })).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByText(`${E2E_FIELD.name}`).first()).toBeVisible();
  await expect(page.getByText("Added a comment")).toBeVisible();

  await page.goto("/analytics");
  const completedRow = page.getByRole("row", { name: /^Completed/ });
  await expect(completedRow.getByRole("cell").first()).toHaveText("1");
  await expect(page.getByText("Across 1 completed work order.")).toBeVisible();
  const lastWeek = page.getByRole("row", { name: /so far/ });
  await expect(lastWeek.getByRole("cell").nth(1)).toHaveText("1");
  await reviewScreenshot(page, "app/journey-analytics", { fullPage: true });
  await context.close();

  // The team member's dashboard is scoped to their own work.
  const tech = await as(browser, fieldState);
  await tech.page.goto("/dashboard");
  await expect(tech.page.getByText("0 active work orders assigned to you")).toBeVisible();
  await tech.page.goto("/analytics");
  await expect(
    tech.page.getByRole("heading", { name: "You don't have access to this page." }),
  ).toBeVisible();
  await tech.context.close();
});

test("signed-out API calls get 401 JSON", async ({ request }) => {
  const response = await request.get("/api/v1/work-orders");
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toBe("no-store");
});
