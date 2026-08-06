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

/**
 * Comments are documentation, not rendered output. The "no studio chrome"
 * rule below is about what the artifact RENDERS, and it was firing on the
 * JSDoc that explains why the owner view suppresses its own wordmark — which
 * is the rule being honoured, described. E06.10, 2026-08-03.
 */
const artifactCode = artifact
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

test("the artifact keeps the locked Option D identity and line-first hierarchy", () => {
  assert.match(artifact, /data-timeline-wordmark/);
  assert.match(artifact, />\s*timeline<span/);
  assert.match(artifact, /role="progressbar"/);
  assert.match(artifact, /data-today-marker/);
  assert.match(artifact, /Our next milestone/);
  assert.match(styles, /\.baseRail/);
  assert.match(styles, /\.milestoneButton/);
  assert.doesNotMatch(artifactCode, /StudioRail|StudioBar|dashboard/i);
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
  // The owner's plan view sits inside the suite chrome, so it embeds the
  // artifact with its own product header suppressed — one wordmark, never
  // two. The studio is an exhibit frame and keeps the header.
  assert.match(
    ownerProject,
    /<TimelineArtifact timeline=\{timeline\} embedded showProductHeader=\{false\} \/>/,
  );
  assert.match(artifactStudio, /<TimelineArtifact timeline=\{timeline\} embedded \/>/);
  assert.match(artifact, /data-embedded=\{embedded \? "true" : undefined\}/);
  assert.match(styles, /\.artifact\[data-embedded="true"\]\s*\{[\s\S]*?min-height:\s*auto;/);
});

test("the completed ink is drawn to the frontier dot, never the count percentage", () => {
  assert.match(artifact, /scaleX\(\$\{\(model\.completedFrontier \?\? 0\) \/ 100\}\)/);
  assert.match(artifact, /scaleY\(\$\{\(model\.completedStackFrontier \?\? 0\) \/ 100\}\)/);
  // The spoken progressbar keeps the honest count — `aria-valuetext` is the
  // sentence a screen reader announces, and it is still "N of N milestones
  // complete". The machine value now tracks the drawing rather than the count
  // percentage: a bar reading 40 while painting 0.34 of its own track is one
  // element making two different claims, which is the defect a visual sweep
  // found and unit tests could not.
  assert.match(artifact, /aria-valuenow=\{Math\.round\(model\.completedFrontier \?\? 0\)\}/);
  assert.doesNotMatch(artifact, /aria-valuenow=\{model\.percent\}/);
});

test("every metric face declares its width class so no value can clip", () => {
  // The face carries its own scale rather than the view guessing from the
  // string, because progress is a sentence and the countdown is a number and
  // they take different treatments at the same moment in the same box.
  assert.match(artifact, /data-metric-scale=\{active\.scale\}/);
  assert.match(artifact, /data-metric-scale=\{completion\.scale\}/);
  assert.match(artifact, /scale: metricValueScale\(value\)/);
  assert.match(styles, /data-metric-scale="word"/);
  assert.match(styles, /data-metric-scale="four"/);
  assert.match(styles, /data-metric-scale="count"/);
});

test("paper keeps the content from ONE list, not a second copy of it", () => {
  // The printed page used to carry a separate ruled index below the rail, so
  // every milestone was rendered into the document twice. Print now stands the
  // rail's own list up as the stacked layout instead: same <ol>, every label
  // visible, nothing rendered a second time.
  assert.doesNotMatch(artifact, /printIndex/);
  assert.doesNotMatch(styles, /\.printIndex/);
  assert.match(artifact, /styles\.printFacts/);
  assert.match(styles, /\.printFacts\s*\{\s*display:\s*none;/);

  const print = styles.slice(styles.indexOf("@media print"));
  assert.match(print, /\.milestone\s*\{[^}]*inset-block-start:\s*var\(--timeline-position-stack/);
  assert.match(print, /\.milestone\[data-labelled="false"\][\s\S]{0,120}\{\s*opacity:\s*1;/);
  assert.match(print, /\.completedRailVertical\s*\{\s*display:\s*block;/);
});

test("the rail's cartography rides the model's mapping and yields to information", () => {
  // Month ticks come from the model (the same distortion mapping as the
  // points), never from raw calendar math in the view; their labels yield
  // near the Today chip and the rail's edges. On the stacked axis the
  // ticks keep the rhythm but drop their text.
  assert.match(artifact, /model\.monthTicks/);
  assert.match(artifact, /styles\.monthTick\b/);
  assert.match(artifact, /data-quiet=/);
  assert.match(styles, /\.monthTick\[data-quiet="true"\] > span/);
  assert.match(styles, /\.monthTick\s*\{[\s\S]*?--timeline-position/);
  assert.doesNotMatch(artifact, /new Date\(\)/);
});

test("the hidden scrollbar owes an affordance and the attribution walks", () => {
  assert.match(artifact, /data-overflow-start/);
  assert.match(artifact, /data-overflow-end/);
  assert.match(styles, /\.railFrame\[data-overflow-end="true"\]::after/);
  // The growth loop's last step: attribution is a link built from the typed
  // product-URL contract, never an invented hostname.
  assert.match(artifact, /PRODUCT_MARKETING_URLS\.timeline/);
  assert.doesNotMatch(artifact, /https?:\/\/(?:www\.)?signalstudio/);
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

// ── E06.09 / E06.10 · the two Timelines are different objects ─────────
//
// Added 2026-08-03. The vertical mobile Timeline (E06.09) and the desktop
// editorial Timeline (E06.10) already shipped, in commit 20be8d7 / PR #48.
// What did not exist was anything in CI that says so, and a layout nobody
// asserts is a layout the next refactor quietly flattens back into one
// responsive rail. These pin the identity of each, not their pixels.

/** The block of rules that only apply below the 620px container width. */
function verticalBlock() {
  const start = styles.indexOf("@container timeline-artifact (max-width: 620px)");
  assert.ok(start > 0, "the vertical mobile tier must exist");
  const end = styles.indexOf("@container", start + 10);
  return styles.slice(start, end > 0 ? end : styles.length);
}

test("the rail flips its axis below 620px rather than being the same rail, rewrapped", () => {
  // Horizontal by default: a line across the page, positioned by inline offset.
  assert.match(styles, /\.progressGeometry\s*\{[^}]*inset-inline:\s*0;[^}]*height:\s*2px;/);
  assert.match(styles, /\.todayMarker\s*\{[^}]*width:\s*1px;\s*height:\s*2rem;/);

  // Vertical below the breakpoint: the rail becomes a column, the Today dash
  // rotates a quarter turn, and milestones stack by block offset.
  const vertical = verticalBlock();
  assert.match(vertical, /\.progressGeometry\s*\{[^}]*width:\s*2px;\s*height:\s*auto;/);
  assert.match(vertical, /\.todayMarker\s*\{[^}]*width:\s*2rem;\s*height:\s*1px;/);
  assert.match(vertical, /\.milestone\s*\{[^}]*inset-block-start:\s*var\(--timeline-position-stack,\s*var\(--timeline-position\)\);/);
  assert.match(vertical, /\.completedRail\s*\{\s*display:\s*none;\s*\}/);
  assert.match(vertical, /\.completedRailVertical\s*\{\s*display:\s*block;/);
});

test("collision avoidance is replaced by showing every label on the vertical Timeline", () => {
  // Wide rails hide crowded labels and reveal the ones that fit.
  assert.match(
    styles,
    /\.milestone\[data-labelled="false"\][\s\S]{0,120}\{\s*opacity:\s*0;\s*pointer-events:\s*none;/,
  );
  // The vertical rail has room for all of them, so none is hidden.
  assert.match(
    verticalBlock(),
    /\.milestone\[data-labelled="false"\][\s\S]{0,120}\{\s*opacity:\s*1;\s*pointer-events:\s*auto;/,
  );
});

test("the desktop editorial Timeline keeps its own widest tier", () => {
  assert.match(styles, /@container timeline-artifact \(max-width: 980px\)/);
  // The extra-label gate used to be a second breakpoint at 980px, and it was
  // the wrong instrument: the rail is a scroll canvas at least
  // `count x --x-timeline-pitch` wide, so a twenty-two-milestone plan renders
  // the same 1848px rail at 768 and at 1920 and the breakpoint could not see
  // that. The model measures the label's real share of the real rail now, so
  // the only gate left is the horizontal tier's own floor — below it the rail
  // stacks and shows every label anyway.
  assert.match(styles, /@container timeline-artifact \(min-width: 621px\)/);
  assert.match(
    styles,
    /@container timeline-artifact \(min-width: 621px\)\s*\{\s*\.milestone\[data-labelled="extra"\]/,
  );
  // Horizontal scroll with hidden scrollbars is the editorial rail's own
  // affordance and belongs only to the wide layout.
  assert.match(styles, /\.stageViewport\s*\{[^}]*overflow-x:\s*auto;/);
  assert.match(verticalBlock(), /overflow-x:\s*hidden;/);
});

test("both Timelines are sized by container width, so the artifact is correct inside the phone preview too", () => {
  assert.match(styles, /container-name:\s*timeline-artifact;/);
  assert.match(styles, /container-type:\s*inline-size;/);
  // No viewport media query may decide the layout: the artifact renders inside
  // an owner panel and a phone frame as well as a full page.
  const layoutMediaQueries = styles.match(/@media\s*\([^)]*width[^)]*\)/g) ?? [];
  assert.deepEqual(layoutMediaQueries, []);
});
