import type { ConversationResult, ConversationFailure } from "@/lib/conversations/contracts";
import type { TaskOutcomeRequest, TaskOutcomeResult } from "./task-outcome-form";

export type TaskOutcomeSubmission = ConversationResult<TaskOutcomeResult> | (ConversationFailure & { outcomeUnknown: true });
type Lookup = { state: "absent" } | { state: "committed"; receipt: TaskOutcomeResult; taskAvailable: boolean };

export function taskOutcomeIsUnknown(result: TaskOutcomeSubmission) {
  return !result.ok && (("outcomeUnknown" in result && result.outcomeUnknown) || result.code === "temporarily_unavailable" || result.code === "rate_limited");
}

/** A denied receipt read says nothing about whether the earlier write committed. */
export async function resolveTaskOutcome(input: TaskOutcomeRequest, transport: {
  lookup: (requestId: string) => Promise<ConversationResult<Lookup>>;
  promote: (input: TaskOutcomeRequest) => Promise<ConversationResult<TaskOutcomeResult>>;
  isCurrent: () => boolean;
}): Promise<TaskOutcomeSubmission> {
  const lookup = await transport.lookup(input.clientRequestId);
  if (!transport.isCurrent()) return { ok: false, code: "unavailable", outcomeUnknown: true };
  if (!lookup.ok) return { ...lookup, outcomeUnknown: true };
  if (lookup.value.state === "committed") return { ok: true, value: { ...lookup.value.receipt, taskAvailable: lookup.value.taskAvailable } };
  const result = await transport.promote(input);
  return transport.isCurrent() ? result : { ok: false, code: "unavailable", outcomeUnknown: true };
}
