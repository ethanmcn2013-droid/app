import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { ledgerFromLegacyBriefing } from "../analytics/ledger-adapters";
import { buildBriefing } from "../briefing/build";
import { createMockBriefingSource } from "../briefing/mock-source";
import type { TaskSignal } from "../briefing/types";
import type { AuthorizedSignalScope } from "../planning-periods/scope";
import { buildOverviewModel, readNoteFor } from "./overview-model";

/**
 * The Overview is presentation over one briefing build. These tests pin the
 * honesty rules that make it trustworthy: every figure traces to the read,
 * signal rows keep the ledger's opaque ids, and nothing is filled in when an
 * input is absent.
 */

const NOW = Date.parse("2026-07-16T08:00:00.000Z"); // 09:00 in Dublin
const DAY = 86_400_000;

const scope = (workspaces: AuthorizedSignalScope["workspaces"]): AuthorizedSignalScope => ({
  scope: { kind: "workspace", workspaceId: workspaces[0]!.id },
  label: "The Orchard, events",
  timezone: "Europe/Dublin",
  period: null,
  workspaces,
});

const orchard = scope([
  {
    id: "ws-orchard",
    name: "The Orchard, events",
    role: "owner",
    planningPeriodId: null,
    contextType: "wedding",
    primaryDate: "2026-10-03",
    primaryDateLabel: "Wedding day",
  },
]);

async function build(signals?: TaskSignal[], authorizedScope = orchard) {
  const source = signals
    ? { getSignalsForUser: async () => signals }
    : createMockBriefingSource({ now: NOW, workspaceId: "ws-orchard", sourceLabel: "Tasks · The Orchard, events" });
  const read = await source.getSignalsForUser({ userId: "synthetic", email: "" });
  const briefing = await buildBriefing(source, { userId: "synthetic", email: "" }, NOW, { timezone: "Europe/Dublin" });
  const ledger = ledgerFromLegacyBriefing(briefing, {
    generatedAtLabel: "Thursday 09:00",
    scopeLabel: authorizedScope.label,
    scopeKind: authorizedScope.scope.kind,
    allowedAppOrigin: "https://app.signalstudio.ie",
  });
  const model = buildOverviewModel({
    ledger,
    timezone: authorizedScope.timezone,
    legacy: { briefing, signals: read, authorizedScope },
  });
  return { briefing, ledger, model, read };
}

test("progress is counted from the signals the engine read, lane by lane", async () => {
  const { model, read } = await build();
  assert.ok(model.lanes);
  const { todo, inProgress, review, done, total } = model.lanes;
  assert.equal(total, read.length);
  assert.equal(todo + inProgress + review + done, total);
  assert.deepEqual({ todo, inProgress, review, done }, { todo: 1, inProgress: 4, review: 1, done: 2 });
  assert.equal(model.lanes.doneThisWeek, 2);
  assert.equal(model.lanes.undated, read.filter((s) => s.lane !== "shipped" && s.dueAt == null).length);
});

test("custom open stages remain in scope without invented progress or leaked prerequisite metadata", async () => {
  const task = (id: string, phase: NonNullable<TaskSignal["stage"]>["phase"], lane: TaskSignal["lane"]): TaskSignal => ({
    id, title: id, lane, priority: 2, dueAt: null, idleDays: 0, commentCount: 0,
    blockedBy: [], sourceLabel: "Tasks · The Orchard, events", workspaceId: "ws-orchard",
    movedToShippedAt: phase === "shipped" ? NOW - DAY : null,
    stage: { key: phase === "unknown" ? "inspection" : phase, label: "Saved stage", phase, complete: phase === "shipped" },
  });
  const custom = { ...task("open-inspection", "unknown", "in-flight"),
    prerequisiteEvidence: [{ id: "internal-inspected-record", workspaceId: "ws-orchard", lane: "done", boardColumnKey: "filed", complete: true }],
    verifiedPrerequisiteIds: ["internal-inspected-record"] };
  const { model } = await build([custom, task("known-started", "in-flight", "in-flight"),
    task("known-review", "review", "review"), task("known-next", "next", "next"), task("known-complete", "shipped", "shipped")]);
  assert.deepEqual(model.lanes, { todo: 1, inProgress: 1, review: 1, done: 1, total: 5, doneThisWeek: 1, undated: 4 });
  const serialized = JSON.stringify(model);
  assert.doesNotMatch(serialized, /internal-inspected-record|prerequisiteEvidence|verifiedPrerequisiteIds|readTaskIds|triggeredTaskIds|evidenceTaskIds/);
});

test("signal rows keep the ledger's order and opaque ids, and carry severity from the trigger", async () => {
  const { model, ledger, read } = await build();
  assert.deepEqual(
    [...model.attention, ...model.risks].map((signal) => signal.entry.id),
    ledger.entries.map((entry) => entry.id),
  );
  assert.deepEqual(
    model.attention.map((signal) => signal.chip),
    [
      { label: "Overdue", tone: "danger" },
      { label: "Due today", tone: "warning" },
    ],
  );
  assert.deepEqual(model.risks.map((signal) => signal.chip), [{ label: "Stalled", tone: "warning" }]);
  const serialized = JSON.stringify([model.attention, model.risks]);
  for (const signal of read) {
    assert.ok(!serialized.includes(`"${signal.id}"`), `signal rows must not carry source id ${signal.id}`);
  }
});

test("dates ahead run from today to the scope's own key date, late work first", async () => {
  const { model } = await build();
  const runway = model.runway;
  assert.ok(runway?.keyDate);
  assert.equal(runway.keyDate.label, "Wedding day");
  assert.equal(runway.keyDate.daysAway, 79);
  assert.equal(runway.keyDate.project, null, "a single-project scope does not repeat its name");
  assert.equal(runway.overdue, 1);
  assert.deepEqual(
    runway.rows.map((row) => [row.day, row.relative, row.tone]),
    [
      ["14 Jul", "2 days late", "danger"],
      ["Today", null, "warning"],
      ["1 Aug", "In 16 days", "neutral"],
    ],
  );
  assert.ok(runway.marks.every((mark) => mark.at >= 0 && mark.at <= 1));
  assert.deepEqual(runway.ticks.map((tick) => tick.label), ["Aug", new Intl.DateTimeFormat("en-GB", { month: "short" }).format(new Date("2026-09-15"))]);
});

test("without a key date the window is the next two weeks, and nothing is invented", async () => {
  const undated = scope([{ ...orchard.workspaces[0]!, primaryDate: null, primaryDateLabel: null }]);
  const { model } = await build(undefined, undated);
  assert.equal(model.runway?.keyDate, null);
  assert.equal(model.runway?.windowDays, 14);
  assert.deepEqual(model.runway?.ticks, []);
});

test("finished work is the last seven days of real completions, newest first", async () => {
  const { model } = await build();
  assert.deepEqual(
    model.finished?.map((row) => [row.title, row.when]),
    [
      ["Open day, nine couples through", "Yesterday"],
      ["Deposit invoice settled, Mara & Finn", "Yesterday"],
    ],
  );
  const old: TaskSignal = {
    id: "old/done?",
    title: "Long closed",
    lane: "shipped",
    priority: 2,
    dueAt: null,
    idleDays: 0,
    commentCount: 0,
    blockedBy: [],
    sourceLabel: "Tasks · The Orchard, events",
    movedToShippedAt: NOW - 30 * DAY,
    workspaceId: "ws-orchard",
  };
  const { model: withOld } = await build([old, { ...old, id: "fresh/done?", title: "Fresh", movedToShippedAt: NOW - DAY / 4 }]);
  assert.deepEqual(withOld.finished?.map((row) => row.title), ["Fresh"]);
  assert.equal(withOld.finished?.[0]?.href, "/app/task/fresh%2Fdone%3F");
});

test("the read note closes its arithmetic in front of the reader", async () => {
  const { model, ledger } = await build();
  const counts = ledger.readCounts!;
  assert.equal(counts.read, counts.flagged + counts.cleared);
  assert.equal(
    model.readNote,
    `Signal read ${counts.read} tasks in The Orchard, events at 09:00. ${counts.flagged} crossed a rule, and ${counts.shown} are shown above. The other ${counts.cleared} were clear.`,
  );
  assert.equal(readNoteFor({ ...ledger, readCounts: null }, "task", "09:00"), null, "no denominator, no sentence");

  // Nothing crossed: every item was clear, so there is no "other" to name.
  const calm = (id: string): TaskSignal => ({
    id, title: `Calm ${id}`, lane: "next", priority: 2, dueAt: null, idleDays: 0, commentCount: 0,
    blockedBy: [], sourceLabel: "Tasks · The Orchard, events", movedToShippedAt: null, workspaceId: "ws-orchard",
  });
  const { model: clear } = await build([calm("a"), calm("b")]);
  assert.equal(
    clear.readNote,
    "Signal read 2 tasks in The Orchard, events at 09:00. None of them crossed Signal’s attention rules.",
  );
});

test("the verdict reads the engine's buckets and never calls a thin read clear", async () => {
  const { model } = await build();
  assert.deepEqual(model.verdict, { tone: "danger", sentence: "2 things need attention and 1 is at risk." });

  const { model: quiet } = await build([]);
  assert.equal(quiet.attention.length + quiet.risks.length, 0);
  assert.equal(quiet.verdict.tone, "success");
  assert.equal(quiet.emptyState?.kind, "healthy");

  const { ledger, briefing, read } = await build();
  const coverage = buildOverviewModel({
    ledger: { ...ledger, coverageStatus: "partial", coverageNote: "Some work could not be checked in this read.", readCounts: null, entries: [], emptyState: { kind: "coverage", headline: "Signal has only part of the picture.", body: "…" } },
    timezone: "Europe/Dublin",
  });
  assert.deepEqual(coverage.verdict, { tone: "warning", sentence: "Signal has only part of the picture." });

  const partial = { ...ledger, coverageStatus: "partial" as const, coverageNote: "Some work could not be checked in this read.", readCounts: null, emptyState: null };
  const riskOnly = buildOverviewModel({ ledger: { ...partial, entries: ledger.entries.filter(entry => entry.section === "risks") }, timezone: "Europe/Dublin" });
  assert.match(riskOnly.verdict.sentence, /^1 thing is at risk\. Some work could not be checked\.$/);
  assert.doesNotMatch(riskOnly.verdict.sentence, /Nothing is urgent/);

  const completedOnly = buildOverviewModel({ ledger: { ...partial, entries: [] }, timezone: "Europe/Dublin", legacy: { briefing, signals: read, authorizedScope: orchard } });
  assert.deepEqual(completedOnly.verdict, { tone: "warning", sentence: "2 finished this week. Some work could not be checked." });
});

test("Overview caps mixed date-only and timed rows after reader-local day ordering", async () => {
  const base: TaskSignal = {
    id: "base", title: "Date", lane: "next", priority: 2, dueAt: null, idleDays: null,
    commentCount: 0, blockedBy: [], sourceLabel: "Tasks · The Orchard, events", movedToShippedAt: null,
  };
  const dated = Array.from({ length: 5 }, (_, index): TaskSignal => ({
    ...base, id: `date-${index}`, deadline: { kind: "date-only", date: "2026-07-17" },
  }));
  const at = Date.parse("2026-07-17T10:00:00.000Z");
  const timed: TaskSignal = { ...base, id: "timed", dueAt: at, deadline: { kind: "instant", at } };
  const west = await build([...dated, timed], { ...orchard, timezone: "Etc/GMT+12" });
  assert.equal(west.model.runway?.rows[0]?.key, "timed");
  const east = await build([...dated, timed], { ...orchard, timezone: "Pacific/Kiritimati" });
  assert.ok(east.model.runway?.rows.every(row => row.key !== "timed"));
});

test("Overview keeps an expired same-day instant ahead of the date cap", async () => {
  const base: TaskSignal = {
    id: "base", title: "Date", lane: "next", priority: 2, dueAt: null, idleDays: null,
    commentCount: 0, blockedBy: [], sourceLabel: "Tasks", movedToShippedAt: null,
  };
  const date = Array.from({ length: 5 }, (_, index): TaskSignal => ({
    ...base, id: `today-${index}`, deadline: { kind: "date-only", date: "2026-07-16" },
  }));
  const late = { ...base, id: "past-time", dueAt: NOW - 3_600_000, deadline: { kind: "instant" as const, at: NOW - 3_600_000 } };
  const { model } = await build([...date, late]);
  assert.equal(model.runway?.overdue, 1);
  assert.equal(model.runway?.rows[0]?.key, "past-time");
  assert.equal(model.runway?.rows[0]?.relative, "Past its time today");
  assert.equal(model.runway?.rows[0]?.tone, "danger");
});

test("Overview qualifies empty date and completion branches when those facts are unknown", async () => {
  const base: TaskSignal = {
    id: "unknown", title: "Unknown", lane: "next", priority: 2, dueAt: null, idleDays: null,
    commentCount: 0, blockedBy: [], sourceLabel: "Tasks", movedToShippedAt: null,
    deadline: { kind: "unknown" },
  };
  const { model } = await build([base, { ...base, id: "done-unknown", lane: "shipped", deadline: null }]);
  assert.equal(model.runway?.dateCoverageComplete, false);
  assert.equal(model.finishedCoverageComplete, false);
  const { OverviewView } = loadView();
  const html = renderToStaticMarkup(createElement(OverviewView, { model }));
  assert.match(html, /Some dates could not be checked/);
  assert.match(html, /Some completion dates could not be checked/);
  assert.doesNotMatch(html, /Nothing is dated|Nothing finished/);
  const known = { ...base, id: "known-date", title: "Known date", dueAt: NOW + DAY, deadline: { kind: "instant" as const, at: NOW + DAY } };
  const withKnown = await build([base, known]);
  assert.equal(withKnown.model.runway?.dateCoverageComplete, false);
  assert.equal(withKnown.model.runway?.rows[0]?.key, "known-date");
  assert.match(renderToStaticMarkup(createElement(OverviewView, { model: withKnown.model })), /Known date/);
});

test("the progressive engine renders its rows and omits every signals-derived section", async () => {
  const { ledger } = await build();
  const model = buildOverviewModel({ ledger, timezone: "Europe/Dublin" });
  assert.equal(model.lanes, null);
  assert.equal(model.runway, null);
  assert.equal(model.finished, null);
  assert.equal("projects" in model, false);
  assert.deepEqual(model.attention.map((signal) => signal.chip.label), ["Needs you", "Needs you"]);
});

test("a planning-period read requested by URL renders as one read, with no program view", async () => {
  const period: AuthorizedSignalScope = {
    scope: { kind: "planningPeriod", planningPeriodId: "season" },
    label: "Our season",
    timezone: "Europe/Dublin",
    period: null,
    workspaces: ["a", "b"].map((id) => ({
      id: `project-${id}`,
      name: `Project ${id.toUpperCase()}`,
      role: "owner" as const,
      planningPeriodId: "season",
      contextType: null,
      primaryDate: id === "a" ? "2026-09-01" : "2026-08-01",
      primaryDateLabel: "Launch",
    })),
  };
  const signals: TaskSignal[] = ["a", "b", "b"].map((id, index) => ({
    id: `t-${index}`,
    title: `Work ${index}`,
    lane: "in-flight",
    priority: 2,
    dueAt: index === 2 ? NOW - 2 * DAY : null,
    idleDays: 0,
    commentCount: 0,
    blockedBy: [],
    sourceLabel: `Tasks · Project ${id.toUpperCase()}`,
    movedToShippedAt: null,
    workspaceId: `project-${id}`,
  }));
  const { model } = await build(signals, period);
  // The server still authorizes and reads the period; the Overview neither
  // labels it as a program nor breaks it down across projects.
  assert.equal("projects" in model, false);
  assert.equal("scopeKindLabel" in model, false);
  assert.equal(model.lanes?.total, 3);
  assert.deepEqual(model.runway?.keyDate?.project, "Project B", "the nearest key date still names its project");

  const { OverviewView } = loadView();
  const html = renderToStaticMarkup(createElement(OverviewView, { model }));
  assert.doesNotMatch(html, /Planning period|Across projects|program/i);
});

test("the project switcher offers Projects only, never a planning period", () => {
  const { SignalScopeSwitcher } = loadSwitcher();
  const catalog = {
    planningSchemaAvailable: true,
    periods: [{ id: "season", name: "Our season", contextType: "wedding", startDate: null, endDate: null, timezone: "Europe/Dublin" }],
    workspaces: ["a", "b"].map((id) => ({
      id: `project-${id}`,
      name: `Project ${id.toUpperCase()}`,
      role: "owner" as const,
      planningPeriodId: "season",
      contextType: null,
      primaryDate: null,
      primaryDateLabel: null,
    })),
  };

  const onProject = renderToStaticMarkup(
    createElement(SignalScopeSwitcher, {
      catalog,
      activeScope: { kind: "workspace", workspaceId: "project-b" },
    }),
  );
  assert.deepEqual(
    [...onProject.matchAll(/<option[^>]*value="([^"]*)"/g)].map((match) => match[1]),
    ["workspace:project-a", "workspace:project-b"],
  );
  assert.doesNotMatch(onProject, /planningPeriod|Our season|Planning period|optgroup/);
  assert.doesNotMatch(onProject, /Show<\/button>/, "nothing to commit until the choice changes");

  // Reached through a period URL: the way back is a Project, and no period
  // appears as a choice.
  const onPeriod = renderToStaticMarkup(
    createElement(SignalScopeSwitcher, {
      catalog,
      activeScope: { kind: "planningPeriod", planningPeriodId: "season" },
    }),
  );
  assert.match(onPeriod, /Choose a project/);
  assert.doesNotMatch(onPeriod, /value="planningPeriod:|Our season/);

  // One Project and already reading it: there is nothing to switch.
  const single = renderToStaticMarkup(
    createElement(SignalScopeSwitcher, {
      catalog: { ...catalog, workspaces: catalog.workspaces.slice(0, 1) },
      activeScope: { kind: "workspace", workspaceId: "project-a" },
    }),
  );
  assert.equal(single, "");
});

/* ── Rendered markup ─────────────────────────────────────────────────── */

const cssModule = { default: new Proxy({}, { get: (_target, key) => String(key) }) };

function loadComponent<T>(relative: string, boundaries: Record<string, unknown>): T {
  const file = new URL(relative, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} as T };
  const require = createRequire(file);
  new Function("require", "module", "exports", compiled)(
    (id: string) => (id in boundaries ? boundaries[id] : require(id)),
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}

function loadView() {
  return loadComponent<typeof import("../../components/overview/overview-view")>(
    "../../components/overview/overview-view.tsx",
    {
      "next/link": {
        default: ({ href, children, className }: { href: string; children: unknown; className?: string }) =>
          createElement("a", { href, className }, children as never),
      },
      "./overview.module.css": cssModule,
      "./overview-actions": {
        OpenInTasks: ({ entryId, label }: { entryId: string; label: string }) =>
          createElement("button", { "data-entry": entryId }, label),
        WhyThis: ({ panelId }: { panelId: string }) => createElement("button", { "aria-controls": panelId }, "Why this"),
      },
    },
  );
}

function loadSwitcher() {
  return loadComponent<typeof import("../../components/brief/scope-switcher")>(
    "../../components/brief/scope-switcher.tsx",
    {
      "../../server/signal-planning-scope-actions": { setSignalScope: async () => {} },
      "../overview/overview.module.css": cssModule,
    },
  );
}

test("the rendered Overview speaks plainly and opens signals only by opaque id", async () => {
  const { model, read } = await build();
  const { OverviewView } = loadView();
  const html = renderToStaticMarkup(createElement(OverviewView, { model }));

  for (const heading of ["Overview", "Progress", "Needs attention", "At risk", "Dates ahead", "Finished this week", "How this was read"]) {
    assert.match(html, new RegExp(`<h[12][^>]*>${heading}</h[12]>`), `missing heading ${heading}`);
  }
  const opened = [...html.matchAll(/data-entry="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(opened.length, 3);
  assert.ok(opened.every((id) => /^signal-[a-z0-9]+$/.test(id)));
  for (const signal of read.filter((s) => s.lane !== "shipped")) {
    assert.ok(!opened.includes(signal.id));
  }
  // "Due today." under a "Due today" chip says nothing new; it is dropped.
  assert.doesNotMatch(html, /Due today\.<\/p>/);
  assert.doesNotMatch(html, /\bworkspace\b/i);
  assert.doesNotMatch(html, /text-transform|uppercase|font-mono/);
});


test("round8receiving recorded work stays neutral and visible after real attention and risks", async () => {
  const base: TaskSignal = { id: "saved", title: "Saved catalogue", lane: "next", priority: 2, dueAt: null, idleDays: null,
    commentCount: 0, blockedBy: [], sourceLabel: "Tasks · The Orchard, events", movedToShippedAt: null, workspaceId: "ws-orchard" };
  const title = { ...base, latestValidatedTitleEdit: { at: new Date(NOW - 1_000).toISOString(), kind: "update" as const, field: "title" as const } };
  const completed: TaskSignal = { ...base, id: "completed", title: "Completed records", lane: "shipped", movedToShippedAt: NOW - 3_600_000 };
  const positive = await build([title, completed]);
  assert.deepEqual(positive.ledger.entries.map(entry => [entry.section, entry.state]), [["activity", "recorded"], ["activity", "recorded"]]);
  assert.equal(positive.model.attention.length + positive.model.risks.length, 0);
  assert.equal(positive.model.activity.length, 2);
  assert.equal(positive.model.verdict.tone, "neutral");
  assert.doesNotMatch(positive.model.verdict.sentence, /needs attention|at risk|part of the picture/i);
  const { OverviewView } = loadView();
  const positiveHtml = renderToStaticMarkup(createElement(OverviewView, { model: positive.model }));
  assert.match(positiveHtml, /<h2[^>]*>Recorded work<\/h2>/);
  assert.doesNotMatch(positiveHtml, /<h2[^>]*>(?:Needs attention|At risk)<\/h2>/);
  const mixed = await build([title, completed, { ...base, id: "urgent", title: "Due record", dueAt: NOW + 3_600_000 },
    { ...base, id: "stalled", title: "Stalled record", lane: "in-flight", idleDays: 10 }]);
  assert.deepEqual(mixed.ledger.entries.map(entry => entry.section), ["attention", "risks", "activity"]);
  assert.equal(mixed.model.activity.length, 1);
  assert.equal(mixed.model.attention.length, 1); assert.equal(mixed.model.risks.length, 1);
  assert.match(mixed.model.verdict.sentence, /^1 thing needs attention and 1 is at risk\.$/);
  assert.doesNotMatch(mixed.model.readNote ?? "", /asks? something of you/i);
  const mixedHtml = renderToStaticMarkup(createElement(OverviewView, { model: mixed.model }));
  assert.ok(mixedHtml.indexOf(">Needs attention</h2>") < mixedHtml.indexOf(">At risk</h2>"));
  assert.ok(mixedHtml.indexOf(">At risk</h2>") < mixedHtml.indexOf(">Recorded work</h2>"));
});

test("round8receiving context notes never establish incomplete coverage without metadata", async () => {
  const base: TaskSignal = { id: "ordinary", title: "Ordinary open record", lane: "next", priority: 2, dueAt: null, idleDays: null,
    commentCount: 0, blockedBy: [], sourceLabel: "Tasks · The Orchard, events", movedToShippedAt: null, workspaceId: "ws-orchard", taskCoverage: "complete" };
  for (const signals of [[base], [{ ...base, lane: "in-flight" as const, idleDays: 10 }]]) {
    const { ledger, model } = await build(signals);
    assert.equal(ledger.coverageStatus, "complete");
    assert.match(ledger.coverageNote ?? "", /1 task is currently open/);
    assert.equal(model.coverage?.tone, "neutral");
    const { OverviewView } = loadView();
    const contextHtml = renderToStaticMarkup(createElement(OverviewView, { model }));
    assert.match(contextHtml, /1 task is currently open/);
    assert.doesNotMatch(contextHtml, /class="notice"/, "complete context does not render as an alert notice");
    assert.doesNotMatch(model.verdict.sentence, /could not be checked|part of the picture/i);
    const partial = buildOverviewModel({ ledger: { ...ledger, coverageStatus: "partial", readCounts: null }, timezone: "Europe/Dublin" });
    assert.equal(partial.coverage?.tone, "warning");
    assert.match(partial.verdict.sentence, /could not be checked|part of the picture/i);
    const unknown = buildOverviewModel({ ledger: { ...ledger, coverageStatus: undefined, coverageNote: null }, timezone: "Europe/Dublin" });
    assert.doesNotMatch(unknown.verdict.sentence, /On track|Nothing is urgent/i);
    assert.match(unknown.verdict.sentence, /coverage.*(?:unknown|not.*established)/i);
  }
});
