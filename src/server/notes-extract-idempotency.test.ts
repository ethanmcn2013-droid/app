import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";

import { freshMemoryDb } from "./db/memory-test-db";
import { tasks } from "./db/schema";
import {
  approvedBodySha256,
  classifyNotesExtractReplay,
  validateExactApprovedBody,
} from "./notes-extract-idempotency";
import { insertOrReadNotesExtractTask } from "./notes-extract-store";

test("approved Notes wording is preserved exactly and fingerprinted by UTF-8 bytes", () => {
  const body = "  Confirm the linen count by Friday.  \n";
  assert.equal(validateExactApprovedBody(body), body);
  assert.equal(approvedBodySha256(body).length, 64);
  assert.notEqual(approvedBodySha256(body), approvedBodySha256(body.trim()));
  assert.throws(() => validateExactApprovedBody(" \n\t "), /Missing required field/);
  assert.throws(() => validateExactApprovedBody("x".repeat(281)), /280/);
});

test("replay identity fails closed for legacy, workspace, hash, and exact-body mismatches", () => {
  const body = "  Call Maeve before Friday.  ";
  const bodySha256 = approvedBodySha256(body);
  const exact = {
    id: "task-1",
    workspaceId: "ws-1",
    sourceNoteExtractBody: body,
    sourceNoteExtractSha256: bodySha256,
  };

  assert.deepEqual(
    classifyNotesExtractReplay(exact, { workspaceId: "ws-1", body, bodySha256 }),
    { kind: "match" },
  );
  assert.deepEqual(
    classifyNotesExtractReplay(exact, { workspaceId: "ws-2", body, bodySha256 }),
    { kind: "workspace-mismatch" },
  );
  assert.deepEqual(
    classifyNotesExtractReplay(
      { ...exact, sourceNoteExtractBody: null, sourceNoteExtractSha256: null },
      { workspaceId: "ws-1", body, bodySha256 },
    ),
    { kind: "legacy-unverifiable" },
  );
  assert.deepEqual(
    classifyNotesExtractReplay(exact, {
      workspaceId: "ws-1",
      body: `${body} `,
      bodySha256: approvedBodySha256(`${body} `),
    }),
    { kind: "body-mismatch" },
  );
  assert.deepEqual(
    classifyNotesExtractReplay(
      { ...exact, sourceNoteExtractSha256: "0".repeat(64) },
      { workspaceId: "ws-1", body, bodySha256 },
    ),
    { kind: "body-mismatch" },
  );
});

test("concurrent Notes inserts converge on one exact canonical task", async () => {
  const { client, db } = await freshMemoryDb();
  try {
    await client.executeMultiple(`
      INSERT INTO users (id, clerk_id, color, initials)
        VALUES ('notes-user', 'clerk-notes', 'black', 'NU');
      INSERT INTO workspaces (id, slug, name, owner_user_id)
        VALUES ('ws-notes', 'notes-space', 'Notes space', 'notes-user');
      INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES ('ws-notes', 'notes-user', 'owner');
    `);

    const sourceNoteId = "notes-user:note-exact-1";
    const body = "  Confirm the exact headcount.  ";
    const bodySha256 = approvedBodySha256(body);
    const values = (id: string, position: number) => ({
      id,
      workspaceId: "ws-notes",
      title: "Confirm the exact headcount.",
      lane: "todo" as const,
      priority: "p2" as const,
      assignees: [],
      position,
      sourceNoteId,
      sourceNoteExtractBody: body,
      sourceNoteExtractSha256: bodySha256,
    });

    const [first, second] = await Promise.all([
      insertOrReadNotesExtractTask(db, {
        sourceNoteId,
        values: values("task-race-a", 1),
      }),
      insertOrReadNotesExtractTask(db, {
        sourceNoteId,
        values: values("task-race-b", 2),
      }),
    ]);

    assert.deepEqual(
      [first.created, second.created].sort(),
      [false, true],
    );
    assert.equal(first.task.id, second.task.id);
    assert.equal(first.task.sourceNoteExtractBody, body);
    assert.equal(first.task.sourceNoteExtractSha256, bodySha256);

    const rows = await db
      .select({
        id: tasks.id,
        body: tasks.sourceNoteExtractBody,
        sha256: tasks.sourceNoteExtractSha256,
      })
      .from(tasks)
      .where(eq(tasks.sourceNoteId, sourceNoteId));
    assert.deepEqual(rows, [{
      id: first.task.id,
      body,
      sha256: bodySha256,
    }]);
  } finally {
    client.close();
  }
});
