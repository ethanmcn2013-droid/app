import type { ConversationResult } from "./contracts";
import type { TaskCommentPage, TaskCommentRecord } from "./task-discussion-contracts";

type CommentPosition = Readonly<{ itemId: string; createSeq: number }>;

/** Read the exact older comment only while the original Task access is current. */
export async function loadDeepLinkedComment(input: Readonly<{
  commentId: string;
  isCurrent: () => boolean;
  position: () => Promise<ConversationResult<{ positions: readonly CommentPosition[] }>>;
  page: (beforeCreateSeq: number) => Promise<ConversationResult<TaskCommentPage>>;
  onLoaded: (comments: readonly TaskCommentRecord[]) => void;
}>): Promise<void> {
  if (!input.isCurrent()) return;
  const status = await input.position();
  if (!input.isCurrent() || !status.ok) return;
  const sequence = status.value.positions.find(position => position.itemId === input.commentId)?.createSeq;
  if (!sequence || !Number.isSafeInteger(sequence)) return;
  const page = await input.page(sequence + 1);
  if (!input.isCurrent() || !page.ok) return;
  if (page.value.comments.some(comment => comment.id === input.commentId && comment.body !== null)) {
    input.onLoaded(page.value.comments);
  }
}
