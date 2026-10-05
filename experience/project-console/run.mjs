/**
 * Browser check for the Projects console with a busy account.
 *
 *   node experience/project-console/run.mjs            # checks only
 *   node experience/project-console/run.mjs --capture  # checks, then screenshots
 *   node experience/project-console/run.mjs --capture experience/reviews/<dir>
 *
 * Bundles `fixture.tsx` with the real Console, its real styles and the v3
 * tokens, stubs only the seams that need a server (listed below), and drives
 * it in Chromium: tab counts, every tab, the row menu, the keyboard walk,
 * empty states, phone layout, reduced motion and axe, in light and dark.
 * No dev server, no database, no network.
 */

import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve("tsx/package.json"))("esbuild");
const { chromium } = require("@playwright/test");
const { AxeBuilder } = require("@axe-core/playwright");

const captureAt = process.argv.indexOf("--capture");
const capture = captureAt !== -1;
const captureArg = capture ? process.argv[captureAt + 1] : undefined;
const outDir = path.resolve(root, captureArg && !captureArg.startsWith("--") ? captureArg : "experience/output/project-console");

// ── Bundle ──────────────────────────────────────────────────────────────────

/** Everything the page reaches for that only exists on a server or in the shell. */
const stubs = new Map([
  ["next/navigation", `export const useRouter=()=>({push:u=>window.consoleProbe.pushed.push(u),replace:u=>window.consoleProbe.pushed.push(u),refresh:()=>{}});`],
  ["next/link", `import {createElement} from "react";export default function Link({href,prefetch,scroll,...rest}){return createElement("a",{href,...rest})}`],
  ["@/lib/access-mode", `export const isDemoMode=()=>false;`],
  ["@/components/app/active-project-provider", `export const useActiveProject=()=>null;`],
  ["@/components/shell/app-sidebar", `export const projectColor=()=>"var(--v3-project-1)";`],
  ["@/components/studio-bar/monthly-template-choice", `export const MonthlyTemplateChoice=()=>null;`],
  ["@/components/primitives/toast", `export const useToast=()=>({toast:(title)=>window.consoleProbe.toasts.push(title)});`],
  ["@/server/actions/planning", `export const createProjectAction=async()=>({ok:true,id:"p-new"});`],
  ["@/server/actions/nudge", `export const sendNudgeAction=async id=>{window.consoleProbe.nudged.push(id);return {ok:true,nudgedCount:1,lastNudgedAt:null}};`],
  ["./project-overview", `export const ProjectOverview=()=>null;`],
]);
const plugin = {
  name: "server-seams",
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => (stubs.has(args.path) ? { path: args.path, namespace: "fixture-stub" } : undefined));
    build.onLoad({ filter: /.*/, namespace: "fixture-stub" }, (args) => ({ contents: stubs.get(args.path), loader: "js", resolveDir: root }));
  },
};
const bundle = await esbuild.build({
  entryPoints: [path.join(root, "experience/project-console/fixture.tsx")],
  absWorkingDir: root,
  outdir: path.join(root, "experience/output/project-console/bundle"),
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  alias: { "@": path.join(root, "src") },
  loader: { ".module.css": "local-css", ".css": "css" },
  external: ["/fonts/*"],
  plugins: [plugin],
  logLevel: "silent",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
});
const js = bundle.outputFiles.find((file) => file.path.endsWith(".js")).text;
const css = bundle.outputFiles.find((file) => file.path.endsWith(".css")).text;

const ORIGIN = "http://127.0.0.1:49273";
const HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Projects</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
const FONTS = {
  "Geist-Variable.woff2": "node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
  "GeistMono-Variable.woff2": "node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
};

// ── Browser ─────────────────────────────────────────────────────────────────

const VIEWPORTS = {
  desk: { width: 1440, height: 900 },
  wide: { width: 1920, height: 1080 },
  phone: { width: 390, height: 844 },
};
const BANNED = /\b(sprint|epic|backlog|stakeholder|kanban|burndown|velocity|workflow|dashboard|deliverable|okr|milestone|ledger|health)\b|!|—/i;

let checks = 0;
const shots = [];

async function open(browser, { viewport, theme, state = "busy", reducedMotion = "reduce" }) {
  const phone = viewport === "phone";
  const context = await browser.newContext({
    viewport: VIEWPORTS[viewport],
    colorScheme: theme,
    reducedMotion,
    deviceScaleFactor: 1,
    hasTouch: phone,
    isMobile: phone,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route(`${ORIGIN}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/app.js") return route.fulfill({ contentType: "text/javascript", body: js });
    if (url.pathname === "/app.css") return route.fulfill({ contentType: "text/css", body: css });
    const font = FONTS[url.pathname.replace("/fonts/", "")];
    if (font) return route.fulfill({ contentType: "font/woff2", body: readFileSync(path.join(root, font)) });
    return route.fulfill({ contentType: "text/html", body: HTML });
  });
  await page.goto(`${ORIGIN}/?state=${state}&theme=${theme}`);
  await page.evaluate(() => document.fonts.ready);
  return { page, context, errors, label: `${state}-${viewport}-${theme}` };
}

async function shot(page, name, { fullPage = false } = {}) {
  if (!capture) return;
  mkdirSync(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage });
  shots.push(`${name}.png`);
}

async function axe(page, label) {
  const result = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(
    result.violations.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map((node) => node.target.join(" ")).slice(0, 4) })),
    [],
    `axe: ${label}`,
  );
  checks += 1;
}

const tab = (page, name) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
const rows = (page) => page.locator("[data-row]");
const rowIds = (page) => rows(page).evaluateAll((els) => els.map((el) => el.dataset.row));

async function noSidewaysScroll(page, label) {
  const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `${label}: the page scrolls sideways by ${overflow}px`);
  checks += 1;
}

let browser;
try {
  browser = await chromium.launch({ headless: true });

  // 1. The busy account, every size, light and dark.
  for (const viewport of Object.keys(VIEWPORTS)) {
    for (const theme of ["dark", "light"]) {
      const { page, context, errors, label } = await open(browser, { viewport, theme });
      await page.getByRole("heading", { name: "Projects", level: 1 }).waitFor();

      // Tabs carry the fixture's counts and show exactly that many rows.
      for (const [name, count] of [["All", 10], ["Needs a look", 3], ["Led by you", 3], ["Wrapped", 2]]) {
        await tab(page, name).click();
        assert.equal(await tab(page, name).getAttribute("aria-selected"), "true", `${label}: ${name} is chosen`);
        assert.equal((await tab(page, name).innerText()).replace(/\s+/g, " ").trim(), `${name} ${count}`);
        assert.equal(await rows(page).count(), count, `${label}: ${name} shows ${count} rows`);
        await noSidewaysScroll(page, `${label} ${name}`);
        if (name !== "All") await shot(page, `tab-${name.toLowerCase().replace(/\s+/g, "-")}-${viewport}-${theme}`);
      }
      assert.match(page.url(), /show=wrapped/, "the tab is written to the address");
      await tab(page, "All").click();
      assert.doesNotMatch(page.url(), /show=/);

      // The order: needs a look first, then on track, paused, no status.
      assert.deepEqual(await rowIds(page), ["p-winter", "p-mara", "p-barn", "p-keane", "p-garden", "p-newyear", "p-harvest", "p-kitchen", "p-website", "p-shared"]);
      assert.deepEqual(await page.locator("[role=tabpanel] h2").allInnerTexts().then((list) => list.map((text) => text.replace(/\s+/g, " ").trim())), [
        "Needs a look 3",
        "On track 4",
        "Paused 1",
        "No status yet 2",
      ]);

      // Four figures, each from the fixture.
      const figures = await page.locator("[data-count='4'] > *").allInnerTexts();
      assert.equal(figures.length, 4);
      assert.match(figures[0].replace(/\s+/g, " "), /Needs a look .*3 projects at risk or past their date .*Winter season launch first/);
      assert.match(figures[1].replace(/\s+/g, " "), /Next big date .*0 days to go, it is today .*Menu tasting · Mon 5 Oct · 23 of 44 done/);
      assert.match(figures[2].replace(/\s+/g, " "), /Late across your projects .*10 tasks past their date .*Oldest: Agree the winter price list · 7 days/);
      assert.match(figures[3].replace(/\s+/g, " "), /This week .*32 tasks done in the last 7 days .*42 the week before · most in Mara & Finn’s wedding \(15\)/);

      // Plain words only, and figures that line up.
      const words = await page.locator("#root").innerText();
      assert.doesNotMatch(words.replace(/Harvest supper[^\n]*/g, ""), BANNED, `${label}: banned word`);
      assert.match(await page.locator("[data-row] >> text=23 of 44").first().evaluate((el) => getComputedStyle(el).fontVariantNumeric), /tabular-nums/);
      // Nothing floats over the list.
      assert.equal(await page.evaluate(() => [...document.querySelectorAll("#root *")].filter((el) => getComputedStyle(el).position === "fixed").length), 0, `${label}: a fixed element sits over the page`);
      checks += 6;

      await axe(page, label);
      await shot(page, `console-${viewport}-${theme}`);
      if (theme === "dark" || viewport === "phone") await shot(page, `console-${viewport}-${theme}-full`, { fullPage: true });

      // The row menu.
      const more = page.getByRole("button", { name: "More for Mara & Finn’s wedding" });
      await more.scrollIntoViewIfNeeded();
      await more.click();
      const menu = page.getByRole("menu", { name: "More for Mara & Finn’s wedding" });
      await menu.waitFor();
      assert.deepEqual(await menu.getByRole("menuitem").allInnerTexts().then((list) => list.map((text) => text.split("\n")[0])), [
        "Nudge Aoife Brennan",
        "Open the project",
        "Open its tasks",
        "See the timeline",
      ]);
      assert.equal(await page.evaluate(() => document.activeElement?.textContent?.startsWith("Nudge")), true, "the menu takes focus on its first item");
      const box = await menu.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= VIEWPORTS[viewport].width, `${label}: the menu stays on screen`);
      await axe(page, `${label} menu`);
      await shot(page, `menu-${viewport}-${theme}`);
      await page.keyboard.press("Escape");
      await menu.waitFor({ state: "detached" });
      assert.equal(await more.evaluate((el) => el === document.activeElement), true, "Escape hands focus back to the button");

      assert.deepEqual(errors, [], `${label}: console or page errors`);
      checks += 5;
      await context.close();
    }
  }

  // 2. Keyboard walk, row actions and the search (desk, dark).
  {
    const { page, context, errors, label } = await open(browser, { viewport: "desk", theme: "dark" });
    await page.getByRole("heading", { name: "Projects", level: 1 }).waitFor();
    const focused = () => page.evaluate(() => document.activeElement?.closest("[data-row]")?.getAttribute("data-row") ?? document.activeElement?.getAttribute("data-filter") ?? document.activeElement?.tagName);

    // Tabs: one stop, arrows move and choose.
    await tab(page, "All").focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await focused(), "attention");
    assert.equal(await rows(page).count(), 3);
    await page.keyboard.press("End");
    assert.equal(await focused(), "wrapped");
    await page.keyboard.press("Home");
    assert.equal(await focused(), "all");

    // Rows: Tab enters the list once; arrows, j and k, Home and End walk it.
    await page.locator("[data-console-row='p-winter']").focus();
    assert.notEqual(await page.locator("[data-console-row='p-winter']").evaluate((el) => getComputedStyle(el, "::after").boxShadow), "none", "a focused row shows a ring");
    await page.keyboard.press("ArrowDown");
    assert.equal(await focused(), "p-mara");
    await page.keyboard.press("j");
    assert.equal(await focused(), "p-barn");
    await page.keyboard.press("k");
    assert.equal(await focused(), "p-mara");
    await page.keyboard.press("End");
    assert.equal(await focused(), "p-shared");
    await page.keyboard.press("Home");
    assert.equal(await focused(), "p-winter");
    await shot(page, "keyboard-row-focus-desk-dark");
    // Only the current row is a tab stop, so Tab reaches its own actions next.
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Open Winter season launch");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "More for Winter season launch");
    await page.keyboard.press("ArrowDown");
    await page.getByRole("menu").waitFor();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.startsWith("Open its tasks")), true);
    await shot(page, "keyboard-menu-desk-dark");
    await page.keyboard.press("Enter");
    assert.deepEqual(await page.evaluate(() => window.consoleProbe.selected), [{ id: "p-winter", surface: "tasks" }]);

    // Enter on a row opens that project through the guarded switch.
    await page.locator("[data-console-row='p-barn']").focus();
    await page.keyboard.press("Enter");
    assert.deepEqual(await page.evaluate(() => window.consoleProbe.selected.at(-1)), { id: "p-barn", surface: "project" });
    // The open project is not switched to; its row points at the overview below.
    await page.getByRole("link", { name: "Keane Legal retreat: see its overview below" }).click();
    assert.equal(await page.evaluate(() => window.consoleProbe.selected.length), 2);
    // A project whose name is shared cannot be opened from here.
    assert.equal(await page.locator("[data-row='p-shared'] a").count(), 0);
    assert.equal(await page.locator("[data-row='p-shared'] button").count(), 0);

    // Nudge sends one reminder, then says so.
    await page.getByRole("button", { name: "More for Barn roof and heating works" }).click();
    await page.getByRole("menuitem", { name: /Nudge Tom Reilly/ }).click();
    await page.waitForFunction(() => window.consoleProbe.toasts.length === 1);
    assert.deepEqual(await page.evaluate(() => [window.consoleProbe.nudged, window.consoleProbe.toasts]), [["t-manifold"], ["Nudged Tom Reilly"]]);
    await page.getByRole("button", { name: "More for Barn roof and heating works" }).click();
    assert.equal(await page.getByRole("menuitem", { name: /Nudged Tom Reilly/ }).getAttribute("aria-disabled"), "true");
    await page.keyboard.press("Escape");
    // A project with nobody else on its late work offers no Nudge.
    await page.getByRole("button", { name: "More for Keane Legal retreat" }).click();
    assert.equal(await page.getByRole("menuitem", { name: /Nudge/ }).count(), 0);
    await page.keyboard.press("Escape");

    // "Needs a look" on the first figure is a way to that tab.
    await page.getByRole("link", { name: /Needs a look/ }).click();
    assert.equal(await tab(page, "Needs a look").getAttribute("aria-selected"), "true");
    await tab(page, "All").click();

    // Search narrows the rows; a miss says so and offers the way back.
    const search = page.getByRole("searchbox", { name: "Find a project" });
    await search.fill("wedding");
    assert.deepEqual(await rowIds(page), ["p-mara"]);
    await shot(page, "search-match-desk-dark");
    await search.fill("zzz");
    await page.getByText("No project called “zzz” here.").waitFor();
    await axe(page, `${label} search miss`);
    await shot(page, "search-miss-desk-dark");
    await page.getByRole("button", { name: "Clear the search" }).click();
    assert.equal(await rows(page).count(), 10);

    // The view switcher is a menu of two; Cards is the earlier grid.
    await page.getByRole("button", { name: "View: Console" }).click();
    assert.deepEqual(await page.getByRole("menuitemradio").allInnerTexts().then((list) => list.map((text) => text.split("\n")[0])), ["Console", "Cards"]);
    await shot(page, "view-menu-desk-dark");
    await page.getByRole("menuitemradio", { name: /Cards/ }).click();
    assert.match(page.url(), /view=cards/);
    assert.equal(await rows(page).count(), 0);
    await page.getByRole("button", { name: "View: Cards" }).click();
    await page.getByRole("menuitemradio", { name: /Console/ }).click();
    assert.doesNotMatch(page.url(), /view=/);

    // New project opens a name field above the list and takes focus.
    await page.getByRole("button", { name: "New project" }).click();
    assert.equal(await page.getByRole("textbox", { name: "Name your project" }).evaluate((el) => el === document.activeElement), true);
    await axe(page, `${label} new project`);
    await shot(page, "new-project-desk-dark");
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("button", { name: "New project" }).evaluate((el) => el === document.activeElement), true);

    assert.deepEqual(errors, [], `${label}: console or page errors`);
    checks += 30;
    await context.close();
  }

  // 3. Motion: the entrance plays once, and not at all when motion is reduced.
  {
    const moving = await open(browser, { viewport: "desk", theme: "dark", reducedMotion: "no-preference" });
    await moving.page.locator("[data-row]").first().waitFor();
    assert.notEqual(await moving.page.locator("[data-row]").first().evaluate((el) => getComputedStyle(el).animationName), "none");
    await moving.context.close();
    const still = await open(browser, { viewport: "desk", theme: "dark" });
    await still.page.locator("[data-row]").first().waitFor();
    assert.equal(await still.page.locator("[data-row]").first().evaluate((el) => getComputedStyle(el).animationName), "none");
    assert.equal(await still.page.locator("[data-row] [role=img] > span").first().evaluate((el) => getComputedStyle(el).animationName), "none");
    await still.context.close();
    checks += 3;
  }

  // 4. The other accounts: nothing flagged, the extra reads failed, one project, none, first run, loading.
  for (const [viewport, theme] of [["desk", "dark"], ["desk", "light"], ["phone", "dark"], ["phone", "light"]]) {
    {
      const { page, context, errors, label } = await open(browser, { viewport, theme, state: "calm" });
      await tab(page, "Needs a look").click();
      await page.getByText("Nothing needs a look.").waitFor();
      assert.equal(await rows(page).count(), 0);
      await axe(page, `${label} empty tab`);
      await shot(page, `empty-tab-${viewport}-${theme}`);
      await page.getByRole("button", { name: "See all projects" }).click();
      assert.equal(await tab(page, "All").getAttribute("aria-selected"), "true");
      assert.deepEqual(errors, []);
      await context.close();
    }
    {
      const { page, context, errors, label } = await open(browser, { viewport, theme, state: "partial" });
      await page.locator("[data-row]").first().waitFor();
      // No finished-work read, so no "This week"; the rest still stands.
      assert.equal(await page.locator("[data-count='3'] > *").count(), 3);
      assert.equal(await page.getByText("This week").count(), 0);
      assert.equal(await page.locator("[data-row='p-mara']").getByText("Owner not shown").count(), 1);
      await axe(page, label);
      await noSidewaysScroll(page, label);
      await shot(page, `partial-${viewport}-${theme}`);
      assert.deepEqual(errors, []);
      await context.close();
    }
    {
      const { page, context, errors, label } = await open(browser, { viewport, theme, state: "one" });
      assert.equal(await rows(page).count(), 1);
      await axe(page, label);
      await shot(page, `one-project-${viewport}-${theme}`);
      assert.deepEqual(errors, []);
      await context.close();
    }
    {
      const { page, context, errors, label } = await open(browser, { viewport, theme, state: "none" });
      await page.getByText("No active projects.").waitFor();
      assert.equal(await page.getByRole("button", { name: "New project" }).count(), 1);
      await axe(page, label);
      await shot(page, `no-active-projects-${viewport}-${theme}`);
      assert.deepEqual(errors, []);
      await context.close();
    }
    {
      const { page, context, errors, label } = await open(browser, { viewport, theme, state: "first-run" });
      await page.getByRole("heading", { name: "No projects yet", level: 1 }).waitFor();
      await axe(page, label);
      await shot(page, `first-run-${viewport}-${theme}`);
      await page.getByRole("button", { name: "New project" }).click();
      assert.equal(await page.getByRole("textbox", { name: "Name your project" }).evaluate((el) => el === document.activeElement), true);
      await axe(page, `${label} naming`);
      await shot(page, `first-run-naming-${viewport}-${theme}`);
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "New project" }).waitFor();
      assert.deepEqual(errors, []);
      await context.close();
    }
    {
      const { page, context, label } = await open(browser, { viewport, theme, state: "loading" });
      await noSidewaysScroll(page, label);
      await shot(page, `loading-${viewport}-${theme}`);
      await context.close();
    }
    checks += 14;
  }

  console.log(`PASS projects console: ${checks} checks across desk, wide and phone, light and dark${capture ? `; ${shots.length} screenshots in ${path.relative(root, outDir).replace(/\\/g, "/")}` : ""}`);
} finally {
  await browser?.close();
}
