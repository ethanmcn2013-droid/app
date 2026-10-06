/**
 * Browser check for the sidebar readers review mode cannot show.
 *
 *   node experience/sidebar/fixture-run.mjs                  # checks only
 *   node experience/sidebar/fixture-run.mjs --capture [dir]  # checks, then screenshots
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
    `export const useActiveProject=()=>{const f=window.sidebarFixture,id=f.currentProjectId;return {chrome:id?{kind:"verified",project:{id}}:{kind:"none"},selectProject(project){f.selected.push(project.id)}}};`,
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
const run = createRunner({ js, css, origin: "http://127.0.0.1:49276", title: "Sidebar", capture, outDir });

const projectsNav = (aside) => aside.locator('nav[aria-label="Projects"]');
const projectRows = (aside) => projectsNav(aside).locator("a[data-project-row]");

try {
  await run.launch();
  for (const viewport of Object.keys(VIEWPORTS)) {
    const drawer = VIEWPORTS[viewport].width < 900;
    for (const theme of ["dark", "light"]) {
      for (const state of ["many", "none", "no-chat", "failed", "loading", "one"]) {
        const { page, context, errors } = await run.open({ viewport, theme, state });
        const label = `${state}-${viewport}-${theme}`;
        const aside = page.locator("aside");
        if (drawer) {
          await page.getByRole("button", { name: /open (navigation|menu|sidebar)/i }).first().click();
        }
        await aside.getByRole("link", { name: "Home", exact: true }).waitFor({ state: "visible" });

        // Groups in order, every reader.
        const groups = await aside.locator("nav[data-group]").evaluateAll((navs) => navs.map((nav) => nav.dataset.group));
        assert.deepEqual(groups, ["home", "workspace", "projects", "build", "chat"], `${label}: groups`);
        run.checks += 1;

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
        if (state === "one") {
          await projectRows(aside).first().waitFor();
          assert.equal(await projectRows(aside).count(), 1);
          assert.equal(await projectsNav(aside).locator("[data-tone]").count(), 0, `${label}: no status, no dot`);
          run.checks += 2;
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
    assert.deepEqual(errors, [], "rail: console");
    run.checks += 6;
    await run.shot(page, `sidebar-rail-desk-${theme}`);
    await context.close();
  }

  console.log(`PASS sidebar fixture: ${run.checks} checks across ${Object.keys(VIEWPORTS).length} sizes, dark and light, six readers and the rail${capture ? `; ${run.shots.length} captures in ${path.relative(root, outDir)}` : ""}`);
} finally {
  await run.close();
}
