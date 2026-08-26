import { chromium } from "@playwright/test";
export const BASE = "file:///C:/Users/ethan/AppData/Local/Temp/claude/C--Users-ethan/7c0de329-febd-4a7e-ab6a-74379c009573/scratchpad/snap.html";
export const browser = await chromium.launch();
export async function open(state, { w = 1440, h = 960, v = "paper", extra = "" } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w <= 480, hasTouch: w <= 480 });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("PAGEERROR", String(e)));
  await page.goto(`${BASE}?v=${v}&state=${state}${extra}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(350);
  return page;
}
