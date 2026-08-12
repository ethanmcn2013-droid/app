import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

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
  const resolveAt = body.indexOf("resolveProjectForRoute(sp.workspaceId)");
  const renderAt = body.indexOf("<HybridWorkspace");
  assert(resolveAt > 0, "the carried Project must actually be consumed");
  assert(resolveAt < renderAt, "it must be resolved before the board renders");
  assert.match(body, /return <ProjectUnavailable \/>/);
  assert.match(body, /return <ProjectMismatch/);
});

test("the venue-welcome demo guard still precedes every production boundary", () => {
  // The WP3 change inserted a branch above the venue block; the demo fixture
  // must still resolve before auth and entitlement access.
  const body = tasksPage.slice(tasksPage.indexOf("export default async function TasksPage"));
  const mismatchGuard = body.indexOf("!isDemoMode()");
  const welcomeAt = body.indexOf('sp.welcome === "venue"');
  assert(mismatchGuard > 0, "the Project branch must be skipped in demo mode");
  assert(mismatchGuard < welcomeAt, "and it must not run ahead of the venue fixture");
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

test("the shell records why the searchParams half of its allowlist condition is unmet", () => {
  // The allowlist entry is conditional. If a later change claims to satisfy
  // it, this test is where the claim has to be argued.
  assert.match(shell, /LayoutProps/, "the framework constraint must be cited, not asserted");
  assert.match(shell, /layout\.tsx/);
});
