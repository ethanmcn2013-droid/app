/**
 * One-shot rescue of the pre-T·114 brief text out of localStorage.
 *
 * Until T·114 the project title and description were written to localStorage
 * keyed by the workspace's *display name*. That data cannot be backfilled
 * server-side: it only exists in each browser that typed it, and the key does
 * not identify a workspace (two projects sharing a display name shared one
 * entry). So the promotion has to happen client-side, once, on the first load
 * of the new UI in each browser that still holds a value.
 *
 * Rules that keep this from doing harm:
 *  - the server always wins. A local value is only promoted into a field the
 *    server has no value for, so this can never overwrite text a collaborator
 *    already saved.
 *  - the old hardcoded default sentence is never promoted. It was a fallback
 *    nobody wrote, and storing it would turn a placeholder into a permanent
 *    record on every workspace that never set one.
 *  - the keys are removed either way, so this runs at most once per browser
 *    per workspace, whether or not anything was promoted.
 *
 * Delete this module once the dispatch has been live long enough that no
 * browser plausibly holds an unpromoted value.
 */

/** The fallback the old brief rendered when no local value was stored. */
const RETIRED_DEFAULT_DESCRIPTION =
  "Everything for this workspace in one view. Every task should leave a clear next handoff.";

function keysFor(displayName: string): {
  title: string[];
  description: string[];
  done: string;
} {
  return {
    title: [
      `signal-tasks.brief.title:${displayName}`,
      `tasks:brief:title:${displayName}`,
    ],
    description: [
      `signal-tasks.brief.subtitle:${displayName}`,
      `tasks:brief:subtitle:${displayName}`,
    ],
    done: `signal-tasks.brief.promoted:${displayName}`,
  };
}

function readFirst(keys: string[]): string | null {
  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (raw && raw.trim().length > 0) return raw.replace(/\s+/g, " ").trim();
  }
  return null;
}

export type PromoteLocalBriefInput = {
  /** The display name the old keys were built from. */
  displayName: string;
  /** Server-stored project name, null when never renamed. */
  serverName: string | null;
  /** Server-stored description, null when never written. */
  serverDescription: string | null;
  onPromoteName: (next: string) => Promise<unknown>;
  onPromoteDescription: (next: string) => Promise<unknown>;
};

/**
 * Returns true when something was promoted (the caller may want to refresh),
 * false when there was nothing to do.
 */
export async function promoteLocalBrief({
  displayName,
  serverName,
  serverDescription,
  onPromoteName,
  onPromoteDescription,
}: PromoteLocalBriefInput): Promise<boolean> {
  let promoted = false;
  try {
    const keys = keysFor(displayName);
    if (window.localStorage.getItem(keys.done)) return false;

    const localTitle = readFirst(keys.title);
    const localDescription = readFirst(keys.description);

    if (localTitle && !serverName && localTitle !== displayName) {
      await onPromoteName(localTitle);
      promoted = true;
    }
    if (
      localDescription &&
      !serverDescription &&
      localDescription !== RETIRED_DEFAULT_DESCRIPTION
    ) {
      await onPromoteDescription(localDescription);
      promoted = true;
    }

    for (const key of [...keys.title, ...keys.description]) {
      window.localStorage.removeItem(key);
    }
    window.localStorage.setItem(keys.done, "1");
  } catch {
    // Private mode, disabled storage, or a failed action. The brief still
    // renders the server value; the local copy stays for a later attempt.
    return promoted;
  }
  return promoted;
}
