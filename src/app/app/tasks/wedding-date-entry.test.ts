import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PROJECT_APP_PATH } from "@/lib/product-urls";
import { withActiveProject } from "@/lib/projects/project-url";

const require = createRequire(import.meta.url);
function load(file: URL, boundaries: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports: Record<string, unknown> = {};
  vm.runInNewContext(code, { exports, require: (id: string) => {
    if (Object.hasOwn(boundaries, id)) return boundaries[id];
    if (["react", "react/jsx-runtime", "next/link"].includes(id)) return require(id);
    throw Error(`Unexpected fixture import ${id}`);
  } });
  return exports;
}
const welcome = load(new URL("../../../components/welcome/venue-welcome-card.tsx", import.meta.url), {
  "@/lib/use-hydrated": { useHydrated: () => true },
  "@/lib/product-urls": { PROJECT_APP_PATH }, "@/lib/projects/project-url": { withActiveProject },
});

for (const canManage of [true, false]) for (const weddingDate of [null, "2029-06-01"]) {
  test(`actual Tasks strip and hydrated welcome: manager=${canManage}, date=${weddingDate}`, async () => {
    const boundaries = {
      "@/lib/product-urls": { PROJECT_APP_PATH }, "@/lib/projects/project-url": { withActiveProject },
      "@/server/db/sponsored-wedding-date": { readSponsoredWeddingDate: async () => ({ canManage, weddingDate }) },
      "@/server/db": { db: {} }, "@/server/auth": { getCurrentUser: async () => "fixture" },
      "@/lib/access-mode": { isDemoMode: () => false },
      "@/server/db/venue-welcome": { detectVenueWelcome: async () => ({ sponsorName: "Synthetic venue", sponsorSlug: "synthetic", code: "SYNTHETIC" }), markVenueEntitlementReached: async () => {} },
      "@/components/welcome/venue-welcome-card": welcome,
      "@/components/hybrid/hybrid-workspace": { HybridWorkspace: () => null },
      "@/components/app/tasks-runtime-mount": { TasksRuntimePageMount: ({ children }: { children: React.ReactNode }) => createElement("div", null, children) },
      "@/components/app/templated-toast": { TemplatedToast: () => null },
      "@/components/app/tasks-project-arrival": { resolveTasksArrival: async () => ({ kind: "ready", project: { kind: "ready", workspaceId: "project-exact" } }) },
      "@/server/demo/tasks-demo": {},
    };
    const { default: Page } = load(new URL("./page.tsx", import.meta.url), boundaries);
    const tree = await (Page as (props: unknown) => Promise<ReturnType<typeof createElement>>)({ searchParams: Promise.resolve({ welcome: "venue", workspaceId: "project-exact" }) });
    const html = renderToStaticMarkup(tree);
    assert.equal((html.match(/href="\/app\/project\?workspaceId=project-exact#wedding-date"/g) ?? []).length, 2);
    if (canManage) {
      assert.match(html, /Add or update your wedding date/);
      assert.ok(html.includes(weddingDate ? "View or update wedding date" : "Add your wedding date"));
    } else {
      assert.equal((html.match(/>View wedding date<\/a>/g) ?? []).length, 2);
      assert.doesNotMatch(html, /Add your wedding date|Add or update your wedding date|View or update wedding date/);
      assert.match(html, /Someone who can manage this project can add the wedding date/);
    }
  });
}
