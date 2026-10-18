import type { AssistantExecuteInput } from "./service";
import { AssistantStoreError } from "./store";

/** Recheck admission only when an actual new effect callback enters the writer.
 * The store may still return an immutable original receipt without calling it.
 */
export function guardAssistantCommitStep(commitStep: AssistantExecuteInput["commitStep"], stillCurrent: () => boolean): AssistantExecuteInput["commitStep"] {
  return (stepId, fence, callback) => commitStep(stepId, fence, tx => {
    if (!stillCurrent()) throw new AssistantStoreError("unavailable");
    return callback(tx);
  });
}
