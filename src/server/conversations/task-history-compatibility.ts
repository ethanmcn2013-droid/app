import "server-only";

import { sql } from "drizzle-orm";
import type { db } from "@/server/db";

export type ExistingTaskComment = Readonly<{
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: number;
}>;

export type ExistingTaskActivity = Readonly<{
  id: string;
  authorId: string;
  authorName: string;
  kind: string;
  createdAt: number;
}>;

export type ExistingTaskHistory = Readonly<{
  taskId: string;
  projectId: string;
  comments: readonly ExistingTaskComment[];
  activities: readonly ExistingTaskActivity[];
}>;

export type ExistingTaskHistoryExecutor = Pick<typeof db, "all">;

type HistoryRow = Readonly<{
  task_id: string;
  project_id: string;
  comments_json: string;
  activities_json: string;
}>;

type CommentJson = Readonly<{
  id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: number;
}>;

type ActivityJson = Readonly<{
  id: string;
  author_id: string;
  author_name: string;
  kind: string;
  created_at: number;
}>;

const validIdentity = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);

function displayName(row: { author_name: unknown }) {
  return typeof row.author_name === "string" && row.author_name.trim()
    ? row.author_name
    : "Someone";
}

/**
 * Read the pre-Discussion task history without opening or creating a canonical
 * discussion. One statement binds identity, the task's stored Project, current
 * membership, and every returned row to the same database snapshot.
 */
export async function readExistingTaskHistory(
  executor: ExistingTaskHistoryExecutor,
  input: Readonly<{ clerkId: string; taskId: string }>,
): Promise<ExistingTaskHistory | null> {
  if (!validIdentity(input.clerkId) || !validIdentity(input.taskId)) return null;

  const [row] = await executor.all<HistoryRow>(sql`
    WITH authorized_task AS (
      SELECT t.id AS task_id, t.workspace_id AS project_id
      FROM tasks t
      JOIN workspaces w ON w.id = t.workspace_id
      JOIN workspace_members member
        ON member.workspace_id = t.workspace_id
      JOIN users actor
        ON actor.id = member.user_id
       AND actor.clerk_id = ${input.clerkId}
      WHERE t.id = ${input.taskId}
      LIMIT 1
    )
    SELECT scope.task_id, scope.project_id,
      COALESCE((
        SELECT json_group_array(json_object(
          'id', visible_comment.id,
          'author_id', visible_comment.user_id,
          'author_name', visible_comment.author_name,
          'body', visible_comment.body,
          'created_at', visible_comment.created_at
        ))
        FROM (
          SELECT c.id, c.user_id,
            COALESCE(author.name, author.handle,
              CASE WHEN author.email IS NOT NULL
                THEN substr(author.email, 1, instr(author.email, '@') - 1)
              END, 'Someone') AS author_name,
            c.body, c.created_at
          FROM comments c
          JOIN users author ON author.id = c.user_id
          WHERE c.task_id = scope.task_id
            AND c.workspace_id = scope.project_id
            AND c.revision IS NOT NULL
            AND c.create_seq IS NOT NULL
            AND c.deleted_at IS NULL
            AND c.body IS NOT NULL
          ORDER BY c.created_at, c.id
          LIMIT 500
        ) AS visible_comment
      ), '[]') AS comments_json,
      COALESCE((
        SELECT json_group_array(json_object(
          'id', visible_activity.id,
          'author_id', visible_activity.user_id,
          'author_name', visible_activity.author_name,
          'kind', visible_activity.kind,
          'created_at', visible_activity.created_at
        ))
        FROM (
          SELECT a.id, a.user_id,
            COALESCE(author.name, author.handle,
              CASE WHEN author.email IS NOT NULL
                THEN substr(author.email, 1, instr(author.email, '@') - 1)
              END, 'Someone') AS author_name,
            a.kind, a.created_at
          FROM activities a
          JOIN users author ON author.id = a.user_id
          WHERE a.task_id = scope.task_id
            AND a.workspace_id = scope.project_id
            AND a.kind IN (
              'taskAdd', 'move', 'toggleComplete', 'update', 'commentAdd',
              'commentRemove', 'attach', 'detach', 'parentChanged',
              'resourceAdd', 'resourceRemove', 'nudgeSent', 'inviteSent',
              'inviteAccepted', 'archived', 'restored'
            )
          ORDER BY a.created_at DESC, a.id DESC
          LIMIT 50
        ) AS visible_activity
      ), '[]') AS activities_json
    FROM authorized_task scope
  `);

  if (!row) return null;
  const comments = JSON.parse(row.comments_json) as CommentJson[];
  const activities = JSON.parse(row.activities_json) as ActivityJson[];
  return {
    taskId: row.task_id,
    projectId: row.project_id,
    comments: comments.map((comment) => ({
      id: comment.id,
      authorId: comment.author_id,
      authorName: displayName(comment),
      body: comment.body,
      createdAt: Number(comment.created_at) * 1_000,
    })),
    activities: activities.map((activity) => ({
      id: activity.id,
      authorId: activity.author_id,
      authorName: displayName(activity),
      kind: activity.kind,
      createdAt: Number(activity.created_at) * 1_000,
    })).sort((left, right) => left.createdAt - right.createdAt),
  };
}
