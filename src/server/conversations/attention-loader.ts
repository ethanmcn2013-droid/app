import type { DirectedAttention } from "./attention";
import type { createMessageAttentionService } from "./attention";

type AttentionService = ReturnType<typeof createMessageAttentionService>;

/** The disabled gate stops before the 0032/0035/0037 source is opened. */
export async function loadInboxAttention(dependencies: {
  authenticate: () => Promise<string | null>;
  service: () => Promise<AttentionService>;
}): Promise<{ attention?: readonly DirectedAttention[]; available: boolean }> {
  try {
    const actorId = await dependencies.authenticate();
    if (!actorId) return { available: true };
    const result = await (await dependencies.service()).listDirected({ actorId });
    return result.ok ? { attention: result.value, available: true } : { available: false };
  } catch { return { available: false }; }
}
