import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild");
const { chromium } = require("@playwright/test");
const out = process.env.PROJECTS_PROOF_DIR;
const result = await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {ProjectConsole} from './src/components/app/project/project-console';import {buildConsole,consoleGroups} from './src/lib/projects/project-console';import {ProjectList} from './src/components/app/project/project-list';import {consoleFixture} from './src/lib/projects/project-console.fixture';
const fixture=consoleFixture();const root=createRoot(document.getElementById('root'));window.visits=[];window.show=(mode='ready',view='console')=>{const projects=fixture.projects.map((p,i)=>({...p,facts:p.facts?{...p.facts,timeline:mode==='failed'?undefined:mode==='empty'?[]:[{id:'m1',title:'Venue confirmed',date:'2026-09-20',done:true},{id:'m2',title:'Final headcount',date:'2026-10-09',done:false},{id:'m3',title:'Wedding day',date:'2026-10-17',done:false}],timelineTruncated:mode==='limited'}:null}));const model=buildConsole(projects,fixture.today);root.render(view==='list'?<ProjectList groups={consoleGroups(model,'all')} statsFor={id=>projects.find(p=>p.id===id)?.stats??null} today={fixture.today} openProjectId={null} hrefFor={(id,surface)=>'/app/'+surface+'?workspaceId='+id} onGo={(id,surface)=>window.visits.push({id,surface})}/>:<ProjectConsole model={model} initialFilter='all' query='' onClearQuery={()=>{}} openProjectId={null} pendingProjectId={null} hrefFor={(id,surface)=>'/app/'+surface+'?workspaceId='+id} taskHref={()=>'#'} weekHref={null} onGo={(id,surface)=>window.visits.push({id,surface})}/>)};window.show();`, loader: "tsx", resolveDir: root }, bundle: true, write: false, platform: "browser", format: "iife", outdir: "fixture", tsconfig: path.join(root, "tsconfig.json"), plugins: [{ name: "project-colour-only", setup(b) { b.onResolve({filter: /^@\/components\/shell\/app-sidebar$/}, () => ({path:"color",namespace:"fixture"})); b.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:"export const projectColor=()=> 'var(--v3-project-1)';",loader:"js"})); } }] });
const js = result.outputFiles.find(file => file.path.endsWith(".js")).text;
const css = result.outputFiles.find(file => file.path.endsWith(".css")).text;
const tokens = readFileSync(path.join(root, "src/ds/v3.css"), "utf8");
const browser = await chromium.launch({ headless: true });
const records = [];
try {
  if (out) mkdirSync(out, { recursive: true });
  for (const [width, theme] of [[1440, "light"], [1440, "dark"], [390, "light"]]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.setContent(`<html data-theme="${theme}"><style>${tokens}\nbody{margin:24px;background:var(--v3-bg);font-family:Arial,sans-serif;color:var(--v3-text)}${css}</style><div id="root"></div></html>`);
    await page.addScriptTag({ content: js });
    await page.getByRole("tab", { name: /^All/ }).waitFor();
    assert.equal(await page.getByRole("tab", { name: /Needs a look/ }).count(), 0);
    assert.equal(await page.getByText("No status yet", { exact: true }).count(), 0);
    const row = page.locator('[data-row="p-winter"]');
    assert.equal(await row.getByText("Lead", { exact: true }).count(), 1);
    assert.equal(await row.locator('[role="img"]').count(), 1, "one task completion bar per row");
    await row.getByRole("link", { name: "See timeline" }).focus();
    await page.getByRole("tooltip").waitFor();
    const previewBounds = await page.getByRole("tooltip").boundingBox();
    assert.ok(previewBounds.x >= 0 && previewBounds.x + previewBounds.width <= width, `preview stays inside ${width}px viewport`);
    assert.ok(previewBounds.y >= 0 && previewBounds.y + previewBounds.height <= 1000, "preview stays inside viewport height");
    assert.match(await page.getByRole("tooltip").innerText(), /Project milestones.*Venue confirmed.*Final headcount.*Wedding day/s);
    if (out) await page.screenshot({ path: path.join(out, `projects-${width}-${theme}.png`), fullPage: false });
    await page.keyboard.press("Escape"); assert.equal(await page.getByRole("tooltip").count(), 0);
    await row.getByRole("link", { name: "See timeline" }).click();
    assert.equal((await page.evaluate(() => window.visits))[0].surface, "timeline");
    for (const [mode, words] of [["failed", "couldn’t be loaded"], ["empty", "No dated milestones yet"], ["limited", "Preview limited"]]) {
      await page.evaluate(mode => { document.activeElement?.blur(); window.show(mode); }, mode);
      await row.getByRole("link", { name: "See timeline" }).focus();
      await page.getByRole("tooltip").waitFor();
      assert.match(await page.getByRole("tooltip").innerText(), new RegExp(words));
      await page.keyboard.press("Escape");
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.evaluate(() => { document.activeElement?.blur(); window.show(); });
    const longRow = page.locator('[data-row="p-harvest"]');
    await longRow.getByRole("link", { name: "See timeline" }).focus();
    await page.getByRole("tooltip").waitFor();
    const longBounds = await page.getByRole("tooltip").boundingBox();
    assert.ok(longBounds.x >= 0 && longBounds.x + longBounds.width <= width, "long project title preview fits");
    await page.keyboard.press("Escape");
    let listBounds = null;
    if (width === 1440) {
      await page.evaluate(() => window.show('ready', 'list'));
      await page.locator('[data-list-row="p-harvest"]').getByRole('link', {name:'See timeline'}).focus();
      await page.getByRole('tooltip').waitFor();
      listBounds = await page.getByRole('tooltip').boundingBox();
      assert.ok(listBounds.x >= 0 && listBounds.x + listBounds.width <= width, 'List keyboard preview fits');
    }
    assert.deepEqual(errors, []); records.push({ width, theme, previewBounds, longBounds, listBounds, checks: "one bar, owner retained, timeline keyboard preview/destination, empty/failure/limited, no overflow, no page errors" });
    await page.close();
  }
  if (out) writeFileSync(path.join(out, "browser.json"), JSON.stringify({ records, limits: "Actual Console and preview components, synthetic authorized DTO fixture; no Next routing, authentication or production data. Reduced motion enabled." }, null, 2));
  console.log(JSON.stringify(records));
} finally { await browser.close(); }
