import { test } from "node:test";
import assert from "node:assert/strict";
import { and, eq, isNull } from "drizzle-orm";
import { freshFileDb } from "./memory-test-db";
import { comments, taskDiscussionState, tasks, users, workspaceMembers, workspaces } from "./schema";
import { taskColumnsWithCount } from "./task-columns";

test("shared task projection counts comments and active children without crossing workspace scope", async () => {
  const fixture = await freshFileDb();
  const { client, db, cleanup } = fixture;

  try {
    await client.execute("PRAGMA foreign_keys = ON");
    const foreignKeys = await client.execute("PRAGMA foreign_keys");
    assert.equal(Number(foreignKeys.rows[0]?.foreign_keys), 1);

    await db.insert(workspaces).values([
      { id: "ws-rollup-a", slug: "rollup-a", name: "Rollup A" },
      { id: "ws-rollup-b", slug: "rollup-b", name: "Rollup B" },
    ]);
    await db.insert(users).values({ id: "user-rollup", color: "#123456", initials: "R" });
    await db.insert(workspaceMembers).values([
      { workspaceId: "ws-rollup-a", userId: "user-rollup", role: "owner" },
      { workspaceId: "ws-rollup-b", userId: "user-rollup", role: "owner" },
    ]);
    const taskSeeds: Array<typeof tasks.$inferInsert> = [
      { id: "parent-a", workspaceId: "ws-rollup-a", title: "A parent", lane: "todo", priority: "p2" },
      { id: "child-a-open", workspaceId: "ws-rollup-a", parentTaskId: "parent-a", title: "Open child", lane: "todo", priority: "p2" },
      { id: "child-a-done", workspaceId: "ws-rollup-a", parentTaskId: "parent-a", title: "Done child", lane: "done", priority: "p2" },
      { id: "child-a-archived", workspaceId: "ws-rollup-a", parentTaskId: "parent-a", title: "Archived child", lane: "done", priority: "p2", archivedAt: new Date("2026-01-02T00:00:00.000Z") },
      { id: "parent-b", workspaceId: "ws-rollup-b", title: "B parent", lane: "todo", priority: "p2" },
      { id: "child-b-done", workspaceId: "ws-rollup-b", parentTaskId: "parent-b", title: "B child", lane: "done", priority: "p2" },
    ];
    await db.insert(tasks).values(taskSeeds);
    await db.insert(taskDiscussionState).values([
      { taskId: "parent-a", workspaceId: "ws-rollup-a" },
      { taskId: "parent-b", workspaceId: "ws-rollup-b" },
    ]);
    await db.insert(comments).values([
      { id: "comment-a", workspaceId: "ws-rollup-a", taskId: "parent-a", userId: "user-rollup", body: "A comment", clientRequestId: "request-a", requestHash: "hash-a", revision: 1, createSeq: 1 },
      { id: "comment-b", workspaceId: "ws-rollup-b", taskId: "parent-b", userId: "user-rollup", body: "B comment", clientRequestId: "request-b", requestHash: "hash-b", revision: 1, createSeq: 1 },
    ]);

    const rowsA = await db.select(taskColumnsWithCount).from(tasks).where(
      and(eq(tasks.workspaceId, "ws-rollup-a"), isNull(tasks.parentTaskId)),
    );
    assert.deepEqual(rowsA.map(({ id, commentCount, subtaskCount, subtaskDoneCount }) => ({
      id, commentCount, subtaskCount, subtaskDoneCount,
    })), [{ id: "parent-a", commentCount: 1, subtaskCount: 2, subtaskDoneCount: 1 }]);

    const rowsB = await db.select(taskColumnsWithCount).from(tasks).where(
      and(eq(tasks.workspaceId, "ws-rollup-b"), isNull(tasks.parentTaskId)),
    );
    assert.deepEqual(rowsB.map(({ id, commentCount, subtaskCount, subtaskDoneCount }) => ({
      id, commentCount, subtaskCount, subtaskDoneCount,
    })), [{ id: "parent-b", commentCount: 1, subtaskCount: 1, subtaskDoneCount: 1 }]);

    const literalOracle = await client.execute({
      sql: `SELECT t.id,
          (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) AS comment_count,
          (SELECT COUNT(*) FROM tasks child WHERE child.parent_task_id = t.id AND child.archived_at IS NULL) AS active_children,
          (SELECT COUNT(*) FROM tasks child WHERE child.parent_task_id = t.id AND child.archived_at IS NULL AND child.lane = 'done') AS done_children
        FROM tasks t WHERE t.workspace_id = ? AND t.parent_task_id IS NULL ORDER BY t.id`,
      args: ["ws-rollup-a"],
    });
    assert.deepEqual(literalOracle.rows.map((row) => ({
      id: row.id, comment_count: Number(row.comment_count), active_children: Number(row.active_children), done_children: Number(row.done_children),
    })), [{ id: "parent-a", comment_count: 1, active_children: 2, done_children: 1 }]);
  } finally {
    cleanup();
  }
});
