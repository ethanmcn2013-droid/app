import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
// Keep the actual route/action/SQLite regressions in the existing Linux default
// gate as well as the source contracts, without separate package wiring.
import "../../../experience/recipient-project-work/server.test.cjs";

/**
 * WP3 route half — source contracts for the six named deep-link defects.
 *
 * These assert *structure*, deliberately, because the properties that matter
 * most here are ordering and absence properties that a behavioural test on a
 * Server Component cannot observe: that the proof precedes the read, that no
 * route can forward a server-only reason code, that no print route can render
 * an artefact it did not authorize, and that the ambient accessor is gone from
 * the surface rather than merely unused. Modelled on
 * `active-project-contract.test.mjs` and `tenant-scope.test.mjs`, which parse
 * source for the same reason.
 *
 * The behavioural half lives in
 * `src/app/app/task/task-deep-link-contract.test.ts`, which proves the task
 * deep-link decision against a real schema-baseline database.
 */

const root = process.cwd();
const read = (relative) => readFileSync(path.join(root, relative), "utf8");

const routeAuthz = read("src/server/projects/route-authz.ts");
const taskPage = read("src/app/app/task/[id]/page.tsx");
const taskResolver = read("src/app/app/task/[id]/resolve-task-route.ts");
const projectPage = read("src/app/app/project/page.tsx");
const tasksPage = read("src/app/app/tasks/page.tsx");
const tasksArrival = read("src/components/app/tasks-project-arrival.tsx");
const attachmentRoute = read("src/app/api/attachments/[id]/route.ts");
const printGate = read("src/app/print/print-project.tsx");
const printLayout = read("src/app/print/layout.tsx");
const shell = read("src/components/app/tasks-runtime-shell.tsx");

const PRINT_PAGES = ["board", "list", "timeline", "calendar"].map((view) => [
  view,
  read(`src/app/print/${view}/page.tsx`),
]);

/* ── The ambient accessor is gone from the owned surface ─────────────────── */

test("no route in the WP3 route half calls the ambient accessor", () => {
  const surface = {
    "task/[id]/page.tsx": taskPage,
    "task/[id]/resolve-task-route.ts": taskResolver,
    "project/page.tsx": projectPage,
    "tasks/page.tsx": tasksPage,
    "api/attachments/[id]/route.ts": attachmentRoute,
    "print/layout.tsx": printLayout,
    "print/print-project.tsx": printGate,
    "tasks-runtime-shell.tsx": shell,
    "route-authz.ts": routeAuthz,
    ...Object.fromEntries(PRINT_PAGES.map(([view, src]) => [`print/${view}`, src])),
  };
  for (const [name, source] of Object.entries(surface)) {
    // The call, not the word: these files discuss the accessor at length in
    // their docblocks, and prose is not a call site.
    assert.doesNotMatch(
      source,
      /getActiveWorkspace\s*\(/,
      `${name} must not resolve the ambient cookie`,
    );
  }
});

test("the shared helper never returns the resolver's server-only reason code", () => {
  // `ProjectRouteResolution.reason` distinguishes missing-or-forbidden from
  // malformed. Surfacing it is an existence leak (ADR 0001 §4).
  const decisionType = routeAuthz.slice(
    routeAuthz.indexOf("export type RouteProjectDecision"),
    routeAuthz.indexOf("function demoDecision"),
  );
  assert.doesNotMatch(decisionType, /reason/);
  assert.match(decisionType, /kind: "unavailable"/);
  assert.match(decisionType, /kind: "empty"/);

  // And no route may read it off the resolution either.
  for (const source of [taskPage, projectPage, tasksPage, attachmentRoute, printGate, shell]) {
    assert.doesNotMatch(source, /\.reason\b/);
  }
});

test("every authorization goes through the resolver's EXPLICIT branch", () => {
  // The implicit branch falls back through a catalog that
  // `listProjectCatalogRows` truncates at `.limit(2000)` with no ORDER BY, so
  // catalog presence is not proof of access. `authorizeObjectProject` must
  // always pass a requestedWorkspaceId.
  const objectAuth = routeAuthz.slice(
    routeAuthz.indexOf("export async function authorizeObjectProject"),
  );
  assert.match(objectAuth, /requestedWorkspaceId: projectId/);
  assert.doesNotMatch(
    objectAuth,
    /cookieWorkspaceId|legacyCookieWorkspaceId/,
    "an object's Project is never resolved from a cookie",
  );
});

test("authorizeObjectProject shape-gates before it queries, and re-checks identity", () => {
  const body = routeAuthz.slice(
    routeAuthz.indexOf("export async function authorizeObjectProject"),
  );
  const parseAt = body.indexOf("parseProjectId(storedWorkspaceId)");
  const resolveAt = body.indexOf("resolveActiveProjectForRoute(");
  assert(parseAt > 0 && parseAt < resolveAt, "shape gate precedes the query");
  assert.match(
    body,
    /decision\.workspaceId !== projectId/,
    "the returned Project must be asserted to be the one asked for",
  );
});

test("demo mode still compares the object's Project instead of waving it through", () => {
  const body = routeAuthz.slice(
    routeAuthz.indexOf("export async function authorizeObjectProject"),
  );
  const demoAt = body.indexOf("isDemoMode()");
  const parseAt = body.indexOf("parseProjectId(storedWorkspaceId)");
  assert(parseAt < demoAt, "the id is parsed before the demo branch reads it");
  assert.match(
    body.slice(demoAt),
    /projectId === DEMO_WORKSPACE_ID/,
    "returning a bare ready in demo would authorize an object from any Project",
  );
});

/* ── Defect 1 · the task deep link ──────────────────────────────────────── */

test("the task route proves membership before it reads task content", () => {
  const body = taskResolver.slice(taskResolver.indexOf("export async function decideTaskRouteWith"));
  const learnAt = body.indexOf("deps.loadTaskProject(id)");
  const proveAt = body.indexOf("deps.authorize(storedWorkspaceId)");
  const readAt = body.indexOf("deps.loadDetail(id, proven)");
  assert(learnAt > 0 && proveAt > learnAt, "the proof follows learning the Project");
  assert(readAt > proveAt, "task content is read only after the proof");
  assert.match(
    body,
    /deps\.loadDetail\(id, proven\)/,
    "the scoped read is scoped by the PROVEN Project, never a caller-supplied one",
  );
});

test("the task route emits a canonical V3 URL and no retired path", () => {
  assert.match(taskResolver, /\/app\/tasks\?/);
  for (const banned of ["sourceProduct", "contextVersion", "planningPeriodId"]) {
    assert.doesNotMatch(
      taskResolver,
      new RegExp(`["'\`]${banned}["'\`]`),
      `a V3 builder must not emit ${banned}`,
    );
  }
  for (const retired of ["/app/board", "/app/plan", "/app/brief", "/app/signal"]) {
    assert.ok(
      !taskResolver.includes(`"${retired}`),
      `must never emit the retired path ${retired}`,
    );
  }
});

test("the task route's not-found state has exactly one shape", () => {
  // Two distinguishable states would let a caller tell "forbidden" from
  // "missing". The union must carry one not-found variant with no payload.
  const union = taskResolver.slice(
    taskResolver.indexOf("export type TaskRouteDecision"),
    taskResolver.indexOf("export type TaskRouteDeps"),
  );
  const notFoundVariants = union.match(/kind: "not-found"/g) ?? [];
  assert.equal(notFoundVariants.length, 1);
  assert.doesNotMatch(union, /kind: "forbidden"|kind: "denied"|kind: "no-access"/);
});

/* ── Defect 3 · print artefacts ─────────────────────────────────────────── */

test("every print page accepts searchParams and gates before reading tasks", () => {
  for (const [view, source] of PRINT_PAGES) {
    assert.match(source, /searchParams/, `/print/${view} must accept searchParams`);
    const gateAt = source.indexOf("gatePrintProject(");
    const tasksAt = source.indexOf("getTasks(");
    assert(gateAt > 0, `/print/${view} must run the Project gate`);
    assert(
      gateAt < tasksAt,
      `/print/${view} must authorize before it reads tasks`,
    );
    assert.match(
      source,
      /gate\.kind === "refused"/,
      `/print/${view} must refuse rather than render an unauthorized artefact`,
    );
    assert.match(
      source,
      new RegExp(`gatePrintProject\\("/print/${view}"`),
      `/print/${view} must canonicalise to its own path`,
    );
  }
});

test("a refused print renders a refusal, never an empty board", () => {
  // The distinction the gate exists to preserve: an authorized Project with
  // no tasks prints an empty board; an unauthorized one must not produce a
  // page that looks like one.
  assert.match(printGate, /export function PrintRefusal/);
  const refusal = printGate.slice(printGate.indexOf("export function PrintRefusal"));
  assert.doesNotMatch(
    refusal,
    /workspaceName|generatedAt/,
    "the refusal must not assert a workspace name or a generated date",
  );
  for (const [view, source] of PRINT_PAGES) {
    const refusedAt = source.indexOf('gate.kind === "refused"');
    const renderAt = source.search(/return\s+\(\s*\n?\s*<Print(Board|List|Timeline|Calendar)/);
    assert(
      refusedAt < renderAt,
      `/print/${view} must return the refusal before the artefact`,
    );
  }
});

test("the print layout resolves no Project at all", () => {
  // A layout receives no searchParams, so it can only ever gate the cookie's
  // Project — which is the defect. Calls, not words: this file explains the
  // history at length and prose is not a call site.
  assert.doesNotMatch(
    printLayout,
    /getActiveWorkspace\s*\(|resolveProjectForRoute\s*\(|requireRouteProjectId\s*\(|isFirstRun\s*\(/,
  );
  // And it takes nothing but children.
  const signature = printLayout.slice(
    printLayout.indexOf("export default function PrintLayout"),
    printLayout.indexOf("return ("),
  );
  assert.doesNotMatch(signature, /searchParams/);
  assert.match(signature, /children/);
});

/* ── Defect 4 · the attachment export ───────────────────────────────────── */

test("the attachment route derives its Project from the attachment", () => {
  const body = attachmentRoute.slice(attachmentRoute.indexOf("export async function GET"));
  const loadAt = body.indexOf("getAttachmentById(id)");
  const proveAt = body.indexOf("authorizeObjectProject(att.workspaceId)");
  const openAt = body.indexOf("resolveStoredPath(");
  assert(loadAt > 0 && proveAt > loadAt, "the attachment names the Project to prove");
  assert(openAt > proveAt, "no byte is opened before the proof");
  assert.doesNotMatch(
    body,
    /att\.workspaceId !== /,
    "comparing to an ambient Project is the defect, not the fix",
  );
});

test("an unauthorized attachment is indistinguishable from a missing one", () => {
  const body = attachmentRoute.slice(attachmentRoute.indexOf("export async function GET"));
  // Both paths must return the same neutral 404 helper.
  assert.match(body, /if \(!att\) \{\s*return notFound\(\);/);
  assert.match(body, /project\.kind !== "ready" && project\.kind !== "archived"\s*\)\s*\{\s*return notFound\(\);/);
  assert.doesNotMatch(body, /403|Forbidden/, "opacity is the right default here");
});

/* ── Defect 6 · /app/tasks consumes workspaceId (D-014) ─────────────────── */

test("/app/tasks reads workspaceId and refuses rather than rendering a wrong board", () => {
  assert.match(tasksPage, /searchParams: Promise<\{[^}]*workspaceId/s);
  const body = tasksPage.slice(tasksPage.indexOf("export default async function TasksPage"));
  const resolveAt = body.indexOf("resolveTasksArrival(sp.workspaceId)");
  const renderAt = body.indexOf("<HybridWorkspace");
  assert(resolveAt > 0, "the carried Project must actually be consumed");
  assert(resolveAt < renderAt, "it must be resolved before the board renders");
  assert.match(body, /return <TasksArrivalRefusal/);
  assert.match(tasksArrival, /await resolveProjectForRoute\(requested\)/);
  assert.match(tasksArrival, /requested !== undefined && !isActiveProjectV3Enabled\(\)/);
});

test("the venue-welcome demo guard still precedes every production boundary", () => {
  // The shared arrival guard delegates to the same demo-first authorization
  // seam. The venue fixture must still precede its production-only reads.
  const body = tasksPage.slice(tasksPage.indexOf("export default async function TasksPage"));
  const arrivalGuard = body.indexOf("resolveTasksArrival(sp.workspaceId)");
  const welcomeAt = body.indexOf('sp.welcome === "venue"');
  assert(arrivalGuard > 0 && arrivalGuard < welcomeAt);
  assert.match(routeAuthz, /if \(isDemoMode\(\)\)/);
  assert(body.indexOf("if (isDemoMode())", welcomeAt) < body.indexOf("await getCurrentUser()", welcomeAt));
});

/* ── Defect 5 · the runtime shell ───────────────────────────────────────── */

test("the shell fails closed and prefers an explicit Project", () => {
  assert.match(shell, /requestedProjectId/, "the explicit seam must exist");
  const body = shell.slice(shell.indexOf("export async function TasksRuntimeShell"));
  assert.match(
    body,
    /resolveProjectForRoute\(\s*parseProjectId\(requestedProjectId\) \?\? undefined,?\s*\)/,
    "an explicit Project is preferred, and still authorized rather than trusted",
  );
  assert.match(
    body,
    /project\.kind !== "ready" && project\.kind !== "archived"[\s\S]{0,80}redirect\("\/welcome"\)/,
    "no accessible Project must land on onboarding, never LEGACY_WORKSPACE_ID",
  );
});

/* ── D-022 · the runtime mounts from the pages ──────────────────────────── */

/**
 * The nine segments whose layouts used to mount `TasksRuntimeShell`
 * directly, and every page inside them. The mount now goes through
 * `tasks-runtime-mount.tsx` (flag-selected; its branch shape is pinned in
 * `active-project-contract.test.mjs`). This section pins the wiring: which
 * boundary mounts what, and which pages hand the shell the URL's Project.
 */
const RUNTIME_SEGMENTS = [
  "archived",
  "import",
  "inbox",
  "my-tasks",
  "project",
  "settings",
  "task",
  "tasks",
  "your-work",
];

/**
 * Passing `searchParams` moves the whole runtime — chrome, palette, board
 * data — to the URL's Project, so only pages whose own content moves with it
 * may pass it: the four Tasks views and My Tasks render from the runtime's
 * providers, Your Work is user-scoped, and the project overview verifies its
 * data against the explicit Project itself.
 */
const PAGES_PASSING_THE_URL = [
  "src/app/app/my-tasks/page.tsx",
  "src/app/app/project/page.tsx",
  "src/app/app/tasks/calendar/page.tsx",
  "src/app/app/tasks/list/page.tsx",
  "src/app/app/tasks/page.tsx",
  "src/app/app/tasks/timeline/page.tsx",
  "src/app/app/your-work/page.tsx",
];

/**
 * These pages resolve their content ambiently (`requireRouteProjectId`, or
 * the task object's own Project per ADR 0001 §9), so their mounts must never
 * claim an explicit Project: chrome naming B over content resolved as A is
 * the inequality ADR 0001 §2 calls a release blocker. None of these is a
 * `PROJECT_DESTINATION_SURFACES` entry, so the switcher never emits a
 * `workspaceId` at them. An entry may move to the passing list only when its
 * content reads take the same explicit Project.
 */
const PAGES_STAYING_AMBIENT = [
  "src/app/app/archived/page.tsx",
  "src/app/app/import/page.tsx",
  "src/app/app/inbox/page.tsx",
  "src/app/app/settings/page.tsx",
  "src/app/app/task/[id]/page.tsx",
];

test("every runtime segment layout mounts through the flag branch and resolves nothing", () => {
  for (const segment of RUNTIME_SEGMENTS) {
    const layout = read(`src/app/app/${segment}/layout.tsx`);
    assert.match(
      layout,
      /<TasksRuntimeLayoutMount>\{children\}<\/TasksRuntimeLayoutMount>/,
      `${segment}/layout.tsx must mount the runtime through the layout half of the flag branch`,
    );
    assert.doesNotMatch(
      layout,
      /TasksRuntimeShell|resolveProjectForRoute|requireRouteProjectId|getActiveWorkspace\s*\(/,
      `${segment}/layout.tsx must not mount the shell directly or resolve a Project of its own`,
    );
    assert.doesNotMatch(
      layout,
      /searchParams/,
      `a layout receives no searchParams; ${segment}/layout.tsx must not pretend otherwise`,
    );
  }
});

test("every page in a runtime segment mounts the runtime's page half", () => {
  for (const page of [...PAGES_PASSING_THE_URL, ...PAGES_STAYING_AMBIENT]) {
    const source = read(page);
    assert.match(
      source,
      /<TasksRuntimePageMount/,
      `${page} must mount the runtime so the flag-on tree still has chrome and providers`,
    );
    assert.doesNotMatch(
      source,
      /<TasksRuntimeShell/,
      `${page} must go through the flag branch, never mount the shell directly`,
    );
  }
});

test("only the pages whose content follows the URL hand the mount their searchParams", () => {
  for (const page of PAGES_PASSING_THE_URL) {
    assert.match(
      read(page),
      /<TasksRuntimePageMount searchParams=\{searchParams\}>/,
      `${page} is a surface whose content follows the URL's Project; the mount must receive its searchParams`,
    );
  }
  for (const page of PAGES_STAYING_AMBIENT) {
    assert.doesNotMatch(
      read(page),
      /<TasksRuntimePageMount searchParams/,
      `${page} resolves its content ambiently; handing only its chrome an explicit Project would let the URL and the content disagree (ADR 0001 §2)`,
    );
  }
});

test("Tasks refusals publish an unavailable context without reading an ambient runtime", () => {
  assert.match(tasksArrival, /<ActiveProjectRouteSync project=\{null\}/);
  assert.doesNotMatch(tasksArrival, /<TasksRuntimePageMount/);
  assert.match(tasksPage, /<TasksRuntimePageMount searchParams=\{searchParams\}>/);
  const myWork = read("src/app/app/my-tasks/page.tsx");
  assert.match(myWork, /resolveTasksArrival\(requested\)/);
  assert.match(myWork, /<TasksArrivalRefusal/);
  assert.match(myWork, /capabilities.manageProject/);
});

test("the shell records how the searchParams half of its allowlist condition is met", () => {
  // The allowlist entry was conditional, and this test used to pin the
  // recorded reason it was unmet: layouts receive no searchParams. WP6
  // (D-022) is the change that satisfies it, and this is the argument: the
  // mount moved into the page boundaries, flag-selected in
  // tasks-runtime-mount.tsx, so pages supply the URL's Project while the
  // flag-off tree keeps the layout mount byte-identical. The framework
  // constraint stays cited because it is why the layout half can never do
  // this itself.
  assert.match(shell, /LayoutProps/, "the framework constraint must be cited, not asserted");
  assert.match(shell, /layout\.tsx/);
  assert.match(
    shell,
    /tasks-runtime-mount\.tsx/,
    "the shell must name the mount module that now supplies requestedProjectId",
  );
});
