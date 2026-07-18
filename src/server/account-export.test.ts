/**
 * Account-export integration test · Signal Tasks. GDPR Art. 20 portability.
 *
 * Runs the REAL `exportAccountData` against a real in-memory libSQL DB built
 * from the prod migrations. Two tenants: the target owns ws-a; a bystander
 * owns ws-b where the target is a member and authored a comment. Asserts the
 * export captures the target's owned content + their footprint elsewhere,
 * never the bystander's owned content, and never an attachment's internal
 * `storedPath`.
 *
 * Run: node --import tsx --test src/server/account-export.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { exportAccountData } from "./account-export";
import { freshMemoryDb } from "./db/memory-test-db";

test("export captures owned content + footprint, scoped to the caller", async () => {
  const { client, db } = await freshMemoryDb();
  try {
    await client.executeMultiple(`
      INSERT INTO users (id, clerk_id, color, initials) VALUES
        ('u-target','clerk_target','#111','TT'),
        ('u-bystander','clerk_bystander','#222','BB');
      INSERT INTO workspaces (id, slug, name, owner_user_id) VALUES
        ('ws-a','ws-a','A','u-target'), ('ws-b','ws-b','B','u-bystander');
      INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
        ('ws-a','u-target','owner'), ('ws-b','u-bystander','owner'), ('ws-b','u-target','member');
      INSERT INTO tasks (
        id, workspace_id, title, lane, priority,
        source_note_id, source_note_extract_body, source_note_extract_sha256
      ) VALUES
        ('task-a1','ws-a','A task','todo','med',NULL,NULL,NULL),
        ('task-b1','ws-b','B task','todo','med','clerk_target:note-shared','Exact approved wording','${"a".repeat(64)}');
      UPDATE tasks
      SET description='PRIVATE WORKSPACE EDIT', external_contact_email='private@example.test', cents=9900
      WHERE id='task-b1';
      INSERT INTO comments (id, workspace_id, task_id, user_id, body) VALUES
        ('c-a1','ws-a','task-a1','u-target','mine in a'),
        ('c-binb','ws-b','task-b1','u-target','mine in b'),
        ('c-b1','ws-b','task-b1','u-bystander','theirs');
      INSERT INTO attachments (id, workspace_id, task_id, uploader_user_id, filename, stored_path, mime_type, size_bytes) VALUES
        ('att-a1','ws-a','task-a1','u-target','f.png','.data/uploads/SECRET-PATH.png','image/png',3);
      INSERT INTO notification_prefs (user_id) VALUES ('u-target');
      INSERT INTO user_preferences (user_id) VALUES ('u-target');
      INSERT INTO meta (key, value) VALUES ('board:ws-a:name','A board'), ('board:ws-b:name','B board');
    `);

    const data = await exportAccountData(db, "clerk_target");

    assert.equal(data.user?.id, "u-target");
    assert.ok(data.ownedWorkspaces, "expected ownedWorkspaces");

    // Owned content: ws-a only.
    assert.equal(data.ownedWorkspaces!.workspaces.length, 1);
    assert.equal(data.ownedWorkspaces!.workspaces[0]!.id, "ws-a");
    assert.equal(data.ownedWorkspaces!.tasks.length, 1);
    assert.equal(data.ownedWorkspaces!.tasks[0]!.id, "task-a1");
    assert.equal(data.ownedWorkspaces!.attachments.length, 1);
    assert.equal(data.ownedWorkspaces!.boardMeta.length, 1); // board:ws-a:* only

    // Footprint elsewhere: the comment the target authored in ws-b.
    assert.ok(
      data.footprintElsewhere!.authoredComments.some((c) => c.id === "c-binb"),
      "target's comment in another workspace missing from footprint",
    );
    assert.ok(data.footprintElsewhere!.notificationPrefs, "prefs missing");
    assert.equal(data.footprintElsewhere!.notesExtractTasks.length, 1);
    assert.equal(data.footprintElsewhere!.notesExtractTasks[0]!.id, "task-b1");
    assert.equal(
      data.footprintElsewhere!.notesExtractTasks[0]!.sourceNoteExtractBody,
      "Exact approved wording",
    );
    assert.equal(
      data.footprintElsewhere!.notesExtractTasks[0]!.sourceNoteExtractSha256,
      "a".repeat(64),
    );
    assert.equal(
      "title" in data.footprintElsewhere!.notesExtractTasks[0]!,
      false,
    );
    assert.equal(
      JSON.stringify(data.footprintElsewhere!.notesExtractTasks).includes(
        "PRIVATE WORKSPACE EDIT",
      ),
      false,
      "mutable content from another workspace leaked into the export",
    );
    assert.equal(
      JSON.stringify(data.footprintElsewhere!.notesExtractTasks).includes(
        "private@example.test",
      ),
      false,
      "private contact data from another workspace leaked into the export",
    );

    // The bystander's owned task must NOT be in owned content.
    assert.ok(
      !data.ownedWorkspaces!.tasks.some((t) => t.id === "task-b1"),
      "bystander's task leaked into owned export",
    );

    // The internal on-disk path must never appear in the export.
    assert.ok(
      !JSON.stringify(data).includes("SECRET-PATH"),
      "attachment storedPath leaked into the export",
    );
  } finally {
    client.close();
  }
});

test("export of an unprovisioned user returns a null user, not an error", async () => {
  const { client, db } = await freshMemoryDb();
  try {
    const data = await exportAccountData(db, "clerk_nobody");
    assert.equal(data.user, null);
  } finally {
    client.close();
  }
});
