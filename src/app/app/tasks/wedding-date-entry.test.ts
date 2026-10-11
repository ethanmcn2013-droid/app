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
    const actors: string[] = [];
    const boundaries = {
      "@/lib/product-urls": { PROJECT_APP_PATH }, "@/lib/projects/project-url": { withActiveProject },
      "@/server/db/sponsored-wedding-date": { readSponsoredWeddingDate: async (_db: unknown, scope: { actorUserId: string }) => {
        actors.push(`date:${scope.actorUserId}`); return { canManage, weddingDate };
      } },
      "@/server/db": { db: {} }, "@/server/auth": { getCurrentUser: () => { throw Error("page must reuse verified arrival actor"); } },
      "@/lib/access-mode": { isDemoMode: () => false },
      "@/server/db/venue-welcome": { detectVenueWelcome: async (actor: string) => {
        actors.push(`venue:${actor}`); return { sponsorName: "Synthetic venue", sponsorSlug: "synthetic", code: "SYNTHETIC" };
      }, markVenueEntitlementReached: async (actor: string) => { actors.push(`mark:${actor}`); } },
      "@/components/welcome/venue-welcome-card": welcome,
      "@/components/hybrid/hybrid-workspace": { HybridWorkspace: () => null },
      "@/components/app/tasks-runtime-mount": { TasksRuntimePageMount: ({ children }: { children: React.ReactNode }) => createElement("div", null, children) },
      "@/components/app/templated-toast": { TemplatedToast: () => null },
      "@/components/app/tasks-project-arrival": { resolveTasksArrival: async () => ({ kind: "ready", actorUserId: "mapped-internal-actor", project: { kind: "ready", workspaceId: "project-exact" } }) },
      "@/server/demo/tasks-demo": {},
    };
    const { default: Page } = load(new URL("./page.tsx", import.meta.url), boundaries);
    const tree = await (Page as (props: unknown) => Promise<ReturnType<typeof createElement>>)({ searchParams: Promise.resolve({ welcome: "venue", workspaceId: "project-exact" }) });
    const html = renderToStaticMarkup(tree);
    assert.deepEqual(actors, ["date:mapped-internal-actor", "venue:mapped-internal-actor", "mark:mapped-internal-actor"]);
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

test("Tasks refusal stops before wedding or venue reads", async () => {
  const forbidden = () => { throw Error("refused route crossed a private read"); };
  const { default: Page } = load(new URL("./page.tsx", import.meta.url), {
    "@/lib/product-urls": { PROJECT_APP_PATH }, "@/lib/projects/project-url": { withActiveProject },
    "@/server/db/sponsored-wedding-date": { readSponsoredWeddingDate: forbidden },
    "@/server/db": { db: {} }, "@/server/auth": { getCurrentUser: forbidden },
    "@/lib/access-mode": { isDemoMode: forbidden },
    "@/server/db/venue-welcome": { detectVenueWelcome: forbidden, markVenueEntitlementReached: forbidden },
    "@/components/welcome/venue-welcome-card": welcome,
    "@/components/hybrid/hybrid-workspace": { HybridWorkspace: forbidden },
    "@/components/app/tasks-runtime-mount": { TasksRuntimePageMount: forbidden },
    "@/components/app/templated-toast": { TemplatedToast: forbidden },
    "@/components/app/tasks-project-arrival": { resolveTasksArrival: async () => ({ kind: "unavailable" }),
      TasksArrivalRefusal: () => createElement("div", null, "unavailable") },
    "@/server/demo/tasks-demo": {},
  });
  const tree = await (Page as (props: unknown) => Promise<ReturnType<typeof createElement>>)(
    { searchParams: Promise.resolve({ welcome: "venue", workspaceId: "forbidden" }) });
  assert.equal(renderToStaticMarkup(tree), "<div>unavailable</div>");
});

test("arrival carries only the actor of a proven ready route and retains flag-off ambient refusal", async () => {
  let flagOn = true;
  let explicit: { kind: string; workspaceId?: string } = { kind: "ready", workspaceId: "project-b" };
  let ambient = { kind: "ready", workspaceId: "project-a" };
  const calls: unknown[] = [];
  const arrivalModule = load(new URL("../../../components/app/tasks-project-arrival.tsx", import.meta.url), {
    "server-only": {},
    "@/lib/projects/flags": { isActiveProjectV3Enabled: () => flagOn },
    "@/lib/product-urls": { HOME_APP_PATH: "/app/home" },
    "@/server/projects/route-authz": {
      resolveProjectForRouteWithActor: async (id: unknown) => { calls.push(id); return { actorUserId: "internal-b", decision: explicit }; },
      resolveProjectForRoute: async (id: unknown) => { calls.push(id); return ambient; },
    },
    "./active-project-route-sync": { ActiveProjectRouteSync: () => null },
    "./open-tasks-project": { OpenTasksProject: () => null },
  });
  const resolve = arrivalModule.resolveTasksArrival as (id?: string) => Promise<Record<string, unknown>>;
  const ready = await resolve("project-b");
  assert.equal(ready.kind, "ready");
  assert.equal(ready.actorUserId, "internal-b");
  assert.deepEqual(calls, ["project-b"]);
  flagOn = false;
  const refused = await resolve("project-b");
  assert.equal(refused.kind, "selection-required");
  assert.equal(Object.hasOwn(refused, "actorUserId"), false);
  assert.deepEqual(calls.slice(1), ["project-b", undefined]);
  ambient = { kind: "ready", workspaceId: "project-b" };
  assert.equal((await resolve("project-b")).actorUserId, "internal-b");
  explicit = { kind: "unavailable" };
  const unavailable = await resolve("project-b");
  assert.equal(unavailable.kind, "unavailable");
  assert.equal(Object.hasOwn(unavailable, "actorUserId"), false);
});
