import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// The default React entry does not install an RSC cache dispatcher. Run this
// bounded fixture under the installed react-server condition and the installed
// Flight renderer so separate renders really have separate Request caches.
if (process.env.SIGNAL_RENDER_CACHE_CHILD !== "1") {
  test("render guards share only within an actual React server request", () => {
    const result = spawnSync(process.execPath, ["--conditions=react-server", fileURLToPath(import.meta.url)], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, SIGNAL_RENDER_CACHE_CHILD: "1" },
      timeout: 30_000,
    });
    assert.equal(result.status, 0, `RSC lifecycle fixture failed:\n${result.stderr}\n${result.stdout}`);
    assert.match(result.stdout, /render guard lifecycle passed/);
  });
} else {
  const require = createRequire(import.meta.url);
  const React = require("react");
  const { renderToReadableStream } = require("next/dist/compiled/react-server-dom-webpack/server.node");
  const ts = require("typescript");
  const routePath = fileURLToPath(new URL("./route-authz.ts", import.meta.url));
  const gatePath = fileURLToPath(new URL("../app-access.ts", import.meta.url));
  const actionsPath = fileURLToPath(new URL("../actions/tasks.ts", import.meta.url));
  const authPath = fileURLToPath(new URL("../auth.ts", import.meta.url));

  function load(path, boundaries) {
    const source = readFileSync(path, "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: path,
    }).outputText;
    const loaded = { exports: {} };
    new Function("require", "module", "exports", compiled)((name) => {
      if (name === "react") return React;
      if (!Object.hasOwn(boundaries, name)) throw Error(`Unexpected fixture import ${name}`);
      return boundaries[name];
    }, loaded, loaded.exports);
    return loaded.exports;
  }

  async function render(work) {
    let result;
    const unhandled = [];
    const Component = async () => {
      result = await work();
      return "rendered";
    };
    const stream = renderToReadableStream(React.createElement(Component), {}, {
      onError: (error) => { unhandled.push(error); return "fixture-render-error"; },
    });
    await new Response(stream).text();
    assert.deepEqual(unhandled, [], `unhandled React server render error: ${String(unhandled[0])}`);
    return result;
  }

  const state = {
    actor: "mapped-a", cookie: "project-a", demo: false, identityError: null,
    actorQueue: [], cookieQueue: [],
    profile: { id: "clerk-a", primaryEmailAddressId: "email", emailAddresses: [{ id: "email", emailAddress: "member@example.invalid" }] },
    member: true, profileError: null,
  };
  const counts = { identity: 0, cookies: 0, resolver: 0, profile: 0, membership: 0, gateFinish: 0 };
  const redirectError = new Error("redirect to waitlist");
  const parseProjectId = (value) => typeof value === "string" && /^[a-z0-9-]+$/.test(value) ? value : null;
  const project = (id) => ({ id, name: id });

  const route = load(routePath, {
    "server-only": {}, "next/navigation": { redirect: () => { throw Error("redirect"); } },
    "@/lib/access-mode": { isDemoMode: () => state.demo },
    "@/lib/projects/project-ref": { assertProjectId: (id) => id, parseProjectId },
    "@/server/projects/capabilities": { projectCapabilities: () => ({}) },
    "@/server/auth": { getCurrentUser: async () => {
      counts.identity++;
      if (state.identityError) throw state.identityError;
      return state.actorQueue.length ? state.actorQueue.shift() : state.actor;
    } },
    "@/server/diagnostics/identity-timing": { withRouteResolverIdentityTiming: (work) => work() },
    "@/server/diagnostics/identity-outbound": { withIdentityOutboundScope: (_scope, work) => work() },
    "@/server/projects/active-project-cookie": { readActiveProjectCookies: async () => {
      counts.cookies++;
      return { unified: state.cookieQueue.length ? state.cookieQueue.shift() : state.cookie, legacy: null };
    } },
    "@/server/projects/request-scope": { resolveActiveProjectForRoute: async (input) => {
      counts.resolver++;
      const raw = input.requestedWorkspaceId;
      if (raw !== undefined && !parseProjectId(raw)) return { state: { kind: "unavailable" }, redirectTo: null };
      const id = raw ?? input.cookieWorkspaceId;
      if (!id) return { state: { kind: "empty" }, redirectTo: null };
      if (id === "denied") return { state: { kind: "unavailable" }, redirectTo: null };
      if (id === "archived") return { state: { kind: "archived", project: project(id) }, redirectTo: null };
      return { state: { kind: "ready", project: project(id), source: raw ? "url" : "fallback" }, redirectTo: null };
    } },
    "@/server/demo/tasks-demo": { DEMO_USER_ID: "demo", DEMO_WORKSPACE_ID: "demo-ws", DEMO_WORKSPACE_NAME: "Demo",
      DEMO_WORKSPACE_SLUG: "demo", demoTasks: () => [] },
  });

  const gate = load(gatePath, {
    "server-only": {}, "@clerk/nextjs/server": { currentUser: async () => {
      counts.profile++;
      if (state.profileError) throw state.profileError;
      return state.profile;
    } },
    "next/navigation": { redirect: () => { throw redirectError; } },
    "drizzle-orm": { eq: (...args) => args },
    "@/lib/access-allowlist": { isEmailAllowed: (email) => email === "founder@example.invalid" },
    "@/lib/access-mode": { isProductionMode: () => !state.demo },
    "@/server/db": { db: { select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ limit: async () => {
      counts.membership++;
      return state.member ? [{ workspaceId: "private" }] : [];
    } }) }) }) }) } },
    "@/server/db/schema": { users: { id: "id", clerkId: "clerkId" }, workspaceMembers: { workspaceId: "workspaceId", userId: "userId" } },
    "@/server/diagnostics/identity-timing": { beginAppGateTiming: () => ({ measure: (_stage, work) => work(), finish: () => { counts.gateFinish++; } }) },
  });

  const before = () => ({ ...counts });
  let mark = before();
  const shared = await render(async () => Promise.all([
    route.resolveProjectForRouteWithActor("project-b"), route.resolveProjectForRouteWithActor("project-b"),
  ]));
  assert.equal(shared[0].actorUserId, "mapped-a");
  assert.equal(shared[0].decision.workspaceId, "project-b");
  assert.deepEqual(shared[0], shared[1]);
  assert.deepEqual([counts.identity - mark.identity, counts.cookies - mark.cookies, counts.resolver - mark.resolver], [1, 1, 1]);

  mark = before();
  const distinct = await render(async () => Promise.all([
    route.resolveProjectForRouteWithActor("project-a"), route.resolveProjectForRouteWithActor("project-b"),
  ]));
  assert.deepEqual(distinct.map((value) => value.decision.workspaceId), ["project-a", "project-b"]);
  assert.deepEqual([counts.identity - mark.identity, counts.cookies - mark.cookies], [2, 2]);

  // Two overlapping Flight requests have independent cache maps, even when
  // they use the same key and module instance.
  state.actorQueue = ["mapped-overlap-a", "mapped-overlap-b"];
  state.cookieQueue = ["project-a", "project-b"];
  mark = before();
  const overlap = await Promise.all([
    render(() => route.resolveProjectForRouteWithActor(undefined)),
    render(() => route.resolveProjectForRouteWithActor(undefined)),
  ]);
  assert.deepEqual(new Set(overlap.map((value) => value.actorUserId)),
    new Set(["mapped-overlap-a", "mapped-overlap-b"]));
  assert.deepEqual(new Set(overlap.map((value) => value.decision.workspaceId)),
    new Set(["project-a", "project-b"]));
  assert.deepEqual([counts.identity - mark.identity, counts.cookies - mark.cookies], [2, 2]);

  mark = before();
  const shapes = await render(async () => Promise.all([
    route.resolveProjectForRouteWithActor(undefined), route.resolveProjectForRouteWithActor(null),
    route.resolveProjectForRouteWithActor(""), route.resolveProjectForRouteWithActor(" bad "),
    route.resolveProjectForRouteWithActor([]), route.resolveProjectForRouteWithActor(["project-b"]),
    route.resolveProjectForRouteWithActor(["project-a", "project-b"]),
  ]));
  assert.deepEqual(shapes.map((value) => value.decision.kind),
    ["ready", "ready", "ready", "unavailable", "unavailable", "unavailable", "unavailable"]);
  assert(shapes.slice(0, 3).every((value) => value.decision.workspaceId === "project-a"));
  assert.deepEqual([counts.identity - mark.identity, counts.resolver - mark.resolver], [2, 2]);

  // The flag-off selection compares explicit B to ambient A; those keys must
  // never collapse into one authorized Project.
  mark = before();
  const selection = await render(async () => [
    await route.resolveProjectForRouteWithActor("project-b"),
    await route.resolveProjectForRouteWithActor(undefined),
  ]);
  assert.deepEqual(selection.map((value) => value.decision.workspaceId), ["project-b", "project-a"]);
  assert.equal(counts.identity - mark.identity, 2);

  // The decision-only API serves the active-Project Server Action. It must
  // reauthenticate even if this exact Project was proved earlier in the same
  // Flight request (the no-render case below is a separate boundary).
  mark = before();
  const freshWithinRender = await render(async () => {
    const first = await route.resolveProjectForRouteWithActor("project-b");
    state.actor = "mapped-action-fresh";
    const second = await route.resolveProjectForRoute("project-b");
    return { first: first.actorUserId, second: second.workspaceId };
  });
  assert.equal(freshWithinRender.first, "mapped-a");
  assert.equal(freshWithinRender.second, "project-b");
  assert.equal(counts.identity - mark.identity, 2);
  state.actor = "mapped-a";

  const archived = await render(() => route.resolveProjectForRouteWithActor("archived"));
  assert.equal(archived.decision.kind, "archived");
  const denied = await render(() => route.resolveProjectForRouteWithActor("denied"));
  assert.deepEqual(denied.decision, { kind: "unavailable" });

  mark = before();
  const gates = await render(async () => {
    await gate.requireAppAccessTasks("layout");
    await gate.requireAppAccessTasks("tasksShell");
    return "admitted";
  });
  assert.equal(gates, "admitted");
  assert.deepEqual([counts.profile - mark.profile, counts.membership - mark.membership, counts.gateFinish - mark.gateFinish], [1, 2, 2]);

  mark = before();
  const revoked = await render(async () => {
    await gate.requireAppAccessTasks("layout");
    state.member = false;
    return assert.rejects(gate.requireAppAccessTasks("tasksShell"), (error) => error === redirectError);
  });
  assert.equal(revoked, undefined);
  assert.deepEqual([counts.profile - mark.profile, counts.membership - mark.membership, counts.gateFinish - mark.gateFinish], [1, 2, 2]);
  state.member = true;

  // The generic decision API is also called by openTasksProjectAction. It is
  // explicitly uncached even when an RSC proof ran earlier, and fresh cookie
  // values are visible in the next render.
  const actionSource = readFileSync(fileURLToPath(new URL("../actions/tasks-project-arrival.ts", import.meta.url)), "utf8");
  assert.match(actionSource, /await resolveProjectForRoute\(id\)/);
  mark = before();
  await route.resolveProjectForRoute("project-a");
  state.actor = "mapped-b";
  state.cookie = "project-b";
  const freshAction = await route.resolveProjectForRoute("project-b");
  assert.equal(freshAction.workspaceId, "project-b");
  assert.equal(counts.identity - mark.identity, 2);
  const afterCookie = await render(() => route.resolveProjectForRouteWithActor(undefined));
  assert.equal(afterCookie.actorUserId, "mapped-b");
  assert.equal(afterCookie.decision.workspaceId, "project-b");

  state.identityError = new Error("deleted account");
  mark = before();
  const rejected = await render(async () => Promise.allSettled([
    route.resolveProjectForRouteWithActor("project-b"), route.resolveProjectForRouteWithActor("project-b"),
  ]));
  assert(rejected.every((result) => result.status === "rejected" && result.reason === state.identityError));
  assert.deepEqual([counts.identity - mark.identity, counts.cookies - mark.cookies], [1, 0]);
  state.identityError = null;
  const afterDeletionRecovery = await render(() => route.resolveProjectForRouteWithActor("project-b"));
  assert.equal(afterDeletionRecovery.actorUserId, "mapped-b");

  state.profileError = new Error("Clerk profile failed");
  mark = before();
  const failedGates = await render(async () => Promise.allSettled([
    gate.requireAppAccessTasks("layout"), gate.requireAppAccessTasks("tasksShell"),
  ]));
  assert(failedGates.every((result) => result.status === "rejected" && result.reason === state.profileError));
  assert.deepEqual([counts.profile - mark.profile, counts.membership - mark.membership, counts.gateFinish - mark.gateFinish], [1, 0, 2]);
  state.profileError = null;
  await render(() => gate.requireAppAccessTasks("layout"));

  state.demo = true;
  mark = before();
  const demo = await render(async () => {
    await gate.requireAppAccessTasks("layout");
    return route.resolveProjectForRouteWithActor("project-b");
  });
  assert.equal(demo.actorUserId, "demo");
  assert.deepEqual([counts.identity - mark.identity, counts.profile - mark.profile, counts.membership - mark.membership], [0, 0, 0]);

  // No render cache is ever imported into the mutation identity or writer.
  assert.doesNotMatch(readFileSync(authPath, "utf8"), /\b(?:cache|unstable_cache)\s*\(/);
  assert.doesNotMatch(readFileSync(actionsPath, "utf8"), /\b(?:cache|unstable_cache)\s*\(/);
  assert.match(readFileSync(actionsPath, "utf8"), /getCurrentUser\(\)/);
  console.log("render guard lifecycle passed");
}
