import { and, eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import {
  comments, conversationChanges, conversationMessages, conversations,
  taskCommentChanges, taskDiscussionState,
} from "@/server/db/schema";

type Database = LibSQLDatabase<typeof schema>;
type RawWriter = Pick<Database, "run">;

/** Explicit cleanup: the production libSQL connection cannot rely on FK cascades. */
export async function eraseProjectConversationRows(database: RawWriter, projectId: string) {
  await database.run(sql`DELETE FROM suite_outbox WHERE type='task.created' AND EXISTS (
    SELECT 1 FROM work_links l WHERE (l.source_project_id=${projectId} OR l.destination_project_id=${projectId})
      AND CASE WHEN json_valid(suite_outbox.object_ref) THEN json_extract(suite_outbox.object_ref,'$.workLinkId') END=l.id)`);
  await database.run(sql`DELETE FROM work_operation_receipts WHERE source_project_id=${projectId} OR destination_project_id=${projectId}
    OR work_link_id IN (SELECT id FROM work_links WHERE source_project_id=${projectId} OR destination_project_id=${projectId})`);
  await database.run(sql`DELETE FROM work_links WHERE source_project_id=${projectId} OR destination_project_id=${projectId}`);
  await database.run(sql`DELETE FROM conversation_dm_receipts WHERE conversation_id IN (SELECT id FROM conversations WHERE workspace_id=${projectId})`);
  await database.run(sql`DELETE FROM conversation_outbox WHERE workspace_id=${projectId}`);
  await database.run(sql`DELETE FROM conversation_attention WHERE workspace_id=${projectId}`);
  await database.run(sql`DELETE FROM conversation_receipts WHERE conversation_id IN (SELECT id FROM conversations WHERE workspace_id=${projectId})`);
  await database.run(sql`DELETE FROM conversation_changes WHERE conversation_id IN (SELECT id FROM conversations WHERE workspace_id=${projectId})`);
  await database.run(sql`DELETE FROM conversation_messages WHERE workspace_id=${projectId}`);
  await database.run(sql`DELETE FROM conversation_participants WHERE conversation_id IN (SELECT id FROM conversations WHERE workspace_id=${projectId})`);
  await database.run(sql`DELETE FROM conversations WHERE workspace_id=${projectId}`);
  await database.run(sql`DELETE FROM task_comment_migration_report WHERE comment_id IN (
    SELECT c.id FROM comments c JOIN tasks t ON t.id=c.task_id WHERE t.workspace_id=${projectId})`);
  await database.run(sql`DELETE FROM suite_outbox WHERE workspace_id=${projectId}`);
}

/** Runs only after the durable account-erasure fence is installed. */
export async function eraseConversationUserFootprint(database: Database, userId: string) {
  const dm = await database.select({ id: conversations.id }).from(conversations)
    .where(sql`${userId} IN (${conversations.dmLowUserId}, ${conversations.dmHighUserId})`).limit(1);
  if (dm.length) throw new Error("account erasure blocked: existing DM requires its separate retention decision");

  // Destination Tasks remain canonical; only source-derived links and replay
  // custody are removed. These statements also consume stale partial retries.
  await database.run(sql`DELETE FROM suite_outbox WHERE actor_user_id=${userId} OR
    (type='task.created' AND CASE WHEN json_valid(object_ref) THEN json_extract(object_ref,'$.workLinkId') END IN (
      SELECT l.id FROM work_links l LEFT JOIN conversation_messages m ON m.id=l.source_message_id
      WHERE l.created_by=${userId} OR m.author_id=${userId}))`);
  await database.run(sql`DELETE FROM work_operation_receipts WHERE actor_id=${userId} OR work_link_id IN (
    SELECT l.id FROM work_links l LEFT JOIN conversation_messages m ON m.id=l.source_message_id
    WHERE l.created_by=${userId} OR m.author_id=${userId})`);
  await database.run(sql`DELETE FROM work_links WHERE created_by=${userId} OR source_message_id IN (
    SELECT id FROM conversation_messages WHERE author_id=${userId})`);
  await database.run(sql`DELETE FROM conversation_dm_receipts WHERE actor_id=${userId}`);
  await database.run(sql`DELETE FROM conversation_participants WHERE user_id=${userId}`);
  await database.run(sql`DELETE FROM conversation_attention WHERE recipient_id=${userId}`);
  await database.run(sql`DELETE FROM conversation_outbox WHERE recipient_id=${userId}`);
  await database.run(sql`DELETE FROM conversation_receipts WHERE actor_id=${userId}`);

  const authoredMessages = await database.select({ id: conversationMessages.id }).from(conversationMessages)
    .where(eq(conversationMessages.authorId, userId));
  for (const { id } of authoredMessages) {
    await database.transaction(async (tx) => {
      const [message] = await tx.select({ conversationId: conversationMessages.conversationId,
        revision: conversationMessages.revision, deletedAt: conversationMessages.deletedAt })
        .from(conversationMessages).where(and(eq(conversationMessages.id, id), eq(conversationMessages.authorId, userId)));
      if (!message) return;
      const [room] = await tx.select({ nextChangeSeq: conversations.nextChangeSeq,
        audienceEpoch: conversations.audienceEpoch }).from(conversations).where(eq(conversations.id, message.conversationId));
      if (!room) throw new Error("account erasure blocked: message room is missing");
      await tx.run(sql`DELETE FROM conversation_attention WHERE message_id=${id}`);
      await tx.run(sql`DELETE FROM conversation_outbox WHERE message_id=${id}`);
      await tx.run(sql`DELETE FROM conversation_receipts WHERE message_id=${id}`);
      await tx.run(sql`DELETE FROM conversation_changes WHERE message_id=${id}`);
      const now = Date.now();
      await tx.update(conversationMessages).set({ authorId: null, clientRequestId: null, requestHash: null,
        body: null, deletedAt: message.deletedAt ?? now, revision: message.revision + 1 }).where(eq(conversationMessages.id, id));
      await tx.update(conversations).set({ nextChangeSeq: room.nextChangeSeq + 1 }).where(eq(conversations.id, message.conversationId));
      await tx.insert(conversationChanges).values({ conversationId: message.conversationId,
        changeSeq: room.nextChangeSeq, kind: "delete", messageId: id, revision: message.revision + 1,
        audienceEpoch: room.audienceEpoch, happenedAt: now });
    });
  }
  await database.run(sql`UPDATE conversations SET created_by=NULL WHERE kind='project' AND created_by=${userId}`);

  await database.run(sql`DELETE FROM task_comment_attention WHERE recipient_id=${userId}`);
  await database.run(sql`DELETE FROM task_comment_outbox WHERE recipient_id=${userId}`);
  await database.run(sql`DELETE FROM task_comment_receipts WHERE actor_id=${userId}`);
  const authoredComments = await database.select({ id: comments.id, revision: comments.revision })
    .from(comments).where(eq(comments.userId, userId));
  for (const { id, revision } of authoredComments) {
    if (revision == null) {
      await database.run(sql`DELETE FROM task_comment_migration_report WHERE comment_id=${id}`);
      await database.run(sql`DELETE FROM comments WHERE id=${id}`);
      continue;
    }
    await database.transaction(async (tx) => {
      const [comment] = await tx.select({ taskId: comments.taskId, revision: comments.revision,
        deletedAt: comments.deletedAt }).from(comments).where(and(eq(comments.id, id), eq(comments.userId, userId)));
      if (!comment || comment.revision == null) return;
      const [state] = await tx.select({ nextChangeSeq: taskDiscussionState.nextChangeSeq,
        audienceEpoch: taskDiscussionState.audienceEpoch }).from(taskDiscussionState).where(eq(taskDiscussionState.taskId, comment.taskId));
      if (!state) throw new Error("account erasure blocked: Task Discussion state is missing");
      await tx.run(sql`DELETE FROM task_comment_attention WHERE comment_id=${id}`);
      await tx.run(sql`DELETE FROM task_comment_outbox WHERE comment_id=${id}`);
      await tx.run(sql`DELETE FROM task_comment_receipts WHERE comment_id=${id}`);
      await tx.run(sql`DELETE FROM task_comment_changes WHERE comment_id=${id}`);
      const now = Date.now();
      await tx.update(comments).set({ userId: null, clientRequestId: null, requestHash: null,
        body: null, deletedAt: comment.deletedAt ?? now, revision: comment.revision + 1 }).where(eq(comments.id, id));
      await tx.update(taskDiscussionState).set({ nextChangeSeq: state.nextChangeSeq + 1 }).where(eq(taskDiscussionState.taskId, comment.taskId));
      await tx.insert(taskCommentChanges).values({ taskId: comment.taskId, changeSeq: state.nextChangeSeq,
        kind: "delete", commentId: id, revision: comment.revision + 1,
        audienceEpoch: state.audienceEpoch, happenedAtMs: now });
    });
  }
}
