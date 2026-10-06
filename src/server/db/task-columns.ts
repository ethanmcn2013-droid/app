import { getTableColumns, sql } from "drizzle-orm";
import { comments, tasks } from "./schema";

/** Shared task projection with tenant-local comment and active-child rollups. */
export const taskColumnsWithCount = {
  ...getTableColumns(tasks),
  commentCount: sql<number>`(
    SELECT COUNT(*) FROM ${comments}
    WHERE ${comments.taskId} = ${sql.raw('"tasks"."id"')}
  )`.as("comment_count"),
  subtaskCount: sql<number>`(
    SELECT COUNT(*) FROM tasks child
    WHERE child.parent_task_id = ${sql.raw('"tasks"."id"')}
      AND child.archived_at IS NULL
  )`.as("subtask_count"),
  subtaskDoneCount: sql<number>`(
    SELECT COUNT(*) FROM tasks child
    WHERE child.parent_task_id = ${sql.raw('"tasks"."id"')}
      AND child.archived_at IS NULL
      AND child.lane = 'done'
  )`.as("subtask_done_count"),
};
