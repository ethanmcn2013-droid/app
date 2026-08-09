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
    const schedule = source("src", "components", "hybrid", "options", "a", "timeline-view.tsx");
    const calendar = source("src", "components", "hybrid", "options", "b", "calendar-view.tsx");
    assert.match(tree, /taskCount: demoTasks\(\)\.length/);
    assert.match(schedule, /activeUnscheduledTasks\(tasks\)/);
    assert.match(calendar, /activeUnscheduledTasks\(tasks\)/);
  });

  it("requires an explicit, informed action before either Tasks AI request", () => {
    const draft = source("src", "components", "app", "ai", "draft-reply-button.tsx");
    const summary = source("src", "components", "app", "ai", "conversation-summary.tsx");
    assert.ok(draft.indexOf("Sends this task&apos;s title") < draft.indexOf("Send to AI and draft"));
    assert.match(draft, /to Anthropic/);
    assert.match(draft, /Nothing is posted until you/);
    assert.match(summary, /onClick=\{\(\) => setConfirming\(true\)\}/);
    assert.ok(summary.indexOf("Sends this task&apos;s title") < summary.indexOf("Send to AI and summarize"));
  });

  it("keeps 320px Notes descendants and forced-colour sharing focus inside the usable viewport", () => {
    const notes = source("src", "modules", "notes", "app", "workspace", "notes-workspace.module.css");
    const sharing = source("src", "modules", "timeline", "app", "audience", "share-controls.module.css");
    assert.match(notes, /@media \(max-width: 359px\)[\s\S]*?\.views \{[\s\S]*?min-inline-size: 0/);
    assert.match(notes, /\.privacy,[\s\S]*?\.iconButton \{[\s\S]*?inline-size: 44px/);
    assert.match(sharing, /@media \(forced-colors: active\)/);
    assert.match(sharing, /outline: 2px solid Highlight !important/);
  });

  it("owns completion motion by event and keeps Timeline feedback under 300ms", () => {
    const taskCss = source("src", "components", "hybrid", "shared", "shared.module.css");
    const timelineCss = source("src", "modules", "timeline", "components", "artifact", "timeline-artifact.module.css");
    assert.match(taskCss, /completionTarget\[data-completion-event\]/);
    assert.match(taskCss, /\.completionGlyph\s*\{[\s\S]*?pointer-events:\s*none/);
    assert.doesNotMatch(taskCss, /:has\(\.controlInput:checked\)[^{]*\{[^}]*animation:/);
    assert.match(timelineCss, /timeline-target-ring 220ms/);
    assert.doesNotMatch(timelineCss, /timeline-target-ring 700ms/);
  });

  it("presents one plain-language Timeline link lifecycle", () => {
    const manager = source("src", "modules", "timeline", "app", "audience", "audience-manager.tsx");
    const panel = source("src", "modules", "timeline", "app", "plan", "[projectSlug]", "_components", "share-panel.tsx");
    assert.doesNotMatch(manager, /Canonical workspace <code/);
    assert.match(manager, /Source plan/);
    assert.match(manager, /set-aside decision/);
    assert.match(manager, /Review changes from your plan/);
    assert.equal((panel.match(/"Make a new link"/g) ?? []).length, 1);
  });
});
