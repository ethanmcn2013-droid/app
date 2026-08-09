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
const taskUi = read("src/components/hybrid/shared/task-ui.tsx");

test("one canonical Done green feeds header, dot, and completion control", () => {
  // The token is defined exactly once; everything green derives from it.
  assert.match(globals, /--x-status-done: #1b873f;/);
  assert.equal((globals.match(/#1b873f/gi) ?? []).length, 2, "the literal appears only as the token and its doc comment");
  assert.match(globals, /--x-task-success: var\(--x-status-done\);/);
  assert.match(globals, /--x-col-emerald: var\(--x-status-done\);/);
  // The completion control consumes the same semantic token while the native
  // checkbox fills an inclusive hit region and the visible glyph stays small.
  assert.match(sharedCss, /\.completionTarget:has\(\.controlInput:checked\) \.completionGlyph \{ background: var\(--x-task-success\); border-color: var\(--x-task-success\); \}/);
  assert.match(sharedCss, /@media \(pointer: coarse\) \{[\s\S]*\.completionTarget \{[\s\S]*inline-size: 44px;[\s\S]*block-size: 44px;/);
  assert.match(taskUi, /className=\{styles\.controlInput\}/);
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
  // 2026-08-05: the founder had the planning-period grouping (a name + end
  // date row, one disclosure per period) removed from Projects — it
  // repeated the crumb the brief header also dropped, and every venue only
  // ever had the one bucket to group by. The list is flat projects now.
  assert.doesNotMatch(sidebar, /group\.periodName/);
  assert.doesNotMatch(sidebar, /group\.dateRange/);
  assert.doesNotMatch(shellCss, /\.projectDate \{/);
  // No rotated strip, no reserved collapsed width, no persistent field.
  assert.doesNotMatch(sidebar, /stripLabel/);
  assert.doesNotMatch(shellCss, /\.stripLabel \{[^}]*writing-mode/s);
  assert.match(sidebar, /if \(!expanded\) return null;/);
  assert.doesNotMatch(studioBar, /data-slot="command-field"/);
  assert.match(studioBar, /data-slot="search-trigger"/);
  // The band offers the reopen trigger; progress reads as a sentence,
  // never a bare percentage.
  assert.match(workspaceBrief, /Open Tasks navigation/);
  assert.doesNotMatch(workspaceBrief, /% complete/);
});

test("the main header states the project alone — the parent crumb is gone", () => {
  // 2026-08-05: the founder had the "<period> /" crumb removed from the
  // brief header. In production it always read "Active work / <project>" —
  // a hierarchy of one, since every venue has a single planning period —
  // so the header now leads straight with the project name.
  assert.doesNotMatch(workspaceBrief, /briefCrumb/);
  assert.doesNotMatch(workspaceBrief, /calendar\.planningPeriod\?\.name/);
  // The description affordance reads as an action, not placeholder prose.
  assert.match(workspaceBrief, /\+ Add description/);
});

test("Planning is time, scheduling and milestones — never money", () => {
  assert.doesNotMatch(planningRail, /budgetCoverageLine|useProjectMoney|Costs/);
  // One selector decides what needs a date.
  assert.match(planningRail, /activeUnscheduledTasks\(tasks\)/);
});

test("the planning drawer docks wherever it fits, and is modal when it cannot", () => {
  assert.match(drawerCss, /flex: 0 0 420px/);
  // T·132 pass 5: it used to float over the board from 1619px down, leaving
  // 26 focusable controls tabbable underneath it (SC 2.4.11). It now reflows
  // the board down to 1100px and is a true focus-trapping dialog below that,
  // at every width — not only on phones.
  assert.match(drawerCss, /@container \(max-width: 1100px\)/);
  assert.match(planningRail, /aria-modal=\{asOverlay \? true : undefined\}/);
  assert.match(planningRail, /role=\{asOverlay \? "dialog" : undefined\}/);
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

// ---------------------------------------------------------------------
// T·132 pass 5 — what the quality panel found, pinned so it cannot rot.
// ---------------------------------------------------------------------

test("five statuses fit a 1440 canvas, and residual overflow is authored", () => {
  // Canvas at 1440 is 1144px (60 rail + 236 panel). Five lanes at 276
  // needed 1409 and amputated the fifth; 224 leaves room to spare.
  assert.match(boardCss, /flex: 1 0 224px/);
  assert.match(boardCss, /min-width: 224px/);
  assert.doesNotMatch(boardCss, /flex: 1 0 276px/);
  // Overflow below that width is a designed edge, not a severed card.
  assert.match(boardCss, /scroll-snap-type: x proximity/);
  assert.match(boardCss, /\.boardTrackEdge \{/);
  assert.match(boardView, /data-overflowing=\{overflowing/);
});

test("the type ramp is a ramp: four weights, no half-step sizes", () => {
  for (const css of [boardCss, drawerCss, sharedCss, read("src/components/hybrid/options/b/option-b.module.css")]) {
    const weights = [...css.matchAll(/font-weight: *(\d{3})/g)].map((m) => m[1]);
    for (const weight of weights) {
      assert.ok(["400", "500", "600", "700"].includes(weight), `stray font-weight ${weight}`);
    }
    assert.doesNotMatch(css, /font-size: *\d+\.\d+px/, "half-step font sizes buy no hierarchy");
  }
  // The board's primary content object outranks the chrome that frames it.
  assert.match(boardCss, /\.boardTitle \{[^}]*font-size: 15px; font-weight: 600/s);
  assert.match(boardCss, /\.laneHeader h2 \{[^}]*font-size: 12px; font-weight: 500/s);
});

test("a card has one left edge, and says its title once", () => {
  // Title, chips and meta share the text column; the checkbox sits outside.
  assert.match(boardView, /className=\{styles\.cardBody\}/);
  assert.match(boardCss, /\.cardBody \{[^}]*flex-direction: column/s);
  // Four spoken repeats of the title made the board unskimmable by ear.
  assert.match(boardView, /triggerLabel="Task actions"/);
  assert.doesNotMatch(taskUi, /aria-label=\{`\$\{task\.completed \? "Reopen" : "Mark done"\} \$\{task\.title\}`\}/);
  assert.match(taskUi, /Owner: \$\{people/);
});

test("finishing work is witnessed, reversible, and announced", () => {
  // The card can travel four statuses; the receipt is the way back.
  assert.match(boardView, /completionReceipt/);
  // Undo has to actually undo: store.undoLast() is a no-op on live data
  // ("Undo is not available on live data"), and reopening alone drops the
  // task into "doing". The receipt moves it back to the status it left.
  assert.match(boardView, /store\.moveStatus\(receipt\.id, receipt\.fromStatus\)/);
  assert.doesNotMatch(boardView, /store\.undoLast\(\)/);
  assert.match(boardCss, /\.completionReceipt \{/);
  // FLIP: the card is animated to its new rect and the lanes hold still.
  assert.match(boardView, /getBoundingClientRect\(\)/);
  assert.match(boardCss, /\.boardSurface\[data-flight\] \.boardLane \{ transition: none; \}/);
  // The spoken receipt carries destination and progress, not just a verb.
  assert.match(read("src/components/hybrid/store.tsx"), /moved to Done, \$\{completedAfter\} of/);
});

test("an empty status says something true, and overdue is a control", () => {
  assert.match(boardView, /function emptyLaneLine/);
  assert.doesNotMatch(boardView, /<span>No tasks yet<\/span>/);
  assert.match(workspaceBrief, /styles\.briefOverdue/);
  assert.match(workspaceBrief, /Day \$\{elapsed\} of \$\{total\}/);
});
