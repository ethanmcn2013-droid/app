import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * The owner plan's accessibility and honesty guarantees (v3, round 2).
 *
 * The retired editor (`curation-surface.tsx`) and its View/Milestones tabs
 * were replaced by one surface: `_components/v3/**`. Every guarantee the old
 * contract pinned is pinned again here against the file that now carries it.
 * Round 2 merged the visibility and freshness lines into
 * `plan-status-line.tsx`, and adds three intents: the view tabs lead with the
 * Project (never a plan), All projects is a grid with one labelled row per
 * Project, and the share sheet's destructive actions need a second press.
 */

const timelineRoot = path.join(process.cwd(), "src", "modules", "timeline");
const portfolioRoot = path.join(process.cwd(), "src", "components", "app", "portfolio");
const plan = "app/plan/[projectSlug]";

function read(relativePath) {
  return fs.readFileSync(path.join(timelineRoot, relativePath), "utf8");
}

const hook = () => read(`${plan}/_components/v3/use-milestone-edits.ts`);
const surface = () => read(`${plan}/_components/v3/plan-surface.tsx`);
const panel = () => read(`${plan}/_components/v3/milestone-panel.tsx`);
const list = () => read(`${plan}/_components/v3/milestone-list.tsx`);
const freshness = () => read(`${plan}/_components/v3/plan-status-line.tsx`);
const sheet = () => read(`${plan}/_components/v3/share-sheet.tsx`);
const portfolio = (file) => fs.readFileSync(path.join(portfolioRoot, file), "utf8");

test("owner milestone ordering has named controls and a polite position announcement", () => {
  const p = panel();
  assert.match(p, /aria-label=\{`Move \$\{node\.title\} up`\}/);
  assert.match(p, /aria-label=\{`Move \$\{node\.title\} down`\}/);
  assert.match(p, /Position \{position\.index \+ 1\} of \{position\.count\}/);

  const h = hook();
  assert.match(h, /buildOwnerKeyboardReorder/);
  assert.match(h, /Position \$\{result\.position\} of \$\{result\.siblingCount\}/);
  // A failed move says so and restores the previous order.
  assert.match(h, /The milestone could not be moved\. The previous order was restored\./);
  assert.match(h, /setNodes\(previousNodes\)/);
  // Every shown node's order is written, so a reload is deterministic (BV-2).
  assert.match(h, /reorderNodesAction\(\s*workspaceSlug,\s*projectSlug,\s*updated\.map\(\(node\) => node\.id\),?\s*\)/);

  const l = list();
  assert.match(l, /aria-live="polite"/);
  assert.match(l, /\{reorderAnnouncement\}/);
});

test("every write is optimistic, rolls back exactly, and leaves a retry", () => {
  const h = hook();
  assert.match(h, /upsertNodeOverlayAction/);
  assert.match(h, /createManualMilestoneAction/);
  // The revert restores exactly the fields the optimistic patch changed.
  assert.match(h, /const revert = Object\.fromEntries\(\s*Object\.keys\(optimistic\)/);
  assert.match(h, /patchNode\(node\.id, revert\)/);
  assert.match(h, /const retry = \(\) => void writeOverlay\(node, field, optimistic, overlay\)/);
  // C1a/C1c: server trees are not absorbed while a write is settling.
  assert.match(h, /if \(pendingWrites === 0\) setNodes\(initialNodes\)/);
  assert.match(h, /if \(pendingWriteCount\.current === 0 && refreshAfterWrites\.current\)/);

  const p = panel();
  assert.match(p, /Could not save\. \{status\.message\}/);
  assert.match(p, />\s*Try again\s*</);
  assert.match(p, /onClick=\{status\.retry\}/);
});

test("there is one refresh owner, and it runs once", () => {
  const h = hook();
  assert.match(h, /syncMilestonesAction\(workspaceSlug, projectSlug\)/);
  assert.match(h, /if \(!autoSync \|\| didAutoSync\.current\) return;/);
  assert.match(h, /didAutoSync\.current = true;/);
  // The truncation flag and total the action has always returned are read.
  assert.match(h, /result\.complete === false/);
  assert.match(h, /result\.totalCount/);
  // Nothing moved, or a newer refresh already landed: no page refresh.
  assert.match(h, /result\.changed !== false && result\.superseded !== true/);
  // The freshness line no longer runs its own refresh.
  assert.doesNotMatch(freshness(), /syncMilestonesAction/);
  // Archived Projects and review do not refresh at all.
  assert.match(read(`${plan}/page.tsx`), /autoSync=\{!archived && !isDemoMode\(\)\}/);
});

test("automatic Tasks sync failure remains visible and retryable", () => {
  const f = freshness();
  assert.match(f, /syncState\.kind === "failed" && syncState\.retryable \? \(/);
  // Visible in the warning tone and announced politely (spec §8: only a
  // failed publish is assertive).
  assert.match(f, /<span role="status" aria-live="polite" className=\{styles\.statusWarn\}>/);
  assert.match(f, /Could not refresh from Tasks\./);
  assert.match(f, />\s*Try again\s*</);
  assert.match(surface(), /onRefresh=\{\(\) => void edits\.runAutoSync\(\)\}/);
});

test("a sync refusal that Retry cannot fix offers no Retry, and is stated once", () => {
  const f = freshness();
  const h = hook();
  // The hook keeps the server's word on whether retrying could help.
  assert.match(h, /retryable: result\.retryable/);
  // The settled statement is polite and carries no control.
  const start = f.indexOf("id={SETTLED_REFUSAL_ID}");
  assert.ok(start !== -1, "the settled refusal statement is missing");
  const block = f.slice(start, f.indexOf("</span>", start));
  assert.match(block, /role="status"/, "a settled state is polite, not assertive");
  assert.ok(!/<button/.test(block), "a settled refusal must not offer a control that cannot change it");
  assert.ok(!/role="alert"/.test(block));
  // The Refresh control is disabled by it and says why.
  assert.match(f, /disabled=\{settledRefusal !== null\}/);
  assert.match(f, /aria-describedby=\{settledRefusal \? SETTLED_REFUSAL_ID : undefined\}/);
});

test("the plan says how old what it shows is", () => {
  const page = read(`${plan}/page.tsx`);
  const f = freshness();
  assert.match(page, /readSyncFreshness\(/);
  assert.match(surface(), /<PlanStatusLine/);
  assert.match(surface(), /serverNowMs=\{props\.nowMs\}/, "the loader's clock is passed so the first client render cannot mismatch");
  assert.match(f, /formatLastRefreshed/);
  assert.match(f, /truncationNotice/);
  assert.match(f, /role="status" aria-live="polite"/, "freshness is polite, never an alert");
});

test("one-time audience link copy has an announced manual recovery path", () => {
  const source = read("app/audience/share-controls.tsx");
  assert.match(source, /try \{/);
  assert.match(source, /catch \{/);
  assert.match(source, /Automatic copy was blocked/);
  assert.match(source, /Select link again/);
  assert.match(source, /role="status"/);
  assert.match(source, /requestAnimationFrame\(selectLink\)/);
  // The plan's share sheet uses those same controls, not copies of them.
  assert.match(sheet(), /<ShareReceipt state=\{minted\} \/>/);
});

test("Timeline loading boundaries announce progress without exposing skeletons", () => {
  for (const relativePath of [`${plan}/loading.tsx`, "app/loading.tsx"]) {
    const source = read(relativePath);
    assert.match(source, /role="status"/);
    assert.match(source, /aria-live="polite"/);
    assert.match(source, /aria-hidden/);
  }
  const sharedLoading = fs.readFileSync(new URL("../../app/s/[token]/loading.tsx", import.meta.url), "utf8");
  assert.match(sharedLoading, /role="status"/);
  assert.match(sharedLoading, /aria-live="polite"/);
  assert.match(sharedLoading, /motion-reduce:animate-none/);
});

test("owner controls meet the 44px touch target and error copy stays factual", () => {
  const css = read(`${plan}/_components/v3/plan.module.css`);
  const shareControls = read("app/audience/share-controls.tsx");
  const errorBoundary = read("app/error.tsx");
  // Every button class grows to 44px on touch; a CSS literal cannot drift
  // with Tailwind's remapped spacing scale (min-h-11 is 80px here).
  assert.match(css, /@media \(pointer: coarse\) \{\s*\.button,\s*\.buttonPrimary,\s*\.buttonQuiet,\s*\.small \{\s*height: 44px;/);
  assert.match(css, /\.textButton \{\s*min-height: 44px;/);
  for (const file of [`${plan}/_components/v3/plan-surface.tsx`, `${plan}/_components/v3/milestone-panel.tsx`, `${plan}/page.tsx`]) {
    assert.doesNotMatch(read(file), /min-h-11\b/, `${file}: min-h-11 is 80px on this scale`);
  }
  assert.match(shareControls, /const primaryButton =\s*\n\s*`\$\{styles\.focusable\}[^`]*\bmin-h-\[44px\]/);
  assert.match(shareControls, /import styles from "\.\/share-controls\.module\.css"/);
  assert.doesNotMatch(errorBoundary, /Nothing was lost|your .* (?:is|are) saved/i);
  assert.match(errorBoundary, /Timeline didn’t load/);
  assert.match(errorBoundary, /This plan didn’t load/);
});

test("manual milestone add restores focus to its initiating control", () => {
  const s = surface();
  assert.match(s, /manualAddTriggerRef/);
  assert.match(s, /requestAnimationFrame\(\(\) => \{\s*manualAddTriggerRef\.current\?\.focus\(\);/);
  // The initiating control is the list's add button, or the phone bar's.
  assert.match(s, /addButtonRef=\{phone \? listAddRef : manualAddTriggerRef\}/);
  assert.match(s, /ref=\{phone \? manualAddTriggerRef : undefined\}/);
  const add = read(`${plan}/_components/v3/add-milestone-row.tsx`);
  assert.match(add, /onClose\("complete"\)/);
  // C1d: a failed add keeps the draft and says why.
  assert.match(add, /if \("error" in result\) \{\s*setError\(result\.error\);\s*return;/);
});

test("the plan has no view modes, and shows the guest's page only as a read-only preview", () => {
  const page = read(`${plan}/page.tsx`);
  assert.ok(!fs.existsSync(path.join(timelineRoot, `${plan}/_components/local-view-tabs.tsx`)), "the tabs are retired");
  assert.ok(!fs.existsSync(path.join(timelineRoot, `${plan}/_components/curation-surface.tsx`)), "the old editor is retired");
  assert.doesNotMatch(page, /LocalViewTabs|Private owner edit/);
  assert.doesNotMatch(surface(), /role="tablist"|LocalViewTabs/);
  assert.match(page, /<PlanSurface/);
  // The guest's page is the latest publication, the frozen copy guests read,
  // never the live plan; drawn compact and inert, so nothing in it can be
  // pressed, focused or counted as a view.
  assert.match(page, /guestPreview=\{latestPublication \? <GuestPreview publication=\{latestPublication\} now=\{now\} \/> : null\}/);
  assert.match(
    read(`${plan}/_components/v3/guest-preview.tsx`),
    /<TimelineArtifact timeline=\{ownerPublicationToTimelineDto\(publication, now\)\} compact \/>/,
  );
  assert.doesNotMatch(page, /QualifiedViewTracker/);
  const column = read(`${plan}/_components/v3/context-column.tsx`);
  assert.match(column, /className=\{styles\.phoneFrame\} aria-hidden="true" inert/);
});

test("the milestone panel is a labelled region whose controls are labelled", () => {
  const s = surface();
  assert.match(s, /role="region" aria-labelledby=\{panelHeadingId\}/);
  assert.match(s, /panelFor\(selected, panelHeadingId, false\)/);
  const p = panel();
  assert.match(p, /<h2 id=\{headingId\}/);
  for (const label of ["Name", "Date", "Show on the shared page", "Where guests see it", "Source", "Order"]) {
    assert.match(p, new RegExp(`>\\s*${label}\\s*<|${label}\\s*\\n\\s*<Status|>\\s*${label}\\s*$`, "m"), `the ${label} field is labelled`);
  }
  assert.match(p, /htmlFor=\{`\$\{id\}-name`\}/);
  // "Where guests see it" is a menu button named by its label and its value.
  assert.match(p, /aria-labelledby=\{`\$\{id\}-state \$\{id\}-state-value`\}/);
  assert.match(p, /role="radiogroup" aria-label=\{`Date for \$\{node\.title\}`\}/);
  assert.match(p, /role="switch"\s*\n\s*aria-checked=\{!node\.hidden\}\s*\n\s*aria-labelledby=\{`\$\{id\}-shared`\}/);
  assert.match(p, /aria-label="Close milestone details"/);
  // On a phone or tablet the same panel is a modal sheet with focus return.
  assert.match(s, /<Sheet\s+open=\{selected !== null\}\s+onClose=\{closePanel\}\s+title=\{selected\?\.title \?\? "Milestone"\}/);
  assert.match(s, /panelFor\(selected, `\$\{panelHeadingId\}-sheet`, true\)/, "inside the sheet the panel does not repeat the sheet's own heading and close");
});

test("opening a publication keeps the Timeline context that owns it", () => {
  const manager = read("app/audience/audience-manager.tsx");
  const page = read("app/audience/page.tsx");
  const detail = read("app/audience/[publicationId]/page.tsx");
  assert.match(
    manager,
    /href=\{`\/app\/timeline\/audience\/\$\{encodeURIComponent\(publication\.id\)\}\$\{contextQuery\}`\}/,
  );
  assert.match(page, /contextQuery=\{contextQuery\}/);
  assert.match(detail, /requested\.workspaceId/);
});

test("armed confirm buttons keep one width so the row never reflows under the pointer", () => {
  const source = read("app/audience/share-controls.tsx");
  assert.match(source, /<span className="grid">/);
  assert.equal((source.match(/col-start-1 row-start-1/g) ?? []).length, 2);
  assert.doesNotMatch(source, /\{armed \? armedLabel : label\}/);
  assert.match(source, /visibility: armed \? "hidden" : "visible"/);
  assert.match(source, /visibility: armed \? "visible" : "hidden"/);
  assert.doesNotMatch(source, /display: armed/);
});

test("the publication page returns to the manager filtered to its Project", () => {
  const detail = read("app/audience/[publicationId]/page.tsx");
  assert.match(detail, /managerQuery\.set\("workspaceId", context\.workspaceId\)/);
  assert.match(detail, /if \(publication\.projectSlug\) managerQuery\.set\("project", publication\.projectSlug\)/);
  assert.match(detail, /managerHref=\{`\/app\/timeline\/audience\$\{managerSearch \? `\?\$\{managerSearch\}` : ""\}`\}/);
});

test("owner Timeline copy never says workspace and uses no uppercase tracked labels", () => {
  for (const file of [
    "app/audience/page.tsx",
    "app/audience/audience-manager.tsx",
    "app/audience/artifact-studio.tsx",
    `${plan}/_components/v3/plan-surface.tsx`,
    `${plan}/_components/v3/plan-header.tsx`,
    `${plan}/_components/v3/plan-status-line.tsx`,
    `${plan}/_components/v3/context-column.tsx`,
    `${plan}/_components/v3/share-sheet.tsx`,
    `${plan}/_components/v3/milestone-panel.tsx`,
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /\buppercase\b/, `${file}: no uppercase labels`);
    assert.doesNotMatch(source, /not the workspace|workspace access|canonical workspace/i, `${file}: the noun is Project`);
  }
  assert.doesNotMatch(read("app/audience/artifact-studio.module.css"), /text-transform: uppercase/);
});

test("the view tabs lead with the Project, never with a plan inside it", () => {
  const tabs = portfolio("timeline-tabs.tsx");
  assert.match(tabs, /role="tablist" aria-label="Timeline views"/);
  assert.equal((tabs.match(/role="tab"/g) ?? []).length, 2, "two link tabs");
  assert.match(tabs, /aria-current=\{current === "all" \? "page" : undefined\}/);
  // The second tab names the Project, or "One project" when none is known.
  assert.match(tabs, /\{project\?\.name \?\? "One project"\}/);
  // The switcher is its own button, named for what it does.
  assert.match(tabs, /aria-haspopup="menu"\s+aria-expanded=\{menu !== null\}\s+aria-label="Switch project"/);

  // On a plan the tab is the suite Project; the plan's name is the H1 under it.
  const page = read(`${plan}/page.tsx`);
  assert.match(page, /<TimelineTabs[\s\S]*?project=\{\{[\s\S]*?name: workspace\.name,/);
  assert.match(page, /title: `Timelines in \$\{workspace\.name\}`/);
  assert.match(page, /planName=\{project\.name\}/);
  assert.match(read(`${plan}/_components/v3/plan-header.tsx`), /<h1 className=\{styles\.title\}>\{planName\}<\/h1>/);

  // On All projects the tab names the Project of the last plan, not the plan.
  const index = read("app/page.tsx");
  assert.match(index, /project: \{\s*id: [^}]*name: workspace\.name,/);
});

test("All projects is a grid with one labelled row per Project", () => {
  const gantt = portfolio("portfolio-gantt.tsx");
  const row = portfolio("portfolio-row.tsx");
  assert.match(gantt, /role="grid"\s+aria-label="All projects on one time scale"/);
  assert.match(gantt, /onKeyDown=\{onGridKeyDown\}/);
  // One row per Project, named by its whole sentence, with a roving tab stop.
  assert.match(row, /role="row"\s+tabIndex=\{active \? 0 : -1\}\s+aria-label=\{label\}/);
  assert.match(row, /rowAccessibleLabel\(row, todayIso\)/);
  assert.match(row, /role="rowheader"/);
  assert.match(row, /role="gridcell"[\s\S]*?aria-hidden="true"/);
  // Group headers fold with aria-expanded; folded rows leave the tab order.
  assert.match(gantt, /aria-expanded=\{!isCollapsed\}/);
  assert.match(gantt, /inert=\{isCollapsed\}/);
  // Milestone stepping is announced politely.
  assert.match(gantt, /<p className="sr-only" role="status" aria-live="polite">\s*\{announcement\}/);
  // The card is a tooltip the row points at, and a dialog once pinned.
  assert.match(portfolio("portfolio-hover-card.tsx"), /role=\{pinned \? "dialog" : "tooltip"\}/);
  assert.match(gantt, /describedBy=\{card && !card\.pinned && card\.rowId === row\.id \? cardId : undefined\}/);
});

test("the share sheet's destructive actions each need a second press", () => {
  const s = sheet();
  // Turning links off and taking the page down sit apart, under Stop sharing.
  assert.match(s, /<h3 id="share-stop-title" className=\{styles\.stopTitle\}>\s*Stop sharing\s*<\/h3>/);
  const revoke = s.indexOf("<form action={revokeAction}>");
  const unpublish = s.indexOf("<form action={unpublishAction}>");
  assert.ok(revoke > s.indexOf("share-stop-title") && unpublish > revoke);
  assert.equal((s.match(/<DangerAction/g) ?? []).length, 3, "revoke, unpublish and a live re-link use the two-step button");
  // The first press arms (and does not submit); the second submits.
  assert.match(s, /if \(armed\) \{\s*disarm\(\);\s*return;\s*\}\s*event\.preventDefault\(\);\s*setArmed\(true\);/);
  assert.match(s, /const ARM_MS = 6000;/);
  // Esc disarms without closing the sheet.
  assert.match(s, /if \(event\.key === "Escape" && armed\) \{\s*event\.preventDefault\(\);\s*event\.stopPropagation\(\);\s*disarm\(\);/);
  // Both labels share one grid cell, so the button never reflows under the pointer.
  assert.match(s, /visibility: armed \? "hidden" : "visible"/);
  assert.match(s, /visibility: armed \? "visible" : "hidden"/);
  // A link is shown once, so a live page offers a new link, but replacing it
  // breaks the one guests hold: on a live page it is a second-press action,
  // never the one-press filled button.
  assert.match(s, /const NEW_LINK = "Make a new link";/);
  const live = s.indexOf('kind === "live" ? (');
  assert.ok(live > 0, "a live page has its own re-link form");
  const liveForm = s.slice(live, s.indexOf("</form>", live));
  assert.match(liveForm, /<form action=\{rotateAction\}/);
  assert.match(liveForm, /<DangerAction\s+tone="neutral"\s+label=\{NEW_LINK\}\s+armedLabel="Replace the link now"/);
  assert.doesNotMatch(liveForm, /buttonPrimary/);
  assert.match(s, /Lost the link\? We don’t keep it, so make a new one\./);
});
