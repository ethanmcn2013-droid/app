/**
 * Browser check for the Tasks views (board, list, calendar) with a busy, a
 * sparse and an empty project.
 *
 *   node experience/tasks-views/run.mjs            # checks only
 *   node experience/tasks-views/run.mjs --capture  # checks, then screenshots
 *   node experience/tasks-views/run.mjs --capture <dir>
 *
 * Bundles `fixture.tsx` with the real TasksWorkspace, its real styles and the
 * v3 tokens, stubs only the seams that need a server or the shell (listed
 * below), and drives it in Chromium: the one shared header on all three
 * views, the stuck control, the board's drag and keyboard carry, the list's
 * editors and foot, the calendar's week with the "To plan" tray on the
 * right and a drag from the tray onto a day, the sparse, empty, view-only
 * and loading states, every size, light and dark, and axe.
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
const outDir = path.resolve(root, captureArg && !captureArg.startsWith("--") ? captureArg : "experience/output/tasks-views");

// ── Bundle ──────────────────────────────────────────────────────────────────

/** Everything the page reaches for that only exists on a server or in the shell. */
const stubs = new Map([
  ["next/navigation", `export const useRouter=()=>({push:u=>window.tasksProbe.pushed.push(u),replace:u=>window.tasksProbe.pushed.push(u),refresh:()=>{}});export const usePathname=()=>"/app/tasks";export const useSearchParams=()=>new URLSearchParams();`],
  ["next/link", `import {createElement} from "react";export default function Link({href,prefetch,scroll,...rest}){return createElement("a",{href,...rest})}`],
  ["next/dynamic", `import {createElement,lazy,Suspense} from "react";export default function dynamic(load,options={}){const View=lazy(()=>load().then(m=>({default:m.default??m})));const Loading=options.loading;return function Dynamic(props){return createElement(Suspense,{fallback:Loading?createElement(Loading):null},createElement(View,props))}}`],
  [
    "@/lib/domain-context",
    `import {LAB_PEOPLE,LAB_LABELS} from "@/components/hybrid/fixtures";
const members=LAB_PEOPLE.map((p,i)=>({id:p.id,name:p.name,initials:p.initials,role:i===0?"owner":"member",color:p.color}));
const tags=LAB_LABELS.map(l=>({name:l.id,color:undefined}));
const workspace={id:"ws-orchard",name:"The Orchard, events"};
const domain={boardName:"The Orchard, events",workspaceName:"The Orchard, events",workspaceTitle:"The Orchard, events"};
const personalization={headline:"Start with the first thing that needs doing",body:"Add a task and it lands in To do. Drag it along as the work moves.",firstTaskExample:"Book the room for the open day"};
const money={currency:null,budgetCents:null};
export const useWorkspaceMembers=()=>members;export const useTagDefs=()=>tags;export const useActiveWorkspace=()=>workspace;export const useDomain=()=>domain;export const useColumnConfig=()=>null;export const usePersonalization=()=>personalization;export const useProjectMoney=()=>money;export const useWorkspaceAnchor=()=>({anchor:null});`,
  ],
  ["@/lib/tasks/tasks-context", `const noop=new Proxy({}, {get:()=>()=>{}});export const useTasksState=()=>({tasks:window.tasksFixture.records});export const useTasksDispatch=()=>noop;export const useTasks=()=>({state:{tasks:window.tasksFixture.records},...noop});`],
  ["@/lib/tasks/use-task-panel", `export const useTaskPanel=()=>({taskId:null,openTask:id=>window.tasksProbe.opened.push(id),closeTask:()=>{}});`],
  ["@/components/app/add-task/add-task-context", `const api={open:false,defaults:{},openDialog:d=>window.tasksProbe.composed.push(d??null),closeDialog:()=>{},setDefaultsProvider:()=>{}};export const useAddTask=()=>api;`],
  ["@/components/app/share/share-button", `import {createElement} from "react";export const ShareButton=()=>createElement("button",{type:"button","data-band-action":"",style:{height:28,padding:"0 8px",fontSize:12,fontWeight:500,color:"var(--v3-text-2)"}},"Share");`],
  ["@/components/primitives/toast", `export const useToast=()=>({toast:(title)=>window.tasksProbe.toasts.push(title)});`],
  ["@/components/app/active-project-provider", `export const useActiveProject=()=>null;`],
  ["@/components/app/done-dopamine/first-completion-moment", `export const maybeFireFirstCompletion=()=>{};`],
  ["@/server/actions/board", `const done=async()=>({ok:true});export const addColumnAction=done,deleteColumnAction=done,renameColumnAction=done,reorderColumnsAction=done,setColumnColorAction=done,setColumnDescriptionAction=done,setColumnDoneAction=done,setColumnLimitAction=done;`],
]);
const plugin = {
  name: "server-seams",
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => (stubs.has(args.path) ? { path: args.path, namespace: "fixture-stub" } : undefined));
    build.onLoad({ filter: /.*/, namespace: "fixture-stub" }, (args) => ({ contents: stubs.get(args.path), loader: "js", resolveDir: root }));
  },
};
const bundle = await esbuild.build({
  entryPoints: [path.join(root, "experience/tasks-views/fixture.tsx")],
  absWorkingDir: root,
  outdir: path.join(root, "experience/output/tasks-views/bundle"),
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

const ORIGIN = "http://127.0.0.1:49274";
const HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Tasks</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
const FONTS = {
  "Geist-Variable.woff2": "node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
  "GeistMono-Variable.woff2": "node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
};

// ── Browser ─────────────────────────────────────────────────────────────────

const VIEWPORTS = {
  wide: { width: 1920, height: 1080 },
  desk: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  phone: { width: 390, height: 844 },
};
const VIEWS = ["board", "list", "calendar"];
const BANNED = /\b(sprint|epic|backlog|stakeholder|kanban|burndown|velocity|workflow|dashboard|deliverable|okr|swimlane|ledger|overdue|milestone)\b|!|—/i;

let checks = 0;
const shots = [];
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  checks += 1;
};

async function open(browser, { viewport, theme, view = "board", state = "busy", reducedMotion = "reduce" }) {
  const touch = viewport === "phone";
  const context = await browser.newContext({
    viewport: VIEWPORTS[viewport],
    colorScheme: theme,
    reducedMotion,
    deviceScaleFactor: 1,
    hasTouch: touch,
    isMobile: touch,
    timezoneId: "Europe/Dublin",
    locale: "en-GB",
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
  await page.goto(`${ORIGIN}/?view=${view}&state=${state}&theme=${theme}`);
  await page.evaluate(() => document.fonts.ready);
  if (state !== "loading") await page.locator("[data-floor-head] h1").waitFor();
  // The view's code arrives on its own; wait for it, then for layout.
  if (state !== "loading") await page.locator("[data-canvas] > *").first().waitFor();
  await page.waitForTimeout(250);
  return { page, context, errors, label: `${view}-${state}-${viewport}-${theme}` };
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

async function noSidewaysScroll(page, label) {
  const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  ok(overflow <= 0, `${label}: the page scrolls sideways by ${overflow}px`);
}

async function plainWords(page, label) {
  const text = await page.locator(".fixture-page").innerText();
  const hit = text.match(BANNED);
  ok(!hit, `${label}: the page says "${hit?.[0]}"`);
}

const box = async (locator) => {
  const rect = await locator.boundingBox();
  assert.ok(rect, "the element is on screen");
  return rect;
};

/** The header every view shares: the same parts, in the same places. */
async function sharedHeader(page, label, view) {
  const head = page.locator("[data-floor-head]");
  equal(await head.count(), 1, `${label}: one header`);
  equal(await head.locator("h1").innerText(), "Tasks", `${label}: the title`);
  ok((await head.getByRole("link", { name: "The Orchard, events" }).count()) === 1, `${label}: the project is named beside the title`);
  const summary = (await head.locator("p").first().innerText()).replace(/\s+/g, " ").trim();
  ok(/^\d+ done this week · \d+ open/.test(summary), `${label}: the summary line reads "${summary}"`);
  // One create button per screen, and it is the top bar's: none here.
  equal(await page.locator(".fixture-page").getByRole("button", { name: /^New task/ }).count(), 0, `${label}: no create button in the page`);
  const views = page.getByRole("navigation", { name: "Task views" });
  equal(await views.getByRole("link").count(), 3, `${label}: Board, List and Calendar`);
  equal((await views.locator('[aria-current="page"]').innerText()).trim().toLowerCase(), view, `${label}: the current view is marked`);
  ok(await page.getByRole("searchbox", { name: "Find a task" }).count(), `${label}: Find a task`);
  ok(await page.getByRole("button", { name: /^Filter/ }).count(), `${label}: Filter`);
  ok(await page.getByRole("button", { name: "Display options" }).count(), `${label}: Display`);
  ok(await page.getByRole("button", { name: "More actions" }).count(), `${label}: the overflow menu`);
}

let browser;
try {
  browser = await chromium.launch({ headless: true });

  // 1. Every view, every size, light and dark: the busy project.
  const headerBoxes = {};
  for (const viewport of Object.keys(VIEWPORTS)) {
    for (const theme of ["dark", "light"]) {
      for (const view of VIEWS) {
        const { page, context, errors, label } = await open(browser, { viewport, theme, view });
        await sharedHeader(page, label, view);
        await noSidewaysScroll(page, label);
        await plainWords(page, label);
        // The header sits in the same place whichever view is open.
        const title = await box(page.locator("[data-floor-head] h1"));
        const switcher = await box(page.getByRole("navigation", { name: "Task views" }));
        const key = `${viewport}-${theme}`;
        const at = { title: [Math.round(title.x), Math.round(title.y)], switcher: [Math.round(switcher.x), Math.round(switcher.y)] };
        if (headerBoxes[key]) assert.deepEqual(at, headerBoxes[key], `${label}: the header moved between views`);
        else headerBoxes[key] = at;
        checks += 1;
        await shot(page, `${view}-busy-${viewport}-${theme}`);
        await axe(page, label);
        assert.deepEqual(errors, [], `${label}: console errors`);
        checks += 1;
        await context.close();
      }
    }
  }

  // 2. Stuck: the control, the sentence, the filter, on the board.
  {
    const { page, context, errors, label } = await open(browser, { viewport: "desk", theme: "dark", view: "board" });
    const stuck = page.getByRole("button", { name: /^Stuck/ });
    equal((await stuck.innerText()).replace(/\s+/g, " ").trim(), "Stuck 3", `${label}: three stuck`);
    const sentence = (await page.locator("[data-floor-head] p").nth(1).innerText()).replace(/\s+/g, " ").trim();
    ok(/has not changed in 9 days\. Open it ?· ?2 more stuck$/.test(sentence), `${label}: the sentence reads "${sentence}"`);
    equal(await page.locator("[data-board] [data-stuck]").count(), 3, `${label}: three cards carry how long they have sat`);
    const all = await page.locator("[data-board] [data-id]").count();
    await stuck.click();
    equal(await stuck.getAttribute("aria-pressed"), "true", `${label}: Stuck is pressed`);
    equal(await page.locator("[data-board] [data-id]").count(), 3, `${label}: only stuck work shows`);
    ok(await page.getByRole("button", { name: "Remove filter Stuck" }).count(), `${label}: the filter is named as a chip`);
    await shot(page, "board-stuck-only-desk-dark");
    await page.getByRole("button", { name: "Remove filter Stuck" }).click();
    equal(await page.locator("[data-board] [data-id]").count(), all, `${label}: everything is back`);
    await page.getByRole("button", { name: "Open it" }).click();
    equal((await page.evaluate(() => window.tasksProbe.opened)).length, 1, `${label}: Open it opens the task`);
    // Late is a filter you can press, and press again.
    const late = page.locator("[data-floor-head]").getByRole("button", { name: /late$/ });
    await late.click();
    equal(await late.getAttribute("aria-pressed"), "true", `${label}: late is pressed`);
    ok((await page.locator("[data-board] [data-id]").count()) < all, `${label}: only late work shows`);
    await late.click();
    equal(await page.locator("[data-board] [data-id]").count(), all, `${label}: everything is back after late`);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // 3. The board keeps its columns, its drag and its keyboard carry.
  {
    const { page, context, errors, label } = await open(browser, { viewport: "wide", theme: "dark", view: "board" });
    const laneOf = (id) => page.evaluate((taskId) => document.querySelector(`[data-board] [data-id="${taskId}"]`)?.closest("[data-lane]")?.getAttribute("data-lane") ?? null, id);
    equal(await page.locator("[data-board] [data-lane]").count(), 5, `${label}: five columns`);
    // Done starts folded to a rail that counts the finished work, and opens.
    const done = page.locator('[data-lane="done"]');
    ok((await done.getAttribute("data-collapsed")) !== null, `${label}: Done starts as a rail`);
    ok((await box(done)).width <= 60, `${label}: the rail is slim`);
    await shot(page, "board-done-rail-wide-dark");
    await done.getByRole("button", { name: /^Unfold Done/ }).click();
    ok((await page.locator('[data-lane="done"]').getAttribute("data-collapsed")) === null, `${label}: pressing the rail opens Done`);
    await shot(page, "board-done-open-wide-dark");

    // Mouse drag between columns.
    const card = page.locator('[data-lane="todo"] [data-tray-body] > [data-id]').first();
    const id = await card.getAttribute("data-id");
    const from = await box(card.locator("p").first());
    const to = await box(page.locator('[data-lane="review"] [data-tray-body]'));
    await page.mouse.move(from.x + 20, from.y + 8);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y + 20, { steps: 3 });
    equal(await page.locator("[data-board] [data-dragging]").count(), 1, `${label}: the card lifts`);
    await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    equal(await laneOf(id), "review", `${label}: a drag moves the card`);
    ok(await page.getByRole("status").filter({ hasText: /Moved|To check/ }).count(), `${label}: the move offers its way back`);

    // Keyboard: arrows walk, Space carries, Escape puts back, Space drops.
    const first = page.locator('[data-lane="todo"] [data-tray-body] > [data-id]').first();
    const carried = await first.getAttribute("data-id");
    await first.focus();
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(150);
    ok((await page.evaluate(() => document.activeElement?.getAttribute("data-id"))) !== carried, `${label}: ArrowDown moves to the next card`);
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(150);
    equal(await page.evaluate(() => document.activeElement?.getAttribute("data-id")), carried, `${label}: ArrowUp comes back`);
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(200);
    equal(await laneOf(carried), "doing", `${label}: Space then ArrowRight carries the card`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    equal(await laneOf(carried), "todo", `${label}: Escape puts it back`);
    // Enter opens the task.
    await page.locator(`[data-board] [data-id="${carried}"]`).focus();
    await page.keyboard.press("Enter");
    ok((await page.evaluate(() => window.tasksProbe.opened)).includes(carried), `${label}: Enter opens the task`);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // 4. The list: editors, grouping, sorting, the foot.
  {
    const { page, context, errors, label } = await open(browser, { viewport: "desk", theme: "dark", view: "list" });
    const rows = page.locator('[role="grid"] [role="row"][data-id]');
    const shown = await rows.count();
    ok(shown > 10, `${label}: rows`);
    const foot = (await page.locator('[data-list-foot]').innerText()).replace(/\s+/g, " ").trim();
    ok(/^48 tasks/.test(foot), `${label}: the foot counts every task, "${foot}"`);
    // A cell opens its editor without opening the task.
    await rows.first().getByRole("button", { name: /Change due date|Set one/ }).click();
    ok(await page.getByRole("dialog").count(), `${label}: the due cell opens its editor`);
    equal((await page.evaluate(() => window.tasksProbe.opened)).length, 0, `${label}: the task did not open`);
    await page.keyboard.press("Escape");
    // A group folds and unfolds.
    const group = page.getByRole("button", { name: /^To do/ }).first();
    await group.click();
    ok((await rows.count()) < shown, `${label}: the group folds`);
    await group.click();
    equal(await rows.count(), shown, `${label}: the group unfolds`);
    // Sort by the Task column.
    await page.getByRole("button", { name: /^Task, sort/ }).click();
    equal(await page.locator('[role="columnheader"][aria-sort="ascending"]').count(), 1, `${label}: the column sorts`);
    // Group by assignee from Display.
    await page.getByRole("button", { name: "Display options" }).click();
    ok(await page.getByRole("menuitem", { name: /Group by/ }).count(), `${label}: Display offers Group by`);
    ok(await page.getByRole("menuitemradio", { name: "Compact" }).count(), `${label}: Display offers the density`);
    await page.keyboard.press("Escape");
    // The choice itself is a saved preference; set it the way the menu does.
    await page.evaluate(() => {
      window.localStorage.setItem("signal-tasks.v3.list-group", "assignee");
      window.dispatchEvent(new StorageEvent("storage", { key: "signal-tasks.v3.list-group" }));
    });
    ok(await page.getByRole("button", { name: /^Maya Chen/ }).count(), `${label}: grouped by person`);
    await shot(page, "list-by-assignee-desk-dark");
    // The Amount column adds up at the foot when it is on.
    await page.getByRole("button", { name: "Choose columns" }).click();
    await page.getByRole("menuitemcheckbox", { name: "Subtasks" }).click();
    await page.keyboard.press("Escape");
    ok(await page.getByRole("columnheader", { name: "Subtasks" }).count(), `${label}: a column can be added`);
    // Selecting rows brings up the bulk bar.
    await page.evaluate(() => window.localStorage.removeItem("signal-tasks.v3.list-group"));
    await rows.first().hover();
    await rows.first().getByRole("checkbox").click();
    ok(await page.getByRole("toolbar", { name: "1 selected" }).count(), `${label}: selecting a row brings up the bulk bar`);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // 5. The calendar: the week, the tray on the right, a drag onto a day.
  for (const theme of ["dark", "light"]) {
    const { page, context, errors, label } = await open(browser, { viewport: "wide", theme, view: "calendar" });
    equal(await page.getByRole("radio", { name: "Week" }).getAttribute("aria-checked"), "true", `${label}: it opens on the week`);
    const grid = await box(page.locator('[role="grid"]'));
    const tray = page.getByRole("complementary", { name: "Day details" });
    const trayBox = await box(tray);
    ok(trayBox.x >= grid.x + grid.width, `${label}: the tray sits to the right of the grid (grid ends ${grid.x + grid.width}, tray starts ${trayBox.x})`);
    const tabs = tray.getByRole("tab");
    assert.deepEqual((await tabs.allInnerTexts()).map((text) => text.replace(/\s+\d+$/, "").trim()), ["Due soon", "Late", "No date"], `${label}: the tray's tabs`);
    checks += 1;
    // Arrows move between the tabs; one tab stop.
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    equal(await tabs.nth(1).getAttribute("aria-selected"), "true", `${label}: ArrowRight moves to Late`);
    await page.keyboard.press("ArrowRight");
    equal(await tabs.nth(2).getAttribute("aria-selected"), "true", `${label}: then to No date`);
    const before = Number((await tabs.nth(2).innerText()).match(/\d+$/)[0]);
    ok(before > 0, `${label}: there is undated work to plan`);
    // Drag the first undated task onto Friday.
    const task = tray.locator("[data-chip]").first();
    const id = await task.getAttribute("data-id");
    const friday = page.locator('[role="gridcell"][data-date="2026-07-17"]');
    await task.dragTo(friday);
    await page.waitForTimeout(300);
    equal(await friday.locator(`[data-id="${id}"]`).count(), 1, `${label}: the task lands on the day`);
    equal(Number((await tabs.nth(2).innerText()).match(/\d+$/)[0]), before - 1, `${label}: one fewer with no date`);
    // And back to the tray clears the date.
    await friday.locator(`[data-id="${id}"]`).dragTo(tray.locator("section").first());
    await page.waitForTimeout(300);
    equal(await friday.locator(`[data-id="${id}"]`).count(), 0, `${label}: dragged back, it leaves the day`);
    equal(Number((await tabs.nth(2).innerText()).match(/\d+$/)[0]), before, `${label}: and has no date again`);
    // Month and agenda are still there.
    await page.getByRole("radio", { name: "Month" }).click();
    ok((await page.locator('[role="gridcell"]').count()) >= 28, `${label}: the month`);
    await shot(page, `calendar-month-wide-${theme}`);
    await page.getByRole("radio", { name: "Agenda" }).click();
    ok(await page.getByRole("heading", { name: /^Today,/ }).count(), `${label}: the agenda`);
    await shot(page, `calendar-agenda-wide-${theme}`);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // 6. Tablet and phone: the tray is never at the left.
  {
    const { page, context, label } = await open(browser, { viewport: "tablet", theme: "dark", view: "calendar" });
    const grid = await box(page.locator('[role="grid"]'));
    const handle = page.getByRole("button", { name: /^To plan/ }).last();
    const handleBox = await box(handle);
    ok(handleBox.y > grid.y, `${label}: the tray is a sheet at the foot, under the grid`);
    await handle.click();
    await page.waitForTimeout(350);
    ok(await page.getByRole("tab", { name: /^No date/ }).isVisible(), `${label}: the sheet opens with its tabs`);
    await shot(page, "calendar-tray-open-tablet-dark");
    await context.close();
  }
  {
    const { page, context, label } = await open(browser, { viewport: "phone", theme: "dark", view: "calendar" });
    equal(await page.getByRole("radio", { name: "Agenda" }).getAttribute("aria-checked"), "true", `${label}: a phone opens on the agenda`);
    await page.getByRole("button", { name: /^To plan, no date yet/ }).click();
    ok(await page.locator("[data-chip]").count(), `${label}: the tray unfolds above the days`);
    await shot(page, "calendar-tray-open-phone-dark");
    await context.close();
  }

  // 7. Sparse, empty, view-only and loading, each view.
  for (const state of ["sparse", "empty", "readonly", "loading"]) {
    for (const [viewport, theme] of [["desk", "dark"], ["desk", "light"], ["phone", "dark"]]) {
      for (const view of VIEWS) {
        const { page, context, errors, label } = await open(browser, { viewport, theme, view, state });
        await noSidewaysScroll(page, label);
        await plainWords(page, label);
        if (state === "sparse") {
          await sharedHeader(page, label, view);
          equal(await page.getByRole("button", { name: /^Stuck/ }).count(), 0, `${label}: nothing stuck, so no Stuck control`);
        }
        if (state === "empty") {
          equal(await page.locator("[data-floor-head] p").count(), 0, `${label}: no figures to state for an empty project`);
          if (view === "board") ok(await page.getByRole("region", { name: "Start your board" }).count(), `${label}: the board says how to start`);
          if (view === "list") ok(await page.getByRole("heading", { name: "Nothing on the list yet" }).count(), `${label}: the list says it is empty`);
        }
        if (state === "readonly") {
          ok(await page.getByText("View only").count(), `${label}: says view only`);
          equal(await page.getByRole("button", { name: /^Add a task/ }).count(), 0, `${label}: nothing to add with`);
        }
        if (state === "loading") ok(await page.locator('[aria-busy="true"]').count(), `${label}: the skeleton`);
        await shot(page, `${view}-${state}-${viewport}-${theme}`);
        if (state !== "loading") await axe(page, label);
        assert.deepEqual(errors, [], `${label}: console errors`);
        checks += 1;
        await context.close();
      }
    }
  }

  // 8. Motion stands still when asked to.
  {
    const { page, context, label } = await open(browser, { viewport: "desk", theme: "dark", view: "board", reducedMotion: "reduce" });
    const moving = await page.evaluate(() =>
      [...document.querySelectorAll(".fixture-page *")].filter((node) => {
        const style = getComputedStyle(node);
        return style.animationName !== "none" && Number.parseFloat(style.animationDuration) > 0.2 && style.animationIterationCount === "infinite";
      }).length,
    );
    equal(moving, 0, `${label}: nothing loops under reduced motion`);
    await context.close();
  }

  console.log(`PASS tasks views: ${checks} checks across wide, desk, tablet and phone, light and dark`);
  if (capture) console.log(`${shots.length} screenshots in ${outDir}`);
} finally {
  await browser?.close();
}
