import type { ConversationFailure, ConversationResult } from "@/lib/conversations/contracts";
import type { TaskConversationSurface } from "@/server/conversations/task-history-loader";

export type ConversationReadEvent =
  | Readonly<{ kind: "slow" }>
  | Readonly<{ kind: "success"; surface: TaskConversationSurface }>
  | Readonly<{ kind: "failure"; code: ConversationFailure["code"] }>;

/** A slow cue leaves the authorized read alive; the current scope may still settle. */
export async function readTaskConversationWithSoftDeadline(input: Readonly<{
  taskId: string;
  load: (taskId: string) => Promise<ConversationResult<TaskConversationSurface>>;
  isCurrent: () => boolean;
  onEvent: (event: ConversationReadEvent) => void;
  slowAfterMs?: number;
}>): Promise<void> {
  const timer = setTimeout(() => {
    if (input.isCurrent()) input.onEvent({ kind: "slow" });
  }, input.slowAfterMs ?? 5_000);

  let result: ConversationResult<TaskConversationSurface>;
  try {
    result = await input.load(input.taskId);
  } catch {
    if (input.isCurrent()) input.onEvent({ kind: "failure", code: "temporarily_unavailable" });
    return;
  } finally {
    clearTimeout(timer);
  }

  if (!input.isCurrent()) return;
  input.onEvent(result.ok
    ? { kind: "success", surface: result.value }
    : { kind: "failure", code: result.code });
}
