import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildBriefing } from "@/modules/signal/lib/briefing/build";
import { calendarDayDifference, localWeekday } from "@/modules/signal/lib/briefing/calendar-time";
import type { TaskSignal } from "@/modules/signal/lib/briefing/types";
import type { PlanningCatalog, SignalScope } from "@/modules/signal/lib/planning-periods/scope";
import type { BriefingForUserResult } from "@/modules/signal/home";
import { parseBriefingReadScopeHint } from "@/modules/signal/lib/planning-periods/read-scope-hint";

function load<T>(relative: string, boundaries: Record<string, unknown>): T {
  const file = new URL(relative, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const testModule = { exports: {} };
  const require = createRequire(file);
  new Function("require", "module", "exports", compiled)(
    (id: string) => id in boundaries ? boundaries[id] : require(id), testModule, testModule.exports,
  );
  return testModule.exports as T;
}
const scopeApi = load<typeof import("@/modules/signal/lib/planning-periods/scope")>(
  "../../../modules/signal/lib/planning-periods/scope.ts",
  { "../data/source": { dataSource: {} }, "../../server/tasks-db/signal-tasks-db-client": { getTasksDb: () => null } },
);
const now = Date.parse("2026-09-04T12:00:00Z");
const catalog: PlanningCatalog = {
  planningSchemaAvailable: true,
  periods: [{ id: "season", name: "Our season", contextType: "wedding", startDate: null, endDate: null, timezone: "Europe/Dublin" }],
  workspaces: ["project-a", "project-b"].map(id => ({ id, name: id, role: "owner", planningPeriodId: "season", contextType: null, primaryDate: null, primaryDateLabel: null })),
};
const signals = (count: number, dueAt: number | null = null): TaskSignal[] => Array.from({ length: count }, (_, index) => ({
  id: `task-${index}`, title: `Work ${index}`, lane: "in-flight", priority: 2, dueAt,
  idleDays: 0, commentCount: 0, blockedBy: [], sourceLabel: "Tasks · project-b", movedToShippedAt: null, workspaceId: "project-b",
}));
async function fixture(items: TaskSignal[], scope: SignalScope = { kind: "workspace", workspaceId: "project-b" }) {
  const authorizedScope = scopeApi.authorizeSignalScope(catalog, scope);
  assert.ok(authorizedScope);
  const briefing = await buildBriefing({ getSignalsForUser: async () => items }, { userId: "synthetic", email: "fixture@example.test" }, now);
  const result: BriefingForUserResult = { kind: "ok", briefing, authorizedScope, catalog, signals: items };
  const calls: unknown[] = [];
  const home = load<typeof import("./home-data")>("./home-data.ts", {
    "@/modules/signal/home": { calendarDayDifference, localWeekday, buildBriefingForUser: async (input: unknown) => { calls.push(input); return result; } },
  });
  const data = await home.loadHomeData({ clerkId: "synthetic" });
  assert.equal(data.kind, "ok");
  if (data.kind !== "ok") throw new Error("fixture Home unavailable");
  assert.deepEqual(calls, [{ clerkId: "synthetic", cadence: "daily", recordReadState: false }]);
  return { data, result };
}

for (const [name, items] of [["overload", signals(6)], ["crowded-week", signals(3, now + 4 * 86_400_000)]] as const) {
  test(`${name} opens the same authorized briefing scope, never a synthetic task`, async () => {
    const { data } = await fixture(items);
    const row = data.signalRows.find(item => item.trigger === name);
    assert.ok(row);
    const url = new URL(row.href, "https://fixture.invalid");
    assert.equal(url.pathname, "/app/home/briefing");
    assert.equal(url.searchParams.get("workspaceId"), "project-b");
    assert.equal(row.destination, "briefing");
    assert.equal(row.source, "Tasks · project-b");
    assert.ok(!row.href.includes("synthetic"));
  });
}

test("an aggregate across projects labels and carries the whole planning scope", async () => {
  const items = signals(6).map((item, index) => index < 3 ? { ...item, workspaceId: "project-a", sourceLabel: "Tasks · project-a" } : item);
  const { data } = await fixture(items, { kind: "planningPeriod", planningPeriodId: "season" });
  const row = data.signalRows.find(item => item.trigger === "overload");
  assert.ok(row);
  assert.equal(row.source, "Tasks · Our season");
  const params = new URL(row.href, "https://fixture.invalid").searchParams;
  assert.equal(params.get("planningPeriodId"), "season");
  assert.equal(params.has("workspaceId"), false);
});

test("ordinary tasks retain their object route and safe path encoding", async () => {
  const items = signals(1, now - 86_400_000);
  items[0].id = "task/?fragment#";
  const { data } = await fixture(items);
  assert.equal(data.signalRows[0].destination, "task");
  assert.equal(data.signalRows[0].href, "/app/task/task%2F%3Ffragment%23");
});

test("aggregate destination passes its scope to the actual briefing route and rechecks a removed project", async () => {
  const { data, result } = await fixture(signals(6));
  const row = data.signalRows.find(item => item.destination === "briefing")!;
  const params = Object.fromEntries(new URL(row.href, "https://fixture.invalid").searchParams);
  let currentCatalog = catalog;
  const observed: SignalScope[] = [];
  const page = load<typeof import("@/modules/signal/app/signal-legacy-briefing")>("../../../modules/signal/app/signal-legacy-briefing.tsx", {
    "next/navigation": { redirect: (href: string) => { throw new Error(`redirect:${href}`); }, notFound: () => { throw new Error("not-found"); } },
    "@/lib/access-mode": { isDemoMode: () => false },
    "../server/signal-auth": { requireSignalUser: async () => "synthetic" },
    "../server/onboarding/signal-onboarding-queries": { isOnboarded: async () => true },
    "../lib/planning-periods/scope": { planningPeriodsEnabled: () => true },
    "../server/briefing/signal-build-for-user": { buildBriefingForUser: async ({ scope }: { scope: SignalScope }) => {
      observed.push(scope);
      return scopeApi.authorizeSignalScope(currentCatalog, scope) ? result : { kind: "no-workspace" };
    } },
    "../server/analytics/build-ledger-dto": { buildLegacyLedgerDTO: () => ({}) },
    "../server/signal-planning-events": { recordPlanningEvent: async () => {} },
    "../components/brief/quiet-briefing-ledger": { QuietBriefingLedger: () => null },
    "../components/brief/scope-switcher": { SignalScopeSwitcher: () => null },
  });
  await page.SignalLegacyBriefing({ searchParams: params });
  assert.deepEqual(observed[0], { kind: "workspace", workspaceId: "project-b" });
  currentCatalog = { ...catalog, workspaces: catalog.workspaces.filter(item => item.id !== "project-b") };
  await assert.rejects(page.SignalLegacyBriefing({ searchParams: params }), /not-found/);
  assert.equal(observed.length, 2);
});

test("rendered Home distinguishes reading an aggregate and opening a task", async () => {
  const { data } = await fixture([...signals(6), { ...signals(1, now - 86_400_000)[0], id: "due-task" }]);
  const link = ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => createElement("a", { href, className }, children);
  const view = load<typeof import("@/components/app/home/home-view")>("../../../components/app/home/home-view.tsx", {
    "next/link": { default: link }, "./home-analytics": { HomeItemLink: link, HomeViewedPing: () => null },
  });
  const html = renderToStaticMarkup(createElement(view.HomeView, { data }));
  assert.match(html, /Read →/);
  assert.match(html, /Read full briefing/);
  assert.match(html, /Open →/);
  assert.doesNotMatch(html, /href="[^"]*synthetic/);
  assert.equal(data.briefingHref, "/app/home/briefing?contextVersion=2&workspaceId=project-b");
  assert.doesNotMatch(html, /href="\/app\/home\/briefing"/);
});

test("no-workspace remains a new-user result without invented signals", async () => {
  const home = load<typeof import("./home-data")>("./home-data.ts", {
    "@/modules/signal/home": { buildBriefingForUser: async () => ({ kind: "no-workspace" }) },
  });
  assert.deepEqual(await home.loadHomeData({ clerkId: "new" }), { kind: "new-user" });
});

function realOrchestratorFixture(periodEnabled = true) {
  const reads: string[][] = [];
  const prefs = { workspaceId: "project-a", scopeKind: "workspace", planningPeriodId: null, timezone: "Europe/Dublin" };
  const query = { from: () => query, where: () => query, limit: async () => [prefs] };
  const orchestrator = load<typeof import("@/modules/signal/server/briefing/signal-build-for-user")>(
    "../../../modules/signal/server/briefing/signal-build-for-user.ts", {
      "../db/signal-analytics-client": { signalAnalyticsDb: { select: () => query } },
      "../../lib/data/source": { dataSource: {
        getWorkspaceOnboarding: async () => null,
        readMany: async (ids: string[]) => { reads.push(ids); return ids.map(id => ({ workspaceId: id, tasks: [] })); },
      } },
      "@/lib/access-mode": { isDemoMode: () => false },
      "../../lib/planning-periods/scope": { ...scopeApi, planningPeriodsEnabled: () => periodEnabled, listPlanningCatalogForUser: async () => catalog },
      "./signal-read-state": { getDismissedKeys: async () => new Set(), getSurfacedAges: async () => new Map(), recordSurfaced: async () => {} },
      "./signal-rotation": { bumpRotations: async () => {} },
    },
  );
  return { orchestrator, reads };
}

for (const flag of [false, true]) {
  test(`actual orchestrator never falls back from an unavailable explicit project (period flag ${flag})`, async () => {
    const { orchestrator, reads } = realOrchestratorFixture(flag);
    const bad = await orchestrator.buildBriefingForUser({ clerkId: "synthetic", cadence: "daily", scope: { kind: "workspace", workspaceId: "removed-project" } });
    assert.deepEqual(bad, { kind: "no-workspace" });
    assert.deepEqual(reads, [], "must not read the saved project's tasks");
    const valid = await orchestrator.buildBriefingForUser({ clerkId: "synthetic", cadence: "daily", scope: { kind: "workspace", workspaceId: "project-b" }, recordReadState: false });
    assert.equal(valid.kind, "ok");
    if (valid.kind === "ok") assert.deepEqual(valid.authorizedScope.scope, { kind: "workspace", workspaceId: "project-b" });
    assert.deepEqual(reads, [["project-b"]]);
    await orchestrator.buildBriefingForUser({ clerkId: "synthetic", cadence: "daily", recordReadState: false });
    assert.deepEqual(reads, [["project-b"], ["project-a"]], "an unscoped visit still uses saved preferences");
  });
}

test("actual orchestrator refuses disabled or unavailable periods without reading a saved project", async () => {
  for (const flag of [false, true]) {
    const { orchestrator, reads } = realOrchestratorFixture(flag);
    const result = await orchestrator.buildBriefingForUser({ clerkId: "synthetic", cadence: "daily", scope: { kind: "planningPeriod", planningPeriodId: flag ? "missing-season" : "season" } });
    assert.deepEqual(result, { kind: "no-workspace" });
    assert.deepEqual(reads, []);
  }
});

test("actual briefing route refuses malformed or disabled explicit hints before a data read", async () => {
  let calls = 0;
  const page = load<typeof import("@/modules/signal/app/signal-legacy-briefing")>("../../../modules/signal/app/signal-legacy-briefing.tsx", {
    "next/navigation": { redirect: () => { throw new Error("redirect"); }, notFound: () => { throw new Error("not-found"); } },
    "@/lib/access-mode": { isDemoMode: () => false },
    "../server/signal-auth": { requireSignalUser: async () => "synthetic" },
    "../server/onboarding/signal-onboarding-queries": { isOnboarded: async () => true },
    "../lib/planning-periods/scope": { planningPeriodsEnabled: () => false },
    "../server/briefing/signal-build-for-user": { buildBriefingForUser: async () => { calls++; return { kind: "no-workspace" }; } },
    "../server/analytics/build-ledger-dto": {},
    "../server/signal-planning-events": {},
    "../components/brief/quiet-briefing-ledger": {},
    "../components/brief/scope-switcher": {},
  });
  for (const params of [{ workspaceId: ["project-a", "project-b"] }, { workspaceId: " " }, { planningPeriodId: "season" }, { planningPeriodId: ["season"] }]) {
    await assert.rejects(page.SignalLegacyBriefing({ searchParams: params }), /not-found/);
  }
  assert.equal(calls, 0);
  await assert.rejects(page.SignalLegacyBriefing({ searchParams: {} }), /redirect/);
  assert.equal(calls, 1, "no explicit scope retains the normal onboarding path");
});

test("actual Home page carries its explicit scope and never invents a new-user view for a refused link", async () => {
  const { data } = await fixture(signals(6));
  let permitted = true;
  let enabled = true;
  const calls: unknown[] = [];
  const page = load<typeof import("./page")>("./page.tsx", {
    "next/navigation": { redirect: () => { throw new Error("redirect"); }, notFound: () => { throw new Error("not-found"); } },
    "@/lib/access-mode": { isDemoMode: () => false },
    "@/server/app-access": { requireAppAccessTasks: async () => {} },
    "@/modules/signal/home": { requireSignalUser: async () => "synthetic", parseBriefingReadScopeHint, planningPeriodsEnabled: () => enabled },
    "./home-data": { loadHomeData: async (input: unknown) => { calls.push(input); return permitted ? data : { kind: "new-user" }; } },
    "@/components/app/home/home-view": { HomeView: () => null, HomeNewUser: () => null },
  });
  for (const flag of [true, false]) {
    enabled = flag;
    await page.default({ searchParams: Promise.resolve({ workspaceId: "project-b", planningPeriodId: "season" }) });
    assert.deepEqual(calls.at(-1), { clerkId: "synthetic", scope: { kind: "workspace", workspaceId: "project-b" } });
  }
  const before = calls.length;
  await assert.rejects(page.default({ searchParams: Promise.resolve({ workspaceId: ["project-b"] }) }), /not-found/);
  await assert.rejects(page.default({ searchParams: Promise.resolve({ planningPeriodId: "season" }) }), /not-found/);
  assert.equal(calls.length, before);
  permitted = false;
  await assert.rejects(page.default({ searchParams: Promise.resolve({ workspaceId: "project-b" }) }), /not-found/);
  await page.default();
  assert.deepEqual(calls.at(-1), { clerkId: "synthetic" }, "a bare new-user visit remains supported");
});

