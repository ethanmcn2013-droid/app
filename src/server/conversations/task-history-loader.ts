import "server-only";

import type { ConversationResult } from "@/lib/conversations/contracts";
import type { ConversationControls } from "@/lib/conversations/flags";
import type { TaskDiscussionSnapshot } from "@/lib/conversations/task-discussion-contracts";
import type { ExistingTaskHistory } from "./task-history-compatibility";

export type TaskConversationSurface =
  | Readonly<{ mode: "discussion"; discussion: TaskDiscussionSnapshot }>
  | Readonly<{ mode: "existing_history"; history: ExistingTaskHistory }>;

type Dependencies = Readonly<{
  controls: () => ConversationControls;
  authenticateClerk: () => Promise<string | null>;
  openDiscussion: (taskId: string) => Promise<ConversationResult<TaskDiscussionSnapshot>>;
  readExistingHistory: (clerkId: string, taskId: string) => Promise<ExistingTaskHistory | null>;
}>;

const validTaskId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);

/** Server-owned mode selection. Canonical failures never fall through. */
export function createTaskConversationLoader(dependencies: Dependencies) {
  return async function loadTaskConversation(
    taskId: string,
  ): Promise<ConversationResult<TaskConversationSurface>> {
    if (!validTaskId(taskId)) return { ok: false, code: "invalid_input" };

    let clerkId: string | null;
    try {
      clerkId = await dependencies.authenticateClerk();
    } catch {
      return { ok: false, code: "temporarily_unavailable" };
    }
    if (!clerkId) return { ok: false, code: "unauthenticated" };

    if (dependencies.controls().internalEnabled) {
      try {
        const canonical = await dependencies.openDiscussion(taskId);
        return canonical.ok
          ? { ok: true, value: { mode: "discussion", discussion: canonical.value } }
          : canonical;
      } catch {
        return { ok: false, code: "temporarily_unavailable" };
      }
    }

    try {
      const history = await dependencies.readExistingHistory(clerkId, taskId);
      return history
        ? { ok: true, value: { mode: "existing_history", history } }
        : { ok: false, code: "unavailable" };
    } catch {
      return { ok: false, code: "temporarily_unavailable" };
    }
  };
}
