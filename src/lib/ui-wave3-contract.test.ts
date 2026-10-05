import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

function source(...parts: string[]) {
  return readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

describe("Wave 3 interface contracts", () => {
  it("derives every demo task count and scheduling obligation from fixtures and selectors", () => {
    const tree = source("src", "server", "actions", "projects-tree.ts");
    // Schedule is retired; the calendar's tray and the header's "need a
    // date" fact read the one selector, so they can never disagree.
    const calendar = source("src", "components", "tasks", "calendar-view.tsx");
    assert.match(tree, /taskCount: demoTasks\(\)\.length/);
    assert.match(calendar, /activeUnscheduledTasks\(surface\.visible\)/);
  });

  it("requires an explicit, informed action before either Tasks AI request", () => {
    const draft = source("src", "components", "app", "ai", "draft-reply-button.tsx");
    const summary = source("src", "components", "app", "ai", "conversation-summary.tsx");
    assert.ok(draft.indexOf("Sends this task&apos;s title") < draft.indexOf("Send and draft"));
    assert.match(draft, /to Anthropic/);
    assert.match(draft, /Nothing is posted until you/);
    assert.match(summary, /onClick=\{\(\) => setConfirming\(true\)\}/);
    assert.ok(summary.indexOf("Sends this task&apos;s title") < summary.indexOf("Send and summarise"));
  });

  it("keeps 320px Notes descendants and forced-colour sharing focus inside the usable viewport", () => {
    const notes = source("src", "modules", "notes", "app", "workspace", "notes-workspace.module.css");
    const sharing = source("src", "modules", "timeline", "app", "audience", "share-controls.module.css");
    // v3 Notes: the view tabs tighten at 320px instead of a shrinking .views row.
    assert.match(notes, /@media \(max-width: 359px\)[\s\S]*?\.viewTab \{[\s\S]*?padding: 0 4px/);
    assert.match(notes, /@media \(pointer: coarse\)[\s\S]*?\.iconButton \{[\s\S]*?width: 44px/);
    assert.match(sharing, /@media \(forced-colors: active\)/);
    assert.match(sharing, /outline: 2px solid Highlight !important/);
  });

  it("owns completion motion by event and keeps Timeline feedback under 300ms", () => {
    // The drawn tick belongs to the completion event (aria-pressed flips on
    // the press), never to a checked state discovered on mount, and it
    // stands still under reduced motion.
    const taskCss = source("src", "components", "tasks", "atoms.module.css");
    const timelineCss = source("src", "modules", "timeline", "components", "artifact", "timeline-artifact.module.css");
    assert.match(taskCss, /\.toggle\[aria-pressed="true"\] \.glyphTick \{\s*animation: draw 180ms/);
    assert.match(taskCss, /prefers-reduced-motion: reduce\)[\s\S]*?\.glyphTick[\s\S]*?animation: none/);
    assert.doesNotMatch(taskCss, /:has\([^)]*:checked\)[^{]*\{[^}]*animation:/);
    assert.match(timelineCss, /timeline-target-ring 220ms/);
    assert.doesNotMatch(timelineCss, /timeline-target-ring 700ms/);
  });

  it("presents one plain-language Timeline link lifecycle", () => {
    const manager = source("src", "modules", "timeline", "app", "audience", "audience-manager.tsx");
    // v3: the share popover became the plan's share sheet; one lifecycle still.
    const panel = source("src", "modules", "timeline", "app", "plan", "[projectSlug]", "_components", "v3", "share-sheet.tsx");
    assert.doesNotMatch(manager, /Canonical workspace <code/);
    assert.match(manager, /Source plan/);
    assert.match(manager, /set-aside decision/);
    assert.match(manager, /Review changes from your plan/);
    assert.equal((panel.match(/"Make a new link"/g) ?? []).length, 1);
  });
});
