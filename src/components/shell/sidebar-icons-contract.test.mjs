// The approved sidebar icon set ("solid when selected", 12 Oct 2026) stays
// the sidebar's set: every row draws from it, the component and the source
// SVGs name the same icons, and selection never turns indigo.
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

test("projects use the one project marker, never letter tiles", () => {
  assert.match(sidebar, /<ProjectMarker color=\{projectColor\(row\.id\)\} \/>/);
  assert.doesNotMatch(sidebar, /row\.monogram\.slice\(0, 1\)/);
  assert.doesNotMatch(sidebar, /<ShellIcon\.(sidebar|search|help|hash) /);
});

test("selection is the solid fill and the row highlight, not indigo", () => {
  const block = css.slice(css.indexOf("Approved sidebar icons"));
  assert.ok(block.length > 0);
  assert.doesNotMatch(block, /--v3-accent/);
  assert.match(block, /\.item\[data-current-project\] \{ background:/);
});
