import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { AUTOMATIONS_APP_PATH, AUTOMATIONS_LABEL } from "@/lib/product-urls";
import { CREATE_LABEL, createKindForPath } from "@/lib/shell-create";
import {
  activeDestinationId,
  crumbsForPath,
  FOOTER_DESTINATIONS,
  HOME_DESTINATION,
  MORE_CUSTOMIZATION_ITEMS,
  MORE_DESTINATIONS,
  MORE_NAVIGATION_GROUPS,
  PRIMARY_DESTINATIONS,
  sectionIsOpen,
  sectionStoreKey,
  SIDEBAR_GROUPS,
  TOOL_DESTINATIONS,
  UTILITY_DESTINATIONS,
  visibleMoreNavigationGroups,
  WORKSPACE_DESTINATIONS,
} from "./shell-nav";

/**
 * Guards for the sidebar's shape: Home, Analytics and Files, then Workspace,
 * Projects, More and Chat as named groups. Overview is a
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

test("the navigation orders the primary links and Workspace, Projects, More and Chat", () => {
  assert.deepEqual(
    SIDEBAR_GROUPS.map((group) => [group.id, group.label, group.folds]),
    [
      ["workspace", "Workspace", true],
      ["projects", "Projects", true],
      ["more", "More", true],
      ["chat", "Chat", true],
    ],
  );
  assert.deepEqual(rows(PRIMARY_DESTINATIONS), [
    ["Home", "/app/home"],
    ["Analytics", "/app/analytics"],
    ["Files", "/app/files"],
  ]);
  // The sidebar draws them in the same order, followed by named groups.
  const order = ['aria-label="Primary"', 'groupById("workspace")', 'groupById("projects")', 'groupById("more")', 'groupById("chat")', "styles.footer"].map(
    (literal) => sidebarSource.indexOf(literal, sidebarSource.indexOf("<aside")),
  );
  assert.ok(order.every((index) => index > 0), "every group renders");
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test("Home is one page: no Overview row or crumb, and the retired briefing paths light Home", () => {
  assert.deepEqual([HOME_DESTINATION.label, HOME_DESTINATION.href], ["Home", "/app/home"]);
  const every = [...PRIMARY_DESTINATIONS, ...WORKSPACE_DESTINATIONS, ...MORE_DESTINATIONS, ...UTILITY_DESTINATIONS, ...TOOL_DESTINATIONS, ...FOOTER_DESTINATIONS];
  assert.equal(every.some((destination) => destination.label === "Overview" || destination.href === "/app/home/briefing"), false);
  for (const inside of ["/app/home", "/app/home/briefing", "/app/signal"]) {
    assert.equal(activeDestinationId(inside), "home", inside);
  }
  assert.deepEqual(crumbsForPath("/app/home").map((crumb) => crumb.label), ["Signal Studio", "Home"]);
  assert.deepEqual(crumbsForPath("/app/home/briefing").map((crumb) => crumb.label), ["Signal Studio", "Home"]);
});

test("Workspace is the three places of the work", () => {
  assert.deepEqual(rows(WORKSPACE_DESTINATIONS), [
    ["Projects", "/app/project"],
    ["Tasks", "/app/tasks"],
    ["Timeline", "/app/timeline"],
  ]);
});

test("More groups destinations by work and honestly marks planned tools", () => {
  assert.deepEqual(rows(MORE_DESTINATIONS), [
    [AUTOMATIONS_LABEL, AUTOMATIONS_APP_PATH],
    ["Whiteboard", "/app/tools/whiteboard"],
    ["Wedding hub", "/app/tools/wedding-planner"],
    ["Teacher hub", "/app/tools/teacher-toolkit"],
    ["Student hub", "/app/tools/student-hub"],
    ["Process map", "/app/tools/process-map"],
    ["Docs", "/app/tools/docs"],
    ["Forms", "/app/tools/forms"],
  ]);
  assert.deepEqual(MORE_DESTINATIONS.map((destination) => [destination.id, Boolean(destination.preview), Boolean(destination.soon)]), [
    ["automations", true, false],
    ["whiteboard", false, true],
    ["wedding-hub", false, false],
    ["teacher-hub", false, true],
    ["student-hub", false, true],
    ["process-map", false, true],
    ["docs", false, true],
    ["forms", false, true],
  ]);
  assert.deepEqual(MORE_NAVIGATION_GROUPS.map(({ id, label, entries }) => [id, label, entries.map(({ id: entryId, children }) => [entryId, children?.map(({ id: childId }) => childId) ?? []])]), [
    ["development", "Development", [["automations", []]]],
    ["wedding-hub", "", [["wedding-hub", ["wedding-guest-list", "wedding-seating", "wedding-budget"]]]],
    ["teacher-hub", "", [["teacher-hub", ["whiteboard", "teacher-lessons", "teacher-marking", "teacher-share-plan"]]]],
    ["student-hub", "", [["student-hub", ["student-deadlines", "student-group-work", "student-lecture-notes"]]]],
    ["other-tools", "Other tools", [["notes", []], ["process-map", []], ["docs", []], ["forms", []]]],
  ]);
  assert.deepEqual(MORE_CUSTOMIZATION_ITEMS.filter(({ defaultVisible }) => defaultVisible === false).map(({ id }) => id), [
    "notes", "process-map", "docs", "forms",
  ]);
  const hiddenByDefault = new Set(MORE_CUSTOMIZATION_ITEMS.filter(({ defaultVisible }) => defaultVisible === false).map(({ id }) => id));
  assert.deepEqual(visibleMoreNavigationGroups(hiddenByDefault).map(({ id, entries }) => [id, entries.map(({ id: entryId }) => entryId)]), [
    ["development", ["automations"]],
    ["wedding-hub", ["wedding-hub"]],
    ["teacher-hub", ["teacher-hub"]],
    ["student-hub", ["student-hub"]],
  ]);
  assert.deepEqual(visibleMoreNavigationGroups(new Set([...hiddenByDefault, "wedding-hub", "whiteboard"])).map(({ id, entries }) => [id, entries.map(({ id: entryId }) => entryId)]), [
    ["development", ["automations"]],
    ["teacher-hub", ["teacher-hub"]],
    ["student-hub", ["student-hub"]],
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
  assert.equal(activeDestinationId("/app/tools/wedding-planner"), "wedding-hub");
  assert.deepEqual(crumbsForPath("/app/tools/wedding-planner").map((crumb) => crumb.label), ["Signal Studio", "Wedding hub"]);
  assert.equal(activeDestinationId("/app/tools/teacher-toolkit"), "teacher-hub");
  assert.equal(activeDestinationId("/app/tools/student-hub"), "student-hub");
  assert.deepEqual(crumbsForPath("/app/wedding/guests").map((crumb) => crumb.label), ["Signal Studio", "Wedding tools", "Guest list"]);
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
  // Inbox lives beside Home; other utilities remain in search, Chat and the launcher.
  const homeTabsSource = readFileSync(path.join(process.cwd(), "src/components/app/home/home-tabs.tsx"), "utf8");
  assert.match(homeTabsSource, /label: "Inbox", href: "\/app\/inbox"/);
  assert.doesNotMatch(shellSource, /<ShellIcon\.bell|className=\{styles\.topSearch\}/);
  assert.match(paletteSource, /id: "my-tasks"/);
  assert.match(paletteSource, /id: "inbox"/);
  assert.match(sidebarSource, /href: "\/app\/messages"/);
  assert.match(shellSource, /<AppsLauncher/);
  assert.deepEqual(crumbsForPath("/app/inbox").map((crumb) => crumb.label), ["Signal Studio", "Inbox"]);
  assert.deepEqual(crumbsForPath("/app/your-work").map((crumb) => crumb.label), ["Signal Studio", "My tasks"]);
  assert.deepEqual(crumbsForPath("/app/tools/docs").map((crumb) => crumb.label), ["Signal Studio", "Docs"]);
  assert.deepEqual(crumbsForPath("/app/notes").map((crumb) => crumb.label), ["Signal Studio", "Apps and tools", "Notes"]);

  const ids = [...PRIMARY_DESTINATIONS, ...WORKSPACE_DESTINATIONS, ...MORE_DESTINATIONS, ...UTILITY_DESTINATIONS, ...TOOL_DESTINATIONS, ...FOOTER_DESTINATIONS].map(
    (destination) => destination.id,
  );
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(FOOTER_DESTINATIONS.map((destination) => destination.id), ["settings"]);
  assert.deepEqual(TOOL_DESTINATIONS.map((destination) => destination.id), ["notes"]);
});

test("the sidebar has no Initial setup group", () => {
  assert.doesNotMatch(sidebarSource, /INITIAL_SETUP|Initial setup|styles\.setup/);
});

test("Projects lists the reader's own catalog with a project marker each and a dot only for a real status", () => {
  // One authorized read: the catalog action's rows, plus the status rule.
  assert.match(sidebarSource, /loadSidebarProjectsAction\(\)/);
  assert.doesNotMatch(sidebarSource, /loadProjectCatalogAction/);
  // The approved sidebar identity retains each Project's colour. The rendered
  // sidebar fixture checks that only the selected row has an outer ring.
  assert.match(sidebarSource, /className=\{styles\.projectProgressCore\} style=\{\{ backgroundColor: projectColor\(row\.id\) \}\}/);
  assert.match(sidebarSource, /const mark = marks\[row\.id\];/);
  assert.match(sidebarSource, /const dot = mark \? <span className=\{styles\.statusDot\} data-tone=\{mark\}/);
  // A row is a link to that Project; a plain click uses the guarded switch.
  assert.match(sidebarSource, /href=\{buildProjectUrl\(\{ surface: "tasks", view: "board" \}, row\.id, readableName\)\}/);
  assert.match(sidebarSource, /const readableName = suiteContext\?\.version === 3 && verifiedProjectName && suiteContext\.workspaceId === row\.id/);
  assert.match(sidebarSource, /activeProject\.selectProject\(row\.project, \{ surface: "tasks", view: "board" \}\)/);
  for (const literal of ["No projects yet", "Start one", "All {rows.length} projects", 'aria-label="Archived projects"', 'aria-label="All projects"']) {
    assert.ok(sidebarSource.includes(literal), literal);
  }
});

test("Chat lists real conversations, or says Coming soon; it never invents one", () => {
  // The rows come from the directory the server read for this reader.
  assert.match(sidebarSource, /const directory = useChatDirectory\(messagesEnabled \? chatDirectory : null\);/);
  assert.match(sidebarSource, /chatEntries\.map\(\(entry\) => chatLink\(entry\)\)/);
  // New message only where the product can start one.
  assert.match(sidebarSource, /directory\?\.newMessageHref \? \(\s*<SidebarIntentLink href=\{directory\.newMessageHref\} aria-label="New message"/);
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
  for (const path of ["/app/home", "/app/tasks", "/app/tasks/list", "/app/timeline", "/app/files", "/app/analytics", "/app/settings", "/app/messages", "/app/projects-like"]) {
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
