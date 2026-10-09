import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { e2ePassword, reviewScreenshot, runChecked, SIGN_IN_PATH, submitLogin } from "./helpers";
import { E2E_ADMIN, E2E_INACTIVE, E2E_TECH } from "./users";

// Ordered smoke suite against the production build on port 3100 and sprikle_ops_test.
//
// Sign-in budget: the real limiter (5 requests per 60 s gap window, one shared bucket, successful
// sign-ins included) is never weakened. Before the final test this file makes exactly four sign-in
// requests: invalid, inactive, admin, technician. Signed-in states are kept in memory only and
// reused through fresh browser contexts. The rate-limit test runs last and stops at the first 429.

test.describe.configure({ mode: "serial" });

type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;
let adminState: StorageState | undefined;
let techState: StorageState | undefined;

const MOBILE = { width: 390, height: 844 };
const WRONG_PASSWORD = "definitely-not-the-password";

function countSignInRequests(page: Page): () => number {
  let count = 0;
  page.on("request", (request) => {
    if (request.url().endsWith(SIGN_IN_PATH)) count += 1;
  });
  return () => count;
}

test("signed-out visitors are sent to login with a safe return path", async ({ page }) => {
  await page.goto("/work-orders?status=BLOCKED");
  await expect(page).toHaveURL("/login?next=%2Fwork-orders%3Fstatus%3DBLOCKED");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.goto("/dashboard");
  await expect(page).toHaveURL("/login?next=%2Fdashboard");
});

test("the public landing page is honest about status, sample data, and contact", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Know what's at risk before it's late.",
  );
  await expect(page.getByText("Sample data · illustrative").first()).toBeVisible();
  await expect(page.getByText("In development.", { exact: true })).toBeVisible();
  await expect(page.getByText("Activity entries are sample data for illustration.")).toBeVisible();

  // No contact destination is configured: honest copy, no link, no form.
  await expect(page.getByText("Contact details coming soon").first()).toBeVisible();
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: /request a demo/i })).toHaveCount(0);
  await expect(page.locator("form")).toHaveCount(0);

  await page.evaluate(() => window.scrollTo(0, 0));
  await reviewScreenshot(page, "landing-desktop");
  await reviewScreenshot(page, "landing-full-desktop", { fullPage: true });

  await page
    .getByRole("navigation", { name: "Site" })
    .getByRole("link", { name: "Sign in" })
    .click();
  await expect(page).toHaveURL("/login");
});

test("the sample board re-derives risk from the keyboard and respects reduced motion", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  const slider = page.getByRole("slider", { name: "Move the sample day" });
  const board = page.getByRole("list", { name: "Sample work orders, most at risk first" });
  await expect(page.getByText("Tue, Mar 10 · 1 overdue")).toBeVisible();

  await slider.focus();
  await page.keyboard.press("End");
  await expect(page.getByText("Sun, Mar 15 · 4 overdue")).toBeVisible();
  await expect(board.getByRole("listitem").first()).toContainText("Overdue 6 days");
  // No scripted row animation (CSS transitions are reduced globally, not counted here).
  const scripted = await page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((a) => !(a instanceof CSSTransition) && !(a instanceof CSSAnimation)).length,
  );
  expect(scripted).toBe(0);

  await page.keyboard.press("Home");
  await expect(page.getByText("Sun, Mar 8 · nothing overdue")).toBeVisible();
  await expect(board.getByRole("listitem").last()).toContainText("Done");
  await context.close();
});

test("the landing page fits a phone without horizontal scrolling", async ({ browser }) => {
  const context = await browser.newContext({ viewport: MOBILE });
  const page = await context.newPage();
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
  await reviewScreenshot(page, "landing-mobile");
  await reviewScreenshot(page, "landing-full-mobile", { fullPage: true });
  await context.close();
});

test("login form is labeled, keyboard-ordered, and validates without a request", async ({
  page,
}) => {
  const signInRequests = countSignInRequests(page);
  await page.goto("/login");

  await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "email");
  await expect(page.getByLabel("Password")).toHaveAttribute("autocomplete", "current-password");
  await reviewScreenshot(page, "login-desktop");
  await page.setViewportSize(MOBILE);
  await reviewScreenshot(page, "login-mobile");
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Sprikle Ops home" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password")).toBeFocused();
  await page.keyboard.press("Tab");
  const submit = page.getByRole("button", { name: "Sign in" });
  await expect(submit).toBeFocused();
  await expect(submit).toHaveCSS("outline-style", "solid");

  await page.keyboard.press("Enter");
  const summary = page.locator("#sign-in-message");
  await expect(summary).toHaveText("Enter your email and password.");
  await expect(summary).toBeFocused();
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Password")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Enter your email.", { exact: true })).toBeVisible();
  await expect(page.getByText("Enter your password.", { exact: true })).toBeVisible();
  expect(signInRequests()).toBe(0);
  await reviewScreenshot(page, "login-missing-fields-desktop");
});

test("invalid credentials show the generic failure and clear the password", async ({ page }) => {
  await page.goto("/login");
  expect(await submitLogin(page, E2E_ADMIN.email, WRONG_PASSWORD)).toBe(401); // sign-in request 1
  await expect(page.locator("#sign-in-message")).toHaveText("Email or password is incorrect.");
  await expect(page.getByLabel("Password")).toHaveValue("");
  await expect(page).toHaveURL("/login");
  await reviewScreenshot(page, "login-error-desktop");
});

test("an inactive account gets the same generic failure", async ({ page }) => {
  await page.goto("/login");
  expect(await submitLogin(page, E2E_INACTIVE.email, e2ePassword())).toBe(401); // request 2
  await expect(page.locator("#sign-in-message")).toHaveText("Email or password is incorrect.");
  await expect(page).toHaveURL("/login");
});

test("admin signs in; an unsafe return path falls back to the dashboard", async ({
  page,
  context,
}) => {
  await page.goto(`/login?next=${encodeURIComponent("https://evil.example/steal")}`);
  expect(await submitLogin(page, E2E_ADMIN.email, e2ePassword())).toBe(200); // request 3
  await expect(page).toHaveURL("/dashboard");

  // The E2E users exist only in sprikle_ops_test, so this session row proves isolation.
  expect(
    Number(runChecked("node", ["scripts/e2e-test-data.ts", "sessions", E2E_ADMIN.email])),
  ).toBe(1);

  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link")).toHaveText(["Dashboard", "Work orders", "Analytics"]);
  await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Needs attention" })).toBeVisible();
  await reviewScreenshot(page, "dashboard-desktop");

  // Skip link moves focus to the main content.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  await page.goto("/analytics");
  await expect(page.getByRole("heading", { level: 1, name: "Analytics" })).toBeVisible();

  await page.goto("/profile");
  await expect(page.getByText(E2E_ADMIN.email)).toBeVisible();
  await expect(page.getByRole("main").getByText("Administrator", { exact: true })).toBeVisible();
  await reviewScreenshot(page, "profile-desktop");

  adminState = await context.storageState();
});

test("a signed-in visitor to login goes to the requested page without signing in", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: adminState });
  const page = await context.newPage();
  const signInRequests = countSignInRequests(page);
  await page.goto("/login?next=%2Fprofile");
  await expect(page).toHaveURL("/profile");
  expect(signInRequests()).toBe(0);
  await context.close();
});

test("a team member sees no Analytics link and is denied on the server", async ({
  page,
  context,
}) => {
  await page.goto("/login?next=%2Fanalytics");
  expect(await submitLogin(page, E2E_TECH.email, e2ePassword())).toBe(200); // request 4
  await expect(page).toHaveURL("/analytics");
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link")).toHaveText(["Dashboard", "Work orders"]);
  await reviewScreenshot(page, "forbidden-desktop");
  techState = await context.storageState();
});

test("mobile menu is keyboard operable and leaves no hidden focusable links", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: adminState, viewport: MOBILE });
  const page = await context.newPage();
  await page.goto("/dashboard");

  const menu = page.getByRole("button", { name: "Menu" });
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#mobile-navigation")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0); // rail hidden too
  await reviewScreenshot(page, "dashboard-mobile");

  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await expect(
    page.locator("#mobile-navigation").getByRole("link", { name: "Dashboard" }),
  ).toBeFocused();
  await reviewScreenshot(page, "mobile-menu-open");

  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#mobile-navigation")).toHaveCount(0);
  await expect(menu).toBeFocused();

  await menu.click();
  await page.locator("#mobile-navigation").getByRole("link", { name: "Work orders" }).click();
  await expect(page).toHaveURL("/work-orders");
  await expect(page.getByRole("heading", { level: 1, name: "Work orders" })).toBeVisible();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#mobile-navigation")).toHaveCount(0);
  await context.close();
});

test("unknown pages show the not-found state", async ({ browser }) => {
  const context = await browser.newContext({ storageState: adminState });
  const page = await context.newPage();
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await reviewScreenshot(page, "not-found-desktop");
  await context.close();
});

test("a failed sign-out is reported instead of pretending it worked", async ({ browser }) => {
  const context = await browser.newContext({ storageState: adminState });
  const page = await context.newPage();
  await page.goto("/dashboard");
  await page.route("**/api/auth/sign-out", (route) => route.abort("internetdisconnected"));
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByText("Sign-out failed. Check your connection and try again."),
  ).toBeVisible();
  await expect(page).toHaveURL("/dashboard");
  await context.close();
});

test("a deactivated user is sent to login by the keepalive without a redirect loop", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: techState });
  const page = await context.newPage();
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

  runChecked("node", ["scripts/e2e-test-data.ts", "deactivate", E2E_TECH.email]);
  // A visibility return triggers the keepalive check (the 15-minute timer is not waited for).
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page).toHaveURL("/login?next=%2Fdashboard");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  // The stale cookie stays, yet login renders its form and protected pages redirect once.
  await page.waitForTimeout(1_000);
  await expect(page).toHaveURL("/login?next=%2Fdashboard");
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/login?next=%2Fdashboard");
  await expect(page.getByLabel("Email")).toBeVisible();
  await context.close();
});

test("signing out ends the session on the server", async ({ browser }) => {
  const context = await browser.newContext({ storageState: adminState });
  const page = await context.newPage();
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/login");
  await page.goto("/profile");
  await expect(page).toHaveURL("/login?next=%2Fprofile");
  await context.close();

  // The saved cookie is now useless: the session was revoked, not just cleared in the browser.
  const replay = await browser.newContext({ storageState: adminState });
  const replayPage = await replay.newPage();
  await replayPage.goto("/dashboard");
  await expect(replayPage).toHaveURL("/login?next=%2Fdashboard");
  await replay.close();
});

// Must stay LAST: it exhausts the shared sign-in bucket for this server process.
test("repeated sign-in attempts show the rate-limit message", async ({ page }) => {
  await page.goto("/login");
  let status = 0;
  for (let attempt = 1; attempt <= 6 && status !== 429; attempt += 1) {
    status = await submitLogin(page, E2E_ADMIN.email, WRONG_PASSWORD);
  }
  expect(status).toBe(429);
  await expect(page.locator("#sign-in-message")).toHaveText(
    "Too many sign-in attempts. Try again in about a minute.",
  );
});
