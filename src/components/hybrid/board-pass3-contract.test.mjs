// Board finishing-pass contract (T·132 pass 3) — the invariants the
// redesign argued for, pinned as source assertions in the same style as
// the suite-navigation contract: cheap to run, loud when someone
// accidentally reintroduces a retired treatment.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(relativePath) {
  return readFileSync(new URL(`../../../${relativePath}`, import.meta.url), "utf8");
}

const globals = read("src/app/globals.css");
const sharedCss = read("src/components/hybrid/shared/shared.module.css");
const boardCss = read("src/components/hybrid/options/a/option-a.module.css");
const drawerCss = read("src/components/hybrid/options/c/option-c.module.css");
const planningRail = read("src/components/hybrid/options/c/planning-rail.tsx");
const workspaceBrief = read("src/components/hybrid/options/b/workspace-brief.tsx");
const studioBar = read("src/components/studio-bar/studio-bar.tsx");
const boardView = read("src/components/hybrid/options/a/board-view.tsx");

test("one canonical Done green feeds header, dot, and completion control", () => {
  // The token is defined exactly once; everything green derives from it.
  assert.match(globals, /--x-status-done: #1b873f;/);
  assert.equal((globals.match(/#1b873f/gi) ?? []).length, 2, "the literal appears only as the token and its doc comment");
  assert.match(globals, /--x-task-success: var\(--x-status-done\);/);
  assert.match(globals, /--x-col-emerald: var\(--x-status-done\);/);
  // The completion control consumes the same semantic token.
  assert.match(sharedCss, /\.completionBox:checked \{ background: var\(--x-task-success\); border-color: var\(--x-task-success\); \}/);
  // The old dark-forest formula and the dead lane palette stay gone.
  assert.doesNotMatch(globals, /var\(--status-done\) 60%, var\(--ink\)/);
  assert.doesNotMatch(globals, /--lane-done/);
  assert.doesNotMatch(globals, /#1f7a45/i);
});

test("column colour lives in the header band only, perceptually tuned", () => {
  assert.match(boardCss, /\.laneHeader \{[^}]*var\(--lane-tint, 7%\)/s);
  assert.match(boardCss, /var\(--lane-border-tint, 18%\)/);
  // The lane body itself stays paper — no full-column wash selector.
  assert.doesNotMatch(boardCss, /\.boardLane\[data-tinted\] \{[^}]*background/s);
});

test("the shell is a product switcher with a command trigger, not a place list", () => {
  const studioRail = read("src/components/studio-bar/studio-rail.tsx");
  const sidebar = read("src/components/studio-bar/projects-sidebar.tsx");
  const shellCss = read("src/components/studio-bar/signal-shell.module.css");
  // Home and Project are gone from the rail; the three products remain.
  assert.doesNotMatch(studioRail, /\{ key: "(home|project)"/);
  // Home leads the local Tasks navigation, above Inbox.
  const homeAt = sidebar.indexOf('href="/app/home"');
  const inboxAt = sidebar.indexOf('href="/app/inbox"');
  assert.ok(homeAt > -1 && inboxAt > -1 && homeAt < inboxAt, "Home renders above Inbox");
  // The panel header is a quiet local label; Projects is a section label.
  assert.match(sidebar, /styles\.sidebarTitle\}>Tasks</);
  assert.match(sidebar, /styles\.projectsLabel\}>Projects</);
  // No rotated strip, no reserved collapsed width, no persistent field.
  assert.doesNotMatch(sidebar, /stripLabel/);
  assert.doesNotMatch(shellCss, /\.stripLabel \{[^}]*writing-mode/s);
  assert.match(sidebar, /if \(!expanded\) return null;/);
  assert.doesNotMatch(studioBar, /data-slot="command-field"/);
  assert.match(studioBar, /data-slot="search-trigger"/);
  // The band offers the reopen trigger and never drops the parent crumb.
  assert.match(workspaceBrief, /Open Tasks navigation/);
  assert.doesNotMatch(workspaceBrief, /% complete/);
});

test("the main header states the parent / project hierarchy", () => {
  assert.match(workspaceBrief, /briefCrumb/);
  assert.match(workspaceBrief, /calendar\.planningPeriod\?\.name/);
  // The description affordance reads as an action, not placeholder prose.
  assert.match(workspaceBrief, /\+ Add description/);
});

test("Planning is time, scheduling and milestones — never money", () => {
  assert.doesNotMatch(planningRail, /budgetCoverageLine|useProjectMoney|Costs/);
  // One selector decides what needs a date.
  assert.match(planningRail, /activeUnscheduledTasks\(tasks\)/);
});

test("the planning drawer docks wide and overlays medium, at 420px", () => {
  assert.match(drawerCss, /flex: 0 0 420px/);
  assert.match(drawerCss, /@container \(max-width: 1619px\)/);
});

test("add status is an end-cap action, not a reserved pseudo-lane", () => {
  assert.match(boardCss, /\.addColumnCap \{[^}]*flex: 0 0 auto/s);
  assert.doesNotMatch(boardCss, /writing-mode: vertical-rl[^}]*Add/s);
});

test("the shell carries one brand object — the wordmark's indigo stop", () => {
  assert.match(studioBar, /text-\[var\(--x-studio-accent\)\]">\.<\/span>/);
  assert.doesNotMatch(studioBar, /h-2\.5 w-2\.5 rounded-full bg-\[var\(--x-studio-accent\)\]/);
});

test("cards drop priority on finished work and noise-free avatars", () => {
  assert.match(boardView, /&& !task\.completed;?$/m);
  assert.match(boardView, /uniformAssignees\(tasks\)/);
});
