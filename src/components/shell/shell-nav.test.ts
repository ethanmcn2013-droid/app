import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { AUTOMATIONS_APP_PATH, AUTOMATIONS_LABEL } from "@/lib/product-urls";
import { CREATE_LABEL, createKindForPath } from "@/lib/shell-create";
import {
  activeDestinationId,
  BUILD_DESTINATIONS,
  crumbsForPath,
  FOOTER_DESTINATIONS,
  HOME_DESTINATION,
  sectionIsOpen,
  sectionStoreKey,
  SIDEBAR_GROUPS,
  TOOL_DESTINATIONS,
  UTILITY_DESTINATIONS,
  WORKSPACE_DESTINATIONS,
} from "./shell-nav";

/**
 * Guards for the sidebar's shape (founder instruction, 6 Oct 2026): Home,
 * then Workspace, Projects, Build and Chat as named groups. Overview is a
 * tab of Home, Automations has a row, and the "Initial setup" group is gone
 * with every place it held still reachable.
 */

const sidebarSource = readFileSync(
  path.join(process.cwd(), "src", "components", "shell", "app-sidebar.tsx"),
  "utf8",
);
const shellSource = readFileSync(
  path.join(process.cwd(), "src", "components", "shell", "app-shell.tsx"),
  "utf8",
);
const paletteSource = readFileSync(
  path.join(process.cwd(), "src", "components", "app", "suite-command-root.tsx"),
  "utf8",
);

const rows = (destinations: readonly { label: string; href: string }[]) =>
  destinations.map((destination) => [destination.label, destination.href]);

test("the groups are Workspace, Projects, Build and Chat, in that order", () => {
  assert.deepEqual(
    SIDEBAR_GROUPS.map((group) => [group.id, group.label, group.folds]),
    [
      ["workspace", "Workspace", false],
      ["projects", "Projects", true],
      ["build", "Build", false],
      ["chat", "Chat", true],
    ],
  );
  // The sidebar draws them in the same order, Home first.
  const order = ["link(HOME_DESTINATION)", 'groupById("workspace")', 'groupById("projects")', 'groupById("build")', 'groupById("chat")', "styles.footer"].map(
    (literal) => sidebarSource.indexOf(literal, sidebarSource.indexOf("<aside")),
  );
  assert.ok(order.every((index) => index > 0), "every group renders");
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test("Home stands alone and owns Overview; there is no Overview row", () => {
  assert.deepEqual([HOME_DESTINATION.label, HOME_DESTINATION.href], ["Home", "/app/home"]);
  const every = [HOME_DESTINATION, ...WORKSPACE_DESTINATIONS, ...BUILD_DESTINATIONS, ...UTILITY_DESTINATIONS, ...TOOL_DESTINATIONS, ...FOOTER_DESTINATIONS];
  assert.equal(every.some((destination) => destination.label === "Overview" || destination.href === "/app/home/briefing"), false);
  for (const inside of ["/app/home", "/app/home/briefing", "/app/signal"]) {
    assert.equal(activeDestinationId(inside), "home", inside);
  }
  assert.deepEqual(crumbsForPath("/app/home").map((crumb) => crumb.label), ["Signal Studio", "Home"]);
  assert.deepEqual(crumbsForPath("/app/home/briefing").map((crumb) => crumb.label), ["Signal Studio", "Home", "Overview"]);
});

test("Workspace is the five places of the work", () => {
  assert.deepEqual(rows(WORKSPACE_DESTINATIONS), [
    ["Projects", "/app/project"],
    ["Tasks", "/app/tasks"],
    ["Timeline", "/app/timeline"],
    ["Files", "/app/files"],
    ["Analytics", "/app/analytics"],
  ]);
});

test("Build is Automations as a preview and Whiteboard as soon", () => {
  assert.deepEqual(rows(BUILD_DESTINATIONS), [
    [AUTOMATIONS_LABEL, AUTOMATIONS_APP_PATH],
    ["Whiteboard", "/app/tools/whiteboard"],
  ]);
  assert.deepEqual(BUILD_DESTINATIONS.map((destination) => [destination.id, Boolean(destination.preview), Boolean(destination.soon)]), [
    ["automations", true, false],
    ["whiteboard", false, true],
  ]);
  assert.equal(activeDestinationId(AUTOMATIONS_APP_PATH), "automations");
  assert.equal(activeDestinationId(`${AUTOMATIONS_APP_PATH}/draft-1`), "automations");
  assert.deepEqual(crumbsForPath(AUTOMATIONS_APP_PATH).map((crumb) => crumb.label), ["Signal Studio", "Automations"]);
  assert.deepEqual(crumbsForPath(`${AUTOMATIONS_APP_PATH}/draft-1`), [
    { label: "Signal Studio", href: "/app/home" },
    { label: "Automations", href: AUTOMATIONS_APP_PATH },
    { label: "Draft" },
  ]);
  assert.equal(activeDestinationId("/app/tools/whiteboard"), "whiteboard");
  assert.deepEqual(crumbsForPath("/app/tools/whiteboard").map((crumb) => crumb.label), ["Signal Studio", "Whiteboard"]);
});

test("no place the old group held is lost, and no row is listed twice", () => {
  // Inbox, My tasks, Chat and Apps and tools keep their paths and crumbs.
  assert.deepEqual(rows(UTILITY_DESTINATIONS), [
    ["Inbox", "/app/inbox"],
    ["My tasks", "/app/my-tasks"],
    ["Chat", "/app/messages"],
    ["Apps and tools", "/app/tools"],
  ]);
  assert.deepEqual(UTILITY_DESTINATIONS.filter((destination) => destination.requiresMessages).map((destination) => destination.id), ["messages"]);
  // Where each is reached now: the bell, Search or jump to, the Chat group, the launcher.
  assert.match(shellSource, /<Link href="\/app\/inbox" className=\{styles\.iconButton\} aria-label="Inbox">/);
  assert.match(paletteSource, /id: "my-tasks"/);
  assert.match(paletteSource, /id: "inbox"/);
  assert.match(sidebarSource, /href: "\/app\/messages"/);
  assert.match(shellSource, /<AppsLauncher/);
  assert.deepEqual(crumbsForPath("/app/inbox").map((crumb) => crumb.label), ["Signal Studio", "Inbox"]);
  assert.deepEqual(crumbsForPath("/app/your-work").map((crumb) => crumb.label), ["Signal Studio", "My tasks"]);
  assert.deepEqual(crumbsForPath("/app/tools/docs").map((crumb) => crumb.label), ["Signal Studio", "Apps and tools", "Docs"]);
  assert.deepEqual(crumbsForPath("/app/notes").map((crumb) => crumb.label), ["Signal Studio", "Apps and tools", "Notes"]);

  const ids = [HOME_DESTINATION, ...WORKSPACE_DESTINATIONS, ...BUILD_DESTINATIONS, ...UTILITY_DESTINATIONS, ...TOOL_DESTINATIONS, ...FOOTER_DESTINATIONS].map(
    (destination) => destination.id,
  );
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(FOOTER_DESTINATIONS.map((destination) => destination.id), ["settings"]);
  assert.deepEqual(TOOL_DESTINATIONS.map((destination) => destination.id), ["notes"]);
});

test("the sidebar has no Initial setup group", () => {
  assert.doesNotMatch(sidebarSource, /INITIAL_SETUP|Initial setup|styles\.setup/);
});

test("Projects lists the reader's own catalog with a tile each and a dot only for a real status", () => {
  // One authorized read: the catalog action's rows, plus the status rule.
  assert.match(sidebarSource, /loadSidebarProjectsAction\(\)/);
  assert.doesNotMatch(sidebarSource, /loadProjectCatalogAction/);
  assert.match(sidebarSource, /backgroundColor: projectColor\(row\.id\)/);
  assert.match(sidebarSource, /const mark = marks\[row\.id\];/);
  assert.match(sidebarSource, /const dot = mark \? <span className=\{styles\.statusDot\} data-tone=\{mark\}/);
  // A row is a link to that Project; a plain click uses the guarded switch.
  assert.match(sidebarSource, /href=\{buildProjectUrl\(\{ surface: "project" \}, row\.id\)\}/);
  assert.match(sidebarSource, /activeProject\.selectProject\(row\.project, \{ surface: "project" \}\)/);
  for (const literal of ["No projects yet", "Start one", "All {rows.length} projects", 'aria-label="Archived projects"', 'aria-label="All projects"']) {
    assert.ok(sidebarSource.includes(literal), literal);
  }
});

test("Chat lists real conversations, or says Coming soon; it never invents one", () => {
  // The rows come from the directory the server read for this reader.
  assert.match(sidebarSource, /const directory = useChatDirectory\(messagesEnabled \? chatDirectory : null\);/);
  assert.match(sidebarSource, /chatEntries\.map\(\(entry\) => chatLink\(entry\)\)/);
  // New message only where the product can start one.
  assert.match(sidebarSource, /directory\?\.newMessageHref \? \(\s*<Link href=\{directory\.newMessageHref\} aria-label="New message"/);
  // Without Chat: one row, not a link.
  const without = sidebarSource.slice(sidebarSource.indexOf(": collapsed || chatPending"), sidebarSource.indexOf("styles.footer"));
  assert.ok(without.includes("Coming soon"));
  assert.doesNotMatch(without, /<Link|href=/);
  assert.match(sidebarSource, /\[CHAT_ENABLED_ATTRIBUTE\]: messagesEnabled \? "" : undefined/);
});

test("the groups that fold start open and remember being folded", () => {
  const untouched: ReadonlySet<string> = new Set();
  for (const group of SIDEBAR_GROUPS.filter((entry) => entry.folds)) {
    assert.equal(sectionIsOpen(untouched, group.id), true, group.id);
    assert.equal(sectionStoreKey(group.id), group.id);
    assert.equal(sectionIsOpen(new Set([group.id]), group.id), false, group.id);
  }
  // A list written by the earlier sidebar never folds a group by accident.
  assert.equal(sectionIsOpen(new Set(["open:initial-setup", "channels", "direct"]), "chat"), true);
  assert.equal(sectionIsOpen(new Set(["open:initial-setup", "projects"]), "projects"), false);
  // A real disclosure, and storage that may refuse.
  assert.match(sidebarSource, /aria-expanded=\{open\}/);
  assert.match(sidebarSource, /aria-controls=\{open \? bodyId : undefined\}/);
  assert.match(sidebarSource, /try \{\s*window\.localStorage\.setItem\(SECTIONS_KEY/);
});

test("the one create button follows the page: an automation, a project, otherwise a task", () => {
  for (const path of [AUTOMATIONS_APP_PATH, `${AUTOMATIONS_APP_PATH}/draft-1`]) assert.equal(createKindForPath(path), "automation", path);
  for (const path of ["/app/project", "/app/archived"]) assert.equal(createKindForPath(path), "project", path);
  for (const path of ["/app/home", "/app/home/briefing", "/app/tasks", "/app/tasks/list", "/app/timeline", "/app/files", "/app/analytics", "/app/settings", "/app/messages", "/app/projects-like"]) {
    assert.equal(createKindForPath(path), "task", path);
  }
  assert.deepEqual(CREATE_LABEL, { task: "New task", project: "New project", automation: "New automation" });
  // The main half starts it; the small half lists every create path.
  assert.match(shellSource, /aria-label=\{CREATE_LABEL\[kind\]\} onClick=\{start\}/);
  const menu = shellSource.slice(shellSource.indexOf('role="menu"'), shellSource.indexOf("function chooseTheme"));
  const order = ["onClick={newTask}", "onClick={newProject}", "onClick={newAutomation}", 'href="/app/notes"', 'href="/app/messages"'].map((literal) => menu.indexOf(literal));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(menu, /\{chat \? \(\s*<Link href="\/app\/messages" role="menuitem"/);
  // The pages no longer carry their own.
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
  const automations = read("src/components/app/automations/automations-list.tsx");
  assert.doesNotMatch(automations, /className=\{styles\.primary\}/);
  assert.match(automations, /window\.addEventListener\(SHELL_CREATE_AUTOMATION_EVENT, start\)/);
  const hub = read("src/components/app/project/projects-hub.tsx");
  assert.doesNotMatch(hub, /styles\.buttonPrimary\} \$\{styles\.newButton\}/);
  assert.match(hub, /window\.addEventListener\(SHELL_CREATE_PROJECT_EVENT, open\)/);
});
