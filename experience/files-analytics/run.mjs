/**
 * Browser check for Files and Analytics with busy, sparse and empty accounts.
 *
 *   node experience/files-analytics/run.mjs                 # checks only
 *   node experience/files-analytics/run.mjs --capture <dir> # checks, then screenshots
 *
 * Bundles `fixture.tsx` with the real pages, their real styles and the v3
 * tokens, stubs only `next/link` (a link changes the address in place, as the
 * router would) and the loading boundary's arrival effect, and drives it in
 * Chromium at four sizes, light and dark. No dev server, no database, no
 * network.
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

const captureAt = process.argv.indexOf("--capture");
const capture = captureAt !== -1;
const captureArg = capture ? process.argv[captureAt + 1] : undefined;
const outDir = path.resolve(root, captureArg && !captureArg.startsWith("--") ? captureArg : "experience/output/files-analytics");

// ── Bundle ──────────────────────────────────────────────────────────────────

const stubs = new Map([
  [
    "next/link",
    `import {createElement} from "react";
     const KEEP=["surface","state","theme"];
     function go(event,href){
       if(event.defaultPrevented||event.metaKey||event.ctrlKey||event.button!==0)return;
       event.preventDefault();
       const target=new URL(href,window.location.href);
       window.fixtureProbe.followed.push(href);
       if(!target.pathname.startsWith("/app/analytics")&&!target.pathname.startsWith("/app/files"))return;
       const now=new URLSearchParams(window.location.search);
       for(const key of KEEP){const value=now.get(key);if(value)target.searchParams.set(key,value);}
       window.history.pushState({}, "", "/?"+target.searchParams.toString());
       window.fixtureRender();
     }
     window.fixtureGo=(href)=>go({defaultPrevented:false,button:0,preventDefault(){}},href);
     export default function Link({href,prefetch,scroll,replace,onClick,...rest}){return createElement("a",{href,onClick:e=>{onClick&&onClick(e);go(e,href)},...rest})}`,
  ],
  ["next/navigation", `export const useRouter=()=>({push:(href)=>window.fixtureGo(href),replace:(href)=>window.fixtureGo(href),refresh(){}});`],
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
  entryPoints: [path.join(root, "experience/files-analytics/fixture.tsx")],
  absWorkingDir: root,
  outdir: path.join(root, "experience/output/files-analytics/bundle"),
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

const ORIGIN = "http://127.0.0.1:49274";
const HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Signal Studio</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script>window.fixtureProbe={followed:[]}</script><script src="/app.js"></script></body></html>`;
const FONTS = {
  "Geist-Variable.woff2": "node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
  "GeistMono-Variable.woff2": "node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
};
// A one-pixel PNG stands in for an uploaded picture behind the attachment route.
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const VIEWPORTS = {
  wide: { width: 1920, height: 1080 },
  desk: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  phone: { width: 390, height: 844 },
};
const BANNED = /\b(sprint|epic|backlog|stakeholder|kanban|burndown|velocity|workflow|dashboard|deliverable|okr|swimlane|ledger|milestone|overdue)\b|!|—/i;

let checks = 0;
const shots = [];

async function open(browser, { viewport, theme, surface, state = "busy", query = "", reducedMotion = "reduce" }) {
  const touch = viewport === "phone" || viewport === "tablet";
  const context = await browser.newContext({
    viewport: VIEWPORTS[viewport],
    colorScheme: theme,
    reducedMotion,
    deviceScaleFactor: 1,
    hasTouch: touch,
    isMobile: viewport === "phone",
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: ORIGIN }).catch(() => {});
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
    if (url.pathname.startsWith("/api/attachments/")) return route.fulfill({ contentType: "image/png", body: PIXEL });
    const font = FONTS[url.pathname.replace("/fonts/", "")];
    if (font) return route.fulfill({ contentType: "font/woff2", body: readFileSync(path.join(root, font)) });
    return route.fulfill({ contentType: "text/html", body: HTML });
  });
  await page.goto(`${ORIGIN}/?surface=${surface}&state=${state}&theme=${theme}${query ? `&${query}` : ""}`);
  await page.evaluate(() => document.fonts.ready);
  return { page, context, errors, label: `${surface}-${state}-${viewport}-${theme}` };
}

async function shot(page, name, { fullPage = false } = {}) {
  if (!capture) return;
  mkdirSync(outDir, { recursive: true });
  if (fullPage) {
    // The page scrolls inside the shell's column; let it grow for the shot.
    await page.addStyleTag({ content: ".fixture-shell{height:auto!important}.fixture-main{overflow:visible!important}.fixture-main>div{overflow:visible!important;flex:none!important}" }).then(async (tag) => {
      await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
      await tag.evaluate((el) => el.remove());
    });
  } else {
    await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  }
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

async function noSidewaysScroll(page, label) {
  const overflow = await page.evaluate(() => {
    const scroller = document.querySelector(".fixture-main > div");
    return Math.max(document.scrollingElement.scrollWidth - window.innerWidth, scroller ? scroller.scrollWidth - scroller.clientWidth : 0);
  });
  assert.ok(overflow <= 0, `${label}: the page scrolls sideways by ${overflow}px`);
  checks += 1;
}

async function plainWords(page, label) {
  const words = await page.locator("#root").innerText();
  assert.doesNotMatch(words, BANNED, `${label}: banned word`);
  checks += 1;
}

const squash = (text) => text.replace(/\s+/g, " ").trim();
const rows = (page) => page.locator("[data-file-row]");

let browser;
try {
  browser = await chromium.launch({ headless: true });

  for (const viewport of Object.keys(VIEWPORTS)) {
    const docks = VIEWPORTS[viewport].width >= 1280;
    for (const theme of ["dark", "light"]) {
      // ── Files, busy ──────────────────────────────────────────────────────
      {
        const { page, context, errors, label } = await open(browser, { viewport, theme, surface: "files" });
        await page.getByRole("heading", { name: "Files", level: 1 }).waitFor();
        assert.equal(squash(await page.locator("header p").first().innerText()), "42 files across 14 tasks 13 added in the last 7 days");
        assert.equal(await rows(page).count(), 42, `${label}: every file is listed`);
        assert.deepEqual(await page.locator("section[aria-label='Files'] h2").allInnerTexts().then((list) => list.map(squash)), ["Added in the last 7 days 13", "Earlier 29"]);
        // Nothing the founder asked to remove is here.
        const words = await page.locator("#root").innerText();
        assert.doesNotMatch(words, /Ask about|Pinned searches|\bKeys\b|Ask your files|Open at the passage/i, `${label}: no ask box, pins or keys panel`);
        assert.equal(await page.getByRole("link", { name: /New task/i }).count() + (await page.getByRole("button", { name: /New task/i }).count()), 0, "no second create button");
        await plainWords(page, label);
        await noSidewaysScroll(page, label);
        // The preview docks beside the list on a wide page and shows the first file.
        const dock = page.getByRole("complementary");
        assert.equal(await dock.isVisible(), docks, `${label}: preview docked ${docks ? "beside the list" : "away"}`);
        if (docks) {
          assert.equal(squash(await dock.getByRole("heading", { level: 2 }).innerText()), "Upload still on its way.pdf");
          assert.match(await dock.innerText(), /Not ready to open yet/);
        }
        await axe(page, label);
        await shot(page, `files-busy-${viewport}-${theme}`);
        if (theme === "dark") await shot(page, `files-busy-${viewport}-${theme}-full`, { fullPage: true });

        // Search: words in the name, then in the task.
        const box = page.getByRole("searchbox", { name: "Find a file by name, task or person" });
        await box.fill("marquee");
        assert.equal(await rows(page).count(), 5);
        assert.deepEqual(await page.locator("section[aria-label='Files'] h2").allInnerTexts().then((list) => list.map(squash)), ["Named “marquee” 4", "On a task matching “marquee” 1"]);
        assert.equal(squash(await page.getByRole("status").first().innerText()).startsWith("5 files for “marquee”"), true);
        assert.ok((await page.locator("mark").count()) >= 5, "the word is marked where it matched");
        await shot(page, `files-search-${viewport}-${theme}`);
        await axe(page, `${label} search`);

        // A question is not answered.
        await box.fill("which seating plan did Mara approve");
        assert.equal(await rows(page).count(), 0);
        assert.match(await page.locator("#root").innerText(), /It does not look inside files\./);
        await shot(page, `files-no-match-${viewport}-${theme}`);
        await axe(page, `${label} no match`);
        await page.getByRole("button", { name: "Show all files" }).first().click();
        assert.equal(await rows(page).count(), 42);

        // Narrowing.
        await page.getByRole("button", { name: /^Images/ }).click();
        assert.equal(await rows(page).count(), 7);
        await page.getByRole("button", { name: /^Added by Tom Reilly/ }).click();
        assert.equal(await rows(page).count(), 5);
        assert.equal(await page.getByRole("button", { name: /^Images/ }).getAttribute("aria-pressed"), "true");
        await noSidewaysScroll(page, `${label} narrowed`);
        if (docks) {
          // An uploaded picture is drawn through the attachment route.
          await rows(page).first().click();
          const img = page.getByRole("complementary").locator("img");
          assert.match(await img.getAttribute("src"), /^\/api\/attachments\//);
          const open = page.getByRole("complementary").getByRole("link", { name: "Open file" });
          assert.match(await open.getAttribute("href"), /^\/api\/attachments\//);
          assert.equal(await open.getAttribute("target"), null, "an upload opens in place, through the app's own route");
          await shot(page, `files-image-preview-${viewport}-${theme}`);
        }
        await page.getByRole("button", { name: /^Images/ }).click();
        await page.getByRole("button", { name: /^Added by Tom Reilly/ }).click();

        // Grid keeps the same files.
        await page.getByRole("button", { name: "Grid", exact: true }).click();
        assert.equal(await rows(page).count(), 42);
        await noSidewaysScroll(page, `${label} grid`);
        await shot(page, `files-grid-${viewport}-${theme}`);
        await axe(page, `${label} grid`);
        await page.getByRole("button", { name: "List", exact: true }).click();

        // External files open in a new tab with no opener; a former member is not named.
        const drive = page.getByRole("link", { name: "Open in a new tab: Seating plan v4" });
        assert.equal(await drive.getAttribute("target"), "_blank");
        assert.equal(await drive.getAttribute("rel"), "noopener noreferrer");
        assert.match(await page.locator("li", { hasText: "Bar licence renewal form.pdf" }).first().innerText(), /A former member/);
        assert.deepEqual(errors, [], `${label}: console or page errors`);
        checks += 16;
        await context.close();
      }

      // ── Files: the sheet on a narrow page, and the keyboard ──────────────
      {
        const { page, context, errors, label } = await open(browser, { viewport, theme, surface: "files" });
        await page.getByRole("heading", { name: "Files", level: 1 }).waitFor();
        const box = page.getByRole("searchbox");
        await page.locator("h1").click();
        await page.keyboard.press("/");
        assert.equal(await box.evaluate((el) => el === document.activeElement), true, "slash moves to the search box");
        await page.keyboard.type("seating");
        await page.keyboard.press("ArrowDown");
        const focusedRow = () => page.evaluate(() => document.activeElement?.getAttribute("data-file-row"));
        const ids = await rows(page).evaluateAll((els) => els.map((el) => el.getAttribute("data-file-row")));
        assert.equal(ids.length, 3);
        assert.equal(await focusedRow(), ids[0]);
        await page.keyboard.press("ArrowDown");
        assert.equal(await focusedRow(), ids[1]);
        await page.keyboard.press("End");
        assert.equal(await focusedRow(), ids[2]);
        await page.keyboard.press("Home");
        await page.keyboard.press("ArrowUp");
        assert.equal(await box.evaluate((el) => el === document.activeElement), true, "Up from the first row returns to the box");
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        if (docks) {
          assert.equal(await page.getByRole("dialog").count(), 0, "a wide page never opens the sheet");
          assert.equal(squash(await page.getByRole("complementary").getByRole("heading", { level: 2 }).innerText()), "Seating plan v3");
          assert.equal(await rows(page).nth(1).getAttribute("aria-current"), "true");
          await shot(page, `files-keyboard-${viewport}-${theme}`);
        } else {
          const dialog = page.getByRole("dialog", { name: "Seating plan v3" });
          await dialog.waitFor();
          assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Close", "the sheet takes focus");
          assert.match(await dialog.innerText(), /Google Drive, linked not copied/);
          // Tab stays inside.
          for (let step = 0; step < 6; step += 1) await page.keyboard.press("Tab");
          assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest("[role=dialog]"))), true, "Tab stays inside the sheet");
          await axe(page, `${label} sheet`);
          await shot(page, `files-sheet-${viewport}-${theme}`);
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "detached" });
          assert.equal(await focusedRow(), ids[1], "Escape hands focus back to the row");
        }
        await box.focus();
        await page.keyboard.press("Escape");
        assert.equal(await box.inputValue(), "", "Escape clears the box");
        assert.deepEqual(errors, [], `${label}: console or page errors`);
        checks += 9;
        await context.close();
      }

      // ── Files: sparse, empty, cut short, archived, loading, no project ───
      for (const [state, query, wait] of [
        ["sparse", "", "2 files across 2 tasks"],
        ["empty", "", "No files yet"],
        ["truncated", "", "more files than one page lists"],
        ["busy", "archived=1", "Files on archived tasks are included."],
        ["unavailable", "", "No project open"],
        ["loading", "", null],
      ]) {
        const { page, context, errors, label } = await open(browser, { viewport, theme, surface: "files", state, query });
        if (wait) await page.getByText(wait).first().waitFor();
        else await page.getByRole("status", { name: "Opening Files" }).waitFor();
        if (state === "sparse") {
          assert.equal(await rows(page).count(), 2);
          assert.equal(await page.getByRole("group", { name: "Narrow the files" }).getByRole("button").count(), 3, "added this week and two kinds; no people");
        }
        if (state === "empty") assert.equal(await page.getByRole("searchbox").count(), 0, "nothing to search yet");
        if (query) {
          assert.equal(await rows(page).count(), 43);
          assert.match(await page.locator("li", { hasText: "Old run sheet.pdf" }).first().innerText(), /Archived task/);
          assert.equal(await page.getByRole("link", { name: "Leave them out" }).getAttribute("href"), "/app/files");
        } else if (state !== "unavailable" && state !== "loading") {
          assert.equal(await page.getByRole("link", { name: "Include them" }).getAttribute("href"), "/app/files?archived=1");
        }
        await noSidewaysScroll(page, label);
        await plainWords(page, label);
        if (state !== "loading") await axe(page, `${label}${query}`);
        await shot(page, `files-${query ? "archived" : state}-${viewport}-${theme}`);
        assert.deepEqual(errors, [], `${label}: console or page errors`);
        checks += 2;
        await context.close();
      }

      // ── Analytics, every project: the ask box and the questions ──────────
      {
        const { page, context, errors, label } = await open(browser, { viewport, theme, surface: "analytics" });
        await page.getByRole("heading", { name: "Analytics", level: 1 }).waitFor();
        assert.equal(squash(await page.locator("header p").first().innerText()), "4 active projects 2 need a look 17 open tasks 4 late 12 done in the last 7 days");
        const picker = page.getByRole("button", { name: /^Showing All projects/ });
        assert.equal(squash(await picker.innerText()), "All projects 4 active");
        assert.deepEqual(await page.getByRole("navigation", { name: "Analytics" }).getByRole("link").allInnerTexts().then((list) => list.map(squash)), ["Ask", "All projects"]);
        const box = page.getByRole("combobox", { name: "What do you want to know across your projects?" });
        await box.waitFor();
        assert.match(await page.locator("#root").innerText(), /Plain answers from your tasks, dates and history\. Pick a question, or type to find one\./);
        // Four groups, two questions each, every one a link.
        const groups = await page.locator("[data-groups] section").evaluateAll((els) => els.map((el) => [el.querySelector("h2").textContent, [...el.querySelectorAll("a")].map((a) => a.querySelector("span:nth-of-type(2)").textContent)]));
        assert.deepEqual(groups, [
          ["Where we stand", ["Which projects are in the worst shape?", "What changed this week?"]],
          ["People", ["Who has too much on?", "What should we do first next week?"]],
          ["What goes wrong", ["What keeps slipping?", "What is late, and who has it?"]],
          ["Patterns", ["Where is the work sitting?", "How long do things usually take us?"]],
        ]);
        const words = await page.locator("#root").innerText();
        assert.doesNotMatch(words, /\bAI\b|Most asked|Your answers|Replay|New task/, `${label}: nothing invented, no second create button`);
        await plainWords(page, label);
        await noSidewaysScroll(page, label);
        await axe(page, label);
        await shot(page, `analytics-ask-${viewport}-${theme}`);
        if (theme === "dark" || viewport === "phone") await shot(page, `analytics-ask-${viewport}-${theme}-full`, { fullPage: true });

        // Typing finds a question by its words; nothing is answered that is not in the library.
        await page.locator("h1").click();
        await page.keyboard.press("/");
        assert.equal(await box.evaluate((el) => el === document.activeElement), true, "slash moves to the ask box");
        await page.keyboard.type("who is busy");
        const options = page.getByRole("option");
        assert.equal(squash(await options.first().innerText()).startsWith("Who has too much on?"), true);
        assert.equal(await options.first().getAttribute("aria-selected"), "true");
        await axe(page, `${label} typing`);
        await shot(page, `analytics-ask-typing-${viewport}-${theme}`);
        await box.fill("which seating plan did Mara approve");
        assert.equal(await options.count(), 0);
        assert.equal(squash(await page.getByRole("status").first().innerText()), "No ready answer for that yet. These are the questions I can answer.");
        assert.equal(await page.locator("[data-question]").count(), 8, "the questions stay on screen");
        await page.keyboard.press("Enter");
        assert.equal(await page.locator("[data-answer]").count(), 0, "Enter with no match opens nothing");
        await shot(page, `analytics-ask-no-match-${viewport}-${theme}`);
        await axe(page, `${label} no match`);
        await box.fill("overdue");
        await page.keyboard.press("Enter");
        await page.locator("[data-answer='late']").waitFor();
        assert.match(page.url(), /scope=all/);
        assert.match(page.url(), /ask=late/);

        const sentence = () => page.locator("[data-answer]").innerText().then(squash);
        const expected = [
          ["shape", "Which projects are in the worst shape?", "2 of 4 active projects need a look. Winter season launch is past its target date with 1 late; Mara & Finn’s wedding is marked at risk with 2 late. 4 tasks are late across them, most in Mara & Finn’s wedding (2)."],
          ["week", "What changed this week?", "12 tasks were finished in the last 7 days, 6 more than the week before. 14 were added. The latest finished was Send the save-the-dates in Barn roof and heating works, on Mon 5 Oct."],
          ["who", "Who has too much on?", "Orla Byrne holds the most: 8 of the 17 open tasks, 1 of them late. Aoife Brennan has 4 and Tom Reilly 3. 2 have no one assigned."],
          ["next", "What should we do first next week?", "7 tasks are due in the next 7 days. The first is Approve the seating plan in Mara & Finn’s wedding, due today, with Orla Byrne. 4 tasks are already late and come before any of it."],
          ["slip", "What keeps slipping?", "3 tasks had their date changed more than once in the last 12 weeks. The most is Agree the winter price list in Winter season launch, changed 4 times. 14 date changes were recorded in all, on 8 tasks."],
          ["late", "What is late, and who has it?", "4 tasks are past their date. The oldest is Agree the winter price list in Winter season launch, 12 days late, with Aoife Brennan. 1 of them has no one assigned. 9 more are due in the next 14 days."],
          ["where", "Where is the work sitting?", "10 of the 35 tasks are in To do, and 3 in In progress. 18 are done."],
          ["long", "How long do things usually take us?", "Half of tasks are finished within 3 days of being added. That is from 51 tasks finished in the last 12 weeks. 29 of the 36 with a due date were finished on time."],
        ];
        for (const [id, question, text] of expected) {
          await page.getByRole("link", { name: "All questions" }).click();
          await page.locator(`[data-question='${id}']`).click();
          await page.locator(`[data-answer='${id}']`).waitFor();
          assert.equal(await sentence(), text, `${label}: ${question}`);
          assert.equal(squash(await page.locator("#an-question").innerText()), question);
          assert.match(page.url(), new RegExp(`ask=${id}`), "the question is in the address");
          await noSidewaysScroll(page, `${label} ${id}`);
          await plainWords(page, `${label} ${id}`);
          await axe(page, `${label} ${id}`);
          await shot(page, `analytics-${id}-${viewport}-${theme}`);
          if (theme === "dark" || viewport === "phone") await shot(page, `analytics-${id}-${viewport}-${theme}-full`, { fullPage: true });
          checks += 3;
        }
        // Worst shape lists every project, needs a look first; late names the task and lists all four.
        await page.getByRole("link", { name: "All questions" }).click();
        await page.locator("[data-question='shape']").click();
        assert.deepEqual(await page.locator("[data-shape-row]").evaluateAll((els) => els.map((el) => el.getAttribute("data-shape-row"))), ["p-winter", "p-mara", "p-barn", "p-keane"]);
        await page.getByRole("link", { name: "See what is late" }).click();
        await page.locator("[data-answer='late']").waitFor();
        assert.equal(await page.locator("[data-answer='late'] a").getAttribute("href"), "/app/task/a-price");
        assert.equal(await page.locator("section[aria-labelledby='an-late'] li").count(), 4);
        assert.match(await page.locator("section[aria-labelledby='an-late']").innerText(), /Winter season launch · Due Wed 23 Sep · Aoife Brennan/);
        assert.match(await page.locator("section[aria-labelledby='an-late']").innerText(), /Former member/);
        assert.match(await page.locator("section[aria-labelledby='an-late']").innerText(), /does not say why a task is late, so no reason is given/);
        // The range switch belongs to the answers it changes.
        assert.equal(await page.getByRole("navigation", { name: "Time range" }).count(), 0);
        await page.getByRole("link", { name: "All questions" }).click();
        await page.locator("[data-question='long']").click();
        await page.getByRole("navigation", { name: "Time range" }).getByRole("link", { name: "4 weeks" }).click();
        assert.match(await sentence(), /finished in the last 4 weeks\./);
        assert.match(page.url(), /ask=long/);
        assert.match(page.url(), /range=4w/);

        // The scope menu: one button, the projects as links, Escape hands focus back.
        await picker.focus();
        await page.keyboard.press("ArrowDown");
        const menu = page.getByRole("menu", { name: "What Analytics covers" });
        await menu.waitFor();
        assert.deepEqual(await menu.getByRole("menuitem").allInnerTexts().then((list) => list.map(squash)), [
          "All projects 4 active",
          "Mara & Finn’s wedding",
          "Winter season launch",
          "Barn roof and heating works",
          "Keane Legal retreat",
        ]);
        assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-current")), "true", "the menu opens on the current scope");
        const menuBox = await menu.boundingBox();
        assert.ok(menuBox.x >= 0 && menuBox.x + menuBox.width <= VIEWPORTS[viewport].width, `${label}: the scope menu stays on screen`);
        await axe(page, `${label} scope menu`);
        await shot(page, `analytics-scope-menu-${viewport}-${theme}`);
        await page.keyboard.press("Escape");
        await menu.waitFor({ state: "detached" });
        assert.equal(await picker.evaluate((el) => el === document.activeElement), true);
        await picker.click();
        await menu.getByRole("menuitem", { name: "Mara & Finn’s wedding" }).click();
        await page.getByRole("button", { name: /^Showing Mara & Finn’s wedding/ }).waitFor();
        assert.match(page.url(), /workspaceId=p-mara/);
        assert.doesNotMatch(page.url(), /scope=all/);
        assert.equal(squash(await page.locator("header p").first().innerText()), "17 open 4 late 12 done in the last 7 days");
        assert.deepEqual(errors, [], `${label}: console or page errors`);
        checks += 26;
        await context.close();
      }

      // ── Analytics, one project of several ────────────────────────────────
      {
        const { page, context, errors, label } = await open(browser, { viewport, theme, surface: "analytics", query: "workspaceId=p-mara" });
        await page.getByRole("combobox", { name: "What do you want to know about Mara & Finn’s wedding?" }).waitFor();
        assert.equal(squash(await page.locator("[data-question='shape']").innerText()), "Are we on track? Late work against the dates set");
        await page.locator("[data-question='shape']").click();
        await page.locator("[data-answer='shape']").waitFor();
        assert.equal(
          squash(await page.locator("[data-answer]").innerText()),
          "4 tasks are late, the oldest by 12 days. 17 tasks are open, 7 due in the next 7 days. In the last 7 days 12 were finished and 14 added. The target date is Sat 17 Oct, in 12 days. It is marked at risk.",
        );
        assert.match(page.url(), /workspaceId=p-mara/, "links stay on the chosen project");
        await noSidewaysScroll(page, label);
        await plainWords(page, label);
        await axe(page, label);
        await shot(page, `analytics-one-track-${viewport}-${theme}`);
        if (theme === "dark") await shot(page, `analytics-one-track-${viewport}-${theme}-full`, { fullPage: true });
        assert.deepEqual(errors, [], `${label}: console or page errors`);
        checks += 4;
        await context.close();
      }

      // ── Analytics: all projects, the wall ────────────────────────────────
      {
        const { page, context, errors, label } = await open(browser, { viewport, theme, surface: "analytics", state: "twelve", query: "view=projects" });
        await page.getByRole("heading", { name: "Analytics", level: 1 }).waitFor();
        const cardIds = () => page.locator("[data-wall-card]").evaluateAll((els) => els.map((el) => el.getAttribute("data-wall-card")));
        assert.deepEqual(await cardIds(), ["p-winter", "p-mara", "p-barn", "p-keane", "p-garden", "p-newyear", "p-harvest", "p-kitchen", "p-website", "p-shared"]);
        const mara = squash(await page.locator("[data-wall-card='p-mara']").innerText());
        assert.match(mara, /Mara & Finn’s wedding Aoife Brennan leads At risk Today Menu tasting · Mon 5 Oct/);
        assert.match(mara, /23 of 44 done Open 21 Late 2 Done in the last 7 days 15 Oldest late: Reprint the faded welcome sign/);
        assert.match(await page.locator("#root").innerText(), /32 tasks finished across these projects in the last 7 days, most in Mara & Finn’s wedding \(15\)\. The week before: 42\./);
        assert.equal(await page.locator("[data-wall-card='p-mara'] h2 a").getAttribute("href"), "/app/analytics?workspaceId=p-mara");
        assert.equal(await page.getByRole("navigation", { name: "Analytics" }).getByRole("link", { name: "All projects" }).getAttribute("aria-current"), "page");
        await noSidewaysScroll(page, label);
        await plainWords(page, label);
        await axe(page, label);
        await shot(page, `analytics-wall-${viewport}-${theme}`);
        if (theme === "dark" || viewport === "phone") await shot(page, `analytics-wall-${viewport}-${theme}-full`, { fullPage: true });
        await page.getByRole("link", { name: "Most late" }).click();
        assert.deepEqual((await cardIds()).slice(0, 3), ["p-winter", "p-barn", "p-mara"]);
        assert.match(page.url(), /sort=late/);
        await page.getByRole("link", { name: "Name", exact: true }).click();
        assert.deepEqual((await cardIds()).slice(0, 2), ["p-barn", "p-garden"]);
        await page.getByRole("navigation", { name: "Analytics" }).getByRole("link", { name: "Ask" }).click();
        await page.locator("[data-question='shape']").waitFor();
        assert.deepEqual(errors, [], `${label}: console or page errors`);
        checks += 11;
        await context.close();
      }

      // ── Analytics: sparse, empty, partial reads, loading, no project ─────
      for (const [state, query, wait] of [
        ["sparse", "", "My first project"],
        ["sparse", "ask=shape", "1 task is late"],
        ["sparse", "ask=who", "No one is assigned to any of the 7 open tasks."],
        ["sparse", "ask=slip", "No task had its date changed more than once"],
        ["sparse", "ask=long", "Half of tasks are finished within 2.5 days"],
        ["sparse", "view=projects", "My first project"],
        ["empty", "", "Nothing to measure yet"],
        ["no-record", "", "Which projects are in the worst shape?"],
        ["partial", "view=projects", "Mara & Finn’s wedding"],
        ["wall-down", "view=projects", "Your projects could not be listed just now"],
        ["unavailable", "", "No project open"],
        ["loading", "", null],
      ]) {
        const { page, context, errors, label } = await open(browser, { viewport, theme, surface: "analytics", state, query });
        if (wait) await page.getByText(wait).first().waitFor();
        else await page.getByRole("status", { name: "Opening Analytics" }).waitFor();
        if (state === "sparse" && !query) {
          // One project: the scope is a label, not a menu, and every question is still answerable.
          assert.equal(await page.getByRole("button", { name: /^Showing/ }).count(), 0);
          assert.equal(await page.locator("[data-question]").count(), 8);
          assert.equal(squash(await page.locator("header p").first().innerText()), "7 open 1 late 2 done in the last 7 days");
          await page.getByRole("combobox", { name: "What do you want to know about My first project?" }).waitFor();
        }
        if (state === "sparse" && query === "ask=shape") {
          assert.equal(squash(await page.locator("[data-answer]").innerText()), "1 task is late, the oldest by 1 day. 7 tasks are open, 1 due in the next 7 days. In the last 7 days 2 were finished and 9 added.");
        }
        if (state === "sparse" && query === "view=projects") assert.equal(await page.locator("[data-wall-card]").count(), 1);
        if (state === "no-record") {
          // The record of date changes was not read: that question is left out and the grid rebalances.
          assert.equal(await page.locator("[data-question]").count(), 7);
          assert.equal(await page.locator("[data-question='slip']").count(), 0);
        }
        if (state === "partial") {
          assert.doesNotMatch(await page.locator("#root").innerText(), /finished across these projects|Finished each day/, "figures whose read failed are absent");
          assert.equal(await page.locator("[data-wall-card]").count(), 4);
        }
        await noSidewaysScroll(page, `${label} ${query}`);
        await plainWords(page, `${label} ${query}`);
        if (state !== "loading") await axe(page, `${label} ${query}`);
        await shot(page, `analytics-${state}${query ? `-${query.replace(/^(ask|view)=/, "")}` : ""}-${viewport}-${theme}`);
        assert.deepEqual(errors, [], `${label} ${query}: console or page errors`);
        checks += 2;
        await context.close();
      }
    }
  }

  // Motion: entrances run by default and are off under reduced motion.
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const { page, context } = await open(browser, { viewport: "desk", theme: "dark", surface: "files", reducedMotion });
    await rows(page).first().waitFor();
    const animated = await page.locator("li", { has: rows(page).first() }).first().evaluate((el) => getComputedStyle(el).animationName);
    assert.equal(animated === "none", reducedMotion === "reduce", `rows ${reducedMotion === "reduce" ? "do not animate" : "rise"} with motion ${reducedMotion}`);
    checks += 1;
    await context.close();
  }

  console.log(`PASS files and analytics: ${checks} checks across wide, desk, tablet and phone, light and dark${capture ? `; ${shots.length} screenshots in ${outDir.replace(/\\/g, "/")}` : ""}`);
} finally {
  await browser?.close();
}
