import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

/**
 * The v3 shell's navigation after the founder instruction of 2 Oct 2026:
 * the approved top level, and everything the shell had before kept under
 * one "Initial setup" group in the sidebar, the New menu and the launcher.
 *
 * Runs against a review server (seeded data, no sign-in). Set
 * INITIAL_SETUP_SHELL_CAPTURE to a directory to keep the screenshots.
 */

const TOP_LEVEL = ["Home", "Overview", "Projects", "Tasks", "Timeline", "Files", "Analytics", "Whiteboard"];
const captureDir = process.env.INITIAL_SETUP_SHELL_CAPTURE;

function isMobile(info: TestInfo): boolean {
  return info.project.name.startsWith("mobile");
}

async function shot(page: Page, info: TestInfo, name: string) {
  if (!captureDir) return;
  mkdirSync(captureDir, { recursive: true });
  await page.screenshot({ path: path.join(captureDir, `${info.project.name}-${name}.png`) });
}

/** Console errors and page errors; the dev server's own notices are named. */
function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // Known on the unmodified branch, development only: React's notice about
    // the theme resolver's inline script tag.
    if (/script tag/i.test(text)) return;
    problems.push(`console: ${text}`);
  });
  return problems;
}

async function open(page: Page, route: string) {
  await page.goto(route);
  await expect(page.locator('[data-shell="v3"]')).toBeVisible();
}

function sidebar(page: Page): Locator {
  return page.getByRole("complementary", { name: "Signal Studio" });
}

function setupToggle(page: Page): Locator {
  return sidebar(page).getByRole("button", { name: /^Initial setup/ });
}

async function openDrawerIfMobile(page: Page, info: TestInfo) {
  if (!isMobile(info)) return;
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(sidebar(page).getByRole("link", { name: "Home", exact: true })).toBeInViewport();
}

test("the sidebar's top level is the approved navigation and the group starts folded", async ({ page }, info) => {
  const problems = watchConsole(page);
  await open(page, "/app/home");
  await openDrawerIfMobile(page, info);

  const primary = sidebar(page).getByRole("navigation", { name: "Primary" });
  await expect(primary.getByRole("link")).toHaveText(TOP_LEVEL.map((label) => new RegExp(`^${label}`)));
  await expect(primary.getByRole("link", { name: /Whiteboard/ })).toContainText("Soon");
  await expect(primary.getByRole("link", { name: /Whiteboard/ })).toHaveAttribute("href", "/app/tools/whiteboard");
  await expect(primary.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");

  const toggle = setupToggle(page);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar(page).getByRole("link", { name: /^Inbox/ })).toHaveCount(0);
  // Folded, the header still says what is waiting inside.
  await expect(toggle).toContainText(/waiting inside/);
  await shot(page, info, "home-group-folded");

  // No nav inside a nav, in either state.
  expect(await sidebar(page).locator("nav nav").count()).toBe(0);
  // Settings, help and the theme stay in the footer.
  await expect(sidebar(page).getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Help and feedback" })).toBeVisible();
  expect(problems).toEqual([]);
});

test("the group opens from the keyboard, keeps every earlier row and remembers the choice", async ({ page }, info) => {
  const problems = watchConsole(page);
  await open(page, "/app/home");
  await openDrawerIfMobile(page, info);

  const toggle = setupToggle(page);
  const whiteboard = sidebar(page).getByRole("link", { name: /Whiteboard/ });
  const before = await whiteboard.boundingBox();
  const toggleBefore = await toggle.boundingBox();

  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const bodyId = await toggle.getAttribute("aria-controls");
  expect(bodyId).toBeTruthy();
  const body = page.locator(`#${bodyId}`);
  await expect(body).toBeVisible();

  const rows = body.getByRole("navigation", { name: "Initial setup" }).getByRole("link");
  await expect(rows).toHaveText([/^Inbox/, /^My tasks/, /^Chat/, /^Apps and tools/]);
  await expect(body.getByRole("navigation", { name: "Projects" })).toBeVisible();
  await expect(body.getByRole("link", { name: "Archived projects" })).toHaveCount(1);
  await expect(body.getByRole("link", { name: "All projects" })).toHaveCount(1);
  await expect(body.getByRole("navigation", { name: "Channels" })).toBeVisible();
  await expect(body.getByRole("navigation", { name: "Direct messages" })).toBeVisible();
  await expect(body.getByRole("link", { name: "New message" }).first()).toBeVisible();
  expect(await sidebar(page).locator("nav nav").count()).toBe(0);

  // Opening moves nothing above the group, and the header stays where it was.
  expect(await whiteboard.boundingBox()).toEqual(before);
  expect(await toggle.boundingBox()).toEqual(toggleBefore);
  // Nested rows sit further in than the top level.
  const inboxBox = await rows.first().boundingBox();
  expect(inboxBox!.x).toBeGreaterThan(before!.x + 8);
  await shot(page, info, "home-group-open");

  // Space folds it again; Enter reopens; a reload remembers.
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.reload();
  await openDrawerIfMobile(page, info);
  await expect(setupToggle(page)).toHaveAttribute("aria-expanded", "true");
  expect(problems).toEqual([]);
});

test("a page inside the group opens it, and it can still be folded there", async ({ page }, info) => {
  const problems = watchConsole(page);
  await open(page, "/app/inbox");
  await openDrawerIfMobile(page, info);

  const toggle = setupToggle(page);
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(sidebar(page).getByRole("link", { name: /^Inbox/ })).toHaveAttribute("aria-current", "page");
  await shot(page, info, "inbox-group-auto-open");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(problems).toEqual([]);
});

test("Tasks keeps the same sidebar", async ({ page }, info) => {
  const problems = watchConsole(page);
  await open(page, "/app/tasks");
  await openDrawerIfMobile(page, info);
  const primary = sidebar(page).getByRole("navigation", { name: "Primary" });
  await expect(primary.getByRole("link")).toHaveText(TOP_LEVEL.map((label) => new RegExp(`^${label}`)));
  await expect(primary.getByRole("link", { name: "Tasks", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(setupToggle(page)).toHaveAttribute("aria-expanded", "false");
  await shot(page, info, "tasks-sidebar");
  expect(problems).toEqual([]);
});

test("icons only: one button widens the sidebar and opens the group", async ({ page }, info) => {
  test.skip(isMobile(info), "The drawer has no icon-only mode.");
  const problems = watchConsole(page);
  await open(page, "/app/home");
  await sidebar(page).getByRole("button", { name: "Collapse sidebar" }).click();
  const rail = sidebar(page).getByRole("button", { name: /^Initial setup.*expand the sidebar/ });
  await expect(rail).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: /^Inbox/ })).toHaveCount(0);
  await shot(page, info, "home-icons-only");

  await rail.focus();
  await page.keyboard.press("Enter");
  await expect(sidebar(page).getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
  await expect(setupToggle(page)).toHaveAttribute("aria-expanded", "true");
  await expect(sidebar(page).getByRole("link", { name: /^Inbox/ })).toBeVisible();
  expect(problems).toEqual([]);
});

test("the drawer closes when a nested row is chosen", async ({ page }, info) => {
  test.skip(!isMobile(info), "Desktop has no drawer.");
  const problems = watchConsole(page);
  await open(page, "/app/home");
  await openDrawerIfMobile(page, info);
  await setupToggle(page).click();
  await shot(page, info, "drawer-group-open");
  await sidebar(page).getByRole("link", { name: /^My tasks/ }).click();
  await page.waitForURL(/\/app\/my-tasks/);
  await expect(page.locator('[data-shell="v3"]')).not.toHaveAttribute("data-mobile-open", "");
  // Escape closes the drawer too.
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator('[data-shell="v3"]')).toHaveAttribute("data-mobile-open", "");
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-shell="v3"]')).not.toHaveAttribute("data-mobile-open", "");
  expect(problems).toEqual([]);
});

test("the New menu keeps Task and Project on top and nests Note and Message", async ({ page }, info) => {
  const problems = watchConsole(page);
  await open(page, "/app/home");
  const trigger = page.getByRole("button", { name: "New", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveText([/Task/, /Project/, /Note/, /Message/]);
  const group = menu.getByRole("group", { name: "Initial setup" });
  await expect(group.getByRole("menuitem")).toHaveText([/Note/, /Message/]);
  await expect(group.getByRole("menuitem", { name: "Note" })).toHaveAttribute("href", "/app/notes");
  await shot(page, info, "new-menu");

  // Tab walks into the menu; Escape closes it and hands focus back.
  await page.keyboard.press("Tab");
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(problems).toEqual([]);
});

test("the launcher lists the approved apps and keeps the rest under Initial setup", async ({ page }, info) => {
  const problems = watchConsole(page);
  await open(page, "/app/home");
  await page.getByRole("banner").getByRole("button", { name: "Apps and tools" }).click();
  const dialog = page.getByRole("dialog", { name: "Apps and tools" });
  await expect(dialog).toBeVisible();

  const yourApps = dialog.getByRole("group", { name: "Your apps" });
  await expect(yourApps.getByRole("option")).toHaveText([/Projects/, /Tasks/, /Timeline/, /Files/, /Analytics/]);
  const toggle = dialog.getByRole("button", { name: "Initial setup" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(dialog.getByRole("group", { name: "Works with" })).toHaveCount(0);
  await shot(page, info, "launcher-group-folded");

  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(dialog.getByRole("group", { name: "More apps" }).getByRole("option")).toHaveText([/Notes/, /Chat/]);
  await expect(dialog.getByRole("group", { name: "Works with" }).getByRole("option")).toHaveCount(2);
  await expect(dialog.getByRole("group", { name: "Coming soon" }).getByRole("option")).toHaveCount(7);
  // No entry is offered twice.
  const keys = await dialog.locator("[data-key]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-key")));
  expect(new Set(keys).size).toBe(keys.length);
  expect(keys.length).toBe(16);
  await shot(page, info, "launcher-group-open");

  // Search reaches an entry inside the group, and Escape clears then closes.
  await dialog.getByRole("combobox").fill("wedding");
  await expect(dialog.getByRole("option").first()).toContainText("Wedding planner");
  await page.keyboard.press("Escape");
  await expect(dialog.getByRole("combobox")).toHaveValue("");
  if (isMobile(info)) {
    await dialog.getByRole("button", { name: "Done" }).click();
  } else {
    await page.keyboard.press("Escape");
  }
  await expect(dialog).toHaveCount(0);
  expect(problems).toEqual([]);
});

test("the Apps and tools page has the same two levels", async ({ page }, info) => {
  const problems = watchConsole(page);
  await open(page, "/app/tools");
  const main = page.locator("[data-shell-content]");
  await expect(main.getByRole("heading", { level: 1, name: "Apps and tools" })).toBeVisible();
  const yourApps = main.getByRole("region", { name: "Your apps" });
  await expect(yourApps.getByRole("link")).toHaveText([/Projects/, /Tasks/, /Timeline/, /Files/, /Analytics/]);
  const toggle = main.getByRole("button", { name: "Initial setup" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await shot(page, info, "tools-page-group-folded");

  await toggle.click();
  await expect(main.getByRole("heading", { level: 3 })).toHaveText(["More apps", "Works with", "Coming soon"]);
  await expect(main.getByRole("region", { name: "More apps" }).getByRole("link")).toHaveText([/Notes/, /Chat/]);
  await expect(main.getByRole("region", { name: "Coming soon" }).getByRole("link", { name: /Whiteboard/ })).toBeVisible();
  await shot(page, info, "tools-page-group-open");
  // The page never scrolls sideways.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(problems).toEqual([]);
});

test("search off Tasks lists what the sidebar lists, and both keycaps agree", async ({ page }, info) => {
  const problems = watchConsole(page);
  await open(page, "/app/home");
  if (!isMobile(info)) {
    const topKeycap = page.getByRole("banner").locator("kbd").first();
    const sideKeycap = sidebar(page).locator("kbd").first();
    await expect(topKeycap).toHaveText((await sideKeycap.textContent()) ?? "");
    await expect(topKeycap).toHaveText(/^(⌘K|Ctrl K)$/);
  }
  await page.getByRole("banner").getByRole("button", { name: "Search or jump to" }).click();
  const palette = page.getByRole("dialog", { name: "Search or jump to" });
  await expect(palette.getByRole("option")).toHaveText([
    /^Home/, /^Overview/, /^Projects/, /^Tasks/, /^Timeline/, /^Files/, /^Analytics/,
    /^Inbox/, /^My tasks/, /^Chat/, /^Notes/, /^Settings/,
  ]);
  await shot(page, info, "palette");
  await palette.getByRole("combobox").fill("sett");
  await expect(palette.getByRole("option")).toHaveText([/^Settings/]);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/app\/settings/);
  expect(problems).toEqual([]);
});
