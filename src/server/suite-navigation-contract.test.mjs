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
// T·132: the design lab's own inspector was deleted with the rest of the
// lab chrome. The task a person actually opens is the production detail
// panel, so the accessible-name contract is asserted where it now lives.
const taskDetailPanel = read(
  "src/components/app/detail-panel/focus-window.tsx",
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
const signalShell = read("src/components/studio-bar/signal-shell.module.css");
const contextHook = read("src/components/app/use-suite-context.ts");
const userButton = read("src/components/app/user-button-with-suite.tsx");
const notesPage = read("src/modules/notes/app/page.tsx");
const notesActions = read("src/modules/notes/server/actions/notes.ts");
const notesWorkspace = read(
  "src/modules/notes/app/workspace/NotesWorkspace.tsx",
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

test("the rail derives ownership and carries allowlisted context hints", () => {
  // Signal → Home consolidation (D4): the rail resolves the active
  // surface (Home included) and walks typed destination paths. Signal
  // must never return as a rail destination.
  assert.match(studioRail, /activeRailKey\(pathname\)/);
  assert.match(studioRail, /suiteSurfaceFromAppPath/);
  assert.doesNotMatch(studioRail, /\{ key: "signal"/);
  // The rail is a PRODUCT switcher (board pass 4): no Home, no Project —
  // Home is the first destination of the local Tasks navigation, and
  // /app/home and /app/project both stay routable.
  assert.doesNotMatch(studioRail, /\{ key: "home"/);
  assert.doesNotMatch(studioRail, /\{ key: "project"/);
  assert.deepEqual(
    [...studioRail.matchAll(/\{ key: "(home|notes|tasks|timeline|project)", label:/g)]
      .map((match) => match[1]),
    ["notes", "tasks", "timeline"],
  );
  assert.match(studioRail, /useSuiteContext\(\)/);
  assert.match(
    studioRail,
    /withSuiteContext\(destination\.path, suiteContext\)/,
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

test("search is a compact command trigger beside Add task, not a resident field", () => {
  // Board pass 4: the persistent command field retired. Search is a quiet
  // trigger in the right action cluster, still platform-aware, and the
  // reserved Signal pulse slot survives in the open middle.
  assert.doesNotMatch(studioBar, /data-slot="command-field"/);
  assert.match(studioBar, /data-slot="search-trigger"/);
  assert.match(studioBar, /data-slot="signal-pulse"/);
  assert.match(studioBar, /aria-keyshortcuts="Control\+K Meta\+K"/);
  assert.match(studioBar, /aria-keyshortcuts="c"/);
  assert.match(studioBar, /bg-\[var\(--x-studio-ink-strong\)\]/);

  assert.doesNotMatch(studioRail, /aria-label="Search"/);
  assert.doesNotMatch(studioRail, /aria-label="Team"/);
  assert.doesNotMatch(studioRail, /aria-label="Settings"/);
  assert.match(studioRail, /aria-label="Help and settings"/);
  assert.match(studioRail, /href="\/app\/settings"/);
  assert.match(studioRail, /href="\/settings\/profile"/);
  assert.match(studioRail, /event\.key !== "Escape"/);
  assert.match(studioRail, /triggerRef\.current\?\.focus/);

  assert.match(
    signalShell,
    /\.railProduct\[data-active\]\s*\{[\s\S]*background:\s*color-mix/,
  );
  assert.doesNotMatch(
    signalShell,
    /\.railProduct\[data-active\]\s+\.railTile\s*\{[\s\S]{0,120}background:/,
  );
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
  assert.match(studioBar, /suiteSurfaceFromAppPath\(pathname\)/);
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
  assert.match(suiteCommandRoot, /suiteSurfaceFromAppPath\(pathname\)/);
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

test("mobile suite nav exposes Home-first canonical destinations", () => {
  // Signal → Home consolidation (D4): Home, then the three products.
  // Signal must not return as a tab, and Project left the shell
  // navigation with the 2026-08-05 board pass — the project overview is
  // reached from project contexts, never as a fifth product.
  assert.match(appLayout, /<MobileSuiteNav \/>/);
  assert.match(mobileSuiteNav, /if \(activeKey === "tasks"\) return null;/);
  assert.deepEqual(
    [...mobileSuiteNav.matchAll(/\{ id: "(home|notes|tasks|timeline|project)", label:/g)]
      .map((match) => match[1]),
    ["home", "notes", "tasks", "timeline"],
  );
  assert.doesNotMatch(mobileSuiteNav, /\{ id: "signal"/);
  assert.doesNotMatch(mobileSuiteNav, /\{ id: "project"/);
  assert.match(
    mobileSuiteNav,
    /withSuiteContext\(destination\.path, suiteContext\)/,
  );
  assert.doesNotMatch(
    mobileSuiteNav,
    /\/app\/(?:board|list|calendar|plan|brief)(?:\b|\/)/,
  );
});

test("mobile Tasks has one persistent product spine and one keyboard-complete views menu", () => {
  assert.equal((tasksSidebar.match(/<nav/g) ?? []).length, 1);
  // Consolidation (D4): the Tasks mobile spine leads with Home and
  // carries the three products; Signal is retired from the spine.
  assert.deepEqual(
    [
      ...tasksSidebar.matchAll(
        /\{ id: "(home|notes|tasks|timeline)", label: "(?:Home|Notes|Tasks|Timeline)", path:/g,
      ),
    ].map((match) => match[1]),
    ["home", "notes", "tasks", "timeline"],
  );
  assert.doesNotMatch(tasksSidebar, /\{ id: "signal"/);
  assert.match(
    tasksSidebar,
    /withSuiteContext\(product\.path, suiteContext\)/,
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
  assert.match(taskDetailPanel, /role="dialog"/);
  assert.match(taskDetailPanel, /aria-modal="true"/);
  assert.match(taskDetailPanel, /aria-labelledby="task-panel-title"/);
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
  // Assert the literal 44px, not `h-11`. This repo remaps Tailwind's numeric
  // spacing scale (--space-11 is 80px), so `h-11` asserted a token that
  // rendered coarse-pointer targets at 80px while this test's name promised
  // 44px. A bracketed 44px cannot drift with the scale.
  assert.match(userButton, /pointer-coarse:h-\[44px\]/);
  assert.match(userButton, /pointer-coarse:w-\[44px\]/);
  assert.match(studioBar, /pointer-coarse:h-\[44px\]/);
  assert.match(studioBar, /md:pointer-coarse:min-w-\[44px\]/);
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
    notesWorkspace,
    /\(event\.metaKey \|\| event\.ctrlKey\)[\s\S]{0,100}key\.toLowerCase\(\) === "k"/,
  );
  assert.match(notesWorkspace, /event\.key === "\/"/);
  assert.match(notesWorkspace, /aria-keyshortcuts="\/"/);
  // The standing sentence "Press / to find" was retired with the 2026-08-05
  // redesign. The shortcut it described did not change, so the rule is now
  // pinned to the keycap that shows it, not to a paragraph of instructions.
  assert.match(notesWorkspace, /className=\{styles\.searchKey\}/);
});

test("Notes opens a task through the approved focus route, never a hostname", () => {
  // The redesign hands off to the Tasks focus experience at /app/task/[id]
  // rather than deep-linking a board with review query parameters. What the
  // old rule protected still holds: the link is built from the typed path
  // helper, it stays inside the unified app, and no component here invents a
  // hostname of its own.
  assert.match(notesWorkspace, /taskFocusPath/);
  assert.doesNotMatch(notesWorkspace, /PRODUCT_APP_URLS/);
  assert.doesNotMatch(notesWorkspace, /https?:\/\//);
  assert.doesNotMatch(notesWorkspace, /`\/app\/task\//);
  const productUrls = read("src/lib/product-urls.ts");
  assert.match(productUrls, /export function taskFocusPath/);
  assert.match(productUrls, /\/app\/task\/\$\{encodeURIComponent\(taskId\)\}/);
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

test("the Notes workspace is the only notebook, and the legacy send seam stays flagged", () => {
  // The legacy renderer was retired with the 2026-08-05 redesign: its stated
  // one-release rollback window had passed, and rolling back to it would
  // have restored the exact screen the redesign replaced. What the flag
  // still governs is the legacy Notes-to-Tasks server actions, which are a
  // separate seam and must stay refused by default.
  assert.match(
    notesActions,
    /process\.env\.NOTES_LEGACY_NOTEBOOK_ENABLED\s*!==\s*"1"/,
  );
  assert.doesNotMatch(notesActions, /NOTES_HYBRID_NOTEBOOK_ENABLED/);
  assert.match(notesPage, /<NotesWorkspace/);
  assert.doesNotMatch(notesPage, /<HybridNotebook/);
  assert.doesNotMatch(notesPage, /<Notebook\s/);
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
    "inspect-home-briefing-evidence",
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
    "home-briefing-opaque-evidence-resolution",
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
