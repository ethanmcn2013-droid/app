import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "./db/timeline-schema";
import { readTimelineRecoveryWith, withdrawTimelinePublicationWith } from "./project-recovery";

async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "timeline-project-recovery-"));
  assert.equal(dirname(directory), resolve(tmpdir()));
  assert.ok(basename(directory).startsWith("timeline-project-recovery-"));
  const client = createClient({ url: pathToFileURL(join(directory, "fixture.db")).href });
  for (const file of ["0000_timeline_baseline.sql", "0001_suite_project_bindings.sql"]) await client.executeMultiple(readFileSync(new URL(`../../../../drizzle-timeline/${file}`, import.meta.url), "utf8"));
  const db = drizzle(client, { schema });
  for (const [slug, owner] of [["local", "timeline-owner"], ["foreign", "other-owner"]]) await db.insert(schema.workspaces).values({ slug, name: "PRIVATE_WORKSPACE_LABEL", ownerUserId: owner });
  return { db, client, close() { client.close(); try { rmSync(directory, { recursive: true }); } catch { /* retain synthetic fixture if Windows still holds it */ } } };
}

async function publication(f: Awaited<ReturnType<typeof fixture>>, id: string, source = "project-a", workspace = "local") {
  await f.db.insert(schema.timelinePublications).values({ id, workspaceSlug: workspace, sourceWorkspaceId: source, sourceDigest: "PRIVATE_SOURCE_DIGEST", label: "PRIVATE_PUBLICATION_LABEL", audienceKind: "couple", timezone: "Europe/Dublin", state: "published", publishedAt: new Date() });
  await f.db.insert(schema.timelinePublicationItems).values({ publicId: "item-" + id, publicationId: id, title: "PRIVATE_FROZEN_BODY", calendarDate: "2027-01-21", state: "now", sortOrder: 0, sourceRelation: "PRIVATE_RELATION", sourceDigest: "PRIVATE_ITEM_DIGEST", publishedAt: new Date() });
  for (const state of ["active", "expired", "rotated"] as const) await f.db.insert(schema.audienceShares).values({ id: `${id}-${state}`, publicationId: id, tokenHash: `PRIVATE_TOKEN_HASH_${id}_${state}`, state, version: 1 });
}

test("bounded exact-source projection reaches older publications without any frozen content or token projection", async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 25; i++) await publication(f, `own-${i}`);
    await publication(f, "same-owner-other-source", "project-b");
    await publication(f, "other-owner", "project-a", "foreign");
    const first = await readTimelineRecoveryWith(f.db, "timeline-owner", "project-a");
    if (first.kind !== "ready") throw Error("Expected local ownership");
    assert.equal(first.publications.items.length, 20);
    assert.ok(first.publications.next);
    const second = await readTimelineRecoveryWith(f.db, "timeline-owner", "project-a", first.publications.next!);
    if (second.kind !== "ready") throw Error("Expected second page");
    assert.equal(second.publications.items.length, 5);
    assert.equal(second.publications.next, null);
    const all = [...first.publications.items, ...second.publications.items];
    assert.equal(new Set(all.map(item => item.id)).size, 25);
    for (const item of all) assert.deepEqual(Object.keys(item).sort(), ["createdAt", "id", "state"]);
    assert.doesNotMatch(JSON.stringify(all), /PRIVATE_|other-owner|other-source/);
    assert.equal(await withdrawTimelinePublicationWith(f.db, "timeline-owner", "project-a", "own-0", "revoke"), true);
    assert.equal((await f.db.select().from(schema.audienceShares).where(eq(schema.audienceShares.id, "own-0-active")))[0].state, "revoked");
  } finally { f.close(); }
});

test("negative local-owner authority does not require Tasks membership, current binding, shared entitlements or content tables", async () => {
  const f = await fixture();
  try {
    await publication(f, "historical");
    await f.db.update(schema.workspaces).set({ suiteWorkspaceId: "project-b" }).where(eq(schema.workspaces.slug, "local"));
    await f.client.execute("DROP TABLE tasks");
    const read = await readTimelineRecoveryWith(f.db, "timeline-owner", "project-a");
    assert.equal(read.kind, "ready");
    assert.equal(await withdrawTimelinePublicationWith(f.db, "timeline-owner", "project-a", "historical", "unpublish"), true);
    const [row] = await f.db.select().from(schema.timelinePublications).where(eq(schema.timelinePublications.id, "historical"));
    const [item] = await f.db.select().from(schema.timelinePublicationItems).where(eq(schema.timelinePublicationItems.publicationId, "historical"));
    assert.equal(row.state, "unpublished");
    assert.ok(item.unpublishedAt);
    assert.equal(item.title, "PRIVATE_FROZEN_BODY");
  } finally { f.close(); }
});

test("all active versions revoke together without changing expired/rotated or another exact publication", async () => {
  const f = await fixture();
  try {
    await publication(f, "chosen"); await publication(f, "sibling");
    for (let i = 0; i < 25; i++) await f.db.insert(schema.audienceShares).values({ id: `old-version-${i}`, publicationId: "chosen", tokenHash: `OLD_HASH_${i}`, state: "active", version: i + 2 });
    assert.equal(await withdrawTimelinePublicationWith(f.db, "timeline-owner", "project-a", "chosen", "revoke"), true);
    const rows = await f.db.select().from(schema.audienceShares).where(eq(schema.audienceShares.publicationId, "chosen"));
    assert.equal(rows.filter(row => row.state === "revoked").length, 26);
    assert.equal(rows.filter(row => row.state === "expired").length, 1);
    assert.equal(rows.filter(row => row.state === "rotated").length, 1);
    assert.equal((await f.db.select().from(schema.audienceShares).where(eq(schema.audienceShares.id, "sibling-active")))[0].state, "active");
    assert.equal((await f.db.select().from(schema.timelinePublications).where(eq(schema.timelinePublications.id, "chosen")))[0].state, "published");
  } finally { f.close(); }
});

test("wrong source, wrong account, changed local owner, deleted workspace and malformed operation refuse", async () => {
  const f = await fixture();
  try {
    await publication(f, "chosen");
    for (const [actor, project, id] of [["other-owner", "project-a", "chosen"], ["timeline-owner", "project-b", "chosen"], ["timeline-owner", "project-a", "missing"], ["timeline-owner", " bad ", "chosen"]]) {
      assert.equal(await withdrawTimelinePublicationWith(f.db, actor, project, id, "revoke"), false);
    }
    assert.equal(await withdrawTimelinePublicationWith(f.db, "timeline-owner", "project-a", "chosen", "publish" as "revoke"), false);
    await f.db.update(schema.workspaces).set({ ownerUserId: "new-owner" }).where(eq(schema.workspaces.slug, "local"));
    assert.deepEqual(await readTimelineRecoveryWith(f.db, "timeline-owner", "project-a"), { kind: "unavailable" });
    assert.equal(await withdrawTimelinePublicationWith(f.db, "timeline-owner", "project-a", "chosen", "unpublish"), false);
    await f.db.delete(schema.workspaces).where(eq(schema.workspaces.slug, "local"));
    assert.equal(await withdrawTimelinePublicationWith(f.db, "new-owner", "project-a", "chosen", "unpublish"), false);
    assert.equal((await f.db.select().from(schema.timelinePublications).where(eq(schema.timelinePublications.id, "chosen")))[0].state, "published");
  } finally { f.close(); }
});

test("partial unpublish failure rolls back publication, items and share metadata; retry commits all three", async () => {
  const f = await fixture();
  try {
    await publication(f, "chosen");
    await f.client.executeMultiple("CREATE TRIGGER fail_recovery_revoke BEFORE UPDATE ON audience_shares BEGIN SELECT RAISE(ABORT, 'SYNTHETIC_PRIVATE_FAILURE'); END;");
    await assert.rejects(withdrawTimelinePublicationWith(f.db, "timeline-owner", "project-a", "chosen", "unpublish"));
    assert.equal((await f.db.select().from(schema.timelinePublications).where(eq(schema.timelinePublications.id, "chosen")))[0].state, "published");
    assert.equal((await f.db.select().from(schema.timelinePublicationItems).where(eq(schema.timelinePublicationItems.publicationId, "chosen")))[0].unpublishedAt, null);
    await f.client.execute("DROP TRIGGER fail_recovery_revoke");
    assert.equal(await withdrawTimelinePublicationWith(f.db, "timeline-owner", "project-a", "chosen", "unpublish"), true);
    assert.equal((await f.db.select().from(schema.audienceShares).where(eq(schema.audienceShares.id, "chosen-active")))[0].state, "revoked");
  } finally { f.close(); }
});

test("concurrent repeated withdrawal cannot restore publication or token authority", async () => {
  const f = await fixture();
  try {
    await publication(f, "chosen");
    assert.deepEqual(await Promise.all(["revoke", "unpublish"].map(operation => withdrawTimelinePublicationWith(f.db, "timeline-owner", "project-a", "chosen", operation as "revoke" | "unpublish"))), [true, true]);
    const before = (await f.db.select().from(schema.audienceShares).where(eq(schema.audienceShares.id, "chosen-active")))[0];
    assert.equal(await withdrawTimelinePublicationWith(f.db, "timeline-owner", "project-a", "chosen", "revoke"), true);
    assert.equal((await f.db.select().from(schema.audienceShares).where(eq(schema.audienceShares.id, "chosen-active")))[0].revokedAt?.getTime(), before.revokedAt?.getTime());
    assert.equal((await f.db.select().from(schema.timelinePublications).where(eq(schema.timelinePublications.id, "chosen")))[0].state, "unpublished");
  } finally { f.close(); }
});
