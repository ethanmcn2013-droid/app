import { before, test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { freshFileDb } from "./db/memory-test-db";
import { meta, tasks, users, workspaceMembers, workspaces } from "./db/schema";
import type { OnboardingSubmission } from "./onboarding-completion";

let service: typeof import("./onboarding-completion");
before(async () => {
  process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
  process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
  service = await import("./onboarding-completion");
});
const input: OnboardingSubmission = { workspaceId: "project-a", requestId: "onboarding-request-0001", primaryUseCase: "wedding", secondaryContext: "wedding", seedMode: "starter" };
async function fixture() {
  const f = await freshFileDb();
  for (const id of ["owner", "stranger"]) await f.db.insert(users).values({ id, clerkId: id, name: id, initials: "FX", color: "fixture" });
  for (const id of ["project-a", "project-b"]) {
    const owner = id === "project-a" ? "owner" : "stranger";
    await f.db.insert(workspaces).values({ id, slug: id, name: id, ownerUserId: owner });
    await f.db.insert(workspaceMembers).values({ workspaceId: id, userId: owner, role: "owner" });
  }
  return {
    ...f,
    apply: (submission = input, actor = "owner") => service.persistOnboardingSubmission(submission, actor, { database: f.db }),
    rows: () => f.db.select().from(tasks).where(eq(tasks.workspaceId, "project-a")),
    workspace: async () => (await f.db.select().from(workspaces).where(eq(workspaces.id, "project-a")))[0],
  };
}

test("metadata failure rolls back seed and completion together; the same submission retries one 18-task seed", async () => {
  const f = await fixture();
  try {
    await f.client.execute("CREATE TRIGGER fail_completion BEFORE UPDATE OF onboarding_completed_at ON workspaces BEGIN SELECT RAISE(ABORT, 'fixture metadata failure'); END");
    await assert.rejects(f.apply(), (error: unknown) => String((error as Error).cause).includes("fixture metadata failure"));
    assert.equal((await f.rows()).length, 0);
    assert.equal((await f.workspace()).onboardingCompletedAt, null);
    assert.equal((await f.workspace()).activeDomain, null);
    await f.client.execute("DROP TRIGGER fail_completion");
    await f.apply();
    assert.equal((await f.rows()).length, 18);
    assert.equal((await f.rows()).filter(t => t.isMilestone).length, 6);
    assert.ok((await f.workspace()).onboardingCompletedAt);
    assert.equal((await f.workspace()).primaryUseCase, "wedding");
  } finally { f.cleanup(); }
});

test("seed failure cannot mark onboarding complete; the retained request retries successfully", async () => {
  const f = await fixture();
  try {
    await f.client.execute("CREATE TRIGGER fail_seed BEFORE INSERT ON tasks WHEN NEW.seq = 3 BEGIN SELECT RAISE(ABORT, 'fixture seed failure'); END");
    await assert.rejects(f.apply());
    assert.equal((await f.rows()).length, 0);
    assert.equal((await f.workspace()).onboardingCompletedAt, null);
    await f.client.execute("DROP TRIGGER fail_seed");
    await f.apply();
    assert.equal((await f.rows()).length, 18);
  } finally { f.cleanup(); }
});

test("replay preserves user edits and later metadata; deliberate settings requests remain additive", async () => {
  const f = await fixture();
  try {
    await f.apply();
    const [task] = await f.rows();
    await f.db.update(tasks).set({ title: "My edited task" }).where(eq(tasks.id, task.id));
    await f.db.update(workspaces).set({ secondaryContext: "Later choice" }).where(eq(workspaces.id, input.workspaceId));
    await f.apply();
    assert.equal((await f.workspace()).secondaryContext, "Later choice");
    assert.ok((await f.rows()).some(t => t.title === "My edited task"));
    await f.apply({ ...input, requestId: "settings-intent-00002" });
    assert.equal((await f.rows()).length, 36);
  } finally { f.cleanup(); }
});

test("one request cannot change segment, context or seed mode", async () => {
  const f = await fixture();
  try {
    await f.apply();
    for (const change of [{ primaryUseCase: "venue" }, { secondaryContext: "changed" }, { seedMode: "blank" }] as const) {
      await assert.rejects(f.apply({ ...input, ...change }), /previous setup/);
    }
    assert.equal((await f.rows()).length, 18);
  } finally { f.cleanup(); }
});

for (const denial of ["foreign", "removed", "archived", "account-erasure", "project-deletion"] as const) {
  test(`${denial} refuses seed and metadata, including a completed receipt replay`, async () => {
    const f = await fixture();
    try {
      await f.apply();
      if (denial === "removed") await f.db.delete(workspaceMembers).where(eq(workspaceMembers.workspaceId, input.workspaceId));
      if (denial === "archived") await f.db.update(workspaces).set({ archivedAt: new Date() }).where(eq(workspaces.id, input.workspaceId));
      if (denial === "account-erasure") await (await import("./account-deletion-lifecycle")).beginAccountDeletionWith(f.db, "owner");
      if (denial === "project-deletion") await f.client.execute(`INSERT INTO project_drive_operations (id, workspace_id, operation_kind, status, dedupe_key) VALUES ('delete-a', 'project-a', 'project_delete', 'pending', '${"a".repeat(64)}')`);
      await assert.rejects(f.apply(input, denial === "foreign" ? "stranger" : "owner"));
      await assert.rejects(f.apply({ ...input, requestId: "new-denied-request-0001" }, denial === "foreign" ? "stranger" : "owner"));
      assert.equal((await f.rows()).length, 18);
    } finally { f.cleanup(); }
  });
}

test("membership removed by an in-transaction seed side effect is re-proved before metadata and rolls everything back", async () => {
  const f = await fixture();
  try {
    await f.client.execute("CREATE TRIGGER revoke_during_seed AFTER INSERT ON tasks WHEN NEW.seq = 18 BEGIN DELETE FROM workspace_members WHERE workspace_id = 'project-a'; END");
    await assert.rejects(f.apply(), /available/);
    assert.equal((await f.rows()).length, 0);
    assert.equal((await f.workspace()).onboardingCompletedAt, null);
    assert.equal((await f.db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, input.workspaceId))).length, 1);
    await f.client.execute("DROP TRIGGER revoke_during_seed");
    await f.apply();
    assert.equal((await f.rows()).length, 18);
    assert.ok((await f.workspace()).onboardingCompletedAt);
  } finally { f.cleanup(); }
});

test("venue first-run identity is stable through metadata loss and scoped to Project and actor", async () => {
  const f = await fixture();
  try {
    const requestId = service.venueFirstRunRequestId(input.workspaceId, "owner");
    assert.equal(requestId, service.venueFirstRunRequestId(input.workspaceId, "owner"));
    assert.notEqual(requestId, service.venueFirstRunRequestId("project-b", "owner"));
    assert.notEqual(requestId, service.venueFirstRunRequestId(input.workspaceId, "stranger"));
    await f.apply({ ...input, requestId, primaryUseCase: "venue" });
    await f.apply({ ...input, requestId, primaryUseCase: "venue" });
    assert.equal((await f.rows()).length, 18);
  } finally { f.cleanup(); }
});

test("blank and metadata-only requests never seed and replay cannot overwrite a later choice", async () => {
  const f = await fixture();
  try {
    await f.apply({ ...input, seedMode: "blank" });
    await f.apply({ ...input, requestId: "settings-metadata-0001", seedMode: "metadata", primaryUseCase: "venue" });
    await f.apply({ ...input, seedMode: "blank" });
    assert.equal((await f.rows()).length, 0);
    assert.equal((await f.workspace()).primaryUseCase, "venue");
  } finally { f.cleanup(); }
});

test("task-editing members can apply a template but cannot change shared onboarding or settings metadata", async () => {
  const f = await fixture();
  try {
    await f.db.insert(workspaceMembers).values({ workspaceId: "project-a", userId: "stranger", role: "member" });
    for (const seedMode of ["starter", "blank", "metadata", "existing"] as const) {
      await assert.rejects(f.apply({ ...input, seedMode }, "stranger"), /available/);
    }
    assert.equal((await f.rows()).length, 0);
    assert.equal((await f.workspace()).primaryUseCase, null);
    assert.equal((await f.db.select().from(meta)).length, 0);
    await (await import("./db/apply-template")).applyTemplateToWorkspace("wedding-planning-workspace", "project-a", { requestId: "member-template-0001" }, { database: f.db, actorUserId: "stranger" });
    assert.equal((await f.rows()).length, 18);
    assert.equal((await f.workspace()).onboardingCompletedAt, null);
  } finally { f.cleanup(); }
});

test("existing starter confirmation rolls back failed completion and preserves its tasks and selected metadata", async () => {
  const f = await fixture();
  try {
    await f.apply();
    const before = await f.rows();
    await f.db.update(workspaces).set({ activeDomain: null, onboardingCompletedAt: null, secondaryContext: "Keep this choice" }).where(eq(workspaces.id, input.workspaceId));
    const confirmation = { ...input, requestId: "existing-setup-0001", primaryUseCase: "other" as const, seedMode: "existing" as const };
    await f.client.execute("CREATE TRIGGER fail_existing BEFORE UPDATE OF onboarding_completed_at ON workspaces BEGIN SELECT RAISE(ABORT, 'fixture confirmation failure'); END");
    await assert.rejects(f.apply(confirmation));
    assert.equal((await f.workspace()).activeDomain, null);
    assert.equal((await f.workspace()).onboardingCompletedAt, null);
    await f.client.execute("DROP TRIGGER fail_existing");
    await f.apply(confirmation);
    await f.apply(confirmation);
    const after = await f.workspace();
    assert.equal(after.primaryUseCase, "wedding");
    assert.equal(after.secondaryContext, "Keep this choice");
    assert.equal(after.templateId, "wedding-planning-workspace");
    assert.equal(after.activeDomain, "marketing");
    assert.ok(after.onboardingCompletedAt);
    assert.deepEqual(await f.rows(), before);
  } finally { f.cleanup(); }
});

test("ambiguous legacy domain reset is not repeated and cannot claim completed metadata", async () => {
  const f = await fixture();
  let calls = 0;
  try {
    const submission = { ...input, primaryUseCase: "student" as const };
    const dependencies = { database: f.db, seedDomain: async () => { calls++; throw new Error("reset response lost"); } };
    await assert.rejects(service.persistOnboardingSubmission(submission, "owner", dependencies), /response lost/);
    await assert.rejects(service.persistOnboardingSubmission(submission, "owner", dependencies), /Check your project/);
    assert.equal(calls, 1);
    assert.equal((await f.workspace()).onboardingCompletedAt, null);
    const receipt = (await f.db.select().from(meta)).find(row => row.key.includes(":onboarding-submission:"));
    const recovery = JSON.parse(receipt!.value);
    assert.equal(recovery.state, "domain-started");
    assert.equal(recovery.requestId, submission.requestId);
    assert.equal(recovery.actorUserId, "owner");
    assert.equal(recovery.submission.workspaceId, input.workspaceId);
    assert.equal(recovery.submission.primaryUseCase, "student");
  } finally { f.cleanup(); }
});

test("missing explicit Project or request fails before any receipt or task write", async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.apply({ ...input, requestId: undefined as never }));
    await assert.rejects(f.apply({ ...input, workspaceId: undefined as never }));
    assert.equal((await f.rows()).length, 0);
    assert.equal((await f.db.select().from(meta)).length, 0);
  } finally { f.cleanup(); }
});
