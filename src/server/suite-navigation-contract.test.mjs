import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

function read(relativePath) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

const hybridWorkspace = read("src/components/hybrid/hybrid-workspace.tsx");
// v3 Tasks: the page is TasksWorkspace; view switches go through the
// toolbar and the one link builder.
const tasksWorkspace = read("src/components/tasks/tasks-workspace.tsx");
const tasksWorkspaceStyles = read("src/components/tasks/workspace.module.css");
const tasksToolbar = read("src/components/tasks/toolbar.tsx");
const tasksHeader = read("src/components/tasks/header.tsx");
const tasksViewHref = read("src/lib/projects/floor-view-href.ts");
const appLayout = read("src/app/app/layout.tsx");
const mobileSuiteNav = read("src/components/app/mobile-suite-nav.tsx");
const coreNavigation = read("src/lib/core-navigation.ts");
const v3Shell = read("src/components/shell/app-shell.tsx");
const v3Sidebar = read("src/components/shell/app-sidebar.tsx");
const v3Nav = read("src/components/shell/shell-nav.ts");
const bareArtifactPath = read("src/lib/bare-artifact-path.ts");
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
const tasksCalendar = read("src/components/tasks/calendar-view.tsx");
// The task a person opens is the production task sheet host, so the
// accessible-name contract is asserted where it lives.
const taskDetailPanel = read(
  "src/components/app/detail-panel/task-detail-panel.tsx",
);
const taskSharedStyles = read("src/components/tasks/workspace.module.css");
const taskBoardStyles = read("src/components/tasks/board.module.css");
const taskCalendarStyles = read("src/components/tasks/calendar.module.css");
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
  assert.match(tasksToolbar, /floorViewHref\(view, verified, taskId\)/);
  assert.match(tasksWorkspace, /router\.push\(viewHref\.href\(next\)\)/);
  for (const source of [`${tasksToolbar}
${tasksViewHref}`, roomTools]) {
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

test("Tasks has three views and no local time view that could be confused with Timeline", () => {
  for (const source of [tasksSidebar, tasksToolbar]) {
    assert.doesNotMatch(source, /TASKS_VIEW_PATHS\.timeline/);
    assert.doesNotMatch(source, /label: "Schedule"/);
  }
  assert.match(tasksToolbar, /\{ id: "board", label: "Board"/);
  assert.match(tasksToolbar, /\{ id: "list", label: "List"/);
  assert.match(tasksToolbar, /\{ id: "calendar", label: "Calendar"/);
});

test("Tasks owns the same product-specific document title as its siblings", () => {
  assert.match(
    tasksLayout,
    /export const metadata = \{ title: "Tasks · Signal Studio" \};/,
  );
});

test("the rail derives ownership and carries allowlisted context hints", () => {
  // The core path model is shared by desktop and both mobile bars. Project
  // ownership must be explicit because the product resolver calls it Tasks.
  assert.match(studioRail, /activeRailKey\(pathname\)/);
  assert.match(studioRail, /activeCoreDestination\(pathname\)/);
  assert.match(studioRail, /RAIL_DESTINATIONS = CORE_DESTINATIONS/);
  assert.deepEqual(
    [...coreNavigation.matchAll(/\{ id: "(home|project|tasks|timeline)", label:/g)]
      .map((match) => match[1]),
    ["home", "project", "tasks", "timeline"],
  );
  assert.doesNotMatch(coreNavigation, /\{ id: "notes"/);
  assert.match(studioRail, /withSuiteContext\(PRODUCT_APP_PATHS\.notes, suiteContext\)/);
  assert.match(studioRail, /aria-label="More"/);
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
  // The Add-task capsule is a FILL, so it spends the capsule token, not the
  // strong-ink text value it used to borrow — that borrow is what left dark
  // with a near-white capsule and nowhere to remap it (wave 6).
  assert.match(studioBar, /bg-\[var\(--x-studio-capsule\)\]/);

  assert.doesNotMatch(studioRail, /aria-label="Search"/);
  assert.doesNotMatch(studioRail, /aria-label="Team"/);
  assert.doesNotMatch(studioRail, /aria-label="Settings"/);
  assert.match(studioRail, /aria-label="More"/);
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

test("the v3 shell is the one persistent navigation on every signed-in page", () => {
  // Redesign sprint (24 Sep 2026, founder authority): the studio bar, icon
  // rail, bottom tab bar and the Floor's own spine were replaced by one
  // sidebar + top bar. The same core paths stay reachable with suite context.
  assert.match(appLayout, /<AppShell[\s>]/);
  assert.doesNotMatch(appLayout, /<MobileSuiteNav|<StudioBar|<StudioRail/);
  for (const path of ["/app/home", "/app/inbox", "/app/tasks", "/app/notes", "/app/timeline", "/app/settings"]) {
    assert.match(v3Nav, new RegExp(`href: "${path}"`));
  }
  assert.match(v3Sidebar, /withSuiteContext\(destination\.href, suiteContext\)/);
  assert.match(v3Nav, /requiresMessages: true/);
  assert.doesNotMatch(v3Nav, /\/app\/(?:board|list|calendar|plan|brief)(?:|\/)/);
});

test("Notes lives in Apps and tools, and the launcher opens the same catalogue", () => {
  // Founder brief (24 Sep 2026): a Google-apps style launcher for apps and
  // the tools on the way. Notes leaves the sidebar but stays one step away.
  // Revision 2 (25 Sep 2026): one name, "Apps and tools", everywhere.
  const studioSection = v3Nav.slice(
    v3Nav.indexOf("WORKSPACE_DESTINATIONS"),
    v3Nav.indexOf("TOOL_DESTINATIONS"),
  );
  assert.doesNotMatch(studioSection, /\{ id: "notes"/);
  assert.match(v3Nav, /\{ id: "tools", label: "Apps and tools", href: "\/app\/tools"/);
  assert.doesNotMatch(v3Nav, /More tools/);
  assert.match(v3Nav, /export const TOOL_DESTINATIONS[\s\S]*?href: "\/app\/notes"/);
  assert.match(v3Shell, /<AppsLauncher/);
  // The New menu still starts a note.
  assert.match(v3Shell, /<Link href="\/app\/notes" role="menuitem"/);
  const launcher = read("src/components/shell/launcher/apps-launcher.tsx");
  assert.match(launcher, /aria-label="Apps and tools"/);
  assert.match(launcher, /aria-haspopup="dialog"/);
  assert.match(launcher, /if \(openPath !== pathname\)/);
  const catalogue = read("src/components/shell/launcher/launcher-catalog.ts");
  assert.doesNotMatch(catalogue, /https?:\/\//);
  const mailHosts = new Set(
    [...catalogue.matchAll(/FEEDBACK_EMAIL = "([^"]+)"/g)].map((match) => match[1]),
  );
  assert.deepEqual([...mailHosts], ["hello@signalstudio.ie"]);
  assert.doesNotMatch(catalogue, /mailto:(?!\$\{FEEDBACK_EMAIL\})/);
});

test("the mobile drawer closes on navigation and Escape", () => {
  assert.match(v3Shell, /aria-label="Open navigation"/);
  assert.match(v3Shell, /event\.key === "Escape"\) setMobileOpen\(false\)/);
  assert.match(v3Shell, /if \(drawerPath !== pathname\)/);
  assert.match(v3Shell, /aria-haspopup="menu"/);
});

test("mobile Tasks has one persistent core spine and one keyboard-complete More menu", () => {
  assert.equal((tasksSidebar.match(/<nav/g) ?? []).length, 1);
  assert.match(tasksSidebar, /CORE_DESTINATIONS\.map/);
  assert.match(tasksSidebar, /withSuiteContext\(PRODUCT_APP_PATHS\.notes, suiteContext\)/);
  assert.match(tasksSidebar, /Tasks views/);
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

test("Tasks renders inside the v3 shell and keeps its own Add task", () => {
  assert.match(bareArtifactPath, /return isBareArtifactPath\(pathname\) \|\| isTimelinePreviewPath\(pathname\);/);
  assert.match(hybridWorkspace, /<TasksWorkspace view=\{view\}/);
  assert.match(tasksHeader, /New task/);
  assert.match(tasksHeader, /data-new-task-anchor/);
  assert.match(v3Shell, /router\.push\("\/app\/tasks\?create=task"\)/);
  assert.match(tasksWorkspace, /data-floor-runtime="true"/);
  assert.match(tasksWorkspaceStyles, /\.workspace \{[\s\S]*?height: 100%;/);
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
  // The month is a grid of labelled, selectable days; "+n more" selects the
  // day so its full list shows in the day pane, where focus can reach it.
  assert.match(tasksCalendar, /role="grid"/);
  assert.match(tasksCalendar, /role="gridcell"/);
  assert.match(tasksCalendar, /aria-selected=\{selected\}/);
  assert.match(tasksCalendar, /aria-label=\{`\$\{longDay\(date\)\}, \$\{items\.length\}/);
  assert.match(tasksCalendar, /\+\{rest\} more/);
  // The sheet is a modal dialog below 1280px and a labelled region beside
  // the board above it; both are named by the task title.
  assert.match(taskDetailPanel, /role="dialog"/);
  assert.match(taskDetailPanel, /aria-modal="true"/);
  assert.match(taskDetailPanel, /role="complementary"/);
  assert.equal((taskDetailPanel.match(/aria-labelledby="task-panel-title"/g) ?? []).length, 2);
});

test("Tasks mobile CSS contains dense canvases and preserves 44px primary targets", () => {
  for (const styles of [
    taskSharedStyles,
    taskBoardStyles,
    taskCalendarStyles,
  ]) {
    assert.match(styles, /@media \(max-width: 767px\)/);
    assert.match(styles, /44px/);
  }
  assert.match(taskBoardStyles, /\.board \{[\s\S]*?overflow-x: auto/);
  assert.match(taskBoardStyles, /scroll-snap-type: x mandatory/);
  assert.match(taskCalendarStyles, /\.main \{[\s\S]*?min-width: 0/);
  assert.match(taskCalendarStyles, /\.day \{[\s\S]*?min-width: 0/);
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
  assert.match(identityCell, /text-\[22px\]/);
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
    /body: `\$\{REVIEW_PRIMARY_PROJECT\.name\}’s menu tasting at The Orchard is booked for 1 August\. Confirm the final dietary list before the venue team locks the service notes\.`/,
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
    "Mara & Finn’s menu tasting at The Orchard is booked for 1 August. Confirm the final dietary list before the venue team locks the service notes.",
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

test("a tool reached through Apps and tools lights up its parent row, and the crumbs still name it", () => {
  // Launcher critique F4 (25 Sep 2026): /app/notes had no highlighted
  // sidebar row while /app/tools/whiteboard highlighted Apps and tools.
  // shell-nav.ts is TypeScript, so it is evaluated in a child process with
  // the same tsx loader the unit suites use.
  const script = [
    'import * as loaded from "./src/components/shell/shell-nav.ts";',
    // The repo is CommonJS by default, so tsx may hand the exports over as default.
    "const nav = loaded.activeDestinationId ? loaded : loaded.default;",
    "const paths = ['/app/notes', '/app/notes/anything', '/app/tools', '/app/tools/whiteboard', '/app/tasks'];",
    "const active = Object.fromEntries(paths.map((path) => [path, nav.activeDestinationId(path)]));",
    "const crumbs = Object.fromEntries(paths.map((path) => [path, nav.crumbsForPath(path).map((crumb) => crumb.label)]));",
    "console.log(JSON.stringify({ active, crumbs }));",
  ].join("\n");
  const output = execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    encoding: "utf8",
  });
  const { active, crumbs } = JSON.parse(output.trim().split("\n").pop());
  assert.equal(active["/app/notes"], "tools");
  assert.equal(active["/app/notes/anything"], "tools");
  assert.equal(active["/app/tools"], "tools");
  assert.equal(active["/app/tools/whiteboard"], "tools");
  assert.equal(active["/app/tasks"], "tasks");
  assert.deepEqual(crumbs["/app/notes"], ["Signal Studio", "Apps and tools", "Notes"]);
  assert.equal(crumbs["/app/tools/whiteboard"].at(-1), "Whiteboard");
});
