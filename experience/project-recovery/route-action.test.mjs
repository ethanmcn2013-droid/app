import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { recoveryFixture, sourceModule } from "./fixture.mjs";
const { ACTIVE_PROJECT_V3_FLAG, isActiveProjectV3Enabled } = sourceModule("src/lib/projects/flags.ts");

async function storedSnapshot(client) {
  const tables = (await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).rows.map(row => row.name);
  return Promise.all(tables.map(async table => [table, (await client.execute('SELECT * FROM "' + table.replaceAll('"', '""') + '"')).rows]));
}

for (const flag of ["0", "1"]) test("actual route/action explicit B ignores ambient A with context flag " + flag, async () => {
  process.env[ACTIVE_PROJECT_V3_FLAG] = flag;
  assert.equal(isActiveProjectV3Enabled(), flag === "1");
  const f = await recoveryFixture({ links: 25, publications: 25 });
  try {
    const before = await storedSnapshot(f.local.client);
    const first = await f.pageProps();
    assert.equal(first.recovery.tasks.project.id, "project-b");
    assert.equal(first.recovery.tasks.links.items.length, 20);
    assert.equal(first.recovery.timeline.publications.items.length, 20);
    assert.deepEqual(await storedSnapshot(f.local.client), before);
    assert.doesNotMatch(JSON.stringify(first.recovery), /SECRET_|PRIVATE_|project-a/);
    const next = await f.pageProps("project-b", { links: String(first.recovery.tasks.links.next), publications: String(first.recovery.timeline.publications.next), files: ["1", "2"] });
    assert.equal(next.recovery.tasks.links.items.length, 5);
    assert.equal(next.recovery.timeline.publications.items.length, 5);
    assert.equal(next.cursor.files, undefined);
    const link = next.recovery.tasks.links.items.at(-1);
    assert.deepEqual(await f.action(f.form("revoke-task-link", { row: String(link.row), fingerprint: link.fingerprint })), { ok: true });
    assert.deepEqual(await f.action(f.form("unpublish-timeline", { publicationId: "publication-0" })), { ok: true });
    assert.ok((await f.local.db.select().from(f.schema.shareLinks).where(eq(f.schema.shareLinks.token, "SECRET_B_0")))[0].revokedAt);
    assert.equal((await f.local.db.select().from(f.schema.shareLinks).where(eq(f.schema.shareLinks.token, "SECRET_OTHER_PROJECT")))[0].revokedAt, null);
    assert.equal((await f.timeline.select().from(f.timelineSchema.timelinePublications).where(eq(f.timelineSchema.timelinePublications.id, "publication-0")))[0].state, "unpublished");
    assert.ok(f.state.changes.some(([path]) => path === "/s/[token]"));
    assert.equal(f.state.ambientReads, 0);
  } finally { f.close(); }
});

test("actual demo and unauthenticated route/action never read or mutate stores", async () => {
  const f = await recoveryFixture();
  try {
    f.state.demo = true;
    const page = await f.pageProps();
    assert.equal(page.preview, true);
    assert.equal((await f.action(f.form("delete-project", { confirmation: "Winter workshop" }))).ok, false);
    assert.equal(f.state.authCalls, 0); assert.equal(f.state.submitted.length, 0);
    f.state.demo = false; f.state.actor = null;
    await assert.rejects(f.pageProps(), error => error.location === "/sign-in?redirect_url=%2Fsettings%2Fprojects%2Fproject-b%2Frecovery");
    assert.equal((await f.action(f.form("unpublish-board"))).ok, false);
    assert.equal(f.state.submitted.length, 0);
  } finally { f.close(); }
});

test("removed, wrong account, malformed and positive operations refuse; no cached UI authority", async () => {
  const f = await recoveryFixture();
  try {
    const initial = await f.pageProps();
    const link = initial.recovery.tasks.links.items[0];
    const form = f.form("revoke-task-link", { row: String(link.row), fingerprint: link.fingerprint });
    await f.removeMember();
    assert.equal((await f.action(form)).ok, false);
    assert.equal((await f.pageProps()).recovery.tasks.kind, "unavailable");
    f.state.actor = "outsider-session";
    assert.equal((await f.action(form)).ok, false);
    assert.equal((await f.pageProps()).recovery.timeline.kind, "unavailable");
    for (const project of [" bad ", "missing", "https://invalid.test"]) assert.equal((await f.pageProps(project)).recovery.tasks.kind, "unavailable");
    for (const operation of ["publish", "mint", "rotate", "restore"]) assert.equal((await f.action(f.form(operation))).ok, false);
    assert.equal((await f.action({ projectId: "project-b" })).ok, false);
    const file = f.form("unpublish-board"); file.set("projectId", new Blob(["project-b"]));
    assert.equal((await f.action(file)).ok, false);
    assert.equal(f.state.changes.length, 0);
  } finally { f.close(); }
});

test("Tasks store failure preserves local Timeline-only owner withdrawal and hides raw diagnostics", async () => {
  const f = await recoveryFixture();
  try {
    await f.local.client.execute("DROP TABLE share_links");
    const page = await f.pageProps();
    assert.equal(page.recovery.tasks.kind, "unavailable");
    assert.equal(page.recovery.timeline.kind, "ready");
    assert.deepEqual(await f.action(f.form("revoke-timeline", { publicationId: "publication-0" })), { ok: true });
    f.state.fail = true;
    const failed = await f.action(f.form("unpublish-timeline", { publicationId: "publication-1" }));
    assert.equal(failed.ok, false);
    assert.doesNotMatch(JSON.stringify(failed), /PRIVATE_|SQL|BEARER/);
    f.state.fail = false;
    assert.deepEqual(await f.action(f.form("unpublish-timeline", { publicationId: "publication-1" })), { ok: true });
  } finally { f.close(); }
});

test("actual primary-owner deletion service commits exact project; co-owner/member and wrong confirmation refuse", async () => {
  const f = await recoveryFixture();
  try {
    for (const actor of ["member-session", "co-owner-session"]) {
      f.state.actor = actor;
      assert.equal((await f.action(f.form("delete-project", { confirmation: "Winter workshop" }))).ok, false);
    }
    f.state.actor = "buyer";
    assert.equal((await f.action(f.form("delete-project", { confirmation: "wrong" }))).ok, false);
    assert.deepEqual(await f.action(f.form("delete-project", { confirmation: "Winter workshop" })), { ok: true, deleted: true });
    assert.equal((await f.local.db.select().from(f.schema.workspaces).where(eq(f.schema.workspaces.id, "project-b"))).length, 0);
    assert.equal((await f.local.db.select().from(f.schema.workspaces).where(eq(f.schema.workspaces.id, "project-a"))).length, 1);
    const page = await f.pageProps();
    assert.equal(page.recovery.tasks.kind, "unavailable");
    assert.equal(page.recovery.timeline.kind, "ready");
    assert.deepEqual(await f.action(f.form("unpublish-timeline", { publicationId: "publication-0" })), { ok: true });
    assert.equal(f.state.providerCalls, 0);
    assert.equal((await f.action(f.form("delete-project", { confirmation: "Winter workshop" }))).ok, false);
  } finally { f.close(); }
});

test("failed actual deletion retains project and generic failure; existing in-progress fence refuses premature retry", async () => {
  const f = await recoveryFixture();
  try {
    await f.local.client.executeMultiple("CREATE TRIGGER fail_recovery_delete BEFORE DELETE ON workspaces BEGIN SELECT RAISE(ABORT,'PRIVATE_SQL_BEARER'); END;");
    const result = await f.action(f.form("delete-project", { confirmation: "Winter workshop" }));
    assert.equal(result.ok, false);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|SQL|BEARER/);
    assert.equal((await f.local.db.select().from(f.schema.workspaces).where(eq(f.schema.workspaces.id, "project-b"))).length, 1);
    await f.local.client.execute("DROP TRIGGER fail_recovery_delete");
    // The existing service retains its lease after a failed final DB commit.
    // Do not pretend immediate retry succeeds or override that lifecycle here.
    assert.equal((await f.pageProps()).recovery.tasks.deletionPending, true);
    await new Promise(resolve => setTimeout(resolve, 1200));
    const retry = await f.action(f.form("delete-project", { confirmation: "Winter workshop" }));
    assert.equal(retry.ok, false);
    assert.doesNotMatch(JSON.stringify(retry), /PRIVATE_|SQL|BEARER/);
    assert.equal((await f.pageProps()).recovery.tasks.deletionPending, true);
    assert.equal((await f.local.db.select().from(f.schema.workspaces).where(eq(f.schema.workspaces.id, "project-b"))).length, 1);
  } finally { f.close(); }
});

test("actual native HTTP owner bytes on archived A with ambient B; fresh removal refuses before opening", async () => {
  const f = await recoveryFixture();
  try {
    await f.local.db.update(f.schema.workspaces).set({ archivedAt: new Date() }).where(eq(f.schema.workspaces.id, "project-a"));
    const call = () => f.attachment(new Request("http://fixture.invalid/api/attachments/recovery-file"), { params: Promise.resolve({ id: "recovery-file" }) });
    const response = await call();
    assert.equal(response.status, 200);
    assert.equal(await response.text(), f.bytes);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(f.state.storageReads, 1);
    await f.removeMember("buyer", "project-a");
    assert.equal((await call()).status, 404);
    f.state.actor = "outsider-session";
    assert.equal((await call()).status, 404);
    assert.equal(f.state.storageReads, 1); assert.equal(f.state.providerCalls, 0);
  } finally { f.close(); }
});

test("fresh primary-owner transfer removes delete/file controls without changing Timeline's independent owner", async () => {
  const f = await recoveryFixture();
  try {
    await f.local.db.update(f.schema.workspaces).set({ ownerUserId: "co-owner" }).where(eq(f.schema.workspaces.id, "project-b"));
    const props = await f.pageProps();
    assert.equal(props.recovery.tasks.canDelete, false);
    assert.equal(props.recovery.timeline.kind, "ready");
    assert.equal((await f.action(f.form("delete-project", { confirmation: "Winter workshop" }))).ok, false);
    f.state.actor = "co-owner-session";
    const incoming = await f.pageProps();
    assert.equal(incoming.recovery.tasks.canDelete, true);
    assert.equal(incoming.recovery.timeline.kind, "unavailable");
    assert.equal((await f.action(f.form("unpublish-timeline", { publicationId: "publication-0" }))).ok, false);
  } finally { f.close(); }
});
