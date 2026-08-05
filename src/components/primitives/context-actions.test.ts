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

const boardSource = readFileSync(
  resolve(__dirname, "../hybrid/options/a/board-view.tsx"),
  "utf8",
);

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

// ── 9. Board-view imports ContextActions (single menu system) ────────────────

test("board-view: imports ContextActions from the primitives module", () => {
  assert.ok(
    boardSource.includes("@/components/primitives/context-actions"),
    "board-view must import from @/components/primitives/context-actions",
  );
  assert.ok(
    boardSource.includes("ContextActions"),
    "board-view must reference ContextActions",
  );
});

// ── 10. Board-view does NOT import the old hand-rolled TaskContextMenu ────────

test("board-view: does not import the old TaskContextMenu or useTaskContextMenu", () => {
  assert.ok(
    !boardSource.includes("useTaskContextMenu"),
    "board-view must NOT use the old useTaskContextMenu hook (consolidated into ContextActions)",
  );
  assert.ok(
    !boardSource.includes("TaskContextMenu"),
    "board-view must NOT render the old TaskContextMenu (consolidated into ContextActions)",
  );
});

// ── 11. Board-view action registry covers all required action labels ──────────

test("board-view: buildTaskActions registry includes all required brand-voice labels", () => {
  const requiredLabels = [
    "Open",
    "Copy link",
    "Change status",
    "Set priority",
    "Move to",
    "Duplicate",
    "Archive",
    "Delete",
  ];
  for (const label of requiredLabels) {
    assert.ok(
      boardSource.includes(`"${label}"`),
      `board-view registry must include the label "${label}"`,
    );
  }
});

// ── 12. Board-view uses ContextActions wrapping the card article ──────────────

test("board-view: wraps each task card in ContextActions (both trigger and target props present)", () => {
  // T·132 pass 5: the label is a constant now, not a template. Interpolating
  // the task title made a screen reader speak it four times per card, so the
  // trigger says what it does and the card's own label names the task. The
  // contract is that a label is passed at all, in either form.
  assert.ok(
    /triggerLabel=[{"]/.test(boardSource),
    "board-view must pass triggerLabel prop to ContextActions",
  );
  assert.ok(
    boardSource.includes("triggerClassName={"),
    "board-view must pass triggerClassName prop to ContextActions",
  );
  assert.ok(
    boardSource.includes("trigger={<Icon"),
    "board-view must pass Icon as the trigger prop to ContextActions",
  );
  assert.ok(
    boardSource.includes("target={"),
    "board-view must pass the card article as the target prop to ContextActions",
  );
});
