import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const origin = process.env.NAV_REVIEW_URL ?? "http://127.0.0.1:4398";
const output = new URL("./", import.meta.url);
const failures = [];
let abortedNavigationRequests = 0;
const browser = await chromium.launch({ channel: "chrome", headless: true });

async function openPage(viewport) {
  const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
  page.on("pageerror", () => failures.push("pageerror"));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push("console-error");
  });
  page.on("requestfailed", (request) => {
    if (!request.url().startsWith(origin)) return;
    // Route transitions can cancel in-flight prefetches and script downloads;
    // destination DOM checks below prove the required resources arrived.
    if (request.failure()?.errorText === "net::ERR_ABORTED") {
      abortedNavigationRequests += 1;
      return;
    }
    failures.push(`local-request-failed:${request.resourceType()}:${request.failure()?.errorText ?? "unknown"}`);
  });
  await page.goto(`${origin}/app/home`);
  await page.getByRole("heading", { name: "Good morning." }).waitFor();
  return page;
}

await mkdir(output, { recursive: true });
try {
  const desktop = await openPage({ width: 1440, height: 900 });
  const rail = desktop.getByRole("navigation", { name: "Core navigation" });
  assert.deepEqual(await rail.locator("a").allTextContents(), ["Home", "Projects", "Tasks", "Timeline"]);
  await desktop.screenshot({ path: fileURLToPath(new URL("home-desktop.png", output)) });
  await desktop.getByRole("button", { name: "More" }).click();
  const desktopMenu = desktop.getByRole("menu", { name: "More" });
  await desktopMenu.getByRole("menuitem", { name: "Notes" }).focus();
  await desktop.keyboard.press("Escape");
  assert.equal(await desktop.getByRole("button", { name: "More" }).evaluate((element) => element === document.activeElement), true);
  await desktop.getByRole("button", { name: "More" }).click();
  await desktopMenu.getByRole("menuitem", { name: "Notes" }).click();
  await desktop.waitForURL(/\/app\/notes/);
  await desktop.getByRole("button", { name: "More" }).waitFor();
  await desktop.goto(`${origin}/app/tasks`);
  const desktopFloor = desktop.locator('[data-group="rail"]');
  assert.deepEqual(await desktopFloor.locator('[data-product]').evaluateAll((links) => links.map((link) => link.getAttribute("data-product"))), ["home", "project", "tasks", "timeline"]);
  await desktop.screenshot({ path: fileURLToPath(new URL("tasks-desktop.png", output)) });
  await desktopFloor.getByRole("button", { name: "More" }).click();
  await desktopFloor.getByRole("menuitem", { name: "Notes" }).waitFor();
  await desktop.keyboard.press("Escape");
  assert.equal(await desktopFloor.getByRole("button", { name: "More" }).evaluate((element) => element === document.activeElement), true);
  await desktop.close();

  const phone = await openPage({ width: 390, height: 844 });
  const bottom = phone.locator('[data-signal-bottom-nav="suite"]');
  assert.deepEqual(await bottom.locator("a").allTextContents(), ["Home", "Projects", "Tasks", "Timeline"]);
  await phone.screenshot({ path: fileURLToPath(new URL("home-phone.png", output)) });
  await bottom.getByRole("button", { name: "More" }).click();
  const phoneMenu = bottom.getByRole("menu", { name: "More" });
  await phoneMenu.getByRole("menuitem", { name: "Notes" }).waitFor();
  await phone.screenshot({ path: fileURLToPath(new URL("more-phone.png", output)) });
  await phone.keyboard.press("Escape");
  assert.equal(await bottom.getByRole("button", { name: "More" }).evaluate((element) => element === document.activeElement), true);
  await bottom.getByRole("button", { name: "More" }).click();
  await phoneMenu.getByRole("menuitem", { name: "Notes" }).click();
  await phone.waitForURL(/\/app\/notes/);
  await phone.locator('[data-product-canvas="module"]').waitFor();
  await phone.screenshot({ path: fileURLToPath(new URL("notes-phone.png", output)) });
  await bottom.getByRole("link", { name: "Projects" }).click();
  await phone.waitForURL(/\/app\/project/);
  const projectBar = phone.locator('[data-signal-bottom-nav="tasks"]');
  assert.equal(await projectBar.getByRole("link", { name: "Projects" }).getAttribute("aria-current"), "page");
  await phone.screenshot({ path: fileURLToPath(new URL("projects-phone.png", output)) });
  await projectBar.getByRole("link", { name: "Tasks" }).click();
  await phone.waitForURL(/\/app\/tasks/);
  const floorRail = phone.locator('[data-group="rail"]');
  await floorRail.getByRole("link", { name: "Tasks" }).waitFor();
  const floorBounds = await phone.evaluate(() => ({
    viewport: window.innerHeight,
    floorBottom: document.querySelector('[data-floor]')?.getBoundingClientRect().bottom ?? 0,
    railBottom: document.querySelector('[data-group="rail"]')?.getBoundingClientRect().bottom ?? 0,
  }));
  assert.ok(floorBounds.floorBottom >= floorBounds.viewport);
  assert.ok(floorBounds.railBottom <= floorBounds.viewport && floorBounds.viewport - floorBounds.railBottom <= 24);
  assert.deepEqual(await floorRail.locator('[data-product]').evaluateAll((links) => links.map((link) => link.getAttribute("data-product"))), ["home", "project", "tasks", "timeline"]);
  await floorRail.getByRole("button", { name: "More" }).click();
  await floorRail.getByRole("menuitem", { name: "Notes" }).waitFor();
  await phone.getByRole("navigation", { name: "View" }).waitFor();
  await phone.screenshot({ path: fileURLToPath(new URL("tasks-more-phone.png", output)) });
  await phone.keyboard.press("Escape");
  assert.equal(await floorRail.getByRole("button", { name: "More" }).evaluate((element) => element === document.activeElement), true);
  await phone.close();
  const narrow = await openPage({ width: 320, height: 720 });
  await narrow.goto(`${origin}/app/tasks`);
  const narrowRail = narrow.locator('[data-group="rail"]');
  await narrowRail.getByRole("button", { name: "More" }).waitFor();
  const narrowBoxes = await narrowRail.locator('[data-product]').evaluateAll((links) => links.map((link) => link.getBoundingClientRect().toJSON()));
  assert.equal(narrowBoxes.length, 4);
  assert.ok(narrowBoxes.every((box) => box.left >= 0 && box.right <= 320));
  assert.equal(await narrowRail.getByRole("button", { name: "Add task" }).isVisible(), false);
  await narrowRail.getByRole("button", { name: "More" }).click();
  await narrowRail.getByRole("menuitem", { name: "Add task" }).waitFor();
  await narrow.screenshot({ path: fileURLToPath(new URL("tasks-narrow-phone.png", output)) });
  await narrow.close();
  assert.deepEqual(failures, []);
  await writeFile(new URL("result.json", output), JSON.stringify({
    source: "local demo preview",
    origin,
    viewports: ["1440x900", "390x844", "320x720"],
    routes: ["home", "notes", "project", "tasks"],
    abortedNavigationRequests,
    checks: ["four core destinations across shared and Floor rails", "More to Notes", "Escape restores focus", "Project active", "Tasks Floor fits the phone viewport", "320px core targets fit and Add task remains in More", "Tasks views retained", "no page errors or non-cancelled local request failures"],
    result: "pass"
  }, null, 2));
  console.log("core navigation browser review passed");
} finally {
  await browser.close();
}
