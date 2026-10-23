// The approved sidebar icon set ("solid when selected", 12 Oct 2026) stays
// the sidebar's set: every row draws from it, the component and the source
// SVGs name the same icons, icon selection stays monochrome, and the separate
// Project identity ring gains an outer selected state without changing status.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const sidebar = read("./app-sidebar.tsx");
const component = read("./sidebar-icon.tsx");
const shell = read("./app-shell.tsx");
const css = read("./shell.module.css");
const svgNames = (state) =>
  readdirSync(new URL(`../../../docs/design/sidebar-icons/svg/${state}/`, import.meta.url))
    .filter((file) => file.endsWith(".svg"))
    .map((file) => file.slice(0, -4))
    .sort();

test("the component and the approved SVGs name the same fifteen icons", () => {
  const union = component.match(/export type SidebarIconName =([\s\S]*?);/)[1];
  const names = [...union.matchAll(/"([a-z]+)"/g)].map((m) => m[1]).sort();
  assert.equal(names.length, 15);
  assert.deepEqual(svgNames("default"), names);
  assert.deepEqual(svgNames("selected"), names);
});

test("every sidebar row draws from the approved set", () => {
  for (const [destination, icon] of [
    ["home", "home"], ["projects", "projects"], ["tasks", "tasks"], ["timeline", "timeline"], ["files", "files"],
    ["analytics", "analytics"], ["automations", "automations"], ["whiteboard", "whiteboard"], ["messages", "chat"], ["settings", "settings"],
  ]) {
    assert.match(sidebar, new RegExp(`\\b${destination}: "${icon}"`), `${destination} uses ${icon}`);
  }
  assert.match(sidebar, /<SidebarIcon name=\{sidebarIcon\} selected=\{current\} \/>/, "rows fill in on the page you are on");
  assert.match(sidebar, /<SidebarIcon name="collapse" \/>/);
  assert.match(sidebar, /<SidebarIcon name="search" \/>/);
  assert.match(sidebar, /<SidebarIcon name="help" \/>/);
  assert.match(sidebar, /<SidebarIcon name="channel" selected=\{current\} \/>/);
  assert.match(sidebar, /<ThemeCycleButton className=\{styles\.iconButton\} sidebar \/>/);
  assert.match(shell, /sidebar \? <SidebarIcon name="theme" \/>/);
});

test("project identity keeps its indigo ring, project colour and status without letter tiles", () => {
  assert.match(sidebar, /<span className=\{styles\.projectProgress\} aria-hidden="true">/);
  // A saved Project colour takes precedence; unspecialised Projects retain
  // their stable generated identity, separately from the status indicator.
  assert.match(sidebar, /<span className=\{styles\.projectProgressCore\} style=\{\{ backgroundColor: colors\[row\.id\] \? projectColorToken\(colors\[row\.id\]\) : projectColor\(row\.id\) \}\} \/>/);
  assert.match(sidebar, /setColors\(result\.colors \?\? \{\}\)/, "saved colours come from the authorized sidebar read");
  assert.doesNotMatch(sidebar, /row\.monogram\.slice\(0, 1\)/);
  assert.match(sidebar, /data-mark=\{mark\}/);
  assert.match(sidebar, /SIDEBAR_MARK_LABEL\[mark\]/);
  assert.doesNotMatch(sidebar, /<ShellIcon\.(sidebar|search|help|hash) /);

  const details = css.slice(css.indexOf("Approved sidebar detail"));
  const identity = details.match(/\.projectProgress \{([^}]+)\}/);
  assert.ok(identity, "the Project identity has one base ring rule");
  assert.match(identity[1], /border:\s*1\.25px solid transparent/);
  const selected = details.match(/\.item\[data-current-project\] \.projectProgress \{([^}]+)\}/);
  assert.ok(selected, "the open Project receives its selected-only indigo ring");
  assert.match(selected[1], /border-color:\s*var\(--v3-accent\)/);
  assert.match(css, /\.statusDot\[data-tone="late"\]/);
  assert.match(css, /\.statusDot\[data-tone="risk"\]/);
  assert.match(css, /\.item\[data-current-project\] \{ background:/, "project selection retains its row highlight");
});

test("selected navigation icons keep their solid foreground treatment, separate from the Project ring", () => {
  const start = css.indexOf("Approved sidebar icons");
  const end = css.indexOf("A project: a square tinted", start);
  const block = css.slice(start, end);
  assert.ok(block.length > 0);
  assert.doesNotMatch(block, /--v3-accent/);
  assert.match(block, /\.item svg\[data-selected\] \{ color: var\(--v3-text\); \}/);
});
