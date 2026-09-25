import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pageHeaderTaskView, pageHeaderTitle } from "./page-header-context";
import { TASKS_VIEW_PATHS } from "@/lib/product-urls";
import { CORE_DESTINATIONS } from "@/lib/core-navigation";
import { assertProjectId } from "@/lib/projects/project-ref";
import { withActiveProject } from "@/lib/projects/project-url";

test("utility, sibling-product and unknown pages never own task view actions", () => {
  for (const path of [null, "", "/app/settings", "/app/settings/security", "/app/inbox", "/app/my-tasks", "/app/archived", "/app/project", "/app/your-work", "/app/home", "/app/notes", "/app/timeline", "/app/tasks/unknown", "/app/tasks/listing"]) {
    assert.equal(pageHeaderTaskView(path), null, String(path));
  }
});

test("the three canonical task views retain their exact share-view identity", () => {
  assert.deepEqual(Object.keys(TASKS_VIEW_PATHS).sort(), ["board", "calendar", "list"]);
  for (const [view, path] of Object.entries(TASKS_VIEW_PATHS)) assert.equal(pageHeaderTaskView(path), view);
});

test("Settings is named for the utility page; task titles and existing personal labels stay intact", () => {
  assert.equal(pageHeaderTitle("/app/settings", "The Orchard"), "Settings");
  assert.equal(pageHeaderTitle("/app/tasks", "The Orchard"), "The Orchard");
  assert.equal(pageHeaderTitle("/app/inbox", "The Orchard"), "Inbox");
  assert.equal(pageHeaderTitle("/app/my-tasks", "The Orchard"), "My tasks");
  assert.equal(pageHeaderTitle("/app/archived", "The Orchard"), "Archived");
});

test("header links retain the loaded Project using canonical URLs", () => {
  for (const path of Object.values(TASKS_VIEW_PATHS)) {
    const result = new URL(withActiveProject(path, assertProjectId("project-b")), "https://app.example.test");
    assert.equal(result.pathname, path);
    assert.deepEqual([...result.searchParams], [["workspaceId", "project-b"]]);
  }
  // Utility pages share this header; Tasks owns its own. The shared header
  // therefore carries no task view tabs, share or export actions at all,
  // and no highlight override can give it route authority.
  const source = readFileSync(new URL("./page-header.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /ShareButton|TASKS_VIEW_PATHS|Schedule|aria-label="Task views"/);
  assert.doesNotMatch(source, /!isInbox|!isMyTasks|!isArchived|inferShareView/);
});

test("the public Studio link stays outside core navigation and Notes stays under More", () => {
  const source = readFileSync(new URL("../studio-bar/studio-rail.tsx", import.meta.url), "utf8");
  assert.deepEqual(CORE_DESTINATIONS.map((destination) => destination.id), ["home", "project", "tasks", "timeline"]);
  assert.match(source, /RAIL_DESTINATIONS = CORE_DESTINATIONS/);
  assert.match(source, /withSuiteContext\(PRODUCT_APP_PATHS\.notes, suiteContext\)/);
  const about = source.slice(source.indexOf('aria-label="About Signal Studio'), source.indexOf('<span className={styles.railSpacer}'));
  assert.ok(source.indexOf('</nav>') < source.indexOf('aria-label="About Signal Studio'));
  assert.match(about, /data-utility="about"/);
  assert.match(about, /href=\{STUDIO_URL\}/);
  assert.match(about, /target="_blank"/);
  assert.match(about, /rel="noopener noreferrer"/);
  assert.doesNotMatch(about, /data-product|RailIcon name="more"/);
  assert.doesNotMatch(source, /More Signal Studio products|More products/);
});
