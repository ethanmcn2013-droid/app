import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  activeDestinationId,
  crumbsForPath,
  FOOTER_DESTINATIONS,
  INITIAL_SETUP,
  INITIAL_SETUP_DESTINATIONS,
  isInsideInitialSetup,
  sectionIsOpen,
  sectionStoreKey,
  TOOL_DESTINATIONS,
  TOP_LEVEL_DESTINATIONS,
} from "./shell-nav";

/**
 * Guards for the sidebar's shape (founder instruction, 2 Oct 2026): the
 * approved navigation is the top level, in order, and everything the sidebar
 * had before sits under one "Initial setup" group. Nothing is dropped.
 */

/** The sidebar's rows before 2 Oct 2026 (PRIMARY then WORKSPACE), id and href. */
const PREVIOUS_ROWS: ReadonlyArray<readonly [string, string]> = [
  ["home", "/app/home"],
  ["inbox", "/app/inbox"],
  ["my-tasks", "/app/my-tasks"],
  ["tasks", "/app/tasks"],
  ["projects", "/app/project"],
  ["timeline", "/app/timeline"],
  ["messages", "/app/messages"],
  ["files", "/app/files"],
  ["overview", "/app/home/briefing"],
  ["analytics", "/app/analytics"],
  ["tools", "/app/tools"],
];

const sidebarSource = readFileSync(
  path.join(process.cwd(), "src", "components", "shell", "app-sidebar.tsx"),
  "utf8",
);
const shellSource = readFileSync(
  path.join(process.cwd(), "src", "components", "shell", "app-shell.tsx"),
  "utf8",
);

test("the top level is the approved navigation, in order", () => {
  assert.deepEqual(
    TOP_LEVEL_DESTINATIONS.map((destination) => [destination.label, destination.href]),
    [
      ["Home", "/app/home"],
      ["Overview", "/app/home/briefing"],
      ["Projects", "/app/project"],
      ["Tasks", "/app/tasks"],
      ["Timeline", "/app/timeline"],
      ["Files", "/app/files"],
      ["Analytics", "/app/analytics"],
      ["Whiteboard", "/app/tools/whiteboard"],
    ],
  );
  // Whiteboard is the only row that is not built yet, and it says so.
  assert.deepEqual(
    TOP_LEVEL_DESTINATIONS.filter((destination) => destination.soon).map((destination) => destination.id),
    ["whiteboard"],
  );
});

test("everything else sits under Initial setup, in the order it had", () => {
  assert.equal(INITIAL_SETUP.label, "Initial setup");
  assert.deepEqual(
    INITIAL_SETUP_DESTINATIONS.map((destination) => [destination.label, destination.href]),
    [
      ["Inbox", "/app/inbox"],
      ["My tasks", "/app/my-tasks"],
      ["Chat", "/app/messages"],
      ["Apps and tools", "/app/tools"],
    ],
  );
  // Chat keeps its gate; nothing else gained one.
  assert.deepEqual(
    [...TOP_LEVEL_DESTINATIONS, ...INITIAL_SETUP_DESTINATIONS]
      .filter((destination) => destination.requiresMessages)
      .map((destination) => destination.id),
    ["messages"],
  );
});

test("nothing the sidebar had before is dropped, and no row is listed twice", () => {
  const now = new Map(
    [...TOP_LEVEL_DESTINATIONS, ...INITIAL_SETUP_DESTINATIONS].map((destination) => [destination.id, destination.href]),
  );
  for (const [id, href] of PREVIOUS_ROWS) {
    assert.equal(now.get(id), href, `${id} must still be a sidebar row at ${href}`);
  }
  const ids = [...TOP_LEVEL_DESTINATIONS, ...INITIAL_SETUP_DESTINATIONS, ...TOOL_DESTINATIONS, ...FOOTER_DESTINATIONS].map(
    (destination) => destination.id,
  );
  assert.equal(new Set(ids).size, ids.length);
  // Only Whiteboard is new.
  const previous = new Set(PREVIOUS_ROWS.map(([id]) => id));
  assert.deepEqual([...now.keys()].filter((id) => !previous.has(id)), ["whiteboard"]);
  assert.deepEqual(FOOTER_DESTINATIONS.map((destination) => destination.id), ["settings"]);
  assert.deepEqual(TOOL_DESTINATIONS.map((destination) => destination.id), ["notes"]);
});

test("the sidebar keeps the foldable lists and their actions inside the group", () => {
  const body = sidebarSource.slice(sidebarSource.indexOf("id={SETUP_BODY_ID}"), sidebarSource.indexOf("styles.footer"));
  assert.ok(body.length > 0, "the group body must come before the footer");
  for (const literal of [
    "INITIAL_SETUP_DESTINATIONS",
    '"Projects"',
    'aria-label="Archived projects"',
    'aria-label="All projects"',
    '"Channels"',
    '"Direct messages"',
    "New message",
    'count(inboxCount, "waiting")',
  ]) {
    assert.ok(
      body.includes(literal) || (literal === "INITIAL_SETUP_DESTINATIONS" && body.includes("setupRows")),
      `${literal} must render inside Initial setup`,
    );
  }
  // A real disclosure, in a plain wrapper: no <nav> wraps another <nav>.
  assert.match(sidebarSource, /aria-expanded=\{setupOpen\}/);
  assert.match(sidebarSource, /aria-controls=\{setupOpen \? SETUP_BODY_ID : undefined\}/);
  assert.match(sidebarSource, /<div className=\{styles\.setup\}/);
  assert.match(sidebarSource, /<div id=\{SETUP_BODY_ID\} className=\{styles\.setupBody\}>/);
  // Folded, the header says what is waiting inside.
  assert.match(sidebarSource, /setupOpen \? null : count\(setupWaiting, "waiting inside"\)/);
});

test("the New menu keeps Task and Project on top and offers Message only with Chat", () => {
  const menu = shellSource.slice(shellSource.indexOf('role="menu"'), shellSource.indexOf("function chooseTheme"));
  const group = menu.indexOf('role="group"');
  assert.ok(group > 0);
  assert.ok(menu.indexOf("Task <span") < group);
  assert.ok(menu.indexOf('href="/app/project"') < group);
  assert.ok(menu.indexOf('href="/app/notes"') > group);
  assert.ok(menu.indexOf('href="/app/messages"') > group);
  assert.match(menu, /\{chat \? \(\s*<Link href="\/app\/messages" role="menuitem"/);
  assert.match(menu, /\{INITIAL_SETUP\.label\}/);
  assert.match(sidebarSource, /\[CHAT_ENABLED_ATTRIBUTE\]: messagesEnabled \? "" : undefined/);
});

test("the group opens by itself only for the pages inside it", () => {
  for (const inside of ["/app/inbox", "/app/my-tasks", "/app/your-work", "/app/messages", "/app/tools", "/app/tools/docs", "/app/notes"]) {
    assert.equal(isInsideInitialSetup(inside), true, inside);
  }
  for (const outside of ["/app/home", "/app/home/briefing", "/app/project", "/app/archived", "/app/tasks", "/app/timeline", "/app/files", "/app/analytics", "/app/tools/whiteboard", "/app/settings"]) {
    assert.equal(isInsideInitialSetup(outside), false, outside);
  }
  assert.equal(activeDestinationId("/app/tools/whiteboard"), "whiteboard");
  assert.deepEqual(crumbsForPath("/app/tools/whiteboard").map((crumb) => crumb.label), ["Signal Studio", "Whiteboard"]);
  assert.deepEqual(crumbsForPath("/app/tools/docs").map((crumb) => crumb.label), ["Signal Studio", "Apps and tools", "Docs"]);
});

test("Initial setup starts folded and remembers a choice; the older sections start open", () => {
  const untouched: ReadonlySet<string> = new Set();
  assert.equal(sectionIsOpen(untouched, INITIAL_SETUP.id), false);
  for (const id of ["projects", "channels", "direct"]) {
    assert.equal(sectionIsOpen(untouched, id), true, id);
    assert.equal(sectionStoreKey(id), id);
    assert.equal(sectionIsOpen(new Set([id]), id), false, id);
  }
  assert.equal(sectionStoreKey(INITIAL_SETUP.id), "open:initial-setup");
  assert.equal(sectionIsOpen(new Set(["open:initial-setup"]), INITIAL_SETUP.id), true);
  // A list written before this group existed never opens or folds it by accident.
  assert.equal(sectionIsOpen(new Set(["initial-setup", "projects"]), INITIAL_SETUP.id), false);
});
