import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const root = "artifacts/tasks-redesign/qa";
await mkdir(root, { recursive: true });
const base = "http://127.0.0.1:4317/__design-lab/tasks?option=b&dataset=normal&density=compact&mode=default";
const browser = await chromium.launch({ channel: "chrome" });

async function page(width, height, dsf = 2) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf, colorScheme: "light", reducedMotion: "no-preference" });
  const p = await context.newPage();
  return p;
}

async function settle(p) {
  await p.locator("[data-option]").waitFor({ state: "visible" });
  await p.locator('[data-hydrated="true"]').waitFor({ state: "attached" });
  await p.evaluate(async () => { await document.fonts.ready; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
}

// 1440 board: rail, sidebar, junction, hover, focus, tooltip
let p = await page(1440, 1000);
await p.goto(`${base}&view=board`);
await settle(p);
await p.screenshot({ path: `${root}/rail-1440.png`, clip: { x: 0, y: 52, width: 64, height: 948 } });
await p.screenshot({ path: `${root}/sidebar-1440.png`, clip: { x: 60, y: 52, width: 252, height: 948 } });
await p.screenshot({ path: `${root}/junction-1440.png`, clip: { x: 0, y: 52, width: 640, height: 380 } });
await p.hover("[data-signal-product-rail] [data-product='timeline']");
await p.waitForTimeout(350);
await p.screenshot({ path: `${root}/rail-hover-timeline.png`, clip: { x: 0, y: 52, width: 300, height: 500 } });
await p.hover("[data-signal-product-rail] [aria-label='Search']");
await p.waitForTimeout(350);
await p.screenshot({ path: `${root}/rail-tooltip-search.png`, clip: { x: 0, y: 560, width: 340, height: 440 } });
await p.locator("[data-signal-product-rail] [data-product='tasks']").focus();
await p.screenshot({ path: `${root}/rail-focus-tasks.png`, clip: { x: 0, y: 52, width: 300, height: 500 } });
// sidebar hover row
await p.hover("[data-projects-sidebar] [data-project-row='customer-proof']");
await p.waitForTimeout(300);
await p.screenshot({ path: `${root}/sidebar-hover-row.png`, clip: { x: 60, y: 52, width: 252, height: 560 } });
// collapsed strip
await p.click("[aria-label='Collapse Projects sidebar']");
await p.waitForTimeout(200);
await p.screenshot({ path: `${root}/collapsed-1440.png`, clip: { x: 0, y: 52, width: 700, height: 500 } });
await p.screenshot({ path: `${root}/collapsed-full-1440.png`, fullPage: false });
await p.context().close();

// 1024: strip + drawer
p = await page(1024, 1000);
await p.goto(`${base}&view=board`);
await settle(p);
await p.screenshot({ path: `${root}/narrow-1024.png` });
await p.click("[aria-label='Open Projects']");
await p.locator("[data-projects-drawer]").waitFor({ state: "visible" });
await p.waitForTimeout(250);
await p.screenshot({ path: `${root}/drawer-open-1024.png` });
await p.context().close();

// long-label truncation probe at 1100 (sidebar 212px)
p = await page(1100, 1000);
await p.goto(`${base}&view=board`);
await settle(p);
await p.screenshot({ path: `${root}/mid-1100.png` });
await p.context().close();

// full views at 1440 dsf1 for composition
p = await page(1440, 1000, 1);
for (const view of ["list", "timeline", "calendar"]) {
  await p.goto(`${base}&view=${view}`);
  await settle(p);
  await p.screenshot({ path: `${root}/view-${view}-1440.png` });
}
await p.context().close();

// reduced motion sanity full shot
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
p = await context.newPage();
await p.goto(`${base}&view=board`);
await settle(p);
await p.screenshot({ path: `${root}/reduced-motion-1440.png` });
await context.close();

await browser.close();
console.log("qa shots done");
