import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

export const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(import.meta.url);
/** Actual source, with explicit process/request/store boundaries only. Unknown
 * imports resolve to the real source; no writer is replaced with a success. */
export function sourceModule(file, adapters = {}) {
  const loaded = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(join(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const local = createRequire(join(root, file));
  new Function("require", "module", "exports", compiled)(name => {
    if (Object.hasOwn(adapters, name)) return adapters[name];
    return name.startsWith("@/") ? require(join(root, "src", name.slice(2))) : local(name);
  }, loaded, loaded.exports);
  return loaded.exports;
}

export async function recoveryFixture({ links = 2, publications = 2 } = {}) {
  process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
  process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw Error("No provider/network in project recovery fixtures"); };
  const { entitlementFixture } = await import("../../src/server/db/entitlements-test-db.ts");
  const schema = await import("../../src/server/db/schema.ts");
  const timelineSchema = await import("../../src/modules/timeline/server/db/timeline-schema.ts");
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const { eq, and } = await import("drizzle-orm");
  const local = await entitlementFixture();
  await local.local.client.execute("PRAGMA journal_mode=WAL");
  const directory = mkdtempSync(join(tmpdir(), "project-recovery-route-"));
  assert.equal(dirname(directory), resolve(tmpdir()));
  assert.ok(basename(directory).startsWith("project-recovery-route-"));
  const client = createClient({ url: pathToFileURL(join(directory, "timeline.db")).href });
  for (const file of ["0000_timeline_baseline.sql", "0001_suite_project_bindings.sql"])
    await client.executeMultiple(readFileSync(join(root, "drizzle-timeline", file), "utf8"));
  const timeline = drizzle(client, { schema: timelineSchema });
  for (const [id, clerkId] of [["member", "member-session"], ["co-owner", "co-owner-session"], ["outsider", "outsider-session"]])
    await local.local.db.insert(schema.users).values({ id, clerkId, handle: id, name: id, initials: "FX", color: "fixture" });
  for (const [userId, role] of [["member", "member"], ["co-owner", "owner"]])
    await local.local.db.insert(schema.workspaceMembers).values({ workspaceId: "project-b", userId, role });
  await local.local.db.update(schema.workspaces).set({ name: "Winter workshop", publishedAt: new Date() }).where(eq(schema.workspaces.id, "project-b"));
  await local.local.db.insert(schema.shareLinks).values({ token: "SECRET_OTHER_PROJECT", workspaceId: "project-a", view: "board" });
  for (let i = 0; i < links; i++) await local.local.db.insert(schema.shareLinks).values({
    token: "SECRET_B_" + i, tokenScheme: "plaintext", workspaceId: "project-b", view: "board", createdAt: new Date(1800000000000 + i * 1000),
  });
  await timeline.insert(timelineSchema.workspaces).values({ slug: "own-timeline", name: "PRIVATE_TIMELINE_NAME", ownerUserId: "buyer" });
  for (let i = 0; i < publications; i++) {
    await timeline.insert(timelineSchema.timelinePublications).values({
      id: "publication-" + i, workspaceSlug: "own-timeline", sourceWorkspaceId: "project-b",
      sourceDigest: "PRIVATE_DIGEST", label: "PRIVATE_PUBLICATION", audienceKind: "couple",
      timezone: "Europe/Dublin", state: "published", publishedAt: new Date(), createdAt: new Date(1800000000000 + i * 1000),
    });
    await timeline.insert(timelineSchema.audienceShares).values({
      id: "share-" + i, publicationId: "publication-" + i, tokenHash: "SECRET_TOKEN_HASH_" + i, state: "active", version: 1,
    });
  }
  const state = { actor: "buyer", demo: false, changes: [], authCalls: 0, fail: false, delay: 0,
    submitted: [], storageReads: 0, providerCalls: 0, ambientReads: 0 };
  const cache = { revalidatePath: (...args) => state.changes.push(args) };
  const authz = await import("../../src/server/actions/project-authz.ts");
  const projectService = sourceModule("src/server/projects/service.ts", {
    "@/server/db": { db: local.local.db },
    "next/cache": cache,
    "@/server/events": { emitTasksChanged() {} },
    "@/server/actions/project-authz": { ...authz, proveProjectCapability: (actor, project, capability, policy, executor) =>
      authz.proveProjectCapability(actor, project, capability, policy, executor ?? local.local.db) },
    "@/server/connections/project-drive-erasure-grants": { revokeExactDriveFolderGrant: async () => { state.providerCalls++; throw Error("Provider forbidden"); } },
  });
  const timelineRecovery = await import("../../src/modules/timeline/server/project-recovery.ts");
  const bridge = sourceModule("src/server/project-recovery.ts", {
    "@/server/db": { db: local.local.db }, "next/cache": cache,
    "@/server/projects/service": projectService,
    "@/modules/timeline/server/project-recovery": {
      readTimelineRecovery: (...args) => timelineRecovery.readTimelineRecoveryWith(timeline, ...args),
      withdrawTimelinePublication: (...args) => timelineRecovery.withdrawTimelinePublicationWith(timeline, ...args),
    },
  });
  const session = { auth: async () => { state.authCalls++; return { userId: state.actor }; } };
  const accessMode = { isDemoMode: () => state.demo };
  const action = sourceModule("src/app/settings/projects/[projectId]/recovery/actions.ts", {
    "@clerk/nextjs/server": session, "next/cache": cache, "@/lib/access-mode": accessMode,
    "@/server/project-recovery": {
      ...bridge,
      async runProjectRecovery(actor, form) {
        state.submitted.push(Object.fromEntries(form.entries()));
        if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
        if (state.fail) throw Error("PRIVATE_SQL_BEARER_DIAGNOSTIC");
        return bridge.runProjectRecovery(actor, form);
      },
    },
  }).projectRecoveryAction;
  const page = sourceModule("src/app/settings/projects/[projectId]/recovery/page.tsx", {
    "@clerk/nextjs/server": session, "@/lib/access-mode": accessMode,
    "next/navigation": { redirect: location => { const error = Error("REDIRECT"); error.location = location; throw error; } },
    "@/server/project-recovery": bridge, "./actions": { projectRecoveryAction: action },
    "@/components/settings/project-recovery": { ProjectRecoveryPanel: "actual-panel-boundary" },
  }).default;

  const bytes = "Synthetic project owner recovery bytes\n";
  const bytePath = join(directory, "owned.txt");
  writeFileSync(bytePath, bytes);
  await local.local.db.insert(schema.tasks).values({ id: "recovery-file-task", workspaceId: "project-a", title: "PRIVATE_TASK", lane: "todo", priority: "p2" });
  await local.local.db.insert(schema.attachments).values({
    id: "recovery-file", taskId: "recovery-file-task", workspaceId: "project-a", uploaderUserId: "buyer",
    filename: "workshop.txt", mimeType: "text/plain", sizeBytes: Buffer.byteLength(bytes), storedPath: bytePath,
  });
  const resolver = await import("../../src/server/projects/resolve.ts");
  const nativeRouteAuth = sourceModule("src/server/projects/route-authz.ts", {
    "@/server/auth": { getCurrentUser: async () => {
      const [actor] = await local.local.db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.clerkId, state.actor ?? ""));
      return actor?.id ?? "";
    } },
    "@/lib/access-mode": { isDemoMode: () => false },
    "@/server/projects/active-project-cookie": { readActiveProjectCookies: async () => {
      state.ambientReads++; return { unified: "project-b", legacy: "project-b" };
    } },
    "@/server/projects/request-scope": { resolveActiveProjectForRoute: input => resolver.resolveActiveProjectForRouteWith(local.local.db, input) },
  });
  const queries = sourceModule("src/server/db/queries.ts", { "@/server/db": { db: local.local.db }, "./index": { db: local.local.db }, "./": { db: local.local.db } });
  const attachment = sourceModule("src/app/api/attachments/[id]/route.ts", {
    "@/server/db/queries": queries,
    "@/server/projects/route-authz": nativeRouteAuth,
    "@/server/storage": { resolveStoredPath: async stored => { state.storageReads++; assert.equal(stored, bytePath); return { kind: "disk", absPath: bytePath }; },
      openBlobStream: async () => { state.providerCalls++; throw Error("Provider forbidden"); } },
  }).GET;
  return { ...local, timeline, timelineClient: client, schema, timelineSchema, state, action, page, bridge, projectService, attachment, bytes,
    pageProps: async (projectId = "project-b", searchParams = {}) => (await page({ params: Promise.resolve({ projectId }), searchParams: Promise.resolve(searchParams) })).props,
    form(operation, values = {}, projectId = "project-b") { const form = new FormData(); for (const [key, value] of Object.entries({ projectId, operation, ...values })) form.set(key, value); return form; },
    async removeMember(id = "buyer", projectId = "project-b") {
      await local.local.db.delete(schema.workspaceMembers).where(and(eq(schema.workspaceMembers.workspaceId, projectId), eq(schema.workspaceMembers.userId, id)));
    },
    close() { local.close(); client.close(); globalThis.fetch = originalFetch; try { rmSync(directory, { recursive: true }); } catch { /* retain owned synthetic temp on Windows */ } },
  };
}
