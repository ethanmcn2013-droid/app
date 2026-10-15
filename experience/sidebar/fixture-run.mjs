/**
 * Browser check for the sidebar readers review mode cannot show.
 *
 *   node experience/sidebar/fixture-run.mjs                  # checks only
 *   node experience/sidebar/fixture-run.mjs --capture [dir]  # checks, then screenshots
 *   node experience/sidebar/fixture-run.mjs --serve-only    # CUA preview; no browser launch
 *
 * Bundles `fixture.tsx` with the real AppShell and AppSidebar, their real
 * styles and the v3 tokens. Every server action is replaced at the module
 * seam: the sidebar's Projects read answers from the fixture, and any other
 * action fails the run if it is called. Stubbed besides: `next/link` and
 * `next/navigation` (the page you are on comes from `?path`), Clerk's
 * account button, and the Active Project provider (the open Project comes
 * from the fixture). No dev server, no database, no network. Four sizes,
 * dark and light; the rail at desk size.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import path from "node:path";
import { createRequire } from "node:module";
import { BANNED, VIEWPORTS, captureArgs, createRunner, root, text } from "../home-overview/harness.mjs";

const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve("tsx/package.json"))("esbuild");
const ts = require("typescript");

const { capture, outDir } = captureArgs("experience/output/sidebar-fixture");

const stubs = new Map([
  ["next/link", `import {createElement} from "react";export default function Link({href,prefetch,scroll,replace,...rest}){return createElement("a",{href:typeof href==="string"?href:href.pathname,...rest,onClick:e=>{rest.onClick&&rest.onClick(e);if(!e.defaultPrevented)e.preventDefault()}})}`],
  ["next/navigation", `const p=()=>new URLSearchParams(location.search).get("path")??"/app/home";export const usePathname=p;export const useSearchParams=()=>new URLSearchParams();const r={push(){},replace(){},refresh(){},back(){},prefetch(){}};export const useRouter=()=>r;export const redirect=()=>{throw Error("redirect outside fixture")};`],
  ["@clerk/nextjs", `export const useUser=()=>({isLoaded:true,isSignedIn:true,user:{id:"u-orla",firstName:"Orla",fullName:"Orla Doyle"}});export const useAuth=()=>({isLoaded:true,isSignedIn:true,userId:"u-orla"});export const useClerk=()=>({signOut(){}});export const UserButton=Object.assign(()=>null,{MenuItems:()=>null,Link:()=>null,Action:()=>null});`],
  [
    "@/components/app/active-project-provider",
    `export const useActiveProject=()=>{const f=window.sidebarFixture;return {enabled:true,chrome:f.currentProject?{kind:"verified",project:f.currentProject}:{kind:"none"},selectProject(project){f.selected.push(project.id)}}};`,
  ],
]);

const ACTION_ANSWERS = {
  // Unanswered on purpose for `loading`: the promise never settles.
  loadSidebarProjectsAction: `()=>window.sidebarFixture.answer===null?new Promise(()=>{}):Promise.resolve(window.sidebarFixture.answer)`,
};

const plugin = {
  name: "server-seams",
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => (stubs.has(args.path) ? { path: args.path, namespace: "fixture-stub" } : undefined));
    build.onLoad({ filter: /.*/, namespace: "fixture-stub" }, (args) => ({ contents: stubs.get(args.path), loader: "js", resolveDir: root }));
    build.onLoad({ filter: /\.[tj]sx?$/ }, async (args) => {
      if (!args.path.startsWith(path.join(root, "src"))) return undefined;
      const source = await readFile(args.path, "utf8");
      if (!/^\s*["']use server["']/.test(source)) return undefined;
      const file = path.relative(root, args.path).replaceAll("\\", "/");
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      const names = [];
      for (const statement of ast.statements) {
        if (ts.isFunctionDeclaration(statement) && statement.name && statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) names.push(statement.name.text);
        if (ts.isVariableStatement(statement) && statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) for (const d of statement.declarationList.declarations) if (ts.isIdentifier(d.name)) names.push(d.name.text);
        if (ts.isExportDeclaration(statement) && !statement.isTypeOnly && statement.exportClause && ts.isNamedExports(statement.exportClause)) for (const el of statement.exportClause.elements) if (!el.isTypeOnly) names.push(el.name.text);
      }
      const contents = names
        .map((name) => `export const ${name}=${ACTION_ANSWERS[name] ?? `()=>{throw Error(${JSON.stringify(`Action outside the sidebar fixture: ${name}`)})}`};`)
        .join("\n");
      return { contents, loader: "js" };
    });
  },
};

const bundle = await esbuild.build({
  entryPoints: [path.join(root, "experience/sidebar/fixture.tsx")],
  absWorkingDir: root,
  outdir: path.join(root, "experience/output/sidebar-fixture/bundle"),
  bundle: true,
  write: false,
  metafile: true,
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
if (process.argv.includes("--serve-only")) {
  const portIndex = process.argv.indexOf("--port");
  const port = portIndex < 0 ? 49276 : Number(process.argv[portIndex + 1]);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error("Invalid sidebar fixture port");
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Sidebar synthetic component fixture</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>';
  const fonts = new Map([
    ["/fonts/Geist-Variable.woff2", "node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2"],
    ["/fonts/GeistMono-Variable.woff2", "node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2"],
  ]);
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  const receipt = {
    scope: "Actual AppShell/AppSidebar/styles with declared synthetic provider, navigation and server-action ports; no provider continuity or production flag change; no browser launched",
    origin: `http://127.0.0.1:${port}`,
    jsSha256: digest(js), cssSha256: digest(css),
    sourceInputs: Object.keys(bundle.metafile.inputs).sort(),
    declaredModulePorts: [...stubs.keys()],
  };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "serve-only-build.json"), JSON.stringify(receipt, null, 2) + "\n");
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, receipt.origin);
      if (request.method !== "GET" || url.origin !== receipt.origin) { response.writeHead(404); response.end(); return; }
      response.setHeader("Cache-Control", "no-store");
      if (url.pathname === "/") { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end(html); }
      else if (url.pathname === "/app.js") { response.setHeader("Content-Type", "application/javascript"); response.end(js); }
      else if (url.pathname === "/app.css") { response.setHeader("Content-Type", "text/css"); response.end(css); }
      else if (fonts.has(url.pathname)) { response.setHeader("Content-Type", "font/woff2"); response.end(await readFile(path.join(root, fonts.get(url.pathname)))); }
      else { response.writeHead(404); response.end(); }
    } catch { response.writeHead(500); response.end("Sidebar fixture unavailable"); }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
  console.log(`Sidebar synthetic component fixture: ${receipt.origin}/?state=many&theme=dark`);
  console.log(receipt.scope);
  // The serve-only path deliberately cannot reach the browser runner below.
  await new Promise(() => {});
}
const run = createRunner({ js, css, origin: "http://127.0.0.1:49276", title: "Sidebar", capture, outDir });

const projectsNav = (aside) => aside.locator('nav[aria-label="Projects"]');
const projectRows = (aside) => projectsNav(aside).locator("a[data-project-row]");

try {
  await run.launch();
  for (const viewport of Object.keys(VIEWPORTS)) {
    const drawer = VIEWPORTS[viewport].width < 900;
    for (const theme of ["dark", "light"]) {
      for (const state of ["many", "none", "no-chat", "failed", "loading", "one", "wedding"]) {
        const { page, context, errors } = await run.open({ viewport, theme, state, query: state === "wedding" ? "&path=/app/wedding/guests" : "" });
        const label = `${state}-${viewport}-${theme}`;
        const aside = page.locator("aside");
        if (drawer) {
          await page.getByRole("button", { name: /open (navigation|menu|sidebar)/i }).first().click();
        }
        await aside.getByRole("link", { name: "Home", exact: true }).waitFor({ state: "visible" });

        // Groups in order, every reader.
        const groups = await aside.locator("nav[data-group]").evaluateAll((navs) => navs.map((nav) => nav.dataset.group));
        assert.deepEqual(groups, ["primary", "workspace", "projects", "more", "chat"], `${label}: groups`);
        run.checks += 1;

        if (state !== "none" && state !== "no-chat") {
          const chat = aside.locator('nav[aria-label="Chat"]');
          // DIRECTORY deliberately retains a typed task discussion. The actual
          // sidebar must filter that row while keeping both channels and DMs.
          assert.deepEqual(await chat.locator('a[data-chat-row]').evaluateAll((rows) => rows.map((row) => row.getAttribute("href"))), [
            "/app/messages?c=c-orchard", "/app/messages?c=c-logistics", "/app/messages?c=d-niamh", "/app/messages?c=d-dara", "/app/messages?c=d-ciaran",
          ], `${label}: only channel and direct-message rows`);
          assert.equal(await chat.locator('a[href="/app/messages?c=c-runsheet"]').count(), 0, `${label}: task discussions stay in the full view`);
          const ordinaryUnread = chat.locator('a[href="/app/messages?c=c-logistics"]');
          assert.notEqual(await ordinaryUnread.getAttribute("data-unread"), null, `${label}: channel unread does not require a mention count`);
          const unreadDot = await ordinaryUnread.locator(':scope > span[aria-hidden="true"]').evaluate((dot) => {
            const style = getComputedStyle(dot);
            return { width: style.width, height: style.height, color: style.backgroundColor };
          });
          const dmDotColor = await chat.locator('a[href="/app/messages?c=d-niamh"] > span[aria-hidden="true"]').last().evaluate((dot) => getComputedStyle(dot).backgroundColor);
          assert.deepEqual(unreadDot, { width: "6px", height: "6px", color: dmDotColor }, `${label}: ordinary unread channel retains its indigo dot`);
          assert.doesNotMatch(await ordinaryUnread.innerText(), /\d/, `${label}: ordinary unread has no invented count`);
          assert.equal(await chat.getByRole("link", { name: /The Orchard, events.*1 mention/ }).count(), 1, `${label}: channel mention count remains accessible`);
          for (const id of ["d-niamh", "d-dara", "d-ciaran"]) {
            const avatar = await chat.locator(`a[href="/app/messages?c=${id}"] > span[aria-hidden="true"]`).first().evaluate((wrap) => {
              const style = getComputedStyle(wrap.firstElementChild);
              return { width: style.width, height: style.height, shadow: style.boxShadow, outline: style.outlineStyle,
                border: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth] };
            });
            assert.deepEqual(avatar, { width: "22px", height: "22px", shadow: "none", outline: "none", border: ["0px", "0px", "0px", "0px"] }, `${label}: ${id} avatar is 22px without an outline`);
          }
          const presence = await chat.locator('a[href="/app/messages?c=d-niamh"] > span[aria-hidden="true"]').first().evaluate((wrap) => {
            const dot = wrap.lastElementChild;
            const style = getComputedStyle(dot);
            return { parts: wrap.children.length, position: style.position, width: style.width, height: style.height, visible: style.visibility };
          });
          assert.deepEqual(presence, { parts: 2, position: "absolute", width: "8px", height: "8px", visible: "visible" }, `${label}: existing online presence remains`);
          run.checks += 10;
        }

        if (state === "many") {
          await projectRows(aside).first().waitFor();
          assert.equal(await projectRows(aside).count(), 8, `${label}: eight rows, then All projects`);
          await projectsNav(aside).getByRole("link", { name: "All 12 projects", exact: true }).waitFor();
          const late = projectsNav(aside).locator('a[data-mark="late"]');
          const risk = projectsNav(aside).locator('a[data-mark="risk"]');
          assert.equal(await late.getAttribute("aria-label"), "Kitchen refit, past its target date");
          assert.equal(await risk.getAttribute("aria-label"), "Spring menu launch for the cafe and the two market stalls, at risk, open now");
          assert.equal(await projectsNav(aside).locator("[data-tone]").count(), 2, `${label}: two dots, no more`);
          assert.notEqual(
            await late.locator("[data-tone]").evaluate((el) => getComputedStyle(el).backgroundColor),
            await risk.locator("[data-tone]").evaluate((el) => getComputedStyle(el).backgroundColor),
            `${label}: late and at risk read differently`,
          );
          // The long name stays on one line and keeps its dot in view.
          const fits = await risk.evaluate((el) => {
            const name = el.querySelector("span:nth-of-type(2)");
            const dot = el.querySelector("[data-tone]").getBoundingClientRect();
            return { oneLine: name.getBoundingClientRect().height < 24, dotInside: dot.right <= el.getBoundingClientRect().right + 0.5 };
          });
          assert.deepEqual(fits, { oneLine: true, dotInside: true }, `${label}: long name`);
          run.checks += 6;
        }
        if (state === "none") {
          await projectsNav(aside).getByText("No projects yet", { exact: true }).waitFor();
          assert.equal(await projectsNav(aside).getByRole("link", { name: "Start one", exact: true }).getAttribute("href"), "/app/project");
          await aside.locator('nav[aria-label="Chat"]').getByText("No conversations yet", { exact: true }).waitFor();
          run.checks += 2;
        }
        if (state === "no-chat") {
          const chat = aside.locator('nav[aria-label="Chat"]');
          await chat.getByText("Coming soon", { exact: true }).waitFor();
          assert.equal(await chat.locator("a").count(), 0, `${label}: nowhere to go yet, so no link`);
          assert.equal(await projectsNav(aside).locator("[data-tone]").count(), 1);
          run.checks += 2;
        }
        if (state === "failed") {
          await projectsNav(aside).getByText("Projects are unavailable right now.", { exact: true }).waitFor();
          assert.equal(await projectRows(aside).count(), 0);
          run.checks += 1;
        }
        if (state === "loading") {
          await projectsNav(aside).locator('[role="status"]', { hasText: "Loading projects…" }).waitFor();
          run.checks += 1;
        }
        if (state === "wedding") {
          const tools = projectsNav(aside).locator('[role="group"][aria-label="Wedding tools for The Orchard, events"]');
          await tools.waitFor();
          const guests = tools.getByRole("link", { name: "Guest list", exact: true });
          assert.equal(await guests.getAttribute("href"), "/app/wedding/guests?workspaceId=p-orchard", `${label}: guest list keeps the Project`);
          assert.equal(await guests.getAttribute("aria-current"), "page", `${label}: the page you are on`);
          assert.equal(await tools.locator("a").count(), 1, `${label}: Seating and Budget go nowhere yet`);
          const soon = (await tools.locator('[aria-disabled="true"]').allTextContents()).map((t) => t.replace(/\s+/g, " ").trim());
          assert.deepEqual(soon, ["SeatingComing Soon", "BudgetComing Soon"], `${label}: two coming soon`);
          assert.equal(await projectsNav(aside).locator('[role="group"]').count(), 1, `${label}: only the open wedding nests`);
          run.checks += 5;
        }
        if (state === "one") {
          assert.equal(await projectsNav(aside).locator('[role="group"]').count(), 0, `${label}: not a wedding, no Wedding tools`);
          run.checks += 1;
          await projectRows(aside).first().waitFor();
          assert.equal(await projectRows(aside).count(), 1);
          assert.equal(await projectsNav(aside).locator("[data-tone]").count(), 0, `${label}: no status, no dot`);
          run.checks += 2;
        }

        if (["many", "one", "no-chat", "wedding"].includes(state)) {
          const rings = await projectRows(aside).evaluateAll((rows) => rows.map((row) => {
            const ring = row.querySelector(':scope > span[aria-hidden="true"]');
            const style = getComputedStyle(ring);
            return { current: row.hasAttribute("data-current-project"), color: style.borderTopColor, outline: style.outlineStyle };
          }));
          assert.equal(rings.filter((ring) => ring.current).length, 1, `${label}: one selected Project`);
          for (const ring of rings) {
            if (ring.current) assert.notEqual(ring.color, "rgba(0, 0, 0, 0)", `${label}: selected Project has its indigo outer ring`);
            else assert.equal(ring.color, "rgba(0, 0, 0, 0)", `${label}: unselected Projects have no outer ring`);
            assert.equal(ring.outline, "none", `${label}: Project ring has no additional light outline`);
          }
          run.checks += 1 + rings.length * 2;
        }

        const words = text(await aside.innerText());
        assert.doesNotMatch(words, BANNED, `${label}: words`);
        run.checks += 1;
        // The page and the sidebar's own scroll area never scroll sideways.
        // (The harness's stricter scan also flags the presence dot and the
        // launcher's badge, which overhang their boxes on purpose and scroll
        // nothing.)
        const sideways = await page.evaluate(() => ({
          page: document.scrollingElement.scrollWidth - window.innerWidth,
          aside: [...document.querySelectorAll("aside, aside *")].filter((el) => ["auto", "scroll"].includes(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1).length,
        }));
        assert.deepEqual(sideways, { page: 0, aside: 0 }, `${label}: sideways scroll`);
        run.checks += 1;
        await run.axe(page, label);
        assert.deepEqual(errors, [], `${label}: console`);
        run.checks += 1;
        await run.shot(page, `sidebar-${label}`);
        await context.close();
      }
    }
  }

  // The rail on a desk: tiles only, and five Projects before "All".
  for (const theme of ["dark", "light"]) {
    const { page, context, errors } = await run.open({ viewport: "desk", theme, state: "many", query: "&rail=1" });
    const aside = page.locator("aside");
    await projectRows(aside).first().waitFor();
    assert.equal(await page.locator('[data-shell="v3"][data-collapsed]').count(), 1, "rail: collapsed");
    assert.equal(await projectRows(aside).count(), 5, "rail: five Projects");
    // The first five keep their dots. The open Project here is sixth, so the
    // rail does not show it: recorded on the pull request as a finding.
    assert.equal(await projectsNav(aside).locator('a[data-mark="late"] [data-tone]').count(), 1, "rail: the late dot stays");
    assert.equal(await projectsNav(aside).locator("a[data-current-project]").count(), 0, "rail: the sixth, open Project is past the cut");
    assert.equal(await projectsNav(aside).getByRole("link", { name: "All 12 projects" }).count(), 1, "rail: All projects");
    // A full rail fits a 900px window: no row sits half under the footer.
    const railOverflow = await aside.evaluate((node) => {
      const scroller = [...node.querySelectorAll("*")].find((el) => getComputedStyle(el).overflowY === "auto");
      return scroller ? scroller.scrollHeight - scroller.clientHeight : null;
    });
    assert.equal(railOverflow, 0, `rail: the full rail fits without scrolling (${railOverflow}px over)`);
    assert.deepEqual(errors, [], "rail: console");
    run.checks += 7;
    await run.shot(page, `sidebar-rail-desk-${theme}`);
    await context.close();
  }

  console.log(`PASS sidebar fixture: ${run.checks} checks across ${Object.keys(VIEWPORTS).length} sizes, dark and light, seven readers and the rail${capture ? `; ${run.shots.length} captures in ${path.relative(root, outDir)}` : ""}`);
} finally {
  await run.close();
}
