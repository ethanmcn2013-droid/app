import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  APP_ENTRIES,
  COMING_SOON_LABEL,
  LAUNCHER_NAME,
  CONNECTED_ENTRIES,
  FEEDBACK_EMAIL,
  TOOL_ENTRIES,
  currentAppId,
  driveRowState,
  entryLabel,
  feedbackHref,
  rankLauncher,
  toolBySlug,
  toolIdeasHref,
  toolRequestHref,
  untilThenApps,
  visibleApps,
  type LauncherEntry,
} from "./launcher-catalog";

/**
 * Guards for the apps launcher catalogue (docs/design/v3/launcher.md §10, §13).
 * The catalogue is the one source both the popover and /app/tools render, so
 * the words, the order and the honesty rules are asserted here.
 */

/**
 * Engineer vocabulary that must never reach a reader. The same list Notes
 * holds in notes-copy.ts (BANNED_IN_COPY); repeated here because module
 * boundaries keep shell code from importing Notes internals.
 */
const BANNED_IN_COPY = [
  "extract",
  "promote",
  "promotion",
  "approved wording",
  "workspace id",
  "note id",
  "immutable",
  "payload",
  "receipt",
  "destination",
  "idempot",
  "sha256",
  "dto",
  "endpoint",
  "schema",
] as const;

const ALL: LauncherEntry[] = [...APP_ENTRIES, ...CONNECTED_ENTRIES, ...TOOL_ENTRIES];
const catalogueSource = readFileSync(
  path.join(process.cwd(), "src", "components", "shell", "launcher", "launcher-catalog.ts"),
  "utf8",
);

function displayedStrings(): string[] {
  const out: string[] = [];
  for (const entry of APP_ENTRIES) out.push(entry.label, entry.description);
  for (const entry of CONNECTED_ENTRIES) out.push(entry.label, entry.description);
  for (const tool of TOOL_ENTRIES) out.push(tool.name, tool.oneLiner, ...(tool.shortLine ? [tool.shortLine] : []), ...tool.bullets);
  out.push(driveRowState(true).label, driveRowState(false).label);
  return out;
}

test("apps follow the founder's order, most used first", () => {
  assert.deepEqual(
    APP_ENTRIES.map((entry) => entry.id),
    ["tasks", "timeline", "notes", "files", "analytics", "messages", "projects"],
  );
  assert.deepEqual(
    CONNECTED_ENTRIES.map((entry) => entry.id),
    ["google-drive", "google-sheets"],
  );
  assert.deepEqual(
    TOOL_ENTRIES.map((tool) => tool.slug),
    ["wedding-planner", "student-hub", "teacher-toolkit", "process-map", "whiteboard", "docs", "forms"],
  );
});

test("ids and slugs are unique and every tool is reachable by slug", () => {
  const keys = [
    ...APP_ENTRIES.map((entry) => entry.id),
    ...CONNECTED_ENTRIES.map((entry) => entry.id),
    ...TOOL_ENTRIES.map((tool) => tool.slug),
  ];
  assert.equal(new Set(keys).size, keys.length);
  for (const tool of TOOL_ENTRIES) {
    assert.equal(toolBySlug(tool.slug), tool);
    assert.equal(tool.bullets.length, 3);
    assert.ok(tool.untilThen.length >= 2, `${tool.slug} needs real links for today`);
  }
  assert.equal(toolBySlug("gantt"), null);
  assert.equal(toolBySlug(""), null);
});

test("every link is internal or the one feedback mailbox, never https", () => {
  assert.doesNotMatch(catalogueSource, /https?:\/\//);
  const hosts = new Set(
    [...catalogueSource.matchAll(/mailto:\$\{FEEDBACK_EMAIL\}|mailto:([^?"`]+)/g)].map(
      (match) => match[1] ?? FEEDBACK_EMAIL,
    ),
  );
  assert.deepEqual([...hosts], [FEEDBACK_EMAIL]);
  assert.equal(FEEDBACK_EMAIL, "hello@signalstudio.ie");
  for (const app of APP_ENTRIES) assert.match(app.href, /^\/app\//);
  for (const href of [feedbackHref(), toolRequestHref("x"), toolIdeasHref(TOOL_ENTRIES[0]!)]) {
    assert.ok(href.startsWith(`mailto:${FEEDBACK_EMAIL}?subject=`), href);
  }
});

test("search finds the synonyms people actually type", () => {
  const first = (query: string) => {
    const result = rankLauncher(query, ALL)[0];
    return result ? entryLabel(result) : null;
  };
  assert.equal(first("miro"), "Whiteboard");
  assert.equal(first("canvas"), "Whiteboard");
  assert.equal(first("spreadsheet"), "Google Sheets");
  assert.equal(first("drive"), "Google Drive");
  assert.equal(first("wedding"), "Wedding planner");
  assert.equal(first("tim"), "Timeline");
  assert.equal(first("TIM"), "Timeline");
  assert.equal(first("  tim  "), "Timeline");
  assert.deepEqual(rankLauncher("gantt chart zz", ALL), []);
  // An empty query returns everything in catalogue order.
  assert.equal(rankLauncher("", ALL).length, ALL.length);
});

test("a label prefix outranks a keyword match", () => {
  const ranked = rankLauncher("no", ALL).map(entryLabel);
  assert.equal(ranked[0], "Notes");
});

test("the zero-result link carries only the trimmed, encoded query", () => {
  const href = toolRequestHref(`  gantt & more${"x".repeat(100)}  `);
  const subject = decodeURIComponent(href.split("subject=")[1] ?? "");
  assert.ok(subject.startsWith("Tool request: gantt & more"));
  assert.ok(subject.length <= "Tool request: ".length + 60);
  assert.doesNotMatch(href, / /);
});

test("Drive reads the build flag and never claims a connection", () => {
  assert.deepEqual(driveRowState(true), {
    status: "setup",
    label: "Set up in Settings",
    href: "/app/settings",
  });
  assert.deepEqual(driveRowState(false), { status: "soon", label: COMING_SOON_LABEL });
  const sheets = CONNECTED_ENTRIES.find((entry) => entry.id === "google-sheets");
  assert.equal(sheets?.state, "soon");
  for (const value of displayedStrings()) {
    assert.doesNotMatch(value, /\bconnected\b/i, value);
  }
});

test("Messages is hidden unless allowed, and whiteboard falls back to Tasks", () => {
  assert.ok(!visibleApps(false).some((app) => app.id === "messages"));
  assert.ok(visibleApps(true).some((app) => app.id === "messages"));
  const whiteboard = toolBySlug("whiteboard")!;
  assert.deepEqual(untilThenApps(whiteboard, true).map((app) => app.id), ["notes", "messages"]);
  assert.deepEqual(untilThenApps(whiteboard, false).map((app) => app.id), ["notes", "tasks"]);
});

test("the current app follows the most specific path", () => {
  assert.equal(currentAppId("/app/tasks"), "tasks");
  assert.equal(currentAppId("/app/task/abc"), "tasks");
  assert.equal(currentAppId("/app/notes"), "notes");
  assert.equal(currentAppId("/app/archived"), "projects");
  assert.equal(currentAppId("/app/home"), null);
});

test("copy is plain: no banned words, no Workspace, no shouting", () => {
  const offences: string[] = [];
  for (const value of displayedStrings()) {
    const lower = value.toLowerCase();
    for (const banned of BANNED_IN_COPY) {
      if (lower.includes(banned)) offences.push(`"${value}" contains "${banned}"`);
    }
    if (/workspace/i.test(value)) offences.push(`"${value}" says workspace`);
    if (value.includes("!")) offences.push(`"${value}" has an exclamation mark`);
    if (value.includes("—")) offences.push(`"${value}" has an em dash`);
    if (/miro/i.test(value)) offences.push(`"${value}" names a brand`);
  }
  assert.deepEqual(offences, [], offences.join("\n"));
});

test("every tool has a popover line of 26 characters or fewer", () => {
  for (const tool of TOOL_ENTRIES) {
    assert.ok(tool.shortLine, `${tool.slug} needs a shortLine`);
    assert.ok(tool.shortLine!.length <= 26, `${tool.slug}: "${tool.shortLine}" is ${tool.shortLine!.length} characters`);
    assert.doesNotMatch(tool.shortLine!, /[.!]$/, `${tool.slug}: no end punctuation in the popover line`);
    assert.equal(tool.shortLine![0], tool.shortLine![0]!.toUpperCase(), `${tool.slug}: sentence case`);
  }
});

test("one name for the launcher, shared with the sidebar and the crumb", () => {
  assert.equal(LAUNCHER_NAME, "Apps and tools");
  const nav = readFileSync(path.join(process.cwd(), "src", "components", "shell", "shell-nav.ts"), "utf8");
  // The sidebar row is a literal the navigation contract reads; it must equal the constant.
  const row = nav.match(/\{ id: "tools", label: "([^"]+)"/);
  assert.equal(row?.[1], LAUNCHER_NAME);
  assert.match(nav, /label: LAUNCHER_NAME, href: "\/app\/tools"/);
  const launcherDir = path.join(process.cwd(), "src", "components", "shell", "launcher");
  for (const file of ["apps-launcher.tsx", "launcher-panel.tsx", "launcher-sheet.tsx", "tool-placeholder.tsx"]) {
    let source = "";
    try {
      source = readFileSync(path.join(launcherDir, file), "utf8");
    } catch {
      continue;
    }
    assert.doesNotMatch(source, /More tools/, `${file} still says More tools`);
  }
});

test("one status label for anything not built yet", () => {
  assert.equal(COMING_SOON_LABEL, "Coming soon");
  assert.equal(driveRowState(false).label, COMING_SOON_LABEL);
  const launcherDir = path.join(process.cwd(), "src", "components", "shell", "launcher");
  for (const file of ["launcher-panel.tsx", "launcher-sheet.tsx", "tool-placeholder.tsx"]) {
    let source = "";
    try {
      source = readFileSync(path.join(launcherDir, file), "utf8");
    } catch {
      continue;
    }
    // No short "Soon" chip, and no hand-typed copy of the label.
    assert.doesNotMatch(source, />\s*Soon\s*</, `${file} has a "Soon" chip`);
    assert.doesNotMatch(source, /"Soon"/, `${file} has a "Soon" label`);
    assert.doesNotMatch(source, /Coming soon/, `${file} types the label instead of COMING_SOON_LABEL`);
  }
});
