import { chromium } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";
const LAB = "C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08";
const MASTER = pathToFileURL(path.join(LAB, "_gate-suite.html")).href;
export async function open(browser, { state, v = "paper", layout, width = 1440, height = 960, touch } = {}) {
  const isTouch = touch ?? width <= 480;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: isTouch, hasTouch: isTouch });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("PAGEERROR", String(e)));
  const url = new URL(MASTER);
  if (state) url.searchParams.set("state", state);
  url.searchParams.set("v", v);
  if (layout) url.searchParams.set("layout", layout);
  await page.goto(url.href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(350);
  return page;
}
export async function launch() { return chromium.launch(); }
