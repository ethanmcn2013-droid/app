/**
 * The sidebar and the one create button, on a production build.
 *
 *   VERCEL_ENV=preview SIGNAL_ACCESS_MODE=review NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review SIGNAL_ACTIVE_PROJECT_V3_ENABLED=true pnpm build
 *   # same environment
 *   node node_modules/next/dist/bin/next start -p 4452
 *   node experience/sidebar/run.mjs --base http://localhost:4452 --capture <folder>
 *
 * Review mode needs no sign-in and touches no database: it has one Project
 * (no status set, so no dot) and the seeded conversations. For each of four
 * sizes, dark and light, this checks the groups and their order, the page
 * you are on, the rail or the drawer, the Chat fold being remembered, the
 * breadcrumb on Automations and that each page has exactly one create
 * button, then saves the pictures. A reader without Chat, with no Projects,
 * with many or with a status dot cannot be shown by review mode: those are
 * in `fixture-run.mjs`, which mounts the real sidebar over fixed readers.
 */

import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("@playwright/test");

const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const origin = flag("--base") ?? "http://localhost:4452";
const outDir = flag("--capture") ? path.resolve(flag("--capture")) : null;
if (outDir) mkdirSync(outDir, { recursive: true });

const VIEWPORTS = {
  wide: { width: 1920, height: 1080 },
  desk: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  phone: { width: 390, height: 844 },
};
const BANNED = /\b(sprint|epic|backlog|stakeholder|kanban|burndown|velocity|workflow|dashboard|deliverable|okr|swimlane|ledger)\b|!|—/i;

let checks = 0;
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};
const same = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  checks += 1;
};

const browser = await chromium.launch({ headless: true });
try {
  for (const [viewport, size] of Object.entries(VIEWPORTS)) {
    for (const theme of ["dark", "light"]) {
      const tag = `${viewport}-${theme}`;
      const drawer = size.width < 900;
      const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, reducedMotion: "reduce", hasTouch: viewport === "phone", isMobile: viewport === "phone" });
      await context.addInitScript((choice) => {
        try {
          window.localStorage.setItem("signal:theme-mode", choice);
          window.localStorage.setItem("signal:home-intro", "hidden");
        } catch {}
      }, theme);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      const shot = async (name) => {
        if (outDir) await page.screenshot({ path: path.join(outDir, `${name}-${tag}.png`) });
      };
      const open = async (target) => {
        await page.goto(`${origin}${target}`, { waitUntil: "networkidle" });
        await page.evaluate(() => document.fonts.ready);
        await page.locator('aside nav[aria-label="Projects"] a[data-project-row]').first().waitFor({ state: "attached" });
        if (drawer) {
          await page.getByRole("button", { name: "Open navigation" }).click();
          await page.locator('[data-shell="v3"][data-mobile-open]').waitFor();
        }
      };
      const aside = page.locator('[data-shell="v3"] > aside');
      const current = () => aside.locator('[aria-current="page"]').allInnerTexts().then((list) => list.map((text) => text.split("\n")[0].trim()));

      // Home: the groups, in order, and what each holds.
      await open("/app/home");
      same(await page.evaluate(() => document.documentElement.getAttribute("data-theme")), theme, `${tag}: theme`);
      same(await aside.locator("nav").evaluateAll((list) => list.map((nav) => nav.getAttribute("aria-label"))), ["Home", "Workspace", "Projects", "Build", "Chat"], `${tag}: groups in order`);
      same(await aside.locator('nav[aria-label="Workspace"] a').allInnerTexts(), ["Projects", "Tasks", "Timeline", "Files", "Analytics"], `${tag}: Workspace rows`);
      same(
        await aside.locator('nav[aria-label="Build"] a').allInnerTexts().then((list) => list.map((text) => text.replace(/\s+/g, " ").trim())),
        ["Automations Preview", "Whiteboard Coming Soon"],
        `${tag}: Build rows`,
      );
      same(await aside.getByRole("link", { name: "Overview", exact: true }).count(), 0, `${tag}: no Overview row`);
      same(await aside.getByText("Initial setup").count(), 0, `${tag}: no Initial setup group`);
      same(await current(), ["Home"], `${tag}: Home is the page you are on`);
      ok((await aside.locator('nav[aria-label="Projects"] a[data-project-row]').count()) >= 1, `${tag}: a Project row`);
      ok((await aside.locator('nav[aria-label="Projects"] a[data-project-row] span[style*="background-color"]').count()) >= 1, `${tag}: its colour tile`);
      // Review sets no status, so there is no dot to show.
      same(await aside.locator('[class*="statusDot"]').count(), 0, `${tag}: no status dot without a status`);
      ok((await aside.locator('nav[aria-label="Chat"] a[data-chat-row]').count()) >= 1, `${tag}: real conversations listed`);
      const words = await aside.innerText();
      ok(!BANNED.test(words.replace("Search or jump to…", "")), `${tag}: plain words`);
      same(await page.getByRole("button", { name: "New task", exact: true }).count(), 1, `${tag}: one create button on Home`);
      await shot("home");

      // Chat folds from its name, and the choice is kept.
      const chatToggle = aside.getByRole("button", { name: "Chat", exact: true });
      await chatToggle.click();
      same(await chatToggle.getAttribute("aria-expanded"), "false", `${tag}: Chat folds`);
      same(await aside.locator('#shell-group-chat').count(), 0, `${tag}: folded Chat shows no rows`);
      await shot("chat-folded");
      await page.reload({ waitUntil: "networkidle" });
      same(await aside.getByRole("button", { name: "Chat", exact: true }).getAttribute("aria-expanded"), "false", `${tag}: the fold is remembered`);
      await page.evaluate(() => window.localStorage.removeItem("signal:v3:sidebar-folded"));

      // Overview is a tab of Home: Home stays lit.
      await open("/app/home/briefing");
      same(await current(), ["Home"], `${tag}: Home is lit on Overview`);
      if (!drawer) {
        same(await page.getByRole("navigation", { name: "Breadcrumb" }).innerText().then((text) => text.replace(/\s+/g, " ").trim()), "Signal Studio / Home / Overview", `${tag}: Overview crumb`);
      }

      // Automations: its row, its crumb, one create button.
      await open("/app/automations");
      same(await current(), ["Automations"], `${tag}: Automations is the page you are on`);
      same(await page.getByRole("navigation", { name: "Breadcrumb" }).locator('[aria-current="page"]').innerText(), "Automations", `${tag}: Automations crumb`);
      same(await page.getByRole("button", { name: "New automation", exact: true }).count(), 1, `${tag}: one create button on Automations`);
      await shot("automations");
      if (drawer) {
        await page.keyboard.press("Escape");
        await page.locator('[data-shell="v3"]:not([data-mobile-open])').waitFor();
        same(await page.locator('[data-shell="v3"][data-mobile-open]').count(), 0, `${tag}: Escape closes the drawer`);
      }
      await page.getByRole("button", { name: "New automation", exact: true }).click();
      await page.waitForURL(/\/app\/automations\/.+/);
      same(await page.getByRole("navigation", { name: "Breadcrumb" }).locator('[aria-current="page"]').innerText(), "Draft", `${tag}: a new automation opens on its canvas`);

      // Projects: one create button, and it opens the page's own form.
      await open("/app/project");
      same(await current(), ["Projects"], `${tag}: Projects is the page you are on`);
      if (drawer) await page.keyboard.press("Escape");
      const newProject = page.getByRole("button", { name: "New project", exact: true });
      same(await newProject.count(), 1, `${tag}: one create button on Projects`);
      await newProject.click();
      const projectName = page.getByRole("textbox", { name: "Name your project", exact: true });
      await projectName.waitFor();
      await shot("projects-new");
      await projectName.press("Escape");
      await projectName.waitFor({ state: "hidden" });
      ok(await newProject.evaluate((element) => document.activeElement === element), `${tag}: focus returns to New project`);

      // The small half lists every create path.
      await page.getByRole("button", { name: "New", exact: true }).click();
      same(
        await page.getByRole("menu").getByRole("menuitem").allInnerTexts().then((list) => list.map((text) => text.split("\n")[0].trim())),
        ["Task", "Project", "Automation", "Note", "Message"],
        `${tag}: every create path in the menu`,
      );
      await shot("new-menu");
      await page.keyboard.press("Escape");

      if (!drawer) {
        // The rail: icons only, every group still there.
        await open("/app/tasks");
        await aside.getByRole("button", { name: "Collapse sidebar" }).click();
        await page.locator('[data-shell="v3"][data-collapsed]').waitFor();
        ok((await aside.boundingBox()).width <= 64, `${tag}: the rail is narrow`);
        same(await aside.locator('[aria-current="page"]').evaluateAll((list) => list.map((row) => row.getAttribute("title"))), ["Tasks"], `${tag}: Tasks is the page you are on, on the rail`);
        same(await aside.locator('nav[aria-label="Build"] a').count(), 2, `${tag}: Build on the rail`);
        same(await aside.locator('#shell-group-chat a').count(), 1, `${tag}: Chat is one icon on the rail`);
        await shot("rail");
        await aside.getByRole("button", { name: "Expand sidebar" }).click();
        await shot("tasks");
      } else {
        await open("/app/tasks");
        await shot("drawer-tasks");
      }

      const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
      ok(overflow <= 0, `${tag}: the page scrolls sideways by ${overflow}px`);
      same(errors, [], `${tag}: console and page errors`);
      await context.close();
    }
  }
  console.log(`PASS sidebar: ${checks} checks across phone, tablet, desk and wide, dark and light`);
} finally {
  await browser.close();
}
