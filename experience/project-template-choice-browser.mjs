import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve("tsx/package.json"))("esbuild");
const { chromium } = require("@playwright/test");
const stubs = new Map([
  ["@clerk/nextjs", `export const useAuth=()=>({isLoaded:true,userId:"actor-a"});`],
  ["next/navigation", `export const useRouter=()=>({refresh:()=>window.templateProbe.refreshes++});export const usePathname=()=>"/app/tasks";`],
  ["next/link", `export default function Link(){return null}`],
  ["@/lib/access-mode", `export const isDemoMode=()=>false;`],
  ["@/components/app/active-project-provider", `export const useActiveProject=()=>null;`],
  ["@/server/actions/cross-workspace", `export const selectWorkspaceAction=async id=>window.templateProbe.selected.push(id);`],
  ["@/server/actions/planning", `export const createProjectAction=async name=>{window.templateProbe.blank.push(name);return {id:"ws-blank"}};export const archiveProjectAction=()=>{};export const restoreProjectAction=()=>{};export const deleteProjectAction=()=>{};`],
  ["@/server/actions/templates", `export const remixTemplateAction=async(templateId,requestId)=>{window.templateProbe.calls.push({templateId,requestId});if(window.templateProbe.calls.length===1)throw Error("lost acknowledgement");return {ok:true,workspaceId:"ws-monthly",slug:"monthly"}};`],
  ["@/lib/tasks/tasks-context", `export const useTasksState=()=>[];`],
  ["@/lib/tasks/selectors", `export const openTaskCount=()=>0;`],
  ["@/components/app/tasks-nav-state", `export const CLOSE_NAV_DRAWER_EVENT="nav:close";export const closeNavDrawer=()=>{};export const collapseNavPanel=()=>{};export const useTasksNav=()=>({expanded:true,drawerOpen:false});`],
]);
const plugin = { name: "browser-only-seams", setup(build) {
  build.onResolve({ filter: /\.module\.css$/ }, args => ({ path: args.path, namespace: "fixture-css" }));
  build.onLoad({ filter: /.*/, namespace: "fixture-css" }, () => ({ contents: `export default new Proxy({}, {get:(_target,key)=>String(key)});`, loader: "js" }));
  build.onResolve({ filter: /.*/ }, args => stubs.has(args.path) ? { path: args.path, namespace: "fixture-stub" } : undefined);
  build.onLoad({ filter: /.*/, namespace: "fixture-stub" }, args => ({ contents: stubs.get(args.path), loader: "jsx" }));
} };
const bundle = await esbuild.build({
  entryPoints: [path.join(root, "experience/project-template-choice-fixture.jsx")],
  absWorkingDir: root, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
  alias: { "@": path.join(root, "src") }, plugins: [plugin], logLevel: "silent",
  define: { "process.env.NODE_ENV": '"test"', "process.env": "{}" },
});

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("http://127.0.0.1:49271/", route => route.fulfill({
    contentType: "text/html",
    body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>',
  }));
  await page.goto("http://127.0.0.1:49271/");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.getByRole("button", { name: "Add project" }).tap();
  const input = page.getByRole("textbox", { name: "New project name" });
  await input.waitFor();
  assert.equal(await input.evaluate(element => document.activeElement === element), true);
  const starter = page.getByRole("button", { name: "Start with Monthly business rhythm" });
  // Some touch browsers blur the input to body (relatedTarget=null) before
  // they dispatch the button click. Force that ordering on the real control.
  await starter.evaluate(button => button.addEventListener("pointerdown", () => {
    document.querySelector('input[aria-label="New project name"]')?.blur();
  }, { once: true }));
  await starter.tap();
  await page.getByRole("button", { name: "Check monthly starter Project" }).waitFor();
  const first = await page.evaluate(() => window.templateProbe.calls[0]);
  assert.equal(first.templateId, "local-business-monthly-rhythm");
  assert.match(first.requestId, /^monthly-remix:/);
  await page.getByRole("button", { name: "Check monthly starter Project" }).tap();
  await page.waitForFunction(() => window.templateProbe.calls.length === 2);
  const proof = await page.evaluate(() => window.templateProbe);
  assert.equal(proof.calls[1].requestId, first.requestId);
  assert.equal(proof.blank.length, 0);
  assert.deepEqual(proof.selected, ["ws-monthly", "opened"]);

  // The blank-name path still accepts Enter and Escape; tapping elsewhere
  // with an empty input still closes the row.
  await page.getByRole("button", { name: "Add project" }).tap();
  await input.fill("Blank project");
  await input.press("Enter");
  await page.waitForFunction(() => window.templateProbe.blank.length === 1);
  assert.equal((await page.evaluate(() => window.templateProbe.blank))[0], "Blank project");
  await page.getByRole("button", { name: "Add project" }).tap();
  await input.evaluate(element => element.blur());
  await page.getByRole("button", { name: "Add project" }).waitFor();
  await page.getByRole("button", { name: "Add project" }).tap();
  await input.press("Escape");
  await page.getByRole("button", { name: "Add project" }).waitFor();
  assert.deepEqual(errors, []);
  console.log("PASS 390px touch template choice, same-request lost-ack retry, blank Enter, outside blur and Escape");
} finally {
  await browser?.close();
}
