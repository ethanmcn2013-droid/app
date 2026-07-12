import { test } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { freshMemoryDb } from "./db/memory-test-db";
import { workspaceMembers, workspaces } from "./db/schema";
import {
  listCurrentMemberWorkspaceNamesInPeriod,
  requireWorkspaceOwnerWith,
  workspaceOwnerMembershipCondition,
} from "./planning/security-boundary";
import { resolveNotesExtractAccess } from "./notes-extract-access";

test("removed workspaces neither appear in bulk-name collisions nor accept owner writes", async () => {
  const { client, db } = await freshMemoryDb();
  try {
    await client.executeMultiple(`
      INSERT INTO users (id, clerk_id, color, initials) VALUES
        ('owner-a', 'clerk-a', 'black', 'OA'),
        ('owner-b', 'clerk-b', 'gray', 'OB');
      INSERT INTO planning_periods
        (id, owner_user_id, name, context_type, start_date, end_date, timezone, position)
      VALUES
        ('period-a', 'owner-a', '2026', 'general', '2026-01-01', '2026-12-31', 'UTC', 1000);
      INSERT INTO workspaces
        (id, slug, name, owner_user_id, planning_period_id, context_type, position)
      VALUES
        ('ws-removed', 'removed', 'Private wedding', 'owner-a', 'period-a', 'project', 1000),
        ('ws-current', 'current', 'Current work', 'owner-a', 'period-a', 'project', 2000);
      INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
        ('ws-removed', 'owner-a', 'owner'),
        ('ws-removed', 'owner-b', 'owner'),
        ('ws-current', 'owner-a', 'owner');
    `);

    const before = await listCurrentMemberWorkspaceNamesInPeriod(
      db,
      "owner-a",
      "period-a",
    );
    assert.deepEqual(
      new Set(before.map((row) => row.name)),
      new Set(["Private wedding", "Current work"]),
    );

    await db
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, "ws-removed"),
          eq(workspaceMembers.userId, "owner-a"),
        ),
      );

    const after = await listCurrentMemberWorkspaceNamesInPeriod(
      db,
      "owner-a",
      "period-a",
    );
    const visibleKeys = new Set(
      after.map((row) => row.name.toLocaleLowerCase("en")),
    );
    const candidates = ["Private wedding", "Current work"];
    const creatable = candidates.filter(
      (name) => !visibleKeys.has(name.toLocaleLowerCase("en")),
    );
    const skipped = candidates.filter((name) => !creatable.includes(name));
    assert.deepEqual(creatable, ["Private wedding"]);
    assert.deepEqual(skipped, ["Current work"]);

    const deniedUpdate = await db
      .update(workspaces)
      .set({ name: "Should not land" })
      .where(
        and(
          eq(workspaces.id, "ws-removed"),
          workspaceOwnerMembershipCondition("owner-a", "ws-removed"),
        ),
      )
      .returning({ id: workspaces.id });
    assert.deepEqual(deniedUpdate, []);

    const allowedUpdate = await db
      .update(workspaces)
      .set({ name: "Still mine" })
      .where(
        and(
          eq(workspaces.id, "ws-current"),
          workspaceOwnerMembershipCondition("owner-a", "ws-current"),
        ),
      )
      .returning({ id: workspaces.id });
    assert.deepEqual(allowedUpdate, [{ id: "ws-current" }]);
    const allowed = await requireWorkspaceOwnerWith(
      db,
      "owner-a",
      "ws-current",
    );
    assert.equal(allowed.id, "ws-current");

    await assert.rejects(
      requireWorkspaceOwnerWith(db, "owner-a", "ws-removed"),
      /Workspace not found\./,
    );
  } finally {
    client.close();
  }
});

test("removed Notes member cannot replay an existing promotion or receive metadata", async () => {
  const { client, db } = await freshMemoryDb();
  try {
    await client.executeMultiple(`
      INSERT INTO users (id, clerk_id, color, initials)
        VALUES ('notes-user', 'clerk-notes', 'black', 'NU');
      INSERT INTO workspaces (id, slug, name, owner_user_id)
        VALUES ('ws-notes', 'notes-space', 'Notes space', 'notes-user');
      INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES ('ws-notes', 'notes-user', 'owner');
      INSERT INTO tasks
        (id, workspace_id, title, lane, priority, source_note_id)
      VALUES
        ('task-existing', 'ws-notes', 'Existing promotion', 'todo', 'p2', 'notes-user:note-1');
    `);

    const before = await resolveNotesExtractAccess(db, {
      userId: "notes-user",
      requestedWorkspaceId: "ws-notes",
      sourceNoteId: "notes-user:note-1",
    });
    assert.deepEqual(before, {
      kind: "allowed",
      workspaceId: "ws-notes",
      existing: { id: "task-existing", workspaceId: "ws-notes" },
    });

    await db
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, "ws-notes"),
          eq(workspaceMembers.userId, "notes-user"),
        ),
      );

    const replay = await resolveNotesExtractAccess(db, {
      userId: "notes-user",
      requestedWorkspaceId: "ws-notes",
      sourceNoteId: "notes-user:note-1",
    });
    assert.deepEqual(replay, { kind: "denied" });
    const serialized = JSON.stringify(replay);
    for (const forbidden of [
      "task-existing",
      "ws-notes",
      "Notes space",
      "notes-space",
      "taskUrl",
    ]) {
      assert.equal(serialized.includes(forbidden), false);
    }
  } finally {
    client.close();
  }
});
