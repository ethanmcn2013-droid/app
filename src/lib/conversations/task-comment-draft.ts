/** State updates used by the Task Discussion composer. Mention selection
 * calls onMention and onChange in the same React event. Both updates must
 * derive from the latest queued state so the body cannot erase the selected
 * recipient before send. */
export type TaskCommentDraft = Readonly<{
  body: string;
  mentionUserIds: readonly string[];
  rootCommentId: string | null;
}>;

export const emptyTaskCommentDraft: TaskCommentDraft = {
  body: "", mentionUserIds: [], rootCommentId: null,
};

export function withTaskCommentBody(body: string) {
  return (current: TaskCommentDraft): TaskCommentDraft => ({ ...current, body });
}

export function withTaskCommentMention(id: string) {
  return (current: TaskCommentDraft): TaskCommentDraft => ({
    ...current,
    mentionUserIds: current.mentionUserIds.includes(id)
      ? current.mentionUserIds : [...current.mentionUserIds, id],
  });
}

export function withoutTaskCommentMention(id: string) {
  return (current: TaskCommentDraft): TaskCommentDraft => ({
    ...current, mentionUserIds: current.mentionUserIds.filter((item) => item !== id),
  });
}

export function withTaskCommentRoot(rootCommentId: string | null) {
  return (current: TaskCommentDraft): TaskCommentDraft => ({ ...current, rootCommentId });
}
