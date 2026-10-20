import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// These are structural safety contracts, not a claim of rendered geometry.
// Actual desktop/phone/zoom/spacing receiving remains a browser gate.
const styles=readFileSync(new URL("./timeline-artifact.module.css",import.meta.url),"utf8");
const source=readFileSync(new URL("./timeline-artifact.tsx",import.meta.url),"utf8");

test("Master3 stage is gated by readable container dimensions, zoom and reader spacing",()=>{
  assert.match(source,/width >= 1024/); assert.match(source,/scale >= \.85/);
  assert.match(source,/!spaced && !zoom/); assert.match(source,/ResizeObserver/);
  assert.match(source,/visualViewport/); assert.match(source,/letterSpacing/);
  assert.match(styles,/\.board\s*\{[^}]*max-width:\s*680px/);
  assert.match(styles,/data-layout="stage"[^}]*\.board\s*\{[^}]*width:\s*1440px[^}]*height:\s*810px/);
});

test("phone timeline precedes actions and follow content, with no layout chooser",()=>{
  const start=source.indexOf('<section className={styles.phoneTimeline}');
  const actions=source.indexOf('<div className={styles.phoneActions}',start);
  const follow=source.indexOf('<aside',start);
  assert.ok(start>=0 && actions>start && follow>start);
  assert.doesNotMatch(source,/setRequestedMode|data-timeline-metric-toggle/);
  assert.match(styles,/grid-template-columns:\s*50px 30px minmax\(0, 1fr\)/);
});

test("primary action placements are mutually exclusive across stage and stack",()=>{
  assert.match(styles,/\.dayPanel > h2, \.desktopTime, \.progress, \.panelAction\s*\{\s*display:\s*none/);
  assert.match(styles,/data-layout="stage"[^}]*\.panelAction\s*\{\s*display:\s*block/);
  assert.match(styles,/data-layout="stage"[^}]*\.phoneActions[^}]*\{\s*display:\s*none/);
  assert.match(styles,/data-layout="stage"[^}]*\.phoneEdit[^}]*\{\s*display:\s*none/);
});

test("long names wrap without clipping and number words retain their reading sentence",()=>{
  assert.match(source,/measureText\(title\)/); assert.match(source,/Math\.max\(40, size\)/);
  assert.match(styles,/\.title[^}]*text-wrap:\s*balance/);
  assert.doesNotMatch(styles,/text-overflow:\s*ellipsis|line-clamp/);
  assert.match(styles,/font-variant-numeric:\s*tabular-nums/);
  assert.match(source,/screenReaderOnly/);
});

test("dark mode, reduced motion, forced colours and touch targets survive the new design",()=>{
  assert.match(styles,/data-theme="dark"/); assert.doesNotMatch(styles,/color-scheme:\s*only light/);
  assert.match(styles,/prefers-reduced-motion:\s*reduce[^}]*animation:\s*none !important/);
  assert.match(styles,/forced-colors:\s*active/); assert.match(styles,/border[^;]*CanvasText/);
  assert.match(styles,/min-height:\s*44px/); assert.match(styles,/nextPulse 2\.4s ease-in-out 3/);
  assert.match(styles,/focus-visible[^}]*outline:\s*2px solid var\(--x-m3-accent\)/);
});

test("embedded and compact views keep their containing scroll owner",()=>{
  assert.match(styles,/data-compact="true"[^}]*data-embedded="true"[^}]*min-height:\s*auto/);
  const studio=readFileSync(new URL("../../app/audience/artifact-studio.module.css",import.meta.url),"utf8");
  assert.match(studio,/\.studio\s*\{[^}]*min-height:\s*0/);
  assert.match(studio,/\.studio\s*\{[^}]*overflow-y:\s*auto/);
});
