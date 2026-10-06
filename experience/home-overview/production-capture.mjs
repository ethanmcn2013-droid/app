/**
 * Screenshots of the real Home and Overview from a production build.
 *
 *   NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review SIGNAL_ACTIVE_PROJECT_V3_ENABLED=true pnpm build
 *   NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review SIGNAL_ACTIVE_PROJECT_V3_ENABLED=true pnpm exec next start -p 4391
 *   node experience/home-overview/production-capture.mjs http://127.0.0.1:4391 <dir>
 *
 * Review mode needs no sign-in and touches no database. For each of the four
 * sizes, in dark and light, it opens both pages, checks the Home and Overview
 * tabs sit in the same place on both, that nothing scrolls sideways, that the
 * console is quiet and that axe reports nothing, then saves the page. It also
 * walks the tab from Home to Overview and back by keyboard.
 */

import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("@playwright/test");
const { AxeBuilder } = require("@axe-core/playwright");

const origin = process.argv[2] ?? "http://127.0.0.1:4391";
const outDir = path.resolve(process.argv[3] ?? "experience/output/home-overview/production-build");
mkdirSync(outDir, { recursive: true });

const VIEWPORTS = {
  wide: { width: 1920, height: 1080 },
  desk: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  phone: { width: 390, height: 844 },
};
const PAGES = [
  { name: "home", path: "/app/home", ready: (page) => page.locator("[data-home-board]").waitFor() },
  { name: "overview", path: "/app/home/briefing", ready: (page) => page.locator("[data-overview-river='desk'], [data-overview-river='phone']").waitFor() },
];

let checks = 0;
const browser = await chromium.launch({ headless: true });
try {
  for (const [viewport, size] of Object.entries(VIEWPORTS)) {
    for (const theme of ["dark", "light"]) {
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
      const tabsAt = {};
      for (const target of PAGES) {
        await page.goto(`${origin}${target.path}`, { waitUntil: "networkidle" });
        await target.ready(page);
        await page.evaluate(() => document.fonts.ready);
        const label = `${target.name}-${viewport}-${theme}`;
        assert.equal(await page.evaluate(() => document.documentElement.getAttribute("data-theme")), theme, `${label}: theme`);
        const tabs = page.getByRole("tablist", { name: "Home views" });
        assert.equal(await tabs.getByRole("tab", { selected: true }).innerText(), target.name === "home" ? "Home" : "Overview");
        tabsAt[target.name] = await tabs.boundingBox();
        const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
        assert.ok(overflow <= 0, `${label}: the page scrolls sideways by ${overflow}px`);
        // The page's own content; the shell around it has its own checks.
        const axe = await new AxeBuilder({ page }).include("[role=tabpanel]").analyze();
        assert.deepEqual(axe.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => node.target.join(" ")).slice(0, 3) })), [], `axe: ${label}`);
        await page.screenshot({ path: path.join(outDir, `${label}.png`) });
        await page.screenshot({ path: path.join(outDir, `${label}-full.png`), fullPage: true });
        checks += 4;
      }
      // The tabs do not move between the two pages.
      assert.deepEqual(
        [Math.round(tabsAt.home.x), Math.round(tabsAt.home.y), Math.round(tabsAt.home.height)],
        [Math.round(tabsAt.overview.x), Math.round(tabsAt.overview.y), Math.round(tabsAt.overview.height)],
        `${viewport}-${theme}: the tabs sit in the same place on both pages`,
      );
      // The sidebar lights Home for both tabs (the drawer is closed on a phone).
      if (viewport !== "phone" && viewport !== "tablet") {
        const current = await page.locator("nav a[aria-current='page']").allInnerTexts();
        assert.deepEqual(current.map((text) => text.trim()), ["Home"], `${viewport}-${theme}: Home is the lit row on the Overview tab`);
        checks += 1;
      }
      // By keyboard: Left from Overview opens Home, Right comes back.
      await page.getByRole("tab", { name: "Overview" }).focus();
      await page.keyboard.press("ArrowLeft");
      await page.waitForURL("**/app/home");
      await page.locator("[data-home-board]").waitFor();
      await page.getByRole("tab", { name: "Home" }).focus();
      await page.keyboard.press("ArrowRight");
      await page.waitForURL("**/app/home/briefing**");
      assert.deepEqual(errors, [], `${viewport}-${theme}: console`);
      checks += 3;
      await context.close();
    }
  }
  console.log(`PASS production build: ${checks} checks on Home and Overview at four sizes, dark and light; screenshots in ${outDir}`);
} finally {
  await browser.close();
}
