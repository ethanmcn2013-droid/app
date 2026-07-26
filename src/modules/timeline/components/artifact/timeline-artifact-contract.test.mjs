import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const artifact = readFileSync(new URL("./timeline-artifact.tsx", import.meta.url), "utf8");
const phonePreview = readFileSync(new URL("./timeline-phone-preview.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./timeline-artifact.module.css", import.meta.url), "utf8");
const studioStyles = readFileSync(
  new URL("../../app/audience/artifact-studio.module.css", import.meta.url),
  "utf8",
);
const ownerProject = readFileSync(
  new URL("../../app/plan/[projectSlug]/page.tsx", import.meta.url),
  "utf8",
);
const artifactStudio = readFileSync(
  new URL("../../app/audience/artifact-studio.tsx", import.meta.url),
  "utf8",
);

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
  assert.match(artifact, /completedRailVertical/);
  assert.match(styles, /\.completedRailVertical/);
  assert.match(styles, /overflow-x:\s*hidden/);
  assert.doesNotMatch(artifact, /scrollIntoView/);
  assert.match(artifact, /viewport\.scrollTo/);
});

test("motion has a reduced-motion path and the metric swaps as a single face", () => {
  assert.match(artifact, /useReducedMotion/);
  assert.match(artifact, /<AnimatePresence initial=\{false\} mode="wait"/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
});

test("motion preference is hydration-safe and never changes the initial metric subtree", () => {
  assert.match(artifact, /import \{ useHydrated \} from "@\/lib\/use-hydrated"/);
  assert.match(artifact, /function useArtifactReducedMotion\(\): boolean/);
  assert.match(artifact, /return hydrated && Boolean\(prefersReducedMotion\)/);
  assert.equal(
    (artifact.match(/useReducedMotion\(\)/g) ?? []).length,
    1,
    "only the hydration-safe wrapper may read the browser motion preference",
  );
  assert.doesNotMatch(
    artifact,
    /\{reduceMotion \? \(\s*<span className=\{styles\.metricMotion\}/,
  );
  assert.doesNotMatch(artifact, /\{!reduceMotion \? \(\s*<motion\.span/);
});

test("the owner studio owns vertical scrolling inside the app shell", () => {
  assert.match(studioStyles, /\.studio\s*\{[\s\S]*?height:\s*100%;/);
  assert.match(studioStyles, /\.studio\s*\{[\s\S]*?min-height:\s*0;/);
  assert.match(studioStyles, /\.studio\s*\{[\s\S]*?overflow-y:\s*auto;/);
});

test("owner surfaces embed the exact artifact without claiming a document-height viewport", () => {
  assert.match(ownerProject, /<TimelineArtifact timeline=\{timeline\} embedded \/>/);
  assert.match(artifactStudio, /<TimelineArtifact timeline=\{timeline\} embedded \/>/);
  assert.match(artifact, /data-embedded=\{embedded \? "true" : undefined\}/);
  assert.match(styles, /\.artifact\[data-embedded="true"\]\s*\{[\s\S]*?min-height:\s*auto;/);
});

test("low-information timelines receive density-only refinements after the generic mobile rules", () => {
  const genericMobileRule = styles.indexOf("@container timeline-artifact (max-width: 620px)");
  const densityRules = styles.indexOf('.artifact[data-density="empty"]');

  assert.match(artifact, /data-density=\{model\.density\}/);
  assert.ok(genericMobileRule >= 0);
  assert.ok(densityRules > genericMobileRule);
  assert.match(styles, /\.artifact\[data-density="single"\]/);
  assert.match(styles, /\.artifact\[data-density="sparse"\]/);
  assert.doesNotMatch(styles, /data-density="standard"/);
});

test("undated milestone copy states the truth without implying a future date", () => {
  assert.match(artifact, /Timing not set/);
  assert.doesNotMatch(artifact, /Date to come/);
});
