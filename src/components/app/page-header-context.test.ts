import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pageHeaderTaskView, pageHeaderTitle } from "./page-header-context";
import { TASKS_VIEW_PATHS } from "@/lib/product-urls";
import { assertProjectId } from "@/lib/projects/project-ref";
import { withActiveProject } from "@/lib/projects/project-url";

test("utility, sibling-product and unknown pages never own task view actions", () => {
  for (const path of [null, "", "/app/settings", "/app/settings/security", "/app/inbox", "/app/my-tasks", "/app/archived", "/app/project", "/app/your-work", "/app/home", "/app/notes", "/app/timeline", "/app/tasks/unknown", "/app/tasks/listing"]) {
    assert.equal(pageHeaderTaskView(path), null, String(path));
  }
});

test("all four canonical task views retain their exact share-view identity", () => {
  for (const [view, path] of Object.entries(TASKS_VIEW_PATHS)) assert.equal(pageHeaderTaskView(path), view);
});

test("Settings is named for the utility page; task titles and existing personal labels stay intact", () => {
  assert.equal(pageHeaderTitle("/app/settings", "The Orchard"), "Settings");
  assert.equal(pageHeaderTitle("/app/tasks", "The Orchard"), "The Orchard");
  assert.equal(pageHeaderTitle("/app/inbox", "The Orchard"), "Inbox");
  assert.equal(pageHeaderTitle("/app/my-tasks", "The Orchard"), "My work");
  assert.equal(pageHeaderTitle("/app/archived", "The Orchard"), "Archived");
});

test("header links retain the loaded Project using canonical URLs", () => {
  for (const path of Object.values(TASKS_VIEW_PATHS)) {
    const result = new URL(withActiveProject(path, assertProjectId("project-b")), "https://app.example.test");
    assert.equal(result.pathname, path);
    assert.deepEqual([...result.searchParams], [["workspaceId", "project-b"]]);
  }
  const source = readFileSync(new URL("./page-header.tsx", import.meta.url), "utf8");
  assert.match(source, /pageHeaderTaskView\(pathname\)/, "highlight overrides cannot create route authority");
  assert.match(source, /parseProjectId\(workspace\?\.id\)/);
  assert.match(source, /href=\{contextualPath\(t\.href\)\}/);
  assert.equal((source.match(/\{taskView \?/g) ?? []).length, 2, "both the actions and tabs are gated by explicit task-view ownership");
  assert.doesNotMatch(source, /!isInbox|!isMyTasks|!isArchived|inferShareView/);
});

test("the public Studio link is an external utility, outside the three-product switcher", () => {
  const source = readFileSync(new URL("../studio-bar/studio-rail.tsx", import.meta.url), "utf8");
  const destinations = source.slice(source.indexOf("export const RAIL_DESTINATIONS"), source.indexOf("function activeRailKey"));
  assert.deepEqual([...destinations.matchAll(/key: "([a-z]+)", label:/g)].map((match) => match[1]), ["notes", "tasks", "timeline"]);
  const about = source.slice(source.indexOf('aria-label="About Signal Studio'), source.indexOf('<span className={styles.railSpacer}'));
  assert.ok(source.indexOf('</nav>') < source.indexOf('aria-label="About Signal Studio'));
  assert.match(about, /data-utility="about"/);
  assert.match(about, /href=\{STUDIO_URL\}/);
  assert.match(about, /target="_blank"/);
  assert.match(about, /rel="noopener noreferrer"/);
  assert.doesNotMatch(about, /data-product|RailIcon name="more"/);
  assert.doesNotMatch(source, /More Signal Studio products|More products/);
});
