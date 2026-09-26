/**
 * context-actions.test.ts — Phase 3.3 source-inspection tests.
 *
 * Asserts structural contracts on the ContextActions primitive and its
 * wiring into the board-view, without a DOM or a bundler. All checks read
 * source text directly; they will catch regressions introduced by future
 * edits to the two files under test.
 *
 * Runtime menu behaviour (focus management, arrow-key nav, Escape, typeahead,
 * submenu open/close) is supplied by Radix and is a LEAD QA item — verify
 * via keyboard walkthrough in the browser.
 *
 * Run: node --import tsx --test src/components/primitives/context-actions.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const primitiveSource = readFileSync(
  resolve(__dirname, "context-actions.tsx"),
  "utf8",
);

// The v3 board opens one task menu (src/components/tasks/task-menu.tsx),
// built on the same Radix dropdown this primitive wraps.
const boardSource = readFileSync(
  resolve(__dirname, "../tasks/board-view.tsx"),
  "utf8",
);
const taskMenuSource = readFileSync(
  resolve(__dirname, "../tasks/task-menu.tsx"),
  "utf8",
);
const uiSource = readFileSync(resolve(__dirname, "../tasks/ui.tsx"), "utf8");

// ── 1. Both Radix menu roots are present in the primitive ────────────────────

test("context-actions: imports and mounts DropdownMenu.Root from @radix-ui/react-dropdown-menu", () => {
  assert.ok(
    primitiveSource.includes("@radix-ui/react-dropdown-menu"),
    "must import @radix-ui/react-dropdown-menu",
  );
  assert.ok(
    primitiveSource.includes("DropdownMenu.Root"),
    "must render a DropdownMenu.Root",
  );
});

test("context-actions: imports and mounts ContextMenu.Root from @radix-ui/react-context-menu", () => {
  assert.ok(
    primitiveSource.includes("@radix-ui/react-context-menu"),
    "must import @radix-ui/react-context-menu",
  );
  assert.ok(
    primitiveSource.includes("ContextMenu.Root"),
    "must render a ContextMenu.Root",
  );
});

// ── 2. One registry drives both surfaces ────────────────────────────────────

test("context-actions: single items prop is passed to both dropdown and context menu renderers", () => {
  // Both renderDropdownGroups and renderContextGroups must be called with items.
  assert.ok(
    primitiveSource.includes("renderDropdownGroups(items)"),
    "DropdownMenu surface must use renderDropdownGroups(items)",
  );
  assert.ok(
    primitiveSource.includes("renderContextGroups(items)"),
    "ContextMenu surface must use renderContextGroups(items)",
  );
});

// ── 3. Group order is canonical: open → workflow → organisation → destructive

test("context-actions: GROUP_ORDER declares the four groups in the required order", () => {
  // Find the GROUP_ORDER array declaration and verify order.
  const match = primitiveSource.match(/GROUP_ORDER[^=]*=\s*\[([^\]]+)\]/);
  assert.ok(match, "GROUP_ORDER must be declared");
  const raw = match[1];
  const groups = [...raw.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    groups,
    ["open", "workflow", "organisation", "destructive"],
    "GROUP_ORDER must be open, workflow, organisation, destructive",
  );
});

// ── 4. Destructive group has visual separation (separator before it) ──────────

test("context-actions: renderDropdownGroups inserts a Separator before each non-first group (including destructive)", () => {
  // The separator is rendered for gIdx > 0, which covers the destructive group.
  assert.ok(
    primitiveSource.includes("DropdownMenu.Separator"),
    "must use DropdownMenu.Separator to separate groups",
  );
  assert.ok(
    primitiveSource.includes("ContextMenu.Separator"),
    "must use ContextMenu.Separator to separate groups",
  );
  assert.ok(
    primitiveSource.includes("gIdx > 0"),
    "separator must be conditional on gIdx > 0 (only between groups)",
  );
});

// ── 5. Destructive items are styled distinctly ───────────────────────────────

test("context-actions: destructive group items carry data-destructive attribute", () => {
  assert.ok(
    primitiveSource.includes('data-destructive={item.group === "destructive" || undefined}'),
    "items must set data-destructive when group is 'destructive'",
  );
});

// ── 6. Disabled items carry disabledReason as native title ──────────────────

test("context-actions: disabled items expose disabledReason via title prop", () => {
  assert.ok(
    primitiveSource.includes("title={item.disabled ? item.disabledReason : undefined}"),
    "disabled items must set title to disabledReason for native tooltip",
  );
});

// ── 7. Shortcut hints present ────────────────────────────────────────────────

test("context-actions: shortcutHint renders in a .shortcut span when present", () => {
  assert.ok(
    primitiveSource.includes("item.shortcutHint"),
    "must conditionally render shortcutHint",
  );
  assert.ok(
    primitiveSource.includes("styles.shortcut"),
    "must apply styles.shortcut class to the hint span",
  );
});

// ── 8. The ••• trigger has aria-label ───────────────────────────────────────

test("context-actions: the DropdownMenu trigger button exposes aria-label={triggerLabel}", () => {
  assert.ok(
    primitiveSource.includes("aria-label={triggerLabel}"),
    "••• trigger button must have aria-label={triggerLabel}",
  );
});

// ── 9. The board has one menu system: right-click, "…" and "." open it ─────

test("board-view: every card route opens the single task menu", () => {
  assert.ok(boardSource.includes("onContextMenu"), "cards must open the menu on right-click");
  assert.ok(boardSource.includes("surface.openMenu"), "cards must open the shared task menu");
  assert.ok(boardSource.includes('aria-haspopup="menu"'), "the card's … button must announce a menu");
});

// ── 10. No hand-rolled menu survives ──────────────────────────────────────────

test("board-view: does not import the old TaskContextMenu or useTaskContextMenu", () => {
  for (const source of [boardSource, taskMenuSource]) {
    assert.ok(!source.includes("useTaskContextMenu"), "the old useTaskContextMenu hook is retired");
    assert.ok(!source.includes("TaskContextMenu"), "the old TaskContextMenu is retired");
  }
  assert.ok(uiSource.includes("@radix-ui/react-dropdown-menu"), "the task menu is built on the Radix dropdown");
});

// ── 11. The task menu covers every act a card can take ────────────────────────

test("task-menu: includes all required brand-voice labels", () => {
  const requiredLabels = ["Open", "Copy link", "Move to", "Priority", "Duplicate", "Archive", "Delete"];
  for (const label of requiredLabels) {
    assert.ok(new RegExp(`>\\s*${label}\\s*<`).test(taskMenuSource), `task menu must include the label ${label}`);
  }
});

// ── 12. The menu is named for what it does, and the card for its task ─────────

test("board-view: the … trigger is labelled and the card carries the task name", () => {
  assert.ok(/aria-label=\{`Actions for \$\{task\.title\}`\}/.test(boardSource), "the … trigger must be labelled");
  assert.ok(boardSource.includes("aria-label={task.title}"), "the card article must be named by its task");
});
