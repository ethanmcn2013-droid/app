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
    "next/navigation": { redirect: (href: string) => { throw new Error(`redirect:${href}`); } },
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
  await assert.rejects(page.SignalLegacyBriefing({ searchParams: params }), /redirect:\/app\/home\/briefing\/onboarding/);
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
});

test("no-workspace remains a new-user result without invented signals", async () => {
  const home = load<typeof import("./home-data")>("./home-data.ts", {
    "@/modules/signal/home": { buildBriefingForUser: async () => ({ kind: "no-workspace" }) },
  });
  assert.deepEqual(await home.loadHomeData({ clerkId: "new" }), { kind: "new-user" });
});
