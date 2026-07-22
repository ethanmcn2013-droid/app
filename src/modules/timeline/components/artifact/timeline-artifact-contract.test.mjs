import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const artifact = readFileSync(new URL("./timeline-artifact.tsx", import.meta.url), "utf8");
const phonePreview = readFileSync(new URL("./timeline-phone-preview.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./timeline-artifact.module.css", import.meta.url), "utf8");

test("the artifact keeps the locked Option D identity and line-first hierarchy", () => {
  assert.match(artifact, /data-timeline-wordmark/);
  assert.match(artifact, />\s*timeline<span/);
  assert.match(artifact, /role="progressbar"/);
  assert.match(artifact, /data-today-marker/);
  assert.match(artifact, /Our next milestone/);
  assert.match(styles, /\.baseRail/);
  assert.match(styles, /\.milestoneButton/);
  assert.doesNotMatch(artifact, /StudioRail|StudioBar|dashboard/i);
});

test("the phone preview renders the exact artifact in compact mode and cannot track views", () => {
  assert.match(phonePreview, /<TimelineArtifact timeline=\{timeline\} compact \/>/);
  assert.doesNotMatch(phonePreview, /\bfetch\s*\(|sendBeacon|\/api\//);
  assert.doesNotMatch(artifact, /\bfetch\s*\(|sendBeacon|\/api\//);
  assert.match(phonePreview, /Previewing it never adds a view/);
});

test("the milestone rail exposes roving keyboard navigation and touch-safe targets", () => {
  assert.match(artifact, /event\.key === "ArrowRight"/);
  assert.match(artifact, /event\.key === "ArrowLeft"/);
  assert.match(artifact, /event\.key === "Home"/);
  assert.match(artifact, /event\.key === "End"/);
  assert.match(artifact, /tabIndex=\{index === boundedFocusIndex \? 0 : -1\}/);
  assert.match(styles, /--x-timeline-hit:\s*3rem/);
  assert.match(styles, /overflow-x:\s*auto/);
});

test("motion has a reduced-motion path and the metric swaps as a single face", () => {
  assert.match(artifact, /useReducedMotion/);
  assert.match(artifact, /<AnimatePresence initial=\{false\} mode="wait"/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
});
