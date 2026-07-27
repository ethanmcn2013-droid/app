import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(relativePath) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

const hybridWorkspace = read("src/components/hybrid/hybrid-workspace.tsx");
const appLayout = read("src/app/app/layout.tsx");
const mobileSuiteNav = read("src/components/app/mobile-suite-nav.tsx");
const commandPaletteFile = read("src/components/app/palette/command-palette.tsx");
// The palette composes its search field from the shared scope-search
// primitive, so the combobox lifecycle spans both files. Read them as one
// surface; the contract is about what the palette renders, not which file
// the JSX happens to live in.
const scopeSearch = read("src/components/ui/scope-search.tsx");
const commandPalette = `${commandPaletteFile}\n${scopeSearch}`;
const productWorkspaceShell = read(
  "src/components/app/product-workspace-shell.tsx",
);
const roomTools = read("src/components/app/room/room-tools-context.tsx");
const suiteCommandRoot = read("src/components/app/suite-command-root.tsx");
const suiteLoading = read("src/components/app/suite-loading.tsx");
const tasksRuntimeShell = read("src/components/app/tasks-runtime-shell.tsx");
const tasksLayout = read("src/app/app/tasks/layout.tsx");
const tasksSidebar = read("src/components/app/sidebar.tsx");
const taskMetadataRail = read(
  "src/components/app/task-detail/metadata-rail.tsx",
);
const tasksCalendar = read(
  "src/components/hybrid/options/b/calendar-view.tsx",
);
const taskInspector = read(
  "src/components/hybrid/shared/task-inspector.tsx",
);
const taskSharedStyles = read(
  "src/components/hybrid/shared/shared.module.css",
);
const taskScheduleStyles = read(
  "src/components/hybrid/options/a/option-a.module.css",
);
const taskCalendarStyles = read(
  "src/components/hybrid/options/b/option-b.module.css",
);
const studioBar = read("src/components/studio-bar/studio-bar.tsx");
const studioChrome = read("src/components/studio-bar/studio-chrome-context.tsx");
const studioRail = read("src/components/studio-bar/studio-rail.tsx");
const contextHook = read("src/components/app/use-suite-context.ts");
const userButton = read("src/components/app/user-button-with-suite.tsx");
const notesPage = read("src/modules/notes/app/page.tsx");
const notesActions = read("src/modules/notes/server/actions/notes.ts");
const notesHybrid = read(
  "src/modules/notes/app/hybrid/HybridNotebook.tsx",
);
const roomBrief = read("src/server/actions/room.ts");
const tasksDemo = read("src/server/demo/tasks-demo.ts");
const notesDemo = read("src/modules/notes/server/demo/notes-demo.ts");
const reviewFixture = read("src/lib/review-suite-fixture.ts");
const crossSuiteJourney = JSON.parse(
  read("experience/cross-suite-journey.json"),
);

test("Tasks view changes can emit only canonical Tasks destinations", () => {
  for (const source of [hybridWorkspace, roomTools]) {
    assert.match(source, /TASKS_VIEW_PATHS/);
    assert.doesNotMatch(source, /router\.(?:push|replace)\(\s*`\/app\/\$\{/);
    for (const retiredPath of [
      "/app/board",
      "/app/list",
      "/app/calendar",
      "/app/plan",
      "/app/brief",
    ]) {
      assert.equal(
        source.includes(`"${retiredPath}"`) ||
          source.includes(`'${retiredPath}'`) ||
          source.includes(`\`${retiredPath}\``),
        false,
        `${retiredPath} must remain an input-only compatibility route`,
      );
    }
  }
});

test("Tasks calls its local time view Schedule, reserving Timeline for the product", () => {
  assert.match(
    tasksSidebar,
    /\{ href: TASKS_VIEW_PATHS\.timeline, label: "Schedule"/,
  );
  assert.doesNotMatch(
    tasksSidebar,
    /\{ href: TASKS_VIEW_PATHS\.timeline, label: "Timeline"/,
  );
});

test("Tasks owns the same product-specific document title as its siblings", () => {
  assert.match(
    tasksLayout,
    /export const metadata = \{ title: "Tasks · Signal Studio" \};/,
  );
});

test("the product rail derives ownership and carries allowlisted context hints", () => {
  assert.match(studioRail, /productIdFromAppPath\(pathname\)/);
  assert.match(studioRail, /useSuiteContext\(\)/);
  assert.match(
    studioRail,
    /withSuiteContext\(\s*PRODUCT_APP_PATHS\[product\.key\],\s*suiteContext,\s*\)/,
  );
  assert.match(
    studioRail,
    /<UserButtonWithSuite current=\{activeProduct\} placement="rail" \/>/,
  );
  assert.doesNotMatch(studioRail, /current="tasks"/);

  for (const forbidden of [
    "noteId",
    "taskId",
    "shareToken",
    "publicLink",
    "attachmentId",
  ]) {
    assert.equal(contextHook.includes(forbidden), false);
  }
});

test("suite context subscribes before its first storage read", () => {
  const subscribe = contextHook.indexOf(
    "window.addEventListener(SUITE_CONTEXT_EVENT, onContext)",
  );
  const firstRead = contextHook.indexOf("readStored();");
  assert.ok(subscribe >= 0);
  assert.ok(firstRead > subscribe);
});

test("the Studio Bar keeps module identity when Tasks chrome data is absent", () => {
  assert.match(studioBar, /productIdFromAppPath\(pathname\)/);
  assert.match(
    studioBar,
    /<IdentityCell edition=\{data\?\.edition \?\? null\} \/>/,
  );
  assert.match(
    studioBar,
    /<UserButtonWithSuite current=\{activeProduct\} \/>/,
  );
  assert.doesNotMatch(studioBar, /data\s*\?\s*\(\s*<IdentityCell/);
  assert.doesNotMatch(studioBar, /animate-pulse/);
});

test("every non-Tasks command event has one shared suite owner", () => {
  assert.match(appLayout, /<SuiteCommandRoot \/>/);
  assert.match(suiteCommandRoot, /productIdFromAppPath\(pathname\)/);
  assert.match(
    suiteCommandRoot,
    /const ownsCommand = activeProduct !== "tasks"/,
  );
  assert.match(
    suiteCommandRoot,
    /window\.addEventListener\(STUDIO_PALETTE_EVENT, onPalette\)/,
  );
  assert.match(
    suiteCommandRoot,
    /window\.removeEventListener\(STUDIO_PALETTE_EVENT, onPalette\)/,
  );
  assert.ok(
    suiteCommandRoot.indexOf("if (!ownsCommand) return;") <
      suiteCommandRoot.indexOf(
        "window.addEventListener(STUDIO_PALETTE_EVENT, onPalette)",
      ),
    "ownership guard must run before the suite command listener is registered",
  );
  assert.match(suiteCommandRoot, /if \(event\.defaultPrevented\) return;/);
});

test("Tasks retains exactly one task-palette event owner", () => {
  assert.match(tasksRuntimeShell, /<PaletteRoot>/);
  assert.equal(
    (tasksRuntimeShell.match(/<StudioChromeBridge \/>/g) ?? []).length,
    1,
  );
  assert.equal(
    (
      studioChrome.match(
        /window\.addEventListener\(STUDIO_PALETTE_EVENT, onPalette\)/g,
      ) ?? []
    ).length,
    1,
  );
  assert.match(suiteCommandRoot, /if \(!ownsCommand\) return;/);
  assert.match(suiteCommandRoot, /if \(!ownsCommand \|\| !open\) return null;/);
});

test("Tasks chrome metadata is cleared before another product can inherit it", () => {
  const publisher = studioChrome.slice(
    studioChrome.indexOf("export function StudioChromePublisher"),
    studioChrome.indexOf("/**\n * Mounted inside PaletteRoot"),
  );
  assert.match(publisher, /return \(\) => \{/);
  assert.match(publisher, /setData\(null\)/);
});

test("Tasks chrome publishes the authorised workspace name, not a domain example", () => {
  assert.match(tasksRuntimeShell, /name:\s*workspaces\.name/);
  assert.match(
    tasksRuntimeShell,
    /workspaceTitle=\{workspace\?\.name \?\? workspaceSlug\}/,
  );
  assert.doesNotMatch(studioChrome, /useDomain/);
});

test("mobile sibling modules expose four canonical contextual destinations", () => {
  assert.match(appLayout, /<MobileSuiteNav \/>/);
  assert.match(mobileSuiteNav, /if \(activeProduct === "tasks"\) return null;/);
  assert.deepEqual(
    [...mobileSuiteNav.matchAll(/\{ id: "(notes|tasks|timeline|signal)", label:/g)]
      .map((match) => match[1]),
    ["notes", "tasks", "timeline", "signal"],
  );
  assert.match(
    mobileSuiteNav,
    /withSuiteContext\(\s*PRODUCT_APP_PATHS\[product\.id\],\s*suiteContext,\s*\)/,
  );
  assert.doesNotMatch(
    mobileSuiteNav,
    /\/app\/(?:board|list|calendar|plan|brief)(?:\b|\/)/,
  );
});

test("mobile Tasks has one persistent product spine and one keyboard-complete views menu", () => {
  assert.equal((tasksSidebar.match(/<nav/g) ?? []).length, 1);
  assert.deepEqual(
    [
      ...tasksSidebar.matchAll(
        /\{ id: "(notes|tasks|timeline|signal)", label: "(?:Notes|Tasks|Timeline|Signal)" \}/g,
      ),
    ].map((match) => match[1]),
    ["notes", "tasks", "timeline", "signal"],
  );
  assert.match(
    tasksSidebar,
    /withSuiteContext\(\s*PRODUCT_APP_PATHS\[product\.id\],\s*suiteContext,\s*\)/,
  );
  assert.match(tasksSidebar, /aria-haspopup="menu"/);
  assert.match(tasksSidebar, /role="menu"/);
  assert.match(tasksSidebar, /role="menuitem"/);
  for (const key of ["ArrowDown", "ArrowUp", "Home", "End"]) {
    assert.match(tasksSidebar, new RegExp(`event\\.key === "${key}"`));
  }
  assert.match(tasksSidebar, /event\.key !== "Escape"/);
  assert.match(tasksSidebar, /triggerRef\.current\?\.focus/);
  assert.match(tasksSidebar, /grid-cols-5/);
  assert.match(tasksSidebar, /min-h-14/);
});

test("the mobile Tasks account escape hatch preserves suite context", () => {
  assert.match(userButton, /useSuiteContext\(\)/);
  assert.match(userButton, /PRODUCT_APP_PATHS/);
  assert.match(
    userButton,
    /withSuiteContext\(product\.path, suiteContext\)/,
  );
  assert.match(userButton, /withSuiteContext\(p\.path, suiteContext\)/);
  assert.doesNotMatch(userButton, /PRODUCT_APP_URLS/);
});

test("milestone task detail opens Timeline inside the contextual unified app", () => {
  assert.match(taskMetadataRail, /useSuiteContext\(\)/);
  assert.match(taskMetadataRail, /PRODUCT_APP_PATHS\.timeline/);
  assert.match(
    taskMetadataRail,
    /withSuiteContext\(\s*PRODUCT_APP_PATHS\.timeline,\s*suiteContext,\s*\)/,
  );
  assert.match(taskMetadataRail, /<Link[\s\S]*href=\{timelineHref\}/);
  assert.doesNotMatch(taskMetadataRail, /PRODUCT_APP_URLS/);
});

test("the Tasks command palette jumps within the unified contextual app", () => {
  assert.match(commandPalette, /PRODUCT_APP_PATHS/);
  assert.match(commandPalette, /useSuiteContext\(\)/);
  assert.match(
    commandPalette,
    /withSuiteContext\(j\.path, suiteContext\)/,
  );
  assert.doesNotMatch(commandPalette, /PRODUCT_APP_URLS/);
  assert.doesNotMatch(commandPalette, /target="_blank"/);
  assert.match(commandPalette, /if \(e\.defaultPrevented\) return;/);
});

test("both command layers expose a valid modal combobox lifecycle", () => {
  for (const source of [commandPalette, suiteCommandRoot]) {
    assert.match(source, /role="dialog"/);
    assert.match(source, /aria-modal="true"/);
    assert.match(source, /role="combobox"/);
    assert.match(source, /aria-controls=/);
    assert.match(source, /aria-activedescendant=/);
    assert.match(source, /role="listbox"/);
    assert.match(source, /role="option"/);
    assert.match(source, /\.inert = true/);
    assert.match(source, /returnFocusRef/);
    assert.match(source, /event\.key (?:===|!==) "Tab"/);
    assert.match(source, /event\.key (?:===|!==) "Escape"/);
  }
  assert.match(commandPalette, /createPortal\(palette, document\.body\)/);
  assert.match(commandPalette, /onMouseDown=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.match(suiteCommandRoot, /if \(event\.defaultPrevented\) return;/);
});

test("Calendar overflow and the task inspector keep accessible focus and names", () => {
  assert.match(tasksCalendar, /aria-haspopup="dialog"/);
  assert.match(tasksCalendar, /aria-controls=\{overflowDate === date/);
  assert.match(tasksCalendar, /role="dialog"/);
  assert.match(tasksCalendar, /aria-labelledby=\{labelledBy\}/);
  assert.match(tasksCalendar, /querySelector<HTMLElement>\("ul button, header button"\)/);
  assert.match(tasksCalendar, /overflowTriggerRef\.current\?\.focus/);
  assert.match(
    taskInspector,
    /<h2 id=\{titleId\}>\{task\?\.title \?\? "Task unavailable"\}<\/h2>/,
  );
  assert.match(taskInspector, /aria-labelledby=\{titleId\}/);
});

test("Tasks mobile CSS contains dense canvases and preserves 44px primary targets", () => {
  for (const styles of [
    taskSharedStyles,
    taskScheduleStyles,
    taskCalendarStyles,
  ]) {
    assert.match(styles, /@media \(max-width: 767px\)/);
    assert.match(styles, /44px/);
  }
  assert.match(taskScheduleStyles, /\.timelineCanvas[\s\S]*overflow|\.timelineScroller[\s\S]*overflow/);
  assert.match(taskCalendarStyles, /\.calendarPrimary[\s\S]*overflow-x: auto/);
  assert.match(taskCalendarStyles, /\.calendarWorkspace[\s\S]*min-width: 0/);
  assert.match(taskSharedStyles, /env\(safe-area-inset-bottom\)/);
  assert.match(studioBar, /md:pointer-coarse:h-11/);
  assert.match(userButton, /pointer-coarse:h-11/);
});

test("the shared app frame starts with one stable skip-link destination", () => {
  assert.match(
    appLayout,
    /<a[\s\S]*href="#app-main-content"[\s\S]*Skip to main content[\s\S]*<\/a>/,
  );
  assert.equal(
    (
      productWorkspaceShell.match(
        /<main[\s\S]*?id="app-main-content"[\s\S]*?tabIndex=\{-1\}/g,
      ) ?? []
    ).length,
    2,
  );
  assert.match(
    suiteLoading,
    /<main[\s\S]*?id="app-main-content"[\s\S]*?tabIndex=\{-1\}/,
  );
});

test("Notes leaves command-K to the suite and exposes slash for local find", () => {
  assert.doesNotMatch(
    notesHybrid,
    /\(event\.metaKey \|\| event\.ctrlKey\)[\s\S]{0,100}key\.toLowerCase\(\) === "k"/,
  );
  assert.match(notesHybrid, /event\.key === "\/"/);
  assert.match(notesHybrid, /aria-keyshortcuts="\/"/);
  assert.match(notesHybrid, /Press \/ to find/);
});

test("Notes receipts stay in the unified app and preserve the review context", () => {
  assert.match(notesHybrid, /const TASKS_APP_PATH = PRODUCT_APP_PATHS\.tasks/);
  assert.doesNotMatch(notesHybrid, /PRODUCT_APP_URLS/);
  assert.match(notesHybrid, /params\.set\("workspaceId", REVIEW_SUITE_FIXTURE\.workspace\.id\)/);
  assert.match(
    notesHybrid,
    /params\.set\(\s*"planningPeriodId",\s*REVIEW_SUITE_FIXTURE\.workspace\.planningPeriodId,\s*\)/,
  );
  assert.match(notesHybrid, /params\.set\("projectId", REVIEW_PRIMARY_PROJECT\.id\)/);
});

test("canonical module identity stays visible in the mobile Studio Bar", () => {
  const identityCell = studioBar.slice(
    studioBar.indexOf("function IdentityCell"),
    studioBar.indexOf("const subscribeNever"),
  );
  assert.match(identityCell, /productIdFromAppPath|activeModuleIdentity/);
  assert.match(identityCell, /className="flex h-full min-w-0/);
  assert.match(identityCell, /md:w-\[248px\]/);
  assert.match(identityCell, /text-\[20px\]/);
  assert.doesNotMatch(identityCell, /\bhidden\b/);
  assert.match(
    studioBar,
    /<IdentityCell edition=\{data\?\.edition \?\? null\} \/>/,
  );
});

test("the approved Notes Hybrid is canonical and legacy is rollback-only", () => {
  for (const source of [notesPage, notesActions]) {
    assert.match(
      source,
      /process\.env\.NOTES_LEGACY_NOTEBOOK_ENABLED\s*!==\s*"1"/,
    );
    assert.doesNotMatch(source, /NOTES_HYBRID_NOTEBOOK_ENABLED/);
  }
  assert.match(notesPage, /<HybridNotebook/);
});

test("the Tasks room tells the same Mara and Finn venue story as Timeline", () => {
  assert.match(roomBrief, /REVIEW_PRIMARY_PROJECT\.name/);
  assert.match(roomBrief, /REVIEW_SUITE_FIXTURE\.workspace\.ownerName/);
  assert.match(roomBrief, /Wedding day · 3 Oct 2026/);
  assert.doesNotMatch(roomBrief, /Hartwell|Product Roadmap/);
});

test("the deterministic cross-suite fixture keeps one workspace, project, and milestone identity", () => {
  assert.match(tasksDemo, /DEMO_WORKSPACE_ID = REVIEW_SUITE_FIXTURE\.workspace\.id/);
  assert.match(tasksDemo, /DEMO_PRIMARY_PROJECT_ID = REVIEW_PRIMARY_PROJECT\.id/);
  assert.match(tasksDemo, /id: REVIEW_MENU_MILESTONE\.sourceId/);
  assert.match(
    tasksDemo,
    /sourceNoteId: REVIEW_SUITE_FIXTURE\.journey\.sourceNoteId/,
  );
  assert.match(
    notesDemo,
    /id: REVIEW_SUITE_FIXTURE\.journey\.sourceNoteId/,
  );
  assert.match(
    notesDemo,
    /body: `\$\{REVIEW_PRIMARY_PROJECT\.name\}'s menu tasting at The Orchard is booked for 1 August\. Confirm the final dietary list before the venue team locks the service notes\.`/,
  );
  assert.match(notesDemo, /promotedTaskId: REVIEW_MENU_MILESTONE\.sourceId/);
  assert.match(reviewFixture, /id: "demo-ws"/);
  assert.match(reviewFixture, /id: "demo-project-mara-finn"/);
  assert.match(reviewFixture, /sourceId: "demo-task-menu-tasting"/);
  assert.match(reviewFixture, /sourceNoteId: "demo-note-menu-tasting"/);
  assert.match(
    reviewFixture,
    /audiencePublicationId: "demo-audience-publication"/,
  );

  assert.equal(crossSuiteJourney.fixtureContext.workspace.id, "demo-ws");
  assert.equal(
    crossSuiteJourney.fixtureContext.project.id,
    "demo-project-mara-finn",
  );
  assert.equal(
    crossSuiteJourney.fixtureContext.task.id,
    "demo-task-menu-tasting",
  );
  assert.equal(
    crossSuiteJourney.fixtureContext.milestone.sourceTaskId,
    crossSuiteJourney.fixtureContext.task.id,
  );
  assert.equal(
    crossSuiteJourney.fixtureContext.task.sourceNoteId,
    crossSuiteJourney.fixtureContext.sourceNote.id,
  );
  assert.equal(
    crossSuiteJourney.fixtureContext.sourceNote.body,
    "Mara & Finn's menu tasting at The Orchard is booked for 1 August. Confirm the final dietary list before the venue team locks the service notes.",
  );

  const [association] =
    crossSuiteJourney.reviewEvidenceAssociations
      .taskToPublicTimelineMilestone;
  assert.equal(
    crossSuiteJourney.reviewEvidenceAssociations.scope,
    "review-only",
  );
  assert.equal(
    association.associationId,
    "demo-task-to-timeline-menu-tasting",
  );
  assert.equal(
    association.sourceTaskId,
    crossSuiteJourney.fixtureContext.task.id,
  );
  assert.equal(
    association.publicMilestoneId,
    crossSuiteJourney.fixtureContext.milestone.id,
  );
  assert.equal(association.publicationId, "demo-audience-publication");
});

test("the cross-suite evidence contract separates read-only traversal from hashed mutation proof", () => {
  assert.equal(
    crossSuiteJourney.status,
    "required-not-yet-evidenced",
  );
  assert.equal(
    crossSuiteJourney.proofMode.browser,
    "continuous-read-only-preseeded-traversal",
  );
  assert.equal(
    crossSuiteJourney.proofMode.mutation,
    "separate-real-server-action-temp-db-reports",
  );
  assert.equal(crossSuiteJourney.proofMode.browserPersistenceClaim, "none");
  assert.equal(
    crossSuiteJourney.mutationEvidence.status,
    "required-not-yet-evidenced",
  );
  assert.deepEqual(
    crossSuiteJourney.steps.map((step) => step.action),
    [
      "inspect-preseeded-source-note",
      "follow-preseeded-task-receipt",
      "inspect-preseeded-task-and-milestone-provenance",
      "inspect-owner-timeline",
      "inspect-briefing-evidence",
    ],
  );
  assert.deepEqual(
    crossSuiteJourney.mutationEvidence.requiredReports.map(
      (report) => report.id,
    ),
    [
      "notes-source-create-and-exact-task-send",
      "notes-task-send-idempotency-and-replay",
      "task-milestone-promotion-and-timeline-provenance",
      "signal-opaque-evidence-resolution",
    ],
  );
  assert.ok(
    crossSuiteJourney.mutationEvidence.requiredReports.every(
      (report) => report.hashRequired === true,
    ),
  );
  const serialized = JSON.stringify(crossSuiteJourney);
  assert.equal(serialized.includes("capture-and-save-source-note"), false);
  assert.equal(serialized.includes("review-and-create-task"), false);
  assert.equal(serialized.includes("confirm-task-and-promote-milestone"), false);
});
