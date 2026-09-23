import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { recoveryFixture, root } from "./fixture.mjs";

const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve("tsx/package.json"))("esbuild");
const postcss = createRequire(require.resolve("@tailwindcss/postcss"))("postcss");
const { chromium } = require("@playwright/test");
const baseline = process.argv.includes("--baseline");
const baselineRef = "3f276ebd495c23cd5680cfe2e6ad9d13e23f32ba";
const component = "src/components/settings/project-recovery.tsx";
const componentSource = baseline ? execFileSync("git", ["show", baselineRef + ":" + component], { cwd: root, encoding: "utf8" }) : await fs.readFile(path.join(root, component), "utf8");
const out = path.resolve(process.env.PROJECT_RECOVERY_OUTPUT ?? path.join(root, "experience/output/project-recovery", new Date().toISOString().replaceAll(/[:.]/g, "-")));
await fs.mkdir(out, { recursive: true });
assert.equal(await fs.access(path.join(out, "receipt.json")).then(() => true, () => false), false, "Fresh evidence directory required");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const receipt = { status: "running", baseline, componentRef: baseline ? baselineRef : "working-tree", head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  dirty: execFileSync("git", ["status", "--short"], { cwd: root, encoding: "utf8" }), command: process.argv, cwd: root,
  sourceInputs: {}, cases: [], limits: [
    "Actual ProjectRecoveryPanel/DataPrivacy, App styles/fonts and React in Chromium. Actual RSC page, server action, controller and local SQLite writers run through explicit Clerk/Next/router/request adapters.",
    "Synthetic existing link/publication inputs; no claim of publication creation, provider bytes, full Next/Clerk admission, human comprehension or receiving acceptance.",
    "Browser request adapter is fixture-only; no production auth bypass or route. Local owner/member/outage and negative-write readback are exercised.",
    "Native/account downloads retain their existing behavior; this browser gate does not certify account export or provider lifecycle.",
    "English App labels use localized en-GB long dates with explicit UTC, invariant under browser locale/host zone. This is not multilingual product support or proof of matching an external URL.",
  ] };
let browser, server, f;
try {
  const publicationId = i => i >= 23 ? "publication-" + "A".repeat(65) + "-" + i : "publication-" + i;
  f = await recoveryFixture({ links: 25, publications: 25, publicationId });
  const sameTime = new Date("2027-09-30T08:05:09Z");
  const publicationIds = new Map();
  for (let i = 0; i < 25; i++) {
    const createdAt = i >= 23 ? sameTime : new Date(sameTime.getTime() - (25 - i) * 1000);
    // Existing fixture inputs, not successful output or new projection fields.
    await f.local.db.update(f.schema.shareLinks).set({ createdAt }).where(eq(f.schema.shareLinks.token, "SECRET_B_" + i));
    const id = publicationId(i);
    publicationIds.set(i, id);
    await f.timeline.update(f.timelineSchema.timelinePublications).set({ createdAt }).where(eq(f.timelineSchema.timelinePublications.id, id));
  }
  const initial = (await f.pageProps()).recovery;
  const entry = [
    "import React,{useState} from 'react';import {createRoot} from 'react-dom/client';",
    "import {ProjectRecoveryPanel} from './src/components/settings/project-recovery.tsx';",
    "function Fixture(){const [props,setProps]=useState(null);window.recoveryRefresh=async()=>{const data=await fetch('/fixture/data'+location.search,{cache:'no-store'}).then(r=>r.json());setProps(data)};",
    "React.useEffect(()=>{window.recoveryRefresh()},[]);return props?<main style={{maxWidth:800,margin:'0 auto',padding:'32px 24px'}}><ProjectRecoveryPanel key={props.identity} {...props} action={async form=>fetch('/fixture/action',{method:'POST',body:new URLSearchParams(form)}).then(r=>r.json())}/></main>:null}",
    "createRoot(document.getElementById('root')).render(<Fixture/>);",
  ].join("\n");
  const build = await esbuild.build({
    absWorkingDir: root, bundle: true, metafile: true, platform: "browser", jsx: "automatic", write: false,
    define: { "process.env.NODE_ENV": '"production"' },
    stdin: { loader: "tsx", resolveDir: root, contents: entry },
    plugins: [{ name: "explicit-framework-adapters", setup(build) {
      build.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "fixture" }));
      build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export function useRouter(){return {refresh(){window.recoveryRefresh()}}}", loader: "js" }));
      build.onLoad({ filter: /[\\/]settings[\\/]project-recovery\.tsx$/ }, () => ({ contents: componentSource, loader: "tsx", resolveDir: path.join(root, "src/components/settings") }));
    } }],
  });
  const css = await postcss([require("@tailwindcss/postcss")({ base: root })]).process(await fs.readFile(path.join(root, "src/app/globals.css"), "utf8"), { from: path.join(root, "src/app/globals.css") });
  const assets = { "/bundle.js": build.outputFiles[0].contents, "/app.css": css.css };
  for (const font of ["Geist", "GeistMono"]) assets["/" + font + ".woff2"] = await fs.readFile(path.join(root, "docs/design/labs/tasks-2026-08/fonts", font + ".woff2"));
  const sources = new Set([...Object.keys(build.metafile.inputs).filter(file => file.startsWith("src/")),
    "src/server/project-recovery.ts", "src/server/project-recovery-core.ts", "src/server/projects/recovery.ts",
    "src/lib/projects/recovery-lock-retry.ts", "src/server/projects/service.ts",
    "src/modules/timeline/server/project-recovery.ts", "src/modules/timeline/server/audience-revocation.ts",
    "src/app/settings/projects/[projectId]/recovery/actions.ts", "src/app/settings/projects/[projectId]/recovery/page.tsx",
    "src/app/settings/layout.tsx", "src/app/globals.css", "experience/project-recovery/fixture.mjs", "experience/project-recovery/browser.mjs",
  ]);
  for (const file of sources) receipt.sourceInputs[file] = hash((file === component ? componentSource : await fs.readFile(path.join(root, file), "utf8")).replaceAll("\r\n", "\n"));
  receipt.styleDependencies = {};
  for (const input of css.messages) if (input.type === "dependency" && input.file) receipt.styleDependencies[path.relative(root, input.file)] = hash(await fs.readFile(input.file));
  for (const [url, body] of Object.entries(assets)) await fs.writeFile(path.join(out, path.basename(url)), body);
  const html = '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>@font-face{font-family:Geist;src:url("/Geist.woff2");font-weight:100 900}@font-face{font-family:"Geist Mono";src:url("/GeistMono.woff2");font-weight:100 900}:root{--font-geist-sans:Geist;--font-geist-mono:"Geist Mono"}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>';
  const httpErrors = [];
  server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://fixture.invalid");
      if (url.pathname === "/fixture/data") {
        const props = await f.pageProps("project-b", Object.fromEntries(url.searchParams.entries()));
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "private, no-store" });
        res.end(JSON.stringify({ ...props, identity: f.state.actor + ":project-b" }));
      } else if (url.pathname === "/fixture/action" && req.method === "POST") {
        let body = ""; for await (const chunk of req) body += chunk;
        const form = new FormData(); for (const [key, value] of new URLSearchParams(body)) form.set(key, value);
        const result = await f.action(form);
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "private, no-store" }); res.end(JSON.stringify(result));
      } else if (url.pathname === "/settings/projects/project-b/recovery") { res.writeHead(200, { "Content-Type": "text/html" }); res.end(html); }
      else if (Object.hasOwn(assets, url.pathname)) {
        res.writeHead(200, { "Content-Type": url.pathname.endsWith(".js") ? "text/javascript" : url.pathname.endsWith(".css") ? "text/css" : "font/woff2" }); res.end(assets[url.pathname]);
      } else { res.writeHead(url.pathname === "/favicon.ico" ? 204 : 404); res.end(); }
    } catch (error) { httpErrors.push(error.stack); res.writeHead(500); res.end("Fixture failed"); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  receipt.origin = origin; receipt.pid = process.pid;
  browser = await chromium.launch({ headless: true });
  const errors = [];
  async function open(viewport, theme = "light") {
    const page = await browser.newPage({ viewport, colorScheme: theme, reducedMotion: "reduce", locale: theme === "light" ? "de-DE" : "en-GB", timezoneId: "Asia/Tokyo" });
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("requestfailed", request => errors.push(request.url()));
    await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(origin + "/settings/projects/project-b/recovery");
    await page.getByRole("heading", { name: "Project recovery", exact: true }).waitFor();
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    await page.evaluate(() => document.fonts.ready);
    return page;
  }
  async function capture(page, name) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    assert.doesNotMatch(await page.locator("body").innerText(), /SECRET_|PRIVATE_|project-a/);
    await page.screenshot({ path: path.join(out, name + ".png"), fullPage: true });
    await page.screenshot({ path: path.join(out, name + "-viewport.png"), fullPage: false });
    await fs.writeFile(path.join(out, name + ".html"), await page.content());
    receipt.cases.push({ name, viewport: page.viewportSize(), passed: true });
  }
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 960 }]) for (const theme of ["light", "dark"]) {
    const page = await open(viewport, theme);
    if (baseline) {
      await page.screenshot({ path: path.join(out, "original-same-time-390.png") });
      await fs.writeFile(path.join(out, "original-same-time.html"), await page.content());
    }
    assert.equal(await page.getByRole("button", { name: /^Revoke link, / }).count(), 20);
    assert.equal(await page.getByRole("button", { name: /^Revoke publication links, / }).count(), 20);
    assert.equal(await page.getByRole("link", { name: "Account settings and deletion" }).getAttribute("href"), "/settings/profile");
    assert.equal(await page.getByRole("button", { name: "Delete project", exact: true }).isDisabled(), true);
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.textContent), "Unpublish board");
    await capture(page, "owner-" + viewport.width + "-" + theme);
    await page.close();
  }
  for (const [index, viewport] of [{ width: 390, height: 844 }, { width: 1440, height: 960 }].entries()) {
    const page = await open(viewport);
    async function recordRows(kind) {
      return page.getByRole("listitem", { name: new RegExp("^" + kind + " reference ") }).evaluateAll(rows => rows.map(row => ({
        reference: row.querySelector("bdi").textContent, time: row.querySelector("time").textContent,
        dateTime: row.querySelector("time").dateTime, label: row.getAttribute("aria-label"),
        actions: [...row.querySelectorAll("button")].map(button => button.getAttribute("aria-label")),
        fits: row.scrollWidth <= row.clientWidth + 1 && [...row.querySelectorAll("button")].every(button => button.getBoundingClientRect().right <= row.getBoundingClientRect().right + 1),
      })));
    }
    const firstLinks = await recordRows("Link"), firstPublications = await recordRows("Publication");
    for (const [kind, rows] of [["Link", firstLinks], ["Publication", firstPublications]]) {
      assert.equal(rows.length, 20);
      assert.equal(new Set(rows.map(row => row.reference)).size, 20);
      assert.equal(rows[0].time, rows[1].time, "same-time control must not invent differing timestamps");
      assert.notEqual(rows[1].time, rows[2].time, "same-day different seconds must stay visible");
      assert.equal(rows[0].time, "30 September 2027 at 08:05:09 UTC");
      assert.notEqual(rows[0].reference, rows[1].reference);
      for (const row of rows) {
        assert.ok(row.fits, "long reference/date and controls must wrap inside the row");
        assert.equal(row.label, kind + " reference " + row.reference);
        assert.ok(row.actions.every(name => name.includes(row.reference) && name.includes(row.time)));
      }
      assert.equal(new Set(rows.flatMap(row => row.actions)).size, rows.flatMap(row => row.actions).length);
    }
    assert.equal(firstPublications[0].reference.length, 80, "full long reference must not be truncated");
    const expectedLink = initial.tasks.links.items[index];
    await page.keyboard.press("Tab"); // board control
    await page.keyboard.press("Tab"); // first enabled link; prior viewport's revoked link is disabled
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "Revoke link, Link reference " + expectedLink.fingerprint + ", 30 September 2027 at 08:05:09 UTC");
    await page.keyboard.press("Enter");
    await page.getByRole("listitem", { name: "Link reference " + expectedLink.fingerprint, exact: true }).getByRole("button").waitFor({ state: "visible" });
    await page.waitForFunction(reference => [...document.querySelectorAll("li")].some(row => row.getAttribute("aria-label") === "Link reference " + reference && row.textContent.includes("revoked")), expectedLink.fingerprint);
    assert.equal(f.state.submitted.at(-1).fingerprint, expectedLink.fingerprint);
    const expectedPublication = publicationIds.get(24 - index);
    const pubRow = page.getByRole("listitem", { name: "Publication reference " + expectedPublication, exact: true });
    await pubRow.getByRole("button", { name: /^Revoke publication links, / }).focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "Unpublish Timeline, Publication reference " + expectedPublication + ", 30 September 2027 at 08:05:09 UTC");
    await page.keyboard.press("Enter");
    await page.waitForFunction(reference => [...document.querySelectorAll("li")].some(row => row.getAttribute("aria-label") === "Publication reference " + reference && row.textContent.includes("unpublished")), expectedPublication);
    assert.equal(f.state.submitted.at(-1).publicationId, expectedPublication);
    assert.equal((await f.timeline.select().from(f.timelineSchema.timelinePublications).where(eq(f.timelineSchema.timelinePublications.id, "publication-0")))[0].state, "published");
    await pubRow.scrollIntoViewIfNeeded();
    await capture(page, "record-keyboard-" + viewport.width);
    await page.getByRole("link", { name: "More shared links", exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('li[aria-label^="Link reference "]').length === 5);
    await page.getByRole("link", { name: "More publications", exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('li[aria-label^="Publication reference "]').length === 5);
    const olderLinks = await recordRows("Link"), olderPublications = await recordRows("Publication");
    assert.equal(new Set([...firstLinks, ...olderLinks].map(row => row.reference)).size, 25);
    assert.equal(new Set([...firstPublications, ...olderPublications].map(row => row.reference)).size, 25);
    await page.reload();
    await page.getByRole("heading", { name: "Project recovery", exact: true }).waitFor();
    assert.deepEqual(await recordRows("Link"), olderLinks);
    assert.deepEqual(await recordRows("Publication"), olderPublications);
    await capture(page, "record-pagination-" + viewport.width);
    await page.goto(origin + "/settings/projects/project-b/recovery");
    await page.getByRole("heading", { name: "Project recovery", exact: true }).waitFor();
    assert.deepEqual((await recordRows("Link")).map(row => row.reference), firstLinks.map(row => row.reference));
    assert.deepEqual((await recordRows("Publication")).map(row => row.reference), firstPublications.map(row => row.reference));
    await page.close();
  }
  const page = await open({ width: 390, height: 844 });
  f.state.fail = true; f.state.delay = 150;
  const before = f.state.submitted.length;
  await page.getByRole("button", { name: "Unpublish board", exact: true }).evaluate(button => { button.click(); button.click(); });
  await page.getByRole("alert").waitFor();
  assert.equal(f.state.submitted.length, before + 1);
  assert.ok((await f.local.db.select().from(f.schema.workspaces).where(eq(f.schema.workspaces.id, "project-b")))[0].publishedAt);
  assert.doesNotMatch(await page.getByRole("alert").innerText(), /PRIVATE_|SQL/);
  await capture(page, "failure-mobile");
  f.state.fail = false;
  await page.getByRole("button", { name: "Unpublish board", exact: true }).click();
  await page.getByText("Public board: not published.", { exact: true }).waitFor();
  assert.equal((await f.local.db.select().from(f.schema.workspaces).where(eq(f.schema.workspaces.id, "project-b")))[0].publishedAt, null);
  await capture(page, "retry-mobile");
  await page.getByRole("link", { name: "More shared links", exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll("button")].filter(x => x.textContent === "Revoke link").length === 5);
  await page.getByRole("button", { name: /^Revoke link, / }).last().click();
  await page.waitForFunction(() => [...document.querySelectorAll("li")].some(x => x.textContent.includes("revoked")));
  assert.ok((await f.local.db.select().from(f.schema.shareLinks).where(eq(f.schema.shareLinks.token, "SECRET_B_0")))[0].revokedAt);
  await capture(page, "older-link-mobile"); await page.close();
  f.state.actor = "member-session";
  const member = await open({ width: 390, height: 844 });
  assert.equal(await member.getByRole("button", { name: "Delete project", exact: true }).count(), 0);
  assert.equal(await member.getByRole("button", { name: "Unpublish board", exact: true }).count(), 0);
  assert.equal(await member.getByRole("button", { name: /^Revoke link, / }).count(), 20);
  await capture(member, "member-mobile"); await member.close();
  f.state.actor = "buyer";
  await f.removeMember();
  const timelineOnly = await open({ width: 1440, height: 960 });
  assert.equal(await timelineOnly.getByRole("button", { name: "Delete project", exact: true }).count(), 0);
  assert.equal(await timelineOnly.getByRole("button", { name: /^Revoke publication links, / }).count(), 20);
  // The earlier keyboard cases unpublished the first two records. Keep this
  // pre-existing independent-authority control meaningful with an active one.
  assert.equal((await f.timeline.select().from(f.timelineSchema.audienceShares).where(eq(f.timelineSchema.audienceShares.id, "share-22")))[0].state, "active");
  await timelineOnly.getByRole("listitem", { name: "Publication reference publication-22", exact: true }).getByRole("button", { name: /^Revoke publication links, / }).click();
  await timelineOnly.getByText("Access withdrawn. The controls are refreshing.", { exact: true }).waitFor();
  assert.equal((await f.timeline.select().from(f.timelineSchema.audienceShares).where(eq(f.timelineSchema.audienceShares.id, "share-22")))[0].state, "revoked");
  await capture(timelineOnly, "timeline-only-desktop"); await timelineOnly.close();
  f.state.actor = "outsider-session";
  const unavailable = await open({ width: 390, height: 844 });
  await unavailable.getByRole("heading", { name: "Project controls aren’t available" }).waitFor();
  assert.equal(await unavailable.getByRole("button", { name: /^Revoke link, / }).count(), 0);
  await capture(unavailable, "unavailable-mobile"); await unavailable.close();
  assert.deepEqual(errors, []); assert.deepEqual(httpErrors, []);
  assert.equal(f.state.providerCalls, 0);
  receipt.errors = errors; receipt.httpErrors = httpErrors;
  receipt.actions = f.state.submitted.map(({ operation, projectId }) => ({ operation, projectId }));
  receipt.status = "passed";
} catch (error) { receipt.status = "failed"; receipt.error = error.stack; process.exitCode = 1; }
finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  f?.close();
  receipt.closedAt = new Date().toISOString();
  await fs.writeFile(path.join(out, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify({ status: receipt.status, cases: receipt.cases.length, error: receipt.error, output: out }, null, 2));
}
