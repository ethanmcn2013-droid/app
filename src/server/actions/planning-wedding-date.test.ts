import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { before, test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { eq } from "drizzle-orm";
import { freshFileDb } from "../db/memory-test-db";
import { compCodes, entitlements, planningPeriods, users, workspaceMembers, workspaces } from "../db/schema";
import { resolvePlanningFeatureFlags } from "@/lib/planning/flags";

const require = createRequire(import.meta.url);
const root = process.cwd();
// Counterfactual mode executes immutable original caller/helper source against
// these same negative assertions. It must fail before the retirement patch.
const sourceRef = process.env.PLANNING_DATE_SOURCE_REF;
const now = new Date("2026-09-04T12:00:00Z");
const sponsor = JSON.stringify({ source_type: "venue_edition", sponsor_slug: "synthetic", sponsor_name: "Synthetic venue" });
before(() => {
  process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
  process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
});

async function fixture(flags = { planningPeriods: true, contextualOnboarding: true }) {
  const f = await freshFileDb();
  for (const id of ["actor", "other"]) await f.db.insert(users).values({ id, clerkId: id, initials: "FX", color: "fixture" });
  await f.db.insert(planningPeriods).values({ id: "period", ownerUserId: "actor", name: "Our wedding", contextType: "wedding_season", startDate: "2029-01-01", endDate: "2029-12-31", timezone: "UTC" });
  await f.db.insert(workspaces).values([
    { id: "old-project", slug: "old-project", name: "Old wedding", ownerUserId: "other", contextType: "wedding", primaryDate: "2027-06-01" },
    { id: "existing", slug: "existing", name: "Existing", ownerUserId: "actor", planningPeriodId: "period", contextType: "wedding", primaryDate: "2028-06-01" },
  ]);
  // Actor deliberately has no membership of old-project.
  await f.db.insert(workspaceMembers).values({ workspaceId: "existing", userId: "actor", role: "owner" });
  await f.db.insert(compCodes).values({ code: "OLD", tier: "wedding", durationDays: 548, quantity: 2, redeemed: 2, notes: sponsor });
  const common = { workspaceId: "old-project", userId: "actor", tier: "wedding" as const, source: "comp" as const, startedAt: now, expiresAt: new Date("2028-03-05T12:00:00Z"), notes: "comp:OLD" };
  await f.db.insert(entitlements).values([
    { ...common, id: "old-active" }, { ...common, id: "old-revoked", expiresAt: new Date(0) },
    { ...common, id: "personal-comp", workspaceId: null },
    { ...common, id: "event-purchase", tier: "event", source: "purchase", notes: "purchase:independent" },
    { ...common, id: "personal-purchase", workspaceId: null, tier: "workspace", source: "purchase", notes: "purchase:personal" },
  ]);
  const env = { NODE_ENV: "production", SIGNAL_PLANNING_PERIODS_ENABLED: String(flags.planningPeriods), SIGNAL_CONTEXTUAL_ONBOARDING_ENABLED: String(flags.contextualOnboarding) };
  const cookies: unknown[] = [], analytics: unknown[] = [], capturedErrors: unknown[] = [];
  const cache = new Map<string, Record<string, unknown>>();
  function load(file: string): Record<string, unknown> {
    if (cache.has(file)) return cache.get(file)!;
    const original = sourceRef && ["src/server/actions/planning.ts", "src/server/db/couple-access-term.ts"].includes(file);
    const source = original ? execFileSync("git", ["show", `${sourceRef}:${file}`], { cwd: root, encoding: "utf8" }) : readFileSync(resolve(root, file), "utf8");
    const exports: Record<string, unknown> = {}; cache.set(file, exports);
    const boundaries: Record<string, unknown> = {
      "server-only": {},
      "@/server/db": { db: f.db },
      "@/server/auth": { getCurrentUser: async () => "actor", ACTIVE_WORKSPACE_COOKIE_NAME: "tasks_active_ws" },
      "next/headers": { cookies: async () => ({ set: (...args: unknown[]) => cookies.push(args), get: () => undefined }) },
      "next/cache": { revalidatePath: () => {} },
      "@sentry/nextjs": { captureException: (error: unknown) => capturedErrors.push(error) },
      "@/server/planning/analytics-server": { trackPlanningEvent: async (...args: unknown[]) => { analytics.push(args); } },
      "@/lib/planning/flags": { resolvePlanningFeatureFlags: () => resolvePlanningFeatureFlags(env) },
      "@/server/db/venue-welcome": { detectVenueWelcomeForLegacyPlanning: async () => ({ sponsorSlug: "synthetic", sponsorName: "Synthetic venue", code: "OLD" }) },
    };
    const injectedModules: Record<string, string> = {
      "@/server/planning/authorization": "src/server/planning/authorization.ts",
      "@/server/planning/flags": "src/server/planning/flags.ts",
      "@/server/db/couple-access-term": "src/server/db/couple-access-term.ts",
    };
    const actualImports = new Set(["node:crypto", "drizzle-orm", "./schema", "@/server/db/schema", "@/server/planning/security-boundary", "@/server/projects/service", "@/lib/planning/input", "@/lib/planning/context", "@/lib/planning/dates", "@/lib/venue-access-term", "@/lib/access-mode"]);
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, { exports, Date, process: { env }, require: (id: string) => {
      if (Object.hasOwn(boundaries, id)) return boundaries[id];
      if (Object.hasOwn(injectedModules, id)) return load(injectedModules[id]);
      assert.ok(actualImports.has(id), `Unexpected caller fixture import ${id}`);
      return require(id === "./schema" ? resolve(root, "src/server/db/schema.ts") : id.startsWith("@/") ? resolve(root, "src", id.slice(2)) : id);
    } });
    return exports;
  }
  const actions = load("src/server/actions/planning.ts") as unknown as typeof import("./planning");
  return { ...f, actions, cookies, analytics, capturedErrors };
}
const bulk = { planningPeriodId: "period", names: ["New wedding"], contextType: "wedding" as const, primaryDate: "2029-06-01", primaryDateLabel: "Wedding date" };
const complete = { name: "New wedding period", contextType: "wedding_season" as const, startDate: "2029-01-01", endDate: "2029-12-31", timezone: "UTC", workspaceNames: ["New wedding"], workspaceContext: "wedding" as const, primaryDate: "2029-06-01", primaryDateLabel: "Wedding date" };

for (const path of ["bulk", "all-skipped", "contextual", "contextual-with-sponsor"] as const) {
  test(`${path} creation preserves every existing grant and old Project date, including revoked/departed/null-scope grants`, async () => {
    const f = await fixture(); try {
      const before = await f.db.select().from(entitlements);
      const oldProjects = await f.db.select().from(workspaces);
      const ids = path === "bulk" || path === "all-skipped"
        ? (await f.actions.bulkCreateWorkspacesAction({ ...bulk, names: path === "all-skipped" ? ["Existing"] : bulk.names })).created.map(row => row.id)
        : (await f.actions.completeContextualOnboardingAction({ ...complete, ...(path === "contextual-with-sponsor" ? { sponsor: { id: "synthetic", consentGranted: true } } : {}) })).workspaceIds;
      assert.deepEqual(await f.db.select().from(entitlements), before, "Project creation must not extend or rebind existing grants");
      assert.equal(ids.length, path === "all-skipped" ? 0 : 1);
      for (const old of oldProjects) assert.deepEqual((await f.db.select().from(workspaces).where(eq(workspaces.id, old.id)))[0], old);
      for (const id of ids) {
        const [created] = await f.db.select().from(workspaces).where(eq(workspaces.id, id));
        assert.equal(created.primaryDate, "2029-06-01"); assert.equal(created.primaryDateLabel, "Wedding date");
        assert.equal((await f.db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, id)))[0].userId, "actor");
      }
      assert.deepEqual(f.capturedErrors, []);
    } finally { f.cleanup(); }
  });
}

for (const primaryDate of ["2029-06-01", null]) {
  test(`new Project redemption reads its own ${primaryDate ?? "unknown"} date and preserves all older grants`, async () => {
    const f = await fixture(); try {
      const before = await f.db.select().from(entitlements);
      const { created } = await f.actions.bulkCreateWorkspacesAction({ ...bulk, primaryDate });
      await f.db.insert(compCodes).values({ code: "NEW", tier: "wedding", durationDays: 548, quantity: 1, notes: sponsor });
      const { claimCompEntitlement } = await import("../db/comp-redemption");
      const result = await claimCompEntitlement(f.db, { code: "NEW", actorUserId: "actor", candidateProjectId: created[0].id, now });
      assert.ok(result.ok); if (!result.ok) return;
      assert.equal(result.entitlement.workspaceId, created[0].id);
      assert.equal(result.entitlement.expiresAt!.toISOString(), primaryDate ? "2029-08-30T00:00:00.000Z" : "2028-03-05T12:00:00.000Z");
      const oldIds = new Set(before.map(row => row.id));
      assert.deepEqual((await f.db.select().from(entitlements)).filter(row => oldIds.has(row.id)), before);
    } finally { f.cleanup(); }
  });
}

test("existing missing-date validation and independently disabled flags do not create Projects or touch grants", async () => {
  const enabled = await fixture(); try {
    const before = await enabled.db.select().from(entitlements);
    await assert.rejects(() => enabled.actions.completeContextualOnboardingAction({ ...complete, primaryDate: null }), /Add the wedding date/);
    assert.deepEqual(await enabled.db.select().from(entitlements), before);
  } finally { enabled.cleanup(); }
  for (const disabled of ["planningPeriods", "contextualOnboarding"] as const) {
    const f = await fixture({ planningPeriods: disabled !== "planningPeriods", contextualOnboarding: disabled !== "contextualOnboarding" }); try {
      const before = await f.db.select().from(entitlements);
      await assert.rejects(() => disabled === "planningPeriods" ? f.actions.bulkCreateWorkspacesAction(bulk) : f.actions.completeContextualOnboardingAction(complete), /not enabled/);
      assert.deepEqual(await f.db.select().from(entitlements), before);
      assert.equal((await f.db.select().from(workspaces)).length, 2);
    } finally { f.cleanup(); }
  }
  const production = resolvePlanningFeatureFlags({ NODE_ENV: "production" });
  assert.equal(production.planningPeriods, false); assert.equal(production.contextualOnboarding, false);
});
