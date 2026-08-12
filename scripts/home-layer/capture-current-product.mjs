/**
 * Wave 0 current-product evidence capture for the Home operating layer programme.
 *
 * Captures, for every surface the Home layer will absorb or migrate:
 *   - a full-page screenshot at each required viewport
 *   - the ARIA/accessibility snapshot (structure, landmarks, headings, names)
 *   - a landmark/heading audit (duplicate main, missing h1, duplicate nav)
 *
 * Runs against the local review-mode server, which uses in-memory seed data and
 * never queries a real database. Read-only: it navigates and screenshots, nothing else.
 *
 * Usage: node scripts/home-layer/capture-current-product.mjs [--base http://localhost:3212]
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const baseArg = args.indexOf("--base");
const BASE = baseArg >= 0 ? args[baseArg + 1] : "http://localhost:3212";
const OUT = path.resolve("docs/projects/home-operating-layer/design/current-product-evidence");

const ROUTES = [
  ["home", "/app/home", "Today — the current authenticated front door"],
  ["home-briefing", "/app/home/briefing", "Full Briefing — progressive depth from Home"],
  ["inbox", "/app/inbox", "Legacy Inbox — Tasks-owned, four jobs in one surface"],
  ["my-tasks", "/app/my-tasks", "Legacy My Tasks / My Week — Tasks-only execution view"],
  ["your-work", "/app/your-work", "Planning administration — NOT personal work"],
  ["project", "/app/project", "Active-project overview — orphaned from shell nav"],
  ["notes", "/app/notes", "Product: Notes"],
  ["tasks", "/app/tasks", "Product: Tasks"],
  ["timeline", "/app/timeline", "Product: Timeline"],
  ["settings-profile", "/settings/profile", "Profile — identity and account only"],
];

const VIEWPORTS = [
  ["desktop-1440", 1440, 960],
  ["mobile-390", 390, 844],
  ["narrow-320", 320, 568],
];

/** Structural audit run inside the page. */
const AUDIT = () => {
  const sel = (q) => Array.from(document.querySelectorAll(q));
  const name = (el) =>
    el.getAttribute("aria-label") ||
    (el.getAttribute("aria-labelledby")
      ? document.getElementById(el.getAttribute("aria-labelledby"))?.textContent?.trim()
      : null) ||
    null;
  const heads = sel("h1,h2,h3,h4,h5,h6")
    .filter((h) => h.offsetParent !== null || h.getClientRects().length)
    .map((h) => ({ level: Number(h.tagName[1]), text: h.textContent.trim().slice(0, 80) }));
  const mains = sel("main, [role=main]");
  const navs = sel("nav, [role=navigation]").map((n) => ({
    name: name(n),
    links: n.querySelectorAll("a").length,
  }));
  const regions = sel("[role=region], section").map((r) => ({
    tag: r.tagName.toLowerCase(),
    name: name(r),
  }));
  const current = sel("[aria-current]").map((e) => ({
    value: e.getAttribute("aria-current"),
    text: e.textContent.trim().slice(0, 40),
    href: e.getAttribute("href"),
  }));
  // nested interactive controls inside a wrapping link — an automatic veto in the brief
  const nested = sel("a").filter((a) => a.querySelector("button, a, input, select, textarea")).length;
  return {
    title: document.title,
    mainCount: mains.length,
    h1Count: heads.filter((h) => h.level === 1).length,
    headings: heads,
    navigations: navs,
    unnamedRegions: regions.filter((r) => !r.name).length,
    regions,
    ariaCurrent: current,
    nestedInteractiveInsideLink: nested,
    horizontalOverflow:
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  };
};

const report = { base: BASE, capturedAt: new Date().toISOString(), routes: {} };

const browser = await chromium.launch();
try {
  for (const [vpName, width, height] of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width, height }, locale: "en-GB", timezoneId: "Europe/London" });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 200)));

    for (const [slug, route, note] of ROUTES) {
      const dir = path.join(OUT, vpName);
      await mkdir(dir, { recursive: true });
      const key = `${slug}@${vpName}`;
      try {
        const res = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(dir, `${slug}.png`), fullPage: true });
        const aria = await page.locator("body").ariaSnapshot();
        await writeFile(path.join(dir, `${slug}.aria.txt`), aria, "utf8");
        const audit = await page.evaluate(AUDIT);
        report.routes[key] = {
          route, note, viewport: `${width}x${height}`,
          status: res?.status() ?? null,
          finalUrl: page.url().replace(BASE, ""),
          ...audit,
          consoleErrors: consoleErrors.splice(0),
        };
        console.log(
          `${key.padEnd(34)} ${res?.status()}  main=${audit.mainCount} h1=${audit.h1Count} ` +
          `navs=${audit.navigations.length} overflow=${audit.horizontalOverflow}`
        );
      } catch (err) {
        report.routes[key] = { route, note, error: String(err).slice(0, 300) };
        console.log(`${key.padEnd(34)} ERROR ${String(err).slice(0, 90)}`);
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, "structural-audit.json"), JSON.stringify(report, null, 2), "utf8");
console.log(`\nWrote ${Object.keys(report.routes).length} route captures to ${OUT}`);
