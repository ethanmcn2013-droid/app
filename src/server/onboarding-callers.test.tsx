import { before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { freshFileDb } from "./db/memory-test-db";
import { tasks, users, workspaceMembers, workspaces } from "./db/schema";

let completion: typeof import("./onboarding-completion");
before(async () => {
  process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
  process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
  completion = await import("./onboarding-completion");
});
function loadModule<T>(relative: string, boundaries: Record<string, unknown>): T {
  const source = readFileSync(new URL(relative, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const testModule = { exports: {} };
  const require = createRequire(import.meta.url);
  new Function("require", "module", "exports", compiled)((name: string) => name in boundaries ? boundaries[name] : require(name), testModule, testModule.exports);
  return testModule.exports as T;
}
async function fixture() {
  const f = await freshFileDb();
  await f.db.insert(users).values({ id: "owner", clerkId: "owner", name: "Owner", initials: "FX", color: "fixture" });
  for (const id of ["project-a", "project-b"]) {
    await f.db.insert(workspaces).values({ id, slug: id, name: id, ownerUserId: "owner" });
    await f.db.insert(workspaceMembers).values({ workspaceId: id, userId: "owner", role: "owner" });
  }
  const state = { actor: "owner", ambient: "project-b", ambientReads: 0, identityReads: 0, effects: 0, failInvalidation: false, demo: false, venue: false, contextual: false };
  const boundaries: Record<string, unknown> = {
    "@/server/db": { db: f.db },
    "@/server/auth": {
      getCurrentUser: async () => { state.identityReads++; return state.actor; },
      getActiveWorkspaceOrNull: async () => { state.ambientReads++; return state.ambient; },
    },
    "@/server/onboarding-completion": { ...completion, persistOnboardingSubmission: (input: Parameters<typeof completion.persistOnboardingSubmission>[0], actor: string) => completion.persistOnboardingSubmission(input, actor, { database: f.db }) },
    "next/cache": { revalidatePath: () => { state.effects++; if (state.failInvalidation) { state.failInvalidation = false; throw new Error("response failed after commit"); } } },
    "next/navigation": { redirect: (target: string) => { throw new Error(`redirect:${target}`); } },
    "@/server/events": { emitTasksChanged: () => { state.effects++; } },
    "@/lib/onboarding/analytics-server": { trackOnboardingEventServer: async () => { state.effects++; } },
    "@/lib/access-mode": { isDemoMode: () => state.demo },
    "./seed": { seedDomainAction: async () => { throw new Error("domain reset outside template fixture"); } },
    "@/server/db/ensure-user": { ensureUserProvisioned: async () => {} },
    "@/server/db/seed": { LEGACY_WORKSPACE_ID: "ws-legacy" },
    "@/server/actions/project-authz": loadModule<typeof import("./actions/project-authz")>("./actions/project-authz.ts", { "@/server/db": { db: f.db } }),
    "@/server/db/queries": { isFirstRun: async (workspaceId: string) => !(await f.db.select().from(workspaces).where(eq(workspaces.id, workspaceId)))[0]?.activeDomain },
    "@/server/db/venue-welcome": { detectVenueWelcome: async () => state.venue ? { sponsorSlug: "synthetic-venue", sponsorName: "Synthetic venue", code: "fixture" } : null },
    "@/lib/planning/flags": { resolvePlanningFeatureFlags: () => ({ contextualOnboarding: state.contextual }) },
    "@/components/welcome/onboarding-flow": { OnboardingFlow: () => null },
    "@/components/welcome/still-provisioning": { StillProvisioning: () => null },
  };
  return {
    ...f, state,
    actions: loadModule<typeof import("./actions/onboarding")>("./actions/onboarding.ts", boundaries),
    page: loadModule<typeof import("../app/welcome/page")>("../app/welcome/page.tsx", boundaries).default,
    count: async (workspaceId = "project-a") => (await f.db.select().from(tasks).where(eq(tasks.workspaceId, workspaceId))).length,
  };
}
const input = { workspaceId: "project-a", requestId: "caller-request-000001", primaryUseCase: "wedding" as const, seedMode: "starter" as const };

test("actual action retries a post-commit failure on its explicit Project despite another active cookie", async () => {
  const f = await fixture();
  try {
    f.state.failInvalidation = true;
    await assert.rejects(f.actions.completeOnboardingAction(input), /after commit/);
    assert.equal(await f.count(), 18);
    f.state.ambient = "missing-project";
    await f.actions.completeOnboardingAction(input);
    assert.equal(await f.count(), 18);
    assert.equal(await f.count("project-b"), 0);
    assert.equal(f.state.ambientReads, 0);
  } finally { f.cleanup(); }
});

test("settings caller retry reuses its request; an intentional new reseed adds a second set", async () => {
  const f = await fixture();
  try {
    const submission = { ...input, reseed: true };
    f.state.failInvalidation = true;
    await assert.rejects(f.actions.updateSegmentAction(submission));
    await f.actions.updateSegmentAction(submission);
    assert.equal(await f.count(), 18);
    await f.actions.updateSegmentAction({ ...submission, requestId: "new-settings-intent-001" });
    assert.equal(await f.count(), 36);
  } finally { f.cleanup(); }
});

test("actual action does not publish completion effects when the seed fails; preview refuses before identity", async () => {
  const f = await fixture();
  try {
    f.state.demo = true;
    await assert.rejects(f.actions.completeOnboardingAction(input), /preview/);
    assert.equal(f.state.identityReads, 0);
    f.state.demo = false;
    await f.client.execute("CREATE TRIGGER fail_seed BEFORE INSERT ON tasks BEGIN SELECT RAISE(ABORT, 'fixture seed failure'); END");
    await assert.rejects(f.actions.completeOnboardingAction(input));
    assert.equal(f.state.effects, 0);
    assert.equal(await f.count(), 0);
  } finally { f.cleanup(); }
});

test("welcome authorizes its explicit URL and passes that same Project to the form without ambient resolution", async () => {
  const f = await fixture();
  try {
    const view = await f.page({ searchParams: Promise.resolve({ workspaceId: "project-a" }) }) as ReactElement<{ workspaceId: string; actorUserId: string }>;
    assert.equal(view.props.workspaceId, "project-a");
    assert.equal(view.props.actorUserId, "owner");
    assert.equal(f.state.ambientReads, 0);
    assert.equal(await f.count(), 0);
    for (const workspaceId of ["missing", "", ["project-a", "project-b"]]) {
      const unavailable = await f.page({ searchParams: Promise.resolve({ workspaceId }) });
      assert.match(renderToStaticMarkup(unavailable), /That project isn’t available/);
    }
    await f.db.delete(workspaceMembers).where(eq(workspaceMembers.workspaceId, "project-a"));
    assert.match(renderToStaticMarkup(await f.page({ searchParams: Promise.resolve({ workspaceId: "project-a" }) })), /That project isn’t available/);
    assert.equal(f.state.ambientReads, 0);
  } finally { f.cleanup(); }
});

test("venue welcome rolls back failed metadata, offers retry, then seeds once and redirects with its Project", async () => {
  const f = await fixture();
  try {
    f.state.venue = true;
    await f.client.execute("CREATE TRIGGER fail_metadata BEFORE UPDATE OF onboarding_completed_at ON workspaces BEGIN SELECT RAISE(ABORT, 'fixture metadata failure'); END");
    const failed = await f.page({ searchParams: Promise.resolve({ workspaceId: "project-a" }) });
    assert.match(renderToStaticMarkup(failed), /Try again/);
    assert.equal(await f.count(), 0);
    await f.client.execute("DROP TRIGGER fail_metadata");
    await assert.rejects(f.page({ searchParams: Promise.resolve({ workspaceId: "project-a" }) }), /redirect:\/app\/tasks\?welcome=venue&v=synthetic-venue&workspaceId=project-a/);
    await assert.rejects(f.page({ searchParams: Promise.resolve({ workspaceId: "project-a" }) }), /redirect:\/app\/home\?workspaceId=project-a/);
    assert.equal(await f.count(), 18);
    assert.equal(await f.count("project-b"), 0);
  } finally { f.cleanup(); }
});

test("contextual welcome forwards the authorized Project without setting an active cookie", async () => {
  const f = await fixture();
  try {
    f.state.contextual = true;
    await assert.rejects(f.page({ searchParams: Promise.resolve({ workspaceId: "project-a", use: "wedding" }) }), /workspaceId=project-a/);
    assert.equal(f.state.ambientReads, 0);
    assert.equal(await f.count(), 0);
  } finally { f.cleanup(); }
});

test("existing starter action retains its Project on lost response and requires current metadata authority", async () => {
  const f = await fixture();
  try {
    await f.actions.completeOnboardingAction(input);
    f.state.failInvalidation = true;
    const confirmation = { workspaceId: "project-a", requestId: "existing-caller-0001" };
    await assert.rejects(f.actions.confirmExistingSetupAction(confirmation), /after commit/);
    await f.actions.confirmExistingSetupAction(confirmation);
    const [project] = await f.db.select().from(workspaces).where(eq(workspaces.id, "project-a"));
    assert.equal(project.activeDomain, "wedding");
    assert.equal(project.primaryUseCase, "wedding");
    assert.equal(await f.count(), 18);
    assert.equal(await f.count("project-b"), 0);
    assert.equal(f.state.ambientReads, 0);
    await f.db.insert(users).values({ id: "member", clerkId: "member", name: "Member", initials: "FX", color: "fixture" });
    await f.db.insert(workspaceMembers).values({ workspaceId: "project-a", userId: "member", role: "member" });
    f.state.actor = "member";
    await assert.rejects(f.actions.confirmExistingSetupAction(confirmation), /available/);
  } finally { f.cleanup(); }
});

test("non-venue /welcome?workspaceId=A with cookie B redirects completed onboarding into A", async () => {
  const f = await fixture();
  try {
    assert.equal(f.state.ambient, "project-b");
    assert.equal(f.state.venue, false);
    await f.db.update(workspaces).set({ activeDomain: "marketing", onboardingCompletedAt: new Date() }).where(eq(workspaces.id, "project-a"));
    await assert.rejects(f.page({ searchParams: Promise.resolve({ workspaceId: "project-a" }) }), /redirect:\/app\/home\?workspaceId=project-a$/);
    assert.equal(f.state.ambientReads, 0);
    assert.equal(await f.count("project-b"), 0);
    assert.equal((await f.db.select().from(workspaces).where(eq(workspaces.id, "project-b")))[0].onboardingCompletedAt, null);
  } finally { f.cleanup(); }
});

test("welcome lets a member open a completed Project but cannot seed or complete its first run", async () => {
  const f = await fixture();
  try {
    await f.db.insert(users).values({ id: "member", clerkId: "member", name: "Member", initials: "M", color: "fixture" });
    await f.db.insert(workspaceMembers).values({ workspaceId: "project-a", userId: "member", role: "member" });
    f.state.actor = "member";
    f.state.venue = true;
    assert.match(renderToStaticMarkup(await f.page({ searchParams: Promise.resolve({ workspaceId: "project-a" }) })), /project owner needs to finish setup/);
    assert.equal(await f.count(), 0);
    await assert.rejects(f.actions.completeOnboardingAction(input), /available/);
    await assert.rejects(f.actions.updateSegmentAction({ ...input, reseed: false }), /available/);
    await f.db.update(workspaces).set({ activeDomain: "wedding" }).where(eq(workspaces.id, "project-a"));
    await assert.rejects(f.page({ searchParams: Promise.resolve({ workspaceId: "project-a" }) }), /redirect:\/app\/home\?workspaceId=project-a/);
  } finally { f.cleanup(); }
});
