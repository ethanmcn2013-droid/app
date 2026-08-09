import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

function source(...parts: string[]) {
  return readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

describe("Wave 2 interface contracts", () => {
  it("discloses photo processing before the AI read action", () => {
    const composer = source("src", "modules", "notes", "app", "workspace", "Composer.tsx");
    const disclosure = composer.indexOf("sends a resized copy to Anthropic");
    const action = composer.indexOf("Read with AI");
    assert.ok(disclosure >= 0);
    assert.ok(action > disclosure);
    assert.match(composer, /Still on this device/);
  });

  it("gives mobile boards explicit lanes and task completion an announced receipt", () => {
    const board = source("src", "components", "hybrid", "options", "a", "board-view.tsx");
    const detail = source("src", "components", "app", "task-detail", "task-detail.tsx");
    assert.match(board, /mobileLaneNav/);
    assert.match(board, /scrollIntoView/);
    assert.match(detail, /role="status"/);
    assert.match(detail, /Moved to Done/);
  });

  it("states the published-link boundary and review step in sharing", () => {
    const page = source("src", "modules", "timeline", "app", "audience", "page.tsx");
    const manager = source("src", "modules", "timeline", "app", "audience", "audience-manager.tsx");
    assert.match(page, /Anyone with a published link can open and forward the frozen copy/);
    assert.match(page, /Choose/);
    assert.match(page, /Review/);
    assert.match(page, /Publish/);
    assert.match(manager, /Changes the wording only\. It does not restrict who can open a published link/);
  });
});
