import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { buildBriefing } from "./build";
import { detectOverload } from "./triggers";
import { phraseFor } from "./prose";
import { ledgerFromLegacyBriefing } from "../analytics/ledger-adapters";
import * as calendar from "./calendar-time";
import type { TaskSignal } from "./types";

const NOW = Date.parse("2026-11-12T10:00:00Z");
const tasks = (reviewCount = 0): TaskSignal[] => Array.from({ length: 6 }, (_, index) => ({
  id: `bench-${index}`, title: `Bench work ${index}`, lane: index < reviewCount ? "review" : "in-flight",
  stage: { key: index < reviewCount ? "review" : "doing", label: index < reviewCount ? "Review" : "Doing", phase: index < reviewCount ? "review" : "in-flight", complete: false },
  priority: 2, dueAt: null, idleDays: null, activityCoverage: "partial", commentCount: 0, blockedBy: [],
  sourceLabel: "Tasks · Repair cooperative", workspaceId: "owned", movedToShippedAt: null,
}));
async function briefing(items: TaskSignal[], now = NOW) {
  let reads = 0;
  const value = await buildBriefing({ getSignalsForUser: async () => { reads++; return items; } },
    { userId: "reader", email: "fixture@example.test" }, now, { timezone: "Europe/Dublin" });
  assert.equal(reads, 1, "workload facts reuse the existing authorized source read");
  return value;
}

test("six saved stages support workload without an activity/progress assertion", () => {
  const items = tasks(2), [row] = detectOverload(items);
  assert.equal(row?.detailOverride, "Six tasks in this read have saved in-flight or review status.");
  assert.deepEqual(row?.representedTaskIds, items.map(task => task.id).sort());
  assert.deepEqual(row?.reasons, ["Signal flags more than five tasks saved in-flight or in review.", "Four are saved in-flight; two are saved in review."]);
  assert.equal(row?.task.dueAt, null);
  assert.doesNotMatch([row?.detailOverride, ...row!.reasons].join(" "), /started|narrowed|reached|already|will sit/i);
});

test("every overload fallback rotation describes only saved stages", () => {
  const task = tasks()[0]!;
  for (let rotation = 0; rotation < 12; rotation++) {
    const prose = phraseFor("overload", task, rotation);
    assert.match(prose, /saved/);
    assert.doesNotMatch(prose, /started|narrowed|progress|will|effort/i);
  }
});

test("unknown, next and terminal phases do not inflate the six-stage source set", () => {
  const items = tasks(), excluded = [
    { ...items[0]!, id: "unknown", stage: { key: "custom", label: "Custom", phase: "unknown" as const, complete: false } },
    { ...items[0]!, id: "next", stage: { key: "todo", label: "To do", phase: "next" as const, complete: false } },
    { ...items[0]!, id: "done", stage: { key: "done", label: "Done", phase: "shipped" as const, complete: true } },
  ];
  const [row] = detectOverload([...excluded, ...items]);
  assert.deepEqual(row?.representedTaskIds, items.map(task => task.id).sort());
  assert.equal(detectOverload(items.slice(0, 5)).length, 0);
  assert.equal(row?.task.title, "Six items open at once");
});

test("workload has no deadline across read days even when contributing tasks have saved dates", async () => {
  for (const dated of [false, true]) {
    const items = tasks().map(task => dated ? { ...task, dueAt: NOW + 10 * 86400000 } : task);
    for (const offset of [0, 86400000, 2 * 86400000]) {
      const b = await briefing(items, NOW + offset), row = b.needsAttention.find(item => item.trigger === "overload");
      assert.equal(row?.detail, "Six tasks in this read have saved in-flight or review status.");
      assert.equal(b.suggestedFocus.find(item => item.trigger === "overload")?.due, null);
      assert.deepEqual(row?.evidenceTaskIds, items.map(task => task.id).sort());
    }
  }
});

test("the ledger retains factual overload detail and all six evidence members", async () => {
  const b = await briefing(tasks(3));
  const ledger = ledgerFromLegacyBriefing(b, { generatedAtLabel: "12 November 2026", scopeLabel: "Repair cooperative", scopeKind: "workspace", allowedAppOrigin: "https://app.signalstudio.ie" });
  const entry = ledger.entries.find(item => item.text === "Six items open at once");
  assert.equal(entry?.detail, "Six tasks in this read have saved in-flight or review status.");
  assert.equal(entry?.receipt.evidenceCount, 6);
  assert.deepEqual(entry?.reasons, ["Signal flags more than five tasks saved in-flight or in review.", "Three are saved in-flight; three are saved in review."]);
});

test("real saved deadlines keep due-today pressure alongside a null workload deadline", async () => {
  const today = { ...tasks()[0]!, id: "deadline", title: "Confirm pickup", lane: "next" as const, stage: undefined,
    deadline: { kind: "date-only" as const, date: "2026-11-12" } };
  const b = await briefing([...tasks(), today]);
  assert.equal(b.suggestedFocus.find(item => item.id === "deadline")?.due, "today");
  assert.equal(b.suggestedFocus.find(item => item.trigger === "overload")?.due, null);
});

test("Home carries the aggregate's null date from the producer without another read", async () => {
  const items = tasks(2), b = await briefing(items);
  const file = new URL("../../../../app/app/home/home-data.ts", import.meta.url);
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const require = createRequire(file), testModule = { exports: {} }; let calls = 0;
  const boundary = { ...calendar, buildBriefingForUser: async () => { calls++; return {
    kind: "ok", briefing: b, signals: items, authorizedScope: { scope: { kind: "workspace", workspaceId: "owned" }, timezone: "Europe/Dublin", label: "Repair cooperative" },
  }; } };
  new Function("require", "module", "exports", compiled)((id: string) => id === "@/modules/signal/home" ? boundary : require(id), testModule, testModule.exports);
  const home = testModule.exports as typeof import("@/app/app/home/home-data");
  const data = await home.loadHomeData({ clerkId: "reader" });
  assert.equal(data.kind, "ok"); if (data.kind !== "ok") throw Error("Home unavailable");
  const row = data.signalRows.find(item => item.trigger === "overload");
  assert.equal(row?.due, null);
  assert.equal(row?.source, "Tasks · Repair cooperative");
  assert.equal(row?.destination, "briefing");
  assert.equal(calls, 1);
});
