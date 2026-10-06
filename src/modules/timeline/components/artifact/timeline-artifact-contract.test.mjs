import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * The shared timeline's contract.
 *
 * On 28 September 2026 the founder picked the Countdown direction for the
 * shared page (concept B, with A's to-scale strip and D's finale; see
 * remote-redesign `work/2026-09-28-timeline-artifact`). It replaced the
 * Option D rail, and this file replaced the rail's contract with it.
 *
 * The rules that were about the product rather than the rail carry over
 * unchanged: no tracking, one vocabulary, the owner embeds, the completed ink
 * drawn to the last completed dot, container sizing, the entrance seen once,
 * reduced motion and the light-only public page. The rules that belonged to
 * the rail's mechanics (roving keys across marks, label nudges, clusters,
 * the metric toggle) went with it.
 */

const artifact = readFileSync(new URL("./timeline-artifact.tsx", import.meta.url), "utf8");
const phonePreview = readFileSync(new URL("./timeline-phone-preview.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./timeline-artifact.module.css", import.meta.url), "utf8");
const studioStyles = readFileSync(new URL("../../app/audience/artifact-studio.module.css", import.meta.url), "utf8");
const ownerProject = readFileSync(new URL("../../app/plan/[projectSlug]/page.tsx", import.meta.url), "utf8");
const artifactStudio = readFileSync(new URL("../../app/audience/artifact-studio.tsx", import.meta.url), "utf8");
const ownerPreview = readFileSync(new URL("../../app/audience/project-preview.tsx", import.meta.url), "utf8");
const vocabulary = readFileSync(new URL("../../lib/vocabulary.ts", import.meta.url), "utf8");

/** Comments are documentation, not rendered output. */
const artifactCode = artifact.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** The declaration block for a selector, at the top level of the stylesheet. */
function block(selector) {
  const pattern = new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`);
  const match = styles.replaceAll("\r\n", "\n").match(pattern);
  assert.ok(match, `${selector} must exist`);
  return match[1];
}

test("the artifact keeps its identity: wordmark, one progressbar, a Today marker, no studio chrome", () => {
  assert.match(artifact, /data-timeline-wordmark/);
  assert.match(artifact, />\s*timeline<span/);
  assert.equal((artifactCode.match(/role="progressbar"/g) ?? []).length, 1);
  assert.match(artifact, /data-today-marker/);
  assert.doesNotMatch(artifactCode, /StudioRail|StudioBar|dashboard/i);
});

test("the phone preview renders the exact artifact in compact mode and nothing on the page can track a view", () => {
  assert.match(phonePreview, /<TimelineArtifact timeline=\{timeline\} compact \/>/);
  assert.doesNotMatch(phonePreview, /\bfetch\s*\(|sendBeacon|\/api\//);
  assert.doesNotMatch(artifact, /\bfetch\s*\(|sendBeacon|\/api\//);
  assert.match(phonePreview, /Previewing it never adds a view/);
});

test("Add to my calendar is built in the browser from facts the page already shows", () => {
  assert.match(artifactCode, /text\/calendar/);
  assert.match(artifactCode, /DTSTART;VALUE=DATE/);
  assert.match(artifactCode, /URL\.createObjectURL/);
  // The day is the only thing it names: a label, a date and the page's own id.
  assert.doesNotMatch(artifactCode, /ownerDisplayLabel[^\n]*SUMMARY|DESCRIPTION:/);
});

test("the owner studio owns vertical scrolling inside the app shell", () => {
  assert.match(studioStyles, /\.studio\s*\{[\s\S]*?height:\s*100%;/);
  assert.match(studioStyles, /\.studio\s*\{[\s\S]*?min-height:\s*0;/);
  assert.match(studioStyles, /\.studio\s*\{[\s\S]*?overflow-y:\s*auto;/);
});

test("owner surfaces embed the exact artifact without claiming a document-height viewport", () => {
  assert.doesNotMatch(ownerProject, /<TimelineArtifact\b/);
  assert.match(ownerPreview, /<TimelineArtifact timeline=\{timeline\} \/>/);
  assert.match(artifactStudio, /<TimelineArtifact timeline=\{timeline\} embedded \/>/);
  assert.match(artifact, /data-embedded=\{embedded \? "true" : undefined\}/);
  assert.match(styles, /\.artifact\[data-embedded="true"\]\s*\{[\s\S]*?min-height:\s*auto;/);
});

test("the completed ink is drawn to the frontier dot, never the count percentage", () => {
  // The strip draws only the time still to come, so it maps dates itself; its
  // ink still stops at the furthest completed dot inside that range.
  assert.match(artifactCode, /doneInRange\.map\(\(point\) => toAt\(dayOf\(point\.item\.date as string\)\)\)/);
  assert.match(artifactCode, /scaleX\(\$\{geometry\.frontier \/ 100\}\)/);
  assert.match(artifactCode, /aria-valuenow=\{Math\.round\(geometry\.frontier\)\}/);
  assert.doesNotMatch(artifactCode, /model\.percent/);
  assert.match(artifactCode, /aria-valuetext=\{`\$\{model\.completedCount\} of \$\{model\.totalCount\} milestones complete`\}/);
});

test("the strip spends its width on what is still to come", () => {
  // Starting at the plan's first milestone gave most of the line to months
  // already behind the couple. It starts a little before today, and earlier
  // work folds into a stub that says what it holds.
  assert.match(artifactCode, /const lead = 12 \* DAY_MS;/);
  assert.match(artifactCode, /className=\{styles\.stripStub\}/);
  assert.match(artifactCode, /since \{formatTimelineDate/);
});

test("rows are read as they are seen, and the strip stays out of the keyboard's way", () => {
  // Row text used to be aria-hidden behind a label on the list item, which
  // several screen readers ignore, so a milestone could read as nothing.
  const rowBlock = artifactCode.slice(artifactCode.indexOf("const row = ("), artifactCode.indexOf("<section className={styles.moments}"));
  assert.doesNotMatch(rowBlock, /<li[^>]*aria-label/);
  assert.doesNotMatch(rowBlock, /className=\{styles\.rowText\} aria-hidden/);
  assert.doesNotMatch(rowBlock, /className=\{styles\.rowFigureCell\} aria-hidden|aria-hidden="true" className=\{styles\.rowFigureCell\}/);
  assert.match(rowBlock, /className=\{styles\.pin\} aria-hidden="true"/);
  // The dots repeat the rows for a pointer; the keyboard takes the rows.
  const strip = artifactCode.slice(artifactCode.indexOf("function Strip("), artifactCode.indexOf("function RowFigure("));
  assert.equal((strip.match(/tabIndex=\{-1\}/g) ?? []).length, 2);
});

test("the page says each thing once", () => {
  // The next moment lives in its row and on the strip; the hero no longer
  // repeats it. Add to my calendar lives in the hero; the finale offers the
  // wait in other words rather than the same number again.
  const hero = artifactCode.slice(artifactCode.indexOf("function Hero("), artifactCode.indexOf("const DAY_MS"));
  assert.doesNotMatch(hero, /isNext|nextUp/);
  const finale = artifactCode.slice(artifactCode.indexOf("function Finale("), artifactCode.indexOf("function PlanningDecisions("));
  assert.doesNotMatch(finale, /CalendarButton/);
  assert.match(artifactCode, /weeks\$\{rest \? ` and \$\{rest\} \$\{plural\(rest, "day", "days"\)\}` : ""\} to go\./);
  assert.match(artifactCode, /!timeline\.ownerDisplayLabel\.includes\(timeline\.label\)/);
});

test("every state says something true", () => {
  // Nothing done yet leads with what is ahead, not a zero; a plan with undated
  // work never claims an end date; the day alone is not "no milestones".
  assert.match(artifactCode, /model\.completedCount === 0/);
  assert.match(artifactCode, /model\.points\.every\(\(point\) => point\.item\.date\)/);
  assert.match(artifactCode, /Nothing else is planned before the day\./);
  assert.doesNotMatch(artifactCode, /"Sept"|month: "short"/);
});

test("rows hold a reading measure", () => {
  assert.match(block(".moments"), /max-width:\s*60rem;/);
});

test("the reader never chooses a layout: the width does", () => {
  // The suite asked a guest to pick Across or Down, and the metric was a
  // toggle. Both are gone; the page reads the room it has.
  assert.doesNotMatch(artifactCode, /\bAcross\b|\bDown\b|data-timeline-metric-toggle|setRequestedMode/);
  assert.match(styles, /@container timeline-artifact \(max-width: 760px\)\s*\{\s*\.strip\s*\{\s*display:\s*none;/);
  assert.match(styles, /@container timeline-artifact \(max-width: 620px\)/);
});

test("both arrangements are sized by container width, so the artifact is right inside the phone preview too", () => {
  assert.match(styles, /container-name:\s*timeline-artifact;/);
  assert.match(styles, /container-type:\s*inline-size;/);
  const layoutMediaQueries = styles.match(/@media\s*\([^)]*width[^)]*\)/g) ?? [];
  assert.deepEqual(layoutMediaQueries, []);
});

test("the plan renders as one list, and the day closes the page instead of being listed twice", () => {
  // One place renders a milestone row. The strip's dots are links into those
  // rows, not a second copy of the plan, and paper prints the same rows.
  assert.equal((artifactCode.match(/<li\b/g) ?? []).length, 1);
  assert.match(artifactCode, /model\.points\.filter\(\(point\) => point\.item\.publicId !== destinationId\)/);
  assert.match(artifactCode, /href=\{isDestination \? `#\$\{finaleId\}` : `#m-\$\{point\.item\.publicId\}`\}/);
  assert.doesNotMatch(block(".strip"), /display:\s*none/);
});

test("every number says what it counts", () => {
  // "16" on its own was the old line's fault. Every figure carries its word.
  assert.match(artifactCode, /plural\(days, "day", "days"\)/);
  assert.match(artifactCode, /plural\(-days, "day late", "days late"\)/);
  assert.match(artifactCode, /until the \$\{dayName\}/);
  assert.match(artifactCode, /plural\(weeks, "week", "weeks"\)\} later/);
});

test("undated milestone copy states the truth without implying a future date", () => {
  assert.match(vocabulary, /NO_TIMING_LABEL = "Timing not set"/);
  assert.match(artifact, /NO_TIMING_LABEL/);
  assert.doesNotMatch(artifact, /Date to come/);
});

test("one state machine speaks one vocabulary", () => {
  assert.match(artifact, /from "@\/modules\/timeline\/lib\/vocabulary"/);
  assert.match(artifact, /timelinePointStatus/);
  assert.match(vocabulary, /current: "Our next milestone"/);
  assert.doesNotMatch(artifactCode, /"A shared (?:wedding|class|project) timeline"/);
  assert.doesNotMatch(artifactCode, />Project timeline</);
  assert.doesNotMatch(vocabulary, /covered: "Covered"/);
});

test("the strip says what it spans, and the month names clear AA", () => {
  assert.match(artifactCode, /aria-label=\{timelineAxisDescription\(model\)\}/);
  assert.match(block(".stripMonth > span"), /color:\s*var\(--x-timeline-quiet\);/);
  assert.match(block(".gap"), /color:\s*var\(--x-timeline-quiet\);/);
});

test("controls are touch-safe", () => {
  assert.match(block(".pillButton"), /min-height:\s*2\.75rem;/);
  assert.match(block(".productMeta button"), /min-height:\s*2\.75rem;/);
  assert.match(block(".stripDot::after"), /inset:\s*-0\.8rem;/);
});

test("the countdown is the hero, and it supersedes the rule that the counter never outranks the name", () => {
  // Superseded 28 Sep 2026 by the founder's pick of the Countdown direction:
  // on a page a guest opens to learn how long is left, the number is the
  // point. The name still comes first in reading order and in the outline.
  const h1 = artifactCode.indexOf("<h1>");
  const count = artifactCode.indexOf("data-timeline-metric-value");
  assert.ok(h1 > 0 && count > h1, "the name is read before the number");
  assert.match(block(".countValue"), /font-family:\s*var\(--font-sans\);/);
  assert.doesNotMatch(styles, /--font-mono/);
  assert.match(block(".countValue"), /font-variant-numeric:\s*tabular-nums;/);
  assert.match(artifactCode, /role="group" aria-label=\{spoken\}/);
});

test("the entrance plays once per session and reduced motion removes it outright", () => {
  assert.match(artifact, /ENTRANCE_SESSION_KEY = "signal:timeline-entrance"/);
  assert.match(artifact, /useLayoutEffect\(\(\) => markEntranceSeen\(artifactRef\.current\), \[\]\)/);
  assert.match(styles, /\.artifact\[data-entrance="seen"\] \.row/);
  const reduced = styles.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/);
  assert.ok(reduced, "a reduced-motion block must exist");
  for (const selector of [".header", ".strip", ".stripInk", ".row", ".finale"]) {
    assert.ok(reduced[1].includes(selector), `reduced motion must stop ${selector}`);
  }
});

test("the published page is the same keepsake for every guest; only the owner's copy follows the app theme", () => {
  assert.match(block(".artifact"), /color-scheme:\s*only light;/);
  assert.match(styles, /:global\(\[data-theme="dark"\]\) \.artifact\s*\{\s*color-scheme:\s*dark;/);
});

test("one Share per page: the header's, or the finale's only where there is no header", () => {
  // The snapshot drew Share in the header and again at the finale, two
  // buttons with one name and two status lines (fixed 6 Oct 2026).
  assert.equal((artifactCode.match(/<ShareButton /g) ?? []).length, 2);
  assert.match(artifactCode, /<Finale timeline=\{timeline\} id=\{finaleId\} onShare=\{showProductHeader \? undefined : onShare\}/);
  assert.match(artifactCode, /\{showProductHeader \? <ProductIdentity timeline=\{timeline\} onShare=\{onShare\}/);
});
