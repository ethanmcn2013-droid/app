import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve("tsx/package.json"))("esbuild");
const postcss = createRequire(require.resolve("@tailwindcss/postcss"))("postcss");
const { chromium } = require("@playwright/test");
const ts = require("typescript");
const baseline = process.argv.includes("--baseline");
const baselineRef = "cbf40af93907a07dde82f2e8036ce84a72a92d88";
const component = "src/components/settings/profile/data-privacy.tsx";
const out = path.resolve(process.env.PROFILE_EXPORT_OUTPUT ?? path.join(root, "experience/output/event-account-export", baseline ? "before" : "after"));
await fs.mkdir(out, { recursive: true });
assert.equal(await fs.access(path.join(out, "receipt.json")).then(() => true, () => false), false, "Use a fresh output directory");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const source = async file => baseline && file === component
  ? execFileSync("git", ["show", `${baselineRef}:${file}`], { cwd: root, encoding: "utf8" })
  : fs.readFile(path.join(root, file), "utf8");
const receipt = {
  status: "running", baseline, componentRef: baseline ? baselineRef : "working-tree",
  head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  command: process.argv, cwd: root, pid: process.pid, sourceInputs: {}, cases: [],
  limits: ["Actual DataPrivacy and SettingsSection, React, App global CSS and local fonts in Chromium.",
    "Component fixture at /settings/profile, not the complete Next/Flight/Clerk profile route or other profile controls.",
    "Actual HTTP handler and unified Tasks SQLite export; Clerk/NextResponse and unavailable Notes/Timeline/Briefing module callbacks are explicit request adapters.",
    "A real local checkout intent is prepared; no provider call, positive grant or content-denial adapter.",
    "Baseline replaces only DataPrivacy with immutable cbf40 source; its next/link is an anchor adapter. Other fixture inputs remain current.",
    "Chromium mobile emulation and keyboard automation, not physical-device/human acceptance. JSON does not contain provider bytes."],
};
let browser, server, fixture, gateError;
const originalFetch = globalThis.fetch;
try {
  process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
  process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
  globalThis.fetch = async () => { throw Error("Provider/network fetch is outside this local export fixture"); };
  const { entitlementFixture } = await import("../../src/server/db/entitlements-test-db.ts");
  const { prepareEventCheckoutWith } = await import("../../src/server/db/event-designation.ts");
  const { exportUnifiedAccountDataWith } = await import("../../src/server/account-unified-export.ts");
  fixture = await entitlementFixture();
  const intentId = await prepareEventCheckoutWith(fixture.local.db, { actorUserId: "buyer", workspaceId: "project-a" });
  class FixtureResponse extends Response {
    static json(value, init) { return new FixtureResponse(JSON.stringify(value), init); }
  }
  const routeSource = await source("src/app/api/account/export/route.ts");
  const compiled = ts.transpileModule(routeSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const loaded = { exports: {} };
  const adapters = {
    "@clerk/nextjs/server": { auth: async () => ({ userId: "buyer" }) },
    "next/server": { NextResponse: FixtureResponse },
    "@/server/account": { exportAccountForUser: actor => exportUnifiedAccountDataWith(fixture.local.db, actor, {
      exportNotes: async () => ({ available: false, reason: "local fixture" }),
      exportTimeline: async () => ({ available: false, reason: "local fixture" }),
      exportSignal: async () => ({ available: false, reason: "local fixture" }),
    }) },
  };
  new Function("require", "module", "exports", compiled)(name => {
    assert.ok(Object.hasOwn(adapters, name), `Unexpected route dependency: ${name}`);
    return adapters[name];
  }, loaded, loaded.exports);

  const built = await esbuild.build({
    absWorkingDir: root, bundle: true, metafile: true, platform: "browser", jsx: "automatic", write: false,
    define: { "process.env.NODE_ENV": '"production"' },
    stdin: { loader: "tsx", resolveDir: root, contents: `import React from 'react';import {createRoot} from 'react-dom/client';
import {DataPrivacy} from './${component}';import {SettingsSection} from './src/components/settings/section';
createRoot(document.getElementById('root')).render(<main style={{maxWidth:800,margin:'0 auto',padding:'32px 24px'}}><SettingsSection title="Profile"><DataPrivacy/></SettingsSection></main>);` },
    plugins: [{ name: "immutable-profile-baseline", setup(build) {
      build.onResolve({ filter: /^next\/link$/ }, () => ({ path: "next/link", namespace: "fixture" }));
      build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: 'import React from "react";export default function Link(props){return <a {...props}/>}', loader: "jsx", resolveDir: root }));
      build.onLoad({ filter: /[\\/]profile[\\/]data-privacy\.tsx$/ }, async () => ({ contents: await source(component), loader: "tsx", resolveDir: path.join(root, "src/components/settings/profile") }));
    } }],
  });
  const css = await postcss([require("@tailwindcss/postcss")({ base: root })]).process(await source("src/app/globals.css"), { from: path.join(root, "src/app/globals.css") });
  const assets = { "/bundle.js": built.outputFiles[0].contents, "/app.css": css.css };
  for (const font of ["Geist", "GeistMono"]) assets[`/${font}.woff2`] = await fs.readFile(path.join(root, `docs/design/labs/tasks-2026-08/fonts/${font}.woff2`));
  const inputs = new Set([...Object.keys(built.metafile.inputs).filter(file => file.startsWith("src/")),
    "src/app/globals.css", "src/server/account-export.ts", "src/server/account-unified-export.ts", "src/app/api/account/export/route.ts", "src/server/db/event-designation.ts",
    "src/app/settings/layout.tsx", "src/app/settings/profile/page.tsx", "src/components/settings/profile/profile-panel.tsx"]);
  for (const file of inputs) receipt.sourceInputs[file] = hash((await source(file)).replace(/\r\n/g, "\n"));
  receipt.styleDependencies = {};
  for (const dependency of css.messages) if (dependency.type === "dependency" && dependency.file) receipt.styleDependencies[path.relative(root, dependency.file)] = hash(await fs.readFile(dependency.file));
  for (const [url, body] of Object.entries(assets)) await fs.writeFile(path.join(out, path.basename(url)), body);
  const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>@font-face{font-family:Geist;src:url('/Geist.woff2');font-weight:100 900}@font-face{font-family:'Geist Mono';src:url('/GeistMono.woff2');font-weight:100 900}:root{--font-geist-sans:Geist;--font-geist-mono:'Geist Mono'}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`;
  const apiRequests = [];
  let abortExportConnection = false;
  server = createServer(async (request, response) => {
    try {
      if (request.url === "/api/account/export" && request.method === "GET") {
        if (abortExportConnection) {
          apiRequests.push({ path: request.url, failure: "fixture connection abort before export" });
          response.destroy();
          return;
        }
        const result = await loaded.exports.GET();
        apiRequests.push({ path: request.url, status: result.status, cacheControl: result.headers.get("Cache-Control") });
        response.writeHead(result.status, Object.fromEntries(result.headers.entries()));
        response.end(await result.text());
      } else if (request.url === "/settings/profile") {
        response.writeHead(200, { "Content-Type": "text/html" }); response.end(html);
      } else if (Object.hasOwn(assets, request.url)) {
        response.writeHead(200, { "Content-Type": request.url.endsWith(".js") ? "text/javascript" : request.url.endsWith(".css") ? "text/css" : "font/woff2" });
        response.end(assets[request.url]);
      } else { response.writeHead(request.url === "/favicon.ico" ? 204 : 404); response.end(); }
    } catch (error) { response.writeHead(500); response.end("Local fixture failed"); gateError ??= error; }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  receipt.origin = origin;
  assert.equal((await originalFetch(`${origin}/settings/profile`)).status, 200);
  browser = await chromium.launch({ headless: true });
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 960 }]) for (const theme of ["light", "dark"]) {
    const result = { viewport, theme, failures: [] };
    receipt.cases.push(result);
    const page = await browser.newPage({ viewport, colorScheme: theme, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("requestfailed", request => errors.push(`Failed request: ${request.url()}`));
    await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    try {
      const before = apiRequests.length;
      await page.goto(`${origin}/settings/profile`);
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      await page.getByRole("heading", { name: "Data and privacy", exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      const name = `${viewport.width}-${theme}`;
      await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
      assert.equal(apiRequests.length, before, "Rendering must not prefetch an account download");
      const link = page.getByRole("link", { name: "Download account JSON", exact: true });
      assert.equal(await link.count(), 1, "Profile must expose the direct account JSON download");
      assert.equal(await link.getAttribute("href"), "/api/account/export");
      assert.notEqual(await link.getAttribute("download"), null);
      assert.match(await page.locator("main").innerText(), /file contents are not included/);
      result.rectangle = await link.boundingBox();
      assert.ok(result.rectangle.height >= 44);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.keyboard.press("Tab");
      assert.equal(await link.evaluate(element => element === document.activeElement), true);
      result.focus = await link.evaluate(element => ({ visible: element.matches(":focus-visible"), outline: getComputedStyle(element).outlineWidth }));
      assert.equal(result.focus.visible, true); assert.equal(result.focus.outline, "2px");
      await page.screenshot({ path: path.join(out, `${name}-keyboard.png`), fullPage: true });
      const pendingDownload = page.waitForEvent("download");
      await page.keyboard.press("Enter");
      const download = await pendingDownload;
      const destination = path.join(out, `${name}-account.json`);
      await download.saveAs(destination);
      assert.equal(await download.failure(), null);
      assert.match(download.suggestedFilename(), /^signal-export-buyer-.*\.json$/);
      const account = JSON.parse(await fs.readFile(destination, "utf8"));
      assert.equal(account.tasks.eventPurchases[0].id, intentId);
      assert.equal(account.tasks.eventPurchases[0].designation, "pending");
      assert.equal(account.notes.available, false);
      assert.equal(apiRequests.length, before + 1);
      assert.deepEqual(apiRequests.at(-1), { path: "/api/account/export", status: 200, cacheControl: "private, no-store" });
      assert.equal(page.url(), `${origin}/settings/profile`, "Download must keep the profile available");
      result.download = { filename: download.suggestedFilename(), sha256: hash(await fs.readFile(destination)), status: 200 };
      assert.deepEqual(errors, []);
    } catch (error) { result.failures.push(error.message); gateError ??= error; }
    finally { result.errors = errors; await page.close(); }
  }
  // Native downloads bypassed page.route in the retained original probe. Abort
  // the local HTTP connection itself so this control proves an actual transport
  // failure. A host read failure separately runs the real handler's generic 500.
  if (!baseline) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/settings/profile`);
    const link = page.getByRole("link", { name: "Download account JSON", exact: true });
    await link.waitFor();
    let retryIntentId;
    for (const failure of ["host-http500", "network-abort"]) {
      const result = { failure, failures: [] };
      receipt.cases.push(result);
      if (failure === "host-http500") await fixture.local.client.execute("DROP TABLE event_purchase_designations");
      else abortExportConnection = true;
      try {
        const before = apiRequests.length;
        const pending = page.waitForEvent("download");
        await link.click();
        const download = await pending;
        result.downloadFailure = await download.failure();
        assert.ok(result.downloadFailure, "Host/transport failure must not become a successful file download");
        await assert.rejects(download.path(), "A failed export must not expose a completed download file");
        const requests = apiRequests.slice(before);
        assert.ok(requests.length >= 1);
        if (failure === "host-http500") assert.deepEqual(requests, [{ path: "/api/account/export", status: 500, cacheControl: "private, no-store" }]);
        else assert.ok(requests.every(request => request.failure === "fixture connection abort before export"));
        assert.equal(page.url(), `${origin}/settings/profile`);
        assert.equal(await link.isVisible(), true);
        result.visibleText = await page.locator("main").innerText();
        result.inlineError = await page.getByRole("alert").count();
        await page.screenshot({ path: path.join(out, `${failure}.png`), fullPage: true });
      } catch (error) { result.failures.push(error.message); gateError ??= error; }
      finally { abortExportConnection = false; }

      // Restore only the disposable host store, then retry from the same page.
      // No UI reload, successful-output seeding or provider operation is used.
      if (failure === "host-http500") {
        fixture.close();
        fixture = await entitlementFixture();
        retryIntentId = await prepareEventCheckoutWith(fixture.local.db, { actorUserId: "buyer", workspaceId: "project-a" });
      }
      const retry = { retryAfter: failure, failures: [] };
      receipt.cases.push(retry);
      try {
        const pending = page.waitForEvent("download");
        await link.click();
        const download = await pending;
        assert.equal(await download.failure(), null);
        const destination = path.join(out, `${failure}-retry-account.json`);
        await download.saveAs(destination);
        const account = JSON.parse(await fs.readFile(destination, "utf8"));
        assert.equal(account.tasks.eventPurchases[0].id, retryIntentId);
        assert.equal(account.tasks.eventPurchases[0].designation, "pending");
        assert.equal(account.notes.available, false, "Successful partial-module JSON must retain its unavailable status");
        assert.deepEqual(apiRequests.at(-1), { path: "/api/account/export", status: 200, cacheControl: "private, no-store" });
        assert.equal(page.url(), `${origin}/settings/profile`);
        retry.download = { filename: download.suggestedFilename(), sha256: hash(await fs.readFile(destination)), status: 200 };
      } catch (error) { retry.failures.push(error.message); gateError ??= error; }
    }
    await page.close();
  }
  receipt.apiRequests = apiRequests;
  if (gateError) throw gateError;
  receipt.status = "passed";
} catch (error) { receipt.status = "failed"; receipt.error = error.stack; process.exitCode = 1; }
finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  fixture?.close();
  globalThis.fetch = originalFetch;
  receipt.closedAt = new Date().toISOString();
  await fs.writeFile(path.join(out, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify({ status: receipt.status, cases: receipt.cases.length, failures: receipt.cases.flatMap(item => item.failures), output: out }, null, 2));
}
