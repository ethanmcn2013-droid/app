import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const root = "artifacts/tasks-redesign/qa";
await mkdir(root, { recursive: true });
const base = "http://127.0.0.1:4317/__design-lab/tasks?option=b&dataset=normal&density=compact&mode=default";
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, colorScheme: "light" });
const p = await context.newPage();
await p.goto(`${base}&view=board`);
await p.locator("[data-option]").waitFor({ state: "visible" });
await p.locator('[data-hydrated="true"]').waitFor({ state: "attached" });
await p.evaluate(async () => { await document.fonts.ready; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
await p.screenshot({ path: `${root}/sidebar-pass2.png`, clip: { x: 60, y: 52, width: 252, height: 620 } });
// measure text offsets for the indentation rhythm
const offsets = await p.evaluate(() => {
  const sidebar = document.querySelector("[data-projects-sidebar]");
  const left = sidebar.getBoundingClientRect().left;
  const pick = (selector) => {
    const el = sidebar.querySelector(selector);
    const name = el.querySelector("span:not([aria-hidden])") ?? el;
    return Math.round((name.getBoundingClientRect().left - left) * 10) / 10;
  };
  return {
    parentText: pick('[data-project-row="public-launch"]'),
    childText: pick('[data-project-row="launch-workspace"]'),
    previewText: pick('[data-project-row="product-readiness"]'),
  };
});
console.log("text offsets", offsets, "child indent =", offsets.childText - offsets.parentText);
await browser.close();
