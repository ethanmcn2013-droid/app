import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ts = require("typescript");
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
const authSource = read("src/server/auth.ts");

function loadSourceWithMockedBoundaries(source, boundaries) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name) => {
      // Ordinary non-RSC calls remain fresh; render-guard-cache.test.mjs
      // exercises the installed React server dispatcher and Flight renderer.
      if (name === "react") return { cache: (work) => work };
      if (!Object.hasOwn(boundaries, name)) throw Error(`Unexpected fixture import ${name}`);
      return boundaries[name];
    }, loaded, loaded.exports,
  );
  return loaded.exports;
}

const loadRouteWithMockedBoundaries = (boundaries) => loadSourceWithMockedBoundaries(routeAuthz, boundaries);

test("actor-bearing resolver shares the freshly mapped actor with the exact authorized decision", async () => {
  let demo = false;
  let actor = "internal_a";
  let authCalls = 0;
  const seen = [];
  const ready = { id: "project-b", name: "B" };
  const route = loadRouteWithMockedBoundaries({
    "server-only": {}, "next/navigation": { redirect: () => { throw Error("redirect"); } },
    "@/lib/access-mode": { isDemoMode: () => demo },
    "@/lib/projects/project-ref": { assertProjectId: (value) => value, parseProjectId: (value) => value },
    "@/server/projects/capabilities": { projectCapabilities: () => ({}) },
    "@/server/auth": { getCurrentUser: async () => {
      authCalls++;
      if (actor === "rejected") throw Error("fresh identity rejected");
      return actor;
    } },
    "@/server/diagnostics/identity-timing": { withRouteResolverIdentityTiming: (work) => work() },
    "@/server/diagnostics/identity-outbound": { withIdentityOutboundScope: (_scope, work) => work() },
    "@/server/projects/active-project-cookie": { readActiveProjectCookies: async () => ({ unified: "project-a", legacy: null }) },
    "@/server/projects/request-scope": { resolveActiveProjectForRoute: async (scope) => {
      seen.push(scope);
      return { state: { kind: "ready", project: ready, source: "url" }, redirectTo: null };
    } },
    "@/server/demo/tasks-demo": { DEMO_USER_ID: "demo_actor", DEMO_WORKSPACE_ID: "demo_ws",
      DEMO_WORKSPACE_NAME: "Demo", DEMO_WORKSPACE_SLUG: "demo", demoTasks: () => [] },
  });
  const withActor = await route.resolveProjectForRouteWithActor("project-b");
  assert.equal(withActor.actorUserId, "internal_a");
  assert.equal(withActor.decision.kind, "ready");
  assert.equal(withActor.decision.workspaceId, "project-b");
  assert.deepEqual(seen[0], { actorUserId: "internal_a", requestedWorkspaceId: "project-b",
    cookieWorkspaceId: "project-a", legacyCookieWorkspaceId: null });
  assert.equal(authCalls, 1);
  actor = "internal_b";
  const publicDecision = await route.resolveProjectForRoute("project-b");
  assert.equal(publicDecision.kind, "ready");
  assert.equal(Object.hasOwn(publicDecision, "actorUserId"), false);
  assert.equal(seen[1].actorUserId, "internal_b");
  assert.equal(authCalls, 2);
  actor = "rejected";
  await assert.rejects(route.resolveProjectForRouteWithActor("project-b"), /fresh identity rejected/);
  assert.equal(seen.length, 2, "an identity failure cannot authorize or read a project");
  demo = true;
  const demoResult = await route.resolveProjectForRouteWithActor("demo_ws");
  assert.equal(demoResult.actorUserId, "demo_actor");
  assert.equal(demoResult.decision.workspaceId, "demo_ws");
  assert.equal(authCalls, 3);
  assert.equal(seen.length, 2);
});

test("route actor is the mapped persisted user, not the Clerk subject, and provisioning stays in the fresh proof", async () => {
  const oldSecret = process.env.CLERK_SECRET_KEY;
  const oldPublic = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  process.env.CLERK_SECRET_KEY = "synthetic-secret";
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "synthetic-public";
  let provisionCalls = 0;
  const scopes = [];
  try {
    const auth = loadSourceWithMockedBoundaries(authSource, {
      "server-only": {}, "next/headers": { cookies: async () => ({ get: () => undefined }) },
      "@clerk/nextjs/server": { auth: async () => ({ userId: "clerk_subject" }), currentUser: async () => null },
      "drizzle-orm": { eq: (_column, value) => value, and: (...values) => values },
      "@/server/db": { db: { select: () => ({ from: () => ({ where: async () => [{ id: "mapped_internal" }] }) }) } },
      "@/server/db/schema": { users: { id: "users.id", clerkId: "users.clerkId" }, workspaceMembers: {} },
      "@/server/db/seed": { LEGACY_WORKSPACE_ID: "legacy" },
      "@/server/db/ensure-user": { ensureUserProvisioned: async () => { provisionCalls++; } },
      "@/lib/access-mode": { isDemoMode: () => false },
      "@/server/projects/catalog": { firstMembershipByCatalogOrder: async () => null },
      "@/server/demo/tasks-demo": { DEMO_USER_ID: "demo_user", DEMO_WORKSPACE_ID: "demo_ws" },
      "@/server/diagnostics/identity-timing": { beginIdentityTiming: () => ({ measure: (_name, work) => work(), finish() {} }) },
      "@/server/diagnostics/identity-outbound": { observeCurrentUserOutbound: (work) => work() },
      "@/server/projects/member-workspaces": { demoMemberWorkspaces: () => [], listMyWorkspacesForUser: async () => [] },
    });
    const route = loadRouteWithMockedBoundaries({
      "server-only": {}, "next/navigation": { redirect: () => { throw Error("redirect"); } },
      "@/lib/access-mode": { isDemoMode: () => false },
      "@/lib/projects/project-ref": { assertProjectId: (value) => value, parseProjectId: (value) => value },
      "@/server/projects/capabilities": { projectCapabilities: () => ({}) },
      "@/server/auth": { getCurrentUser: auth.getCurrentUser },
      "@/server/diagnostics/identity-timing": { withRouteResolverIdentityTiming: (work) => work() },
      "@/server/diagnostics/identity-outbound": { withIdentityOutboundScope: (_scope, work) => work() },
      "@/server/projects/active-project-cookie": { readActiveProjectCookies: async () => ({ unified: null, legacy: null }) },
      "@/server/projects/request-scope": { resolveActiveProjectForRoute: async (scope) => {
        scopes.push(scope);
        return { state: { kind: "ready", project: { id: "project-b", name: "B" }, source: "url" }, redirectTo: null };
      } },
      "@/server/demo/tasks-demo": { DEMO_USER_ID: "demo_user", DEMO_WORKSPACE_ID: "demo_ws",
        DEMO_WORKSPACE_NAME: "Demo", DEMO_WORKSPACE_SLUG: "demo", demoTasks: () => [] },
    });
    const result = await route.resolveProjectForRouteWithActor("project-b");
    assert.equal(result.actorUserId, "mapped_internal");
    assert.equal(scopes[0].actorUserId, "mapped_internal");
    assert.notEqual(result.actorUserId, "clerk_subject");
    assert.equal(provisionCalls, 1);
  } finally {
    if (oldSecret === undefined) delete process.env.CLERK_SECRET_KEY; else process.env.CLERK_SECRET_KEY = oldSecret;
    if (oldPublic === undefined) delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = oldPublic;
  }
});

const PRINT_PAGES = ["board", "list", "calendar"].map((view) => [
  view,
  read(`src/app/print/${view}/page.tsx`),
]);
// The Schedule view is retired; its print address only forwards to the
// board print, which runs the gate. It reads nothing itself.
const retiredTimelinePrint = read("src/app/print/timeline/page.tsx");

test("the retired timeline print reads no tasks and forwards to the gated board print", () => {
  assert.doesNotMatch(retiredTimelinePrint, /getTasks\(|getWorkspaceName\(|getActiveWorkspace\s*\(/);
  assert.match(retiredTimelinePrint, /redirect\(/);
  assert.match(retiredTimelinePrint, /\/print\/board/);
});

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
  assert.match(tasksArrival, /await resolveProjectForRouteWithActor\(requested\)/);
  assert.match(tasksArrival, /return \{ kind: "ready" as const, project, actorUserId \}/);
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
  assert.match(body.slice(welcomeAt), /if \(isDemoMode\(\)\)[\s\S]*const me = arrival\.actorUserId/);
  assert.doesNotMatch(body, /getCurrentUser\s*\(/, "the page reuses only its freshly resolved server actor");
});

/* ── Defect 5 · the runtime shell ───────────────────────────────────────── */

test("the shell fails closed and prefers an explicit Project", () => {
  assert.match(shell, /requestedProjectId/, "the explicit seam must exist");
  const body = shell.slice(shell.indexOf("export async function TasksRuntimeShell"));
  assert.match(
    body,
    /resolveProjectForRouteWithActor\(\s*parseProjectId\(requestedProjectId\) \?\? undefined,?\s*\)/,
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
 * may pass it: the three Tasks views and My Tasks render from the runtime's
 * providers, Your Work is user-scoped, and the project overview verifies its
 * data against the explicit Project itself.
 */
const PAGES_PASSING_THE_URL = [
  "src/app/app/archived/page.tsx",
  "src/app/app/my-tasks/page.tsx",
  "src/app/app/project/page.tsx",
  "src/app/app/tasks/calendar/page.tsx",
  "src/app/app/tasks/list/page.tsx",
  "src/app/app/tasks/page.tsx",
];

/**
 * These pages resolve their content ambiently (`requireRouteProjectId`), so their mounts must never
 * claim an explicit Project: chrome naming B over content resolved as A is
 * the inequality ADR 0001 §2 calls a release blocker. None of these is a
 * `PROJECT_DESTINATION_SURFACES` entry, so the switcher never emits a
 * `workspaceId` at them. An entry may move to the passing list only when its
 * content reads take the same explicit Project.
 */
const PAGES_STAYING_AMBIENT = [
  "src/app/app/import/page.tsx",
  "src/app/app/inbox/page.tsx",
  "src/app/app/settings/page.tsx",
];
const OBJECT_PROJECT_PAGES = ["src/app/app/task/[id]/page.tsx"];

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
  for (const page of [...PAGES_PASSING_THE_URL, ...PAGES_STAYING_AMBIENT, ...OBJECT_PROJECT_PAGES]) {
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

test("archived object and archive destination keep content and runtime on the proven project", () => {
  assert.match(taskResolver, /kind: "archived", workspaceId: proven, task: detail.task/);
  assert.match(taskPage, /const \{ task, workspaceId \} = decision/);
  assert.match(taskPage, /const searchParams = Promise.resolve\(\{ workspaceId \}\)/);
  assert.match(taskPage, /<TasksRuntimePageMount searchParams=\{searchParams\} snapshotRequestedProjectId=\{snapshotRequestedProjectId\}>/);
  const archive = read("src/app/app/archived/page.tsx");
  assert.match(archive, /resolveTasksArrival\(requested\)/);
  assert.match(archive, /getArchivedTasks\(arrival.project.workspaceId\)/);
  assert.doesNotMatch(archive, /requireRouteProjectId/);
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
