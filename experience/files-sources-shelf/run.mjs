/**
 * Browser check for Files, Sources + shelf (the operators-only redesign).
 *
 *   node experience/files-sources-shelf/run.mjs                 # checks only
 *   node experience/files-sources-shelf/run.mjs --capture <dir> # checks, then screenshots
 *
 * Bundles `fixture.tsx` with the real view, its real styles and the v3
 * tokens, stubs only `next/link` (a link changes the address in place, as the
 * router would), and drives it in Chromium at 1440, 1280, 768 and 390, light
 * and dark. No dev server, no database, no network. The fixed 42-file
 * fixture is the oracle; counts are never read back from the UI.
 */

import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve("tsx/package.json"))("esbuild");
const { chromium } = require("@playwright/test");
const { AxeBuilder } = require("@axe-core/playwright");

const fixtureBundle = await esbuild.build({
  entryPoints: [path.join(root, "src/lib/projects/project-files-analytics.fixture.ts")],
  bundle: true, write: false, platform: "node", format: "esm", logLevel: "silent",
});
const { filesFixture } = await import(`data:text/javascript;base64,${Buffer.from(fixtureBundle.outputFiles[0].text).toString("base64")}`);
const FILES = filesFixture();
assert.equal(FILES.length, 42, "the fixture still holds exactly 42 files");
const BY_SOURCE = {
  signal: FILES.filter((file) => file.storage === "signal"),
  drive: FILES.filter((file) => file.storage === "google_drive"),
  links: FILES.filter((file) => file.storage === "link"),
};
const SIGNAL_IMAGES = BY_SOURCE.signal.filter((file) => file.kind === "image");
const SIGNAL_SHEETS = BY_SOURCE.signal.filter((file) => file.kind === "sheet");
const SIGNAL_DOCS = BY_SOURCE.signal.length - SIGNAL_IMAGES.length - SIGNAL_SHEETS.length;
const { FIXTURE_NOW_SECONDS } = await import(`data:text/javascript;base64,${Buffer.from(fixtureBundle.outputFiles[0].text).toString("base64")}`);
const RECENT = FILES.filter((file) => FIXTURE_NOW_SECONDS - file.addedAt < 7 * 86_400).length;
const TASKS = new Set(FILES.map((file) => file.taskId)).size;

const captureAt = process.argv.indexOf("--capture");
const capture = captureAt !== -1;
const captureArg = capture ? process.argv[captureAt + 1] : undefined;
const outDir = path.resolve(root, captureArg && !captureArg.startsWith("--") ? captureArg : "experience/output/files-sources-shelf");

// ── Bundle ──────────────────────────────────────────────────────────────────

const stubs = new Map([
  [
    "next/link",
    `import {createElement} from "react";
     const KEEP=["theme","state"];
     function go(event,href){
       if(event.defaultPrevented||event.metaKey||event.ctrlKey||event.button!==0)return;
       event.preventDefault();
       const target=new URL(href,window.location.href);
       window.fixtureProbe.followed.push(href);
       if(!target.pathname.startsWith("/app/files"))return;
       const now=new URLSearchParams(window.location.search);
       for(const key of KEEP){const value=now.get(key);if(value)target.searchParams.set(key,value);}
       window.history.pushState({}, "", "/?"+target.searchParams.toString());
       window.fixtureRender();
     }
     export default function Link({href,prefetch,scroll,replace,onClick,...rest}){return createElement("a",{href,onClick:e=>{onClick&&onClick(e);go(e,href)},...rest})}`,
  ],
  ["@/components/system/arrival-settle", `export const ArrivalSettle=()=>null;`],
]);
const plugin = {
  name: "server-seams",
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => (stubs.has(args.path) ? { path: args.path, namespace: "fixture-stub" } : undefined));
    build.onLoad({ filter: /.*/, namespace: "fixture-stub" }, (args) => ({ contents: stubs.get(args.path), loader: "js", resolveDir: root }));
  },
};
const bundle = await esbuild.build({
  entryPoints: [path.join(root, "experience/files-sources-shelf/fixture.tsx")],
  absWorkingDir: root,
  outdir: path.join(root, "experience/output/files-sources-shelf/bundle"),
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  alias: { "@": path.join(root, "src") },
  loader: { ".module.css": "local-css", ".css": "css" },
  external: ["/fonts/*"],
  plugins: [plugin],
  logLevel: "silent",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
});
const js = bundle.outputFiles.find((file) => file.path.endsWith(".js")).text;
const css = bundle.outputFiles.find((file) => file.path.endsWith(".css")).text;

const ORIGIN = "http://127.0.0.1:49275";
const HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Signal Studio</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script>window.fixtureProbe={followed:[],opened:[]};window.open=(u)=>{window.fixtureProbe.opened.push(u);return null;};</script><script src="/app.js"></script></body></html>`;
const FONTS = {
  "Geist-Variable.woff2": "node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
  "GeistMono-Variable.woff2": "node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
};

const VIEWPORTS = {
  desk: { width: 1440, height: 960 },
  laptop: { width: 1280, height: 860 },
  tablet: { width: 768, height: 1024 },
  phone: { width: 390, height: 844 },
};
const BANNED = /\b(sprint|epic|backlog|stakeholder|kanban|burndown|velocity|workflow|dashboard|deliverable|okr|swimlane|ledger|milestone|overdue)\b|!|—|linked, not copied|not copied/i;

let checks = 0;
const shots = [];

async function open(browser, { viewport, theme, query = "", reducedMotion = "reduce" }) {
  const context = await browser.newContext({
    viewport: VIEWPORTS[viewport],
    colorScheme: theme,
    reducedMotion,
    deviceScaleFactor: 1,
    hasTouch: viewport === "phone" || viewport === "tablet",
    isMobile: viewport === "phone",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route(`${ORIGIN}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/app.js") return route.fulfill({ contentType: "text/javascript", body: js });
    if (url.pathname === "/app.css") return route.fulfill({ contentType: "text/css", body: css });
    const font = FONTS[url.pathname.replace("/fonts/", "")];
    if (font) return route.fulfill({ contentType: "font/woff2", body: readFileSync(path.join(root, font)) });
    return route.fulfill({ contentType: "text/html", body: HTML });
  });
  await page.goto(`${ORIGIN}/?theme=${theme}${query ? `&${query}` : ""}`);
  await page.evaluate(() => document.fonts.ready);
  return { page, context, errors, label: `${viewport}-${theme}${query ? `-${query}` : ""}` };
}

async function shot(page, name) {
  if (!capture) return;
  mkdirSync(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  shots.push(`${name}.png`);
}

async function axe(page, label) {
  const result = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(
    result.violations.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map((node) => node.target.join(" ")).slice(0, 4) })),
    [],
    `axe: ${label}`,
  );
  checks += 1;
}

async function settled(page, label) {
  const overflow = await page.evaluate(() => {
    const scroller = document.querySelector(".fixture-main > div");
    return Math.max(document.scrollingElement.scrollWidth - window.innerWidth, scroller ? scroller.scrollWidth - scroller.clientWidth : 0);
  });
  assert.ok(overflow <= 0, `${label}: the page scrolls sideways by ${overflow}px`);
  assert.doesNotMatch(await page.locator("#root").innerText(), BANNED, `${label}: banned or retired words`);
  checks += 2;
}

const activeAttr = (page, name) => page.evaluate((attr) => document.activeElement?.getAttribute(attr) ?? null, name);
const search = (page) => page.getByRole("searchbox");
const fileItems = (page) => page.locator("[data-files] [data-item][data-file-id]");
const visibleIds = (page) =>
  fileItems(page).evaluateAll((els) => els.filter((el) => el.getClientRects().length > 0).map((el) => el.getAttribute("data-file-id")));

let browser;
try {
  browser = await chromium.launch({ headless: true });

  for (const viewport of Object.keys(VIEWPORTS)) {
    const docks = VIEWPORTS[viewport].width >= 1280;
    const evidence = viewport === "desk" || viewport === "phone";
    const width = VIEWPORTS[viewport].width;
    for (const theme of ["light", "dark"]) {
      // ── Home ───────────────────────────────────────────────────────────
      {
        const { page, context, errors, label } = await open(browser, { viewport, theme });
        await page.getByRole("heading", { name: "Files", level: 1 }).waitFor();
        assert.equal(
          (await page.locator("header p").first().innerText()).trim(),
          `42 files on ${TASKS} tasks in Mara & Finn’s wedding, ${RECENT} added in the last 7 days.`,
          `${label}: one plain summary sentence`,
        );
        for (const [key, files] of Object.entries(BY_SOURCE)) {
          const folder = page.locator(`[data-source-folder="${key}"]`);
          assert.match(await folder.getAttribute("aria-label"), new RegExp(`, ${files.length} files\\.`), `${label}: ${key} folder counts its own files`);
        }
        assert.match(await page.locator('[data-source-folder="drive"]').innerText(), /In Google Drive\. Opens in Drive\./, `${label}: Drive copy`);
        assert.equal(await page.getByRole("link", { name: /^Add files\./ }).count(), 1, `${label}: Add files points to Tasks`);
        assert.equal(await page.getByRole("button", { name: /^(upload|attach|delete|remove|connect)/i }).and(page.locator(":not([data-file-id])")).count(), 0, `${label}: no upload, attach, delete or connect actions`);
        const latest = await visibleIds(page);
        assert.ok(latest.length >= 2 && latest.length <= 6, `${label}: Latest additions is one row (${latest.length})`);
        assert.deepEqual(latest, FILES.slice(0, latest.length).map((file) => file.id), `${label}: newest first`);
        const anim = await page.locator("[data-files]").evaluate((el) => getComputedStyle(el.parentElement.closest("section").parentElement).animationName);
        assert.equal(anim, "none", `${label}: reduced motion stops the arrival rise`);
        checks += 8;
        await settled(page, `${label} home`);
        await axe(page, `${label} home`);
        if (evidence) await shot(page, `home-${width}-${theme}`);

        // Latest additions as a list: calendar groups, every file once.
        await page.getByRole("group", { name: "Show latest additions as" }).getByRole("button", { name: "List" }).click();
        assert.deepEqual(await page.locator("[data-files] h3").allInnerTexts(), ["Today", "Last 7 days", "Older"], `${label}: list groups by calendar date`);
        assert.deepEqual(await visibleIds(page), FILES.map((file) => file.id), `${label}: the list holds every file, newest first`);
        checks += 2;
        await settled(page, `${label} list`);
        if (evidence) await shot(page, `latest-list-${width}-${theme}`);
        assert.deepEqual(errors, [], `${label}: console errors`);
        checks += 1;
        await context.close();
      }

      // ── Search on home ─────────────────────────────────────────────────
      {
        const { page, context, errors, label } = await open(browser, { viewport, theme });
        await search(page).fill("aoife seating");
        const expected = FILES.filter((file) => /seating/i.test(file.title) && file.addedByName === "Aoife Brennan").map((file) => file.id);
        await page.getByRole("status").filter({ hasText: "matching" }).waitFor();
        assert.equal((await page.locator("#shelf-results").innerText()).trim(), `${expected.length} files matching “aoife seating”`, `${label}: result count`);
        assert.deepEqual(await visibleIds(page), expected, `${label}: every word must match`);
        assert.ok((await page.locator("[data-files] mark").count()) >= expected.length * 2, `${label}: the words are lit where they were found`);
        assert.match(await fileItems(page).first().getAttribute("aria-label"), /Matched person Aoife Brennan/, `${label}: the card says why it matched`);
        checks += 4;
        await settled(page, `${label} search`);
        await axe(page, `${label} search`);
        if (evidence) await shot(page, `search-${width}-${theme}`);
        await search(page).fill("zzzz nothing");
        await page.getByText("Nothing matches").waitFor();
        await search(page).focus();
        await page.keyboard.press("Escape");
        assert.equal(await search(page).inputValue(), "", `${label}: Escape clears the search first`);
        checks += 1;
        assert.deepEqual(errors, [], `${label}: console errors`);
        await context.close();
      }

      // ── A source folder, with chips, keyboard and preview ──────────────
      {
        const { page, context, errors, label } = await open(browser, { viewport, theme });
        const signal = page.locator('[data-source-folder="signal"]');
        await signal.focus();
        if (viewport === "desk") {
          await page.keyboard.press("ArrowRight");
          assert.equal(await activeAttr(page, "data-source-folder"), "drive", `${label}: arrows rove the folders`);
          await page.keyboard.press("End");
          assert.ok(await page.evaluate(() => document.activeElement?.hasAttribute("data-add")), `${label}: End reaches Add files`);
          await page.keyboard.press("Home");
          assert.equal(await activeAttr(page, "data-source-folder"), "signal", `${label}: Home returns to the first folder`);
          assert.equal(await page.locator('[data-source-folder="drive"]').getAttribute("tabindex"), "-1", `${label}: one Tab stop per group`);
          checks += 4;
        }
        await page.keyboard.press("Enter");
        await page.getByRole("heading", { name: "In Signal", level: 1 }).waitFor();
        assert.equal(new URL(page.url()).searchParams.get("source"), "signal", `${label}: the folder is in the address`);
        assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-file-id")), BY_SOURCE.signal[0].id, `${label}: focus moves to the first file`);
        assert.deepEqual(await visibleIds(page), BY_SOURCE.signal.map((file) => file.id), `${label}: exactly the files uploaded to Signal`);
        const chips = page.getByRole("group", { name: "Show a type of file" });
        assert.deepEqual(
          (await chips.getByRole("button").allInnerTexts()).map((text) => text.replace(/\s+/g, " ").trim()),
          [`All ${BY_SOURCE.signal.length}`, `Documents ${SIGNAL_DOCS}`, `Sheets ${SIGNAL_SHEETS.length}`, `Images ${SIGNAL_IMAGES.length}`],
          `${label}: chips for the types present`,
        );
        checks += 4;
        await settled(page, `${label} source`);
        await axe(page, `${label} source`);
        if (evidence) await shot(page, `source-signal-${width}-${theme}`);

        await chips.getByRole("button", { name: /^Images/ }).click();
        assert.equal((await page.locator("p[role=status]").innerText()).replace(/\s+/g, " ").trim(), `Showing ${SIGNAL_IMAGES.length} images Clear`, `${label}: the filter states itself`);
        assert.deepEqual(await visibleIds(page), SIGNAL_IMAGES.map((file) => file.id), `${label}: only images`);
        assert.equal(await page.locator('[data-files] [data-item][tabindex="0"]').count(), 1, `${label}: a filtered group keeps one Tab stop`);
        await page.locator("p[role=status]").getByRole("button", { name: "Clear" }).click();
        assert.equal((await visibleIds(page)).length, BY_SOURCE.signal.length, `${label}: Clear shows every file again`);
        checks += 4;

        // Preview: click (or Enter) previews, Enter again opens, Escape steps back.
        const target = BY_SOURCE.signal[1];
        const item = page.locator(`[data-files] [data-file-id="${target.id}"]`);
        await item.focus();
        await page.keyboard.press("Enter");
        const panel = docks ? page.getByRole("complementary") : page.getByRole("dialog", { name: target.title, exact: true });
        await panel.waitFor();
        assert.equal((await panel.getByRole("heading", { level: 2 }).innerText()).trim(), target.title, `${label}: preview shows the file`);
        assert.match(await panel.innerText(), /Uploaded to Signal/, `${label}: preview says where it lives`);
        if (docks) assert.equal(await item.getAttribute("aria-current"), "true", `${label}: the previewed file is current`);
        checks += docks ? 3 : 2;
        await settled(page, `${label} preview`);
        await axe(page, `${label} preview`);
        if (evidence) await shot(page, `preview-${width}-${theme}`);
        await page.keyboard.press("Escape");
        await panel.waitFor({ state: "detached" });
        assert.equal(await activeAttr(page, "data-file-id"), target.id, `${label}: closing the preview returns focus to the file`);
        await page.keyboard.press("Escape");
        await page.getByRole("heading", { name: "Files", level: 1 }).waitFor();
        assert.equal(new URL(page.url()).searchParams.get("source"), null, `${label}: Escape leaves the folder`);
        assert.equal(await activeAttr(page, "data-source-folder"), "signal", `${label}: focus returns to the folder`);
        checks += 3;

        // Back leaves a folder too.
        await page.locator('[data-source-folder="links"]').click();
        await page.getByRole("heading", { name: "Links", level: 1 }).waitFor();
        assert.equal(await page.getByRole("group", { name: "Show a type of file" }).count(), 0, `${label}: one type, no chips`);
        assert.deepEqual(await visibleIds(page), BY_SOURCE.links.map((file) => file.id), `${label}: exactly the links`);
        await page.goBack();
        await page.getByRole("heading", { name: "Files", level: 1 }).waitFor();
        checks += 3;
        assert.deepEqual(errors, [], `${label}: console errors`);
        await context.close();
      }

      // ── Drive by address, Enter twice opens, list rows ─────────────────
      {
        const { page, context, errors, label } = await open(browser, { viewport, theme, query: "source=drive" });
        await page.getByRole("heading", { name: "Google Drive", level: 1 }).waitFor();
        assert.deepEqual(await visibleIds(page), BY_SOURCE.drive.map((file) => file.id), `${label}: a shared address opens the folder`);
        if (docks) {
          const first = page.locator(`[data-files] [data-file-id="${BY_SOURCE.drive[0].id}"]`);
          await first.focus();
          await page.keyboard.press("Enter");
          await page.getByRole("complementary").waitFor();
          assert.match(await page.getByRole("complementary").innerText(), /In Google Drive/, `${label}: Drive is where it lives`);
          await page.keyboard.press("Enter");
          assert.deepEqual(await page.evaluate(() => window.fixtureProbe.opened), [BY_SOURCE.drive[0].href], `${label}: Enter again opens it`);
          checks += 2;
        }
        await page.getByRole("group", { name: "Show files as" }).getByRole("button", { name: "List" }).click();
        assert.deepEqual(await visibleIds(page), BY_SOURCE.drive.map((file) => file.id), `${label}: list keeps the same files`);
        checks += 2;
        await settled(page, `${label} drive list`);
        await axe(page, `${label} drive list`);
        if (evidence) await shot(page, `source-drive-list-${width}-${theme}`);
        assert.deepEqual(errors, [], `${label}: console errors`);
        await context.close();
      }

      // ── Empty, archived ────────────────────────────────────────────────
      {
        const { page, context, errors, label } = await open(browser, { viewport, theme, query: "state=empty" });
        await page.getByRole("heading", { name: "No files yet" }).waitFor();
        assert.equal(await page.locator("[data-source-folder]").count(), 3, `${label}: empty still shows the three folders`);
        await settled(page, `${label} empty`);
        await axe(page, `${label} empty`);
        if (evidence) await shot(page, `empty-${width}-${theme}`);
        checks += 1;
        assert.deepEqual(errors, [], `${label}: console errors`);
        await context.close();
      }
      if (theme === "light") {
        const { page, context, errors, label } = await open(browser, { viewport, theme, query: "source=signal" });
        await page.getByRole("link", { name: "Include them" }).click();
        await page.getByText("Files on archived tasks are included.").waitFor();
        assert.equal(new URL(page.url()).searchParams.get("archived"), "1", `${label}: archived toggle uses ?archived=1`);
        assert.equal(new URL(page.url()).searchParams.get("source"), "signal", `${label}: and keeps the folder`);
        assert.match(await page.locator('[data-file-id="fx-archived"]').getAttribute("aria-label"), /\(archived\)/, `${label}: archived file says so`);
        checks += 3;
        assert.deepEqual(errors, [], `${label}: console errors`);
        await context.close();
      }
    }
  }

  // ── Forced colours keep the previewed file visible ─────────────────────
  {
    const { page, context, label } = await open(browser, { viewport: "desk", theme: "light", query: "source=signal" });
    await page.emulateMedia({ forcedColors: "active" });
    const item = page.locator(`[data-files] [data-file-id="${BY_SOURCE.signal[0].id}"]`);
    await item.click();
    await page.getByRole("complementary").waitFor();
    assert.equal(await item.evaluate((el) => getComputedStyle(el).outlineStyle), "solid", `${label}: forced colours outline the previewed file`);
    checks += 1;
    await context.close();
  }

  // ── Motion is on when reduced motion is not asked for ──────────────────
  {
    const { page, context, label } = await open(browser, { viewport: "desk", theme: "light", reducedMotion: "no-preference" });
    const anim = await page.locator(".fixture-main [data-files]").evaluate((el) => getComputedStyle(el.closest("section").parentElement).animationName);
    assert.notEqual(anim, "none", `${label}: views arrive with a short rise`);
    checks += 1;
    await context.close();
  }

  console.log(`files-sources-shelf: ${checks} checks passed${capture ? `; ${shots.length} screenshots in ${path.relative(root, outDir)}` : ""}`);
} finally {
  await browser?.close();
}
