// Keep the persisted board harness and its 18 baseline cases unchanged. Its
// before/after hooks own this child process's fixture connection and cleanup.
import "../../src/server/actions/board-fidelity.persisted.test.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { sql } from "drizzle-orm";

test("default Waiting claims retain canonical lanes without requiring stored config", async () => {
  const fixture = globalThis.__boardFidelity;
  assert.ok(fixture?.db, "the unchanged persisted harness must initialize the owned fixture");
  const { db } = fixture;
  const { moveTaskToColumnAction } = await import("../../src/server/actions/board.ts");
  const { resolveBoardColumns } = await import("../../src/lib/board-columns.ts");
  fixture.actor = "owner_actor";
  fixture.workspace = "waiting_default_ws";
  await db.run(sql`INSERT INTO workspaces(id,slug,name,owner_user_id,context_type)
    VALUES('waiting_default_ws','waiting-default','Default Waiting','owner_actor','project')`);
  await db.run(sql`INSERT INTO workspace_members(workspace_id,user_id,role)
    VALUES('waiting_default_ws','owner_actor','owner')`);
  assert.ok(resolveBoardColumns(null).some(column => column.key === "waiting" && !column.isSystem));
  const old = Math.floor(Date.now() / 1000) - 86400;
  let seq = 0;
  for (const lane of ["todo", "review", "done"]) {
    const id = `waiting_default_${lane}`;
    await db.run(sql`INSERT INTO tasks(id,workspace_id,seq,title,lane,priority,assignees,tags,blocked_by,created_at,updated_at,completed_at)
      VALUES(${id},'waiting_default_ws',${++seq},${id},${lane},'p2','[]','[]','[]',${old},${old},${lane === "done" ? old : null})`);
    await moveTaskToColumnAction(id, "waiting");
    const [claimed] = await db.all(sql`SELECT lane,board_column_key,completed_at FROM tasks WHERE id=${id}`);
    assert.equal(claimed.lane, lane);
    assert.equal(claimed.board_column_key, "waiting");
    assert.equal(claimed.completed_at, null, "Waiting is an open column, including a move out of Done");
    assert.equal((await db.all(sql`SELECT value FROM meta WHERE key='board:waiting_default_ws:columns'`)).length, 0);
    await moveTaskToColumnAction(id, "doing");
    const [moved] = await db.all(sql`SELECT lane,board_column_key FROM tasks WHERE id=${id}`);
    assert.equal(moved.lane, "doing");
    assert.equal(moved.board_column_key, null, "a system move clears the custom claim");
  }
});
