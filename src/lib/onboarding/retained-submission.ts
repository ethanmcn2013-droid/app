/** One user's intent survives a rejected/lost response. A successful intent is
 * released, so the next deliberate settings apply gets a fresh request. */
export function createRetainedSubmission<T extends { workspaceId: string }>(
  workspaceId: string,
  options: {
    newId?: () => string;
    storage?: () => Pick<Storage, "getItem" | "setItem" | "removeItem">;
    storageKey?: string;
  } = {},
) {
  let held: (T & { requestId: string }) | null = null;
  let busy = false;
  let disposed = false;
  function retain(input: T) {
    if (input.workspaceId !== workspaceId) throw new Error("The project changed.");
    const storage = options.storage?.();
    if (!held && storage && options.storageKey) {
      const saved = storage.getItem(options.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as T & { requestId: string };
        if (parsed.workspaceId !== workspaceId || typeof parsed.requestId !== "string") throw new Error("The saved setup needs to be checked.");
        held = parsed;
      }
    }
    held ??= { ...input, requestId: (options.newId ?? (() => crypto.randomUUID()))() };
    if (storage && options.storageKey) storage.setItem(options.storageKey, JSON.stringify(held));
    return held;
  }
  return {
    async run(input: T, action: (input: T & { requestId: string }) => Promise<void>): Promise<boolean> {
      if (busy || disposed) return false;
      busy = true;
      try {
        const submission = retain(input);
        await action(submission);
        if (disposed) return false;
        if (options.storageKey) options.storage?.().removeItem(options.storageKey);
        held = null;
        return true;
      } finally { busy = false; }
    },
    retained() { return held ? { ...held } : null; },
    dispose() { disposed = true; },
  };
}
