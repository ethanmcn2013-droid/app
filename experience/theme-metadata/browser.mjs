/**
 * Manual rendered regression for the App/Next theme-color ownership boundary.
 * Start an owned credential-free Next review server separately, then run:
 * THEME_REGRESSION_URL=http://127.0.0.1:<port> THEME_REGRESSION_OUT=<absolute-dir>
 *   node experience/theme-metadata/browser.mjs
 *
 * Next owns ordinary viewport metadata. The runtime owns only the separate
 * name=theme-color/property=signal:app-theme resource, including when both
 * colors are equal. React's meta hydration identity includes `property`.
 * Real React unmount instrumentation must never identify the private node
 * as the viewport resource. No source fixtures, auth providers or product writes.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium, expect } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const base = new URL(process.env.THEME_REGRESSION_URL ?? "");
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname), "an owned loopback review server is required");
const out = process.env.THEME_REGRESSION_OUT;
assert.ok(out && path.isAbsolute(out), "THEME_REGRESSION_OUT must be an explicit absolute evidence directory");
await fs.mkdir(out, { recursive: true });
const selector = 'meta[name="theme-color"][property="signal:app-theme"][data-app-theme]';
const files = ["src/lib/app-theme-bootstrap.ts", "src/app/app/theme-bootstrap.tsx", "src/app/app/theme-resolver.test.ts", "experience/theme-metadata/browser.mjs"];
const hashes = async () => Object.fromEntries(await Promise.all(files.map(async file => [file, createHash("sha256").update(await fs.readFile(path.join(root, file))).digest("hex")])));
const receipt = {
  source: root, HEAD: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  startedAt: new Date().toISOString(), hashes: await hashes(),
  scope: "Actual local Next review routes. Disposable Chromium. Browser theme-color metadata, not physical browser-bar appearance. No production acceptance.",
  cases: [],
};
const persist = () => fs.writeFile(path.join(out, "theme-metadata-browser.json"), JSON.stringify(receipt, null, 2));
const browser = await chromium.launch({ headless: true, args: ["--disable-extensions"] });
try {
  receipt.browserVersion = browser.version();
  for (const choice of ["dark", "light"]) {
    const result = { choice, snapshots: [], pageErrors: [], consoleErrors: [], HTTP: [], requestFailures: [], blockedExternal: [] };
    receipt.cases.push(result);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 }, reducedMotion: "reduce",
      storageState: { cookies: [], origins: [{ origin: base.origin, localStorage: [{ name: "signal:theme-mode", value: choice }] }] },
    });
    await context.route("**/*", route => {
      if (new URL(route.request().url()).origin === base.origin) return route.continue();
      result.blockedExternal.push(route.request().url());
      return route.abort("blockedbyclient");
    });
    await context.addInitScript(() => {
      const snapshot = node => node ? ({ name: node.getAttribute("name"), property: node.getAttribute("property"), content: node.getAttribute("content"), connected: node.isConnected, html: node.outerHTML }) : null;
      window.__themeOwnershipProbe = { documentId: crypto.randomUUID(), unmounts: [], firstPaint: [] };
      const probe = window.__themeOwnershipProbe;
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) probe.firstPaint.push({ name: entry.name, theme: document.documentElement.getAttribute("data-theme"), firstBar: snapshot(document.querySelector('meta[name="theme-color"]')) });
      });
      observer.observe({ type: "paint", buffered: true });
      // This is test instrumentation only, installed before React/Refresh.
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        supportsFiber: true, renderers: new Map(),
        inject(renderer) { const id = this.renderers.size + 1; this.renderers.set(id, renderer); return id; },
        onCommitFiberRoot() {}, onPostCommitFiberRoot() {},
        onCommitFiberUnmount(_rendererId, fiber) {
          if (fiber.tag === 26 && fiber.memoizedProps?.name === "theme-color") {
            probe.unmounts.push({ props: fiber.memoizedProps, node: snapshot(fiber.stateNode) });
          }
        },
      };
    });
    const page = await context.newPage();
    page.on("pageerror", error => result.pageErrors.push({ message: error.message, stack: error.stack }));
    page.on("console", message => { if (message.type() === "error") result.consoleErrors.push(message.text()); });
    page.on("response", response => { if (response.status() >= 400) result.HTTP.push({ url: response.url(), status: response.status() }); });
    page.on("requestfailed", request => result.requestFailures.push({ url: request.url(), error: request.failure()?.errorText, method: request.method(), prefetch: request.headers()["next-router-prefetch"] ?? null }));
    try {
      const color = selected => selected === "light" ? "#ffffff" : "#1c1c1c";
      async function appSnapshot(label, selected = choice) {
        await expect(page.locator("html")).toHaveAttribute("data-theme", selected);
        await expect(page.locator(selector)).toHaveCount(1);
        await expect(page.locator('meta[name="theme-color"]:not([property])')).toHaveCount(1);
        const value = await page.evaluate(privateSelector => {
          const owned = document.querySelector(privateSelector);
          const viewport = [...document.querySelectorAll('meta[name="theme-color"]')].filter(node => !node.hasAttribute("property"));
          return { documentId: window.__themeOwnershipProbe.documentId, theme: document.documentElement.getAttribute("data-theme"), owned: { content: owned?.getAttribute("content"), connected: owned?.isConnected }, viewport: viewport.map(node => ({ content: node.getAttribute("content"), connected: node.isConnected })), firstIsPrivate: document.querySelector('meta[name="theme-color"]') === owned, independent: !viewport.includes(owned) };
        }, selector);
        assert.equal(value.owned.content, color(selected));
        assert.equal(value.owned.connected, true); assert.equal(value.firstIsPrivate, true); assert.equal(value.independent, true);
        assert.deepEqual(value.viewport, [{ content: "#1c1c1c", connected: true }]);
        if (result.documentId) assert.equal(value.documentId, result.documentId, "navigation must preserve the document");
        else result.documentId = value.documentId;
        result.snapshots.push({ label, ...value });
      }
      await page.goto(new URL("/app/files", base).href, { waitUntil: "networkidle", timeout: 120_000 });
      await appSnapshot("initial Files");
      await expect.poll(() => page.evaluate(() => window.__themeOwnershipProbe.firstPaint.length)).toBeGreaterThan(0);
      result.firstPaint = await page.evaluate(() => window.__themeOwnershipProbe.firstPaint);
      assert.equal(result.firstPaint[0].theme, choice, "the first painted App theme must honor this browser's choice");
      assert.equal(result.firstPaint[0].firstBar?.content, color(choice));

      // Chat links intentionally open an overlay without changing the URL.
      // Use ordinary page links to exercise actual router metadata deletion.
      for (const [href, label] of [["/app/analytics", "soft Analytics"], ["/app/files", "soft Files"], ["/app/tasks", "soft Tasks"]]) {
        await page.locator(`a[href="${href}"]`).first().click();
        await expect(page).toHaveURL(new URL(href, base).href, { timeout: 60_000 });
        await page.waitForLoadState("networkidle");
        await appSnapshot(label);
      }

      // The unit suite executes the actual account-correction function. This
      // browser seam tests its attribute/storage/event contract without auth
      // or a persistent preference write to the product backend.
      for (const selected of [choice === "dark" ? "light" : "dark", choice]) {
        await page.evaluate(value => {
          document.documentElement.setAttribute("data-theme-mode", value);
          localStorage.setItem("signal:theme-mode", value);
          window.dispatchEvent(new Event("signal:theme"));
        }, selected);
        await appSnapshot("simulated account correction " + selected, selected);
      }
      await page.screenshot({ path: path.join(out, `theme-${choice}-app.png`) });

      // Next exposes this public AppRouter instance for dev tools; push uses
      // the real router. No synthetic link/component replaces the App tree.
      // There is no existing App-to-marketing UI link in this shell.
      await page.evaluate(() => window.next.router.push("/"));
      await expect(page).toHaveURL(new URL("/", base).href, { timeout: 60_000 });
      await expect(page.getByRole("link", { name: "Demo workspace", exact: true })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(page.locator(selector)).toHaveCount(0);
      const departed = await page.evaluate(() => ({ documentId: window.__themeOwnershipProbe.documentId, theme: document.documentElement.getAttribute("data-theme"), runtime: !!window.__signalAppThemeRuntime, metas: [...document.querySelectorAll('meta[name="theme-color"]')].map(node => ({ content: node.getAttribute("content"), property: node.getAttribute("property"), connected: node.isConnected })) }));
      assert.equal(departed.documentId, result.documentId); assert.equal(departed.theme, null); assert.equal(departed.runtime, false);
      assert.deepEqual(departed.metas, [{ content: "#ffffff", property: null, connected: true }]);
      result.snapshots.push({ label: "marketing after actual App disposal", ...departed });
      await page.getByRole("link", { name: "Demo workspace", exact: true }).click();
      await expect(page).toHaveURL(new URL("/app/tasks", base).href, { timeout: 60_000 });
      await page.waitForLoadState("networkidle");
      await appSnapshot("soft return to App");
      result.reactUnmounts = await page.evaluate(() => window.__themeOwnershipProbe.unmounts);
      assert.ok(result.reactUnmounts.length > 0, "real React metadata deletion must be exercised");
      for (const event of result.reactUnmounts) {
        assert.notEqual(event.node?.property, "signal:app-theme", "React must not adopt the private App bar node");
        assert.equal(event.node?.connected, true, "the viewport node remains attached until React deletes it");
      }
      assert.deepEqual(result.pageErrors, []); assert.deepEqual(result.consoleErrors, []); assert.deepEqual(result.HTTP, []); assert.deepEqual(result.blockedExternal, []);
      result.status = "PASS";
    } catch (error) { result.status = "FAIL"; result.failure = error.stack; }
    finally {
      result.finalURL = page.url();
      result.finalDOM = await page.evaluate(() => ({
        metas: [...document.querySelectorAll('meta[name="theme-color"]')].map(node => ({ html: node.outerHTML, connected: node.isConnected })),
        unmounts: window.__themeOwnershipProbe?.unmounts ?? [],
      })).catch(error => ({ unavailable: error.message }));
      await context.close(); await persist();
    }
  }
} finally {
  await browser.close(); receipt.completedAt = new Date().toISOString(); receipt.endHashes = await hashes();
  receipt.sourceStable = JSON.stringify(receipt.hashes) === JSON.stringify(receipt.endHashes);
  await persist();
}
console.log(JSON.stringify({ cases: receipt.cases.map(test => ({ choice: test.choice, status: test.status, failure: test.failure })), sourceStable: receipt.sourceStable }));
if (!receipt.sourceStable || receipt.cases.some(test => test.status !== "PASS")) process.exitCode = 1;
