import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { after, before, test } from "node:test";
import { chromium } from "@playwright/test";

const root = process.cwd();
const requireFromApp = createRequire(path.join(root, "package.json"));
const { build } = createRequire(requireFromApp.resolve("tsx/package.json"))("esbuild");
const sourceRef = process.env.WDATE_SOURCE_REF;
const output = process.env.WDATE_RENDER_OUTPUT;
const cssRoot = process.env.WDATE_CSS_ROOT;
const records = [];
let browser, bundle, sourceInputs;
const sources = ["src/components/app/project/wedding-date-form.tsx", "src/components/app/project/project-overview.tsx"];
const source = file => sourceRef
  ? execFileSync("git", ["show", sourceRef + ":" + file], { cwd: root, encoding: "utf8" })
  : readFileSync(path.join(root, file), "utf8");

// These DTOs match the independent actual-reader reproduction. Extra expired/
// term vectors are synthetic readbacks; browser actions below are explicit replies.
const active = { projectId: "b", weddingDate: "2030-06-01", revision: 2, canManage: true, access: { status: "active", expiresAt: "2030-08-30T00:00:00.000Z" } };
const revoked = { ...active, access: { status: "revoked", expiresAt: null } };
const external = { ...revoked, weddingDate: "2031-06-01", revision: 3 };
const adapters = {
  "next/navigation": "export const useRouter=()=>({refresh(){window.refreshes++}});",
  "next/link": 'import React from "react";export default function Link(props){return React.createElement("a",props);}',
  "@/server/actions/sponsored-wedding-date": "export async function saveSponsoredWeddingDate(input){window.saveCalls.push(input);if(window.delaySave)return await new Promise(resolve=>window.finishSave=resolve);return structuredClone(window.saveReply);}",
  "@/server/actions/project-overview": 'export async function setProjectStatusAction(){throw Error("Outside fixture");}export async function setProjectTargetDateAction(){throw Error("Outside fixture");}',
  "@/components/app/detail-panel/popover": "export const Popover=()=>null;",
  "@/components/app/detail-panel/due-calendar": "export const DueCalendar=()=>null;",
};

before(async () => {
  if (output) mkdirSync(output, { recursive: true });
  const built = await build({
    stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {ProjectOverview} from './src/components/app/project/project-overview';
const root=createRoot(document.getElementById('root'));window.refreshes=0;window.saveCalls=[];
window.show=state=>root.render(<ProjectOverview key={state.projectId} data={{workspaceId:state.projectId,slug:state.projectId,displayName:'Synthetic wedding',purpose:null,createdAt:null,ownerUserId:'primary',isOwner:true,members:[],taskStats:{total:0,complete:0,overdue:0,undated:0,progressPct:0},milestones:[],recentEvents:[],declaredStatus:null,targetDate:null,program:null,sponsoredWeddingDate:state}}/>);`,
      loader: "tsx", resolveDir: root },
    bundle: true, write: false, platform: "browser", format: "iife",
    nodePaths: [path.join(root, "node_modules")], tsconfig: path.join(root, "tsconfig.json"), metafile: true,
    plugins: [{ name: "explicit-readback-fixtures", setup(b) {
      b.onResolve({ filter: /.*/ }, args => Object.hasOwn(adapters, args.path) ? { path: args.path, namespace: "adapter" } : null);
      b.onLoad({ filter: /.*/, namespace: "adapter" }, args => ({ contents: adapters[args.path], resolveDir: root, loader: "js" }));
      if (sourceRef) b.onLoad({ filter: /[\\/]project[\\/](wedding-date-form|project-overview)\.tsx$/ }, args => ({
        contents: source(path.relative(root, args.path).replaceAll("\\", "/")), loader: "tsx", resolveDir: path.dirname(args.path),
      }));
    } }],
  });
  bundle = built.outputFiles[0].text;
  sourceInputs = built.metafile.inputs;
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
  if (output) writeFileSync(path.join(output, "render.json"), JSON.stringify({
    sourceRef: sourceRef ?? "working-tree",
    sourceHashes: Object.fromEntries(sources.map(file => [file, createHash("sha256").update(source(file)).digest("hex")])),
    sourceInputs, adapters, cssRoot: cssRoot ?? null, records,
    limits: ["Actual mounted Overview/Form in Chromium, not Next/Flight/Clerk.",
      "Initial/revoked/revision DTO values match the retained actual-reader reproduction; expired/term/save reply DTOs are synthetic.",
      "No database writes or provider actions in this browser test; action replies and router.refresh are adapters.",
      "Optional CSS is the preserved local build output with cached fonts, not a normal font-provider build."],
  }, null, 2) + "\n");
});

async function open(viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [], unexpectedRequests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (cssRoot && url.hostname === "127.0.0.1" && url.pathname.startsWith("/_next/static/")) {
      const file = path.resolve(cssRoot, url.pathname.slice("/_next/static/".length));
      if (file.startsWith(path.resolve(cssRoot) + path.sep) && existsSync(file)) {
        return route.fulfill({ body: readFileSync(file), contentType: file.endsWith(".css") ? "text/css" : "font/woff2" });
      }
    }
    unexpectedRequests.push(route.request().url());
    return route.abort();
  });
  let links = "", fontClasses = [];
  if (cssRoot) {
    const files = readdirSync(path.join(cssRoot, "chunks")).filter(file => file.endsWith(".css"));
    links = files.map(file => '<link rel="stylesheet" href="http://127.0.0.1/_next/static/chunks/' + file + '">').join("");
    fontClasses = files.flatMap(file => [...readFileSync(path.join(cssRoot, "chunks", file), "utf8").matchAll(/\.([a-zA-Z0-9_-]+)\s*\{\s*--font-geist-(?:sans|mono):[^}]+}/g)].map(match => match[1]));
  }
  await page.setContent('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1">' + links + '</head><body class="' + fontClasses.join(" ") + '" style="margin:0"><div id="root"></div></body></html>');
  await page.addScriptTag({ content: bundle });
  await show(page, active);
  await page.locator('#wedding-date input').waitFor();
  await page.evaluate(() => document.fonts.ready);
  return { page, errors, unexpectedRequests };
}
async function show(page, dto) {
  await page.evaluate(state => window.show(state), dto);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function record(f, name, expected) {
  const { page } = f;
  const actual = await page.locator("#wedding-date").innerText();
  const draft = await page.locator("#wedding-date input").count() ? await page.locator("#wedding-date input").inputValue() : null;
  const fonts = await page.locator("#wedding-date").evaluate(el => ({ family: getComputedStyle(el).fontFamily, loaded: document.fonts.check('14px "Geist"') }));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  const calls = await page.evaluate(() => window.saveCalls);
  records.push({ name, expected, actual, draft, calls, errors: [...f.errors], unexpectedRequests: [...f.unexpectedRequests], fonts, overflow });
  if (output) await page.locator("#wedding-date").screenshot({ path: path.join(output, name + ".png") });
  assert.deepEqual(f.errors, []);
  assert.deepEqual(f.unexpectedRequests, []);
  assert.equal(overflow, false);
  return { actual, draft };
}

for (const [size, viewport] of Object.entries({ desktop: { width: 1440, height: 1080 }, mobile: { width: 390, height: 844 } })) {
  for (const [name, access, text] of [
    ["revoked", revoked.access, /Your sponsored access was revoked/],
    ["expired", { status: "expired", expiresAt: "2025-08-30T00:00:00.000Z" }, /Your sponsored access ended on 30 August 2025/],
    ["term", { status: "active", expiresAt: "2031-08-30T00:00:00.000Z" }, /Your sponsored access is available until 30 August 2031/],
  ]) {
    test(size + ": same-key active to " + name + " refreshes access and preserves the unsaved date", async () => {
      const f = await open(viewport);
      try {
        await f.page.locator("#wedding-date input").fill("2032-06-01");
        await show(f.page, { ...active, access });
        const result = await record(f, size + "-" + name, text.source);
        assert.equal(result.draft, "2032-06-01");
        assert.match(result.actual, text);
        if (name !== "term") assert.doesNotMatch(result.actual, /Your sponsored access is available until/);
      } finally { await f.page.close(); }
    });
  }
  test(size + ": successful local save uses its returned readback before refreshed props arrive", async () => {
    const f = await open(viewport);
    try {
      const reply = { ...active, weddingDate: "2031-06-01", revision: 3, access: { status: "active", expiresAt: "2031-08-30T00:00:00.000Z" } };
      await f.page.evaluate(data => { window.saveReply = { ok: true, data }; }, reply);
      await f.page.locator("#wedding-date input").fill(reply.weddingDate);
      await f.page.getByRole("button", { name: "Save wedding date", exact: true }).click();
      await f.page.getByRole("status").waitFor();
      const result = await record(f, size + "-local-save", "Returned access term and saved date");
      assert.match(result.actual, /available until 30 August 2031/);
      assert.equal(result.draft, reply.weddingDate);
      assert.deepEqual(await f.page.evaluate(() => window.saveCalls), [{ projectId: "b", expectedRevision: 2, weddingDate: "2031-06-01" }]);
      assert.equal(await f.page.evaluate(() => window.refreshes), 1);
      // A second save before incoming props must use the successful revision.
      await f.page.evaluate(data => { window.saveReply = { ok: true, data: { ...data, revision: 4 } }; }, reply);
      await f.page.getByRole("button", { name: "Save wedding date", exact: true }).click();
      await f.page.waitForFunction(() => window.refreshes === 2);
      assert.equal(await f.page.evaluate(() => window.saveCalls[1].expectedRevision), 3);
    } finally { await f.page.close(); }
  });
  for (const ordering of ["props-before-reply", "props-after-reply"]) {
    test(size + ": " + ordering + " keeps confirmed revision and newer revoked display for repeat save", async () => {
      const f = await open(viewport);
      try {
        // The active reply was read before the newer revocation snapshot. Its
        // successful mutation revision remains valid even if delivery is late.
        const reply = { ...active, weddingDate: "2032-06-01", revision: 3, access: { status: "active", expiresAt: "2032-08-30T00:00:00.000Z" } };
        await f.page.evaluate(() => { window.delaySave = true; });
        await f.page.locator("#wedding-date input").fill(reply.weddingDate);
        await f.page.getByRole("button", { name: "Save wedding date", exact: true }).click();
        await f.page.waitForFunction(() => typeof window.finishSave === "function");
        if (ordering === "props-before-reply") await show(f.page, revoked);
        assert.equal(await f.page.locator("#wedding-date input").inputValue(), reply.weddingDate);
        await f.page.evaluate(data => { window.delaySave = false; window.finishSave({ ok: true, data }); }, reply);
        await f.page.waitForFunction(() => window.refreshes === 1);
        if (ordering === "props-after-reply") {
          await f.page.locator("#wedding-date input").fill("2034-06-01");
          await show(f.page, revoked);
        }
        assert.equal(await f.page.locator("#wedding-date input").inputValue(), ordering === "props-after-reply" ? "2034-06-01" : reply.weddingDate);
        assert.match(await f.page.locator("#wedding-date").innerText(), /Your sponsored access was revoked/);
        assert.doesNotMatch(await f.page.locator("#wedding-date").innerText(), /Your sponsored access is available until/);
        await f.page.evaluate(data => { window.saveReply = { ok: true, data }; }, { ...revoked, weddingDate: "2033-06-01", revision: 4 });
        await f.page.locator("#wedding-date input").fill("2033-06-01");
        await f.page.getByRole("button", { name: "Save wedding date", exact: true }).click();
        await f.page.waitForFunction(() => window.refreshes === 2);
        const result = await record(f, size + "-" + ordering, "Newer revoked display and confirmed revision3 for repeat save");
        assert.match(result.actual, /Your sponsored access was revoked/);
        assert.equal(result.draft, "2033-06-01");
        assert.equal(await f.page.evaluate(() => window.saveCalls[1].expectedRevision), 3);
      } finally { await f.page.close(); }
    });
  }
  test(size + ": incoming new revision retains the existing remount and canonical-date control", async () => {
    const f = await open(viewport);
    try {
      await f.page.locator("#wedding-date input").fill("2032-06-01");
      await show(f.page, external);
      const result = await record(f, size + "-revision", "New revision remounts with the durable date and revoked readback");
      assert.equal(result.draft, "2031-06-01");
      assert.match(result.actual, /access was revoked/);
    } finally { await f.page.close(); }
  });
  test(size + ": role downgrade retains the existing read-only remount", async () => {
    const f = await open(viewport);
    try {
      await f.page.locator("#wedding-date input").fill("2032-06-01");
      await show(f.page, { ...revoked, canManage: false });
      const result = await record(f, size + "-role", "No editing controls; current date and revoked readback");
      assert.equal(result.draft, null);
      assert.equal(await f.page.locator("#wedding-date form").count(), 0);
      assert.match(result.actual, /1 June 2030/);
      assert.match(result.actual, /Someone who can manage/);
      assert.match(result.actual, /access was revoked/);
    } finally { await f.page.close(); }
  });
}
