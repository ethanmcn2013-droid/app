"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { CURRENT_USER, type Comment } from "@/lib/data";
import {
  addCommentAction,
  removeCommentAction,
} from "@/server/actions/comments";

export function useTaskComments(
  taskId: string | null,
  initialComments: Comment[],
) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [isPending, startTransition] = useTransition();

  // Keep latest snapshot for revert without becoming a stale closure.
  const stateRef = useRef(comments);
  stateRef.current = comments;

  // Sync external truth when caller passes a new initial list (panel
  // switching tasks, or fetch resolved with newer data).
  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  const addComment = useCallback(
    (body: string) => {
      if (!taskId) return;
      const trimmed = body.trim();
      if (!trimmed) return;

      const optimistic: Comment = {
        id: `temp-${
          globalThis.crypto?.randomUUID?.() ??
          Math.random().toString(36).slice(2)
        }`,
        taskId,
        userId: CURRENT_USER,
        body: trimmed,
        createdAt: new Date(),
      };
      const prior = stateRef.current;
      setComments([...prior, optimistic]);

      startTransition(async () => {
        try {
          const fresh = await addCommentAction(taskId, trimmed);
          setComments(fresh);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("comments: add failed; reverting", err);
          setComments(prior);
        }
      });
    },
    [taskId],
  );

  const removeComment = useCallback(
    (commentId: string) => {
      const prior = stateRef.current;
      setComments(prior.filter((c) => c.id !== commentId));

      // Optimistic-only delete for temp ids that never reached server.
      if (commentId.startsWith("temp-")) return;

      startTransition(async () => {
        try {
          const fresh = await removeCommentAction(commentId);
          setComments(fresh);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("comments: remove failed; reverting", err);
          setComments(prior);
        }
      });
    },
    [],
  );

  return {
    comments,
    addComment,
    removeComment,
    isPending,
  };
}
