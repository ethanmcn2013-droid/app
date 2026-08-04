/**
 * Tips — pure tip-selection engine, no IO.
 *
 * TIPS is the canonical list. Each entry has a version field: bumping
 * version re-shows the tip to users who already saw the previous version
 * (the seen map stores { [id]: lastSeenVersion }).
 *
 * nextTip enforces:
 *   - sessionShown true  → null (at most one tip per session)
 *   - lastShownAt within 7 days → null (weekly cadence cap)
 *   - seen[id] >= tip.version → skip (user has seen this version)
 *   - context filter
 *   - returns the first eligible tip
 */

export type TipContext = "board" | "task-panel" | "inbox";

export type Tip = {
  id: string;
  version: number;
  context: TipContext;
  body: string;
};

export const TIPS: Tip[] = [
  // Retired 2026-07-28: "Press j or k to move between tasks, e to open focus
  // mode." The task panel prints that same hint permanently, beside Mark
  // done. A tip that teaches what the surface already says out loud spends a
  // session slot and reads as the product repeating itself.
  {
    id: "task-panel-resize",
    version: 1,
    context: "task-panel",
    // Verified: panel-shell.tsx drag handle on left edge
    body: "Drag the left edge of the panel to resize it.",
  },
  {
    id: "board-context-menu",
    version: 1,
    context: "board",
    // Verified: ContextActions (radix context-menu) on board cards
    body: "Right-click a card for status, priority, assign, and more.",
  },
  {
    id: "board-due-date",
    version: 1,
    context: "board",
    // Verified: Phase 3 due-date submenu items Today / Tomorrow / Next week in card menu
    body: "Set a due date fast from a card menu: Today, Tomorrow, Next week.",
  },
  {
    id: "inbox-milestones",
    version: 1,
    context: "inbox",
    // Verified: this phase — milestones appear at 100, 250, 500, 1000 completions
    body: "Milestones appear here at 100, 250, 500 and 1000 completed tasks.",
  },
];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type NextTipInput = {
  context: TipContext;
  /** Map of tip id → last seen version number. */
  seen: Record<string, number>;
  /** Unix ms timestamp of the last time any tip was shown. Null = never shown. */
  lastShownAt: number | null;
  /** Current unix ms timestamp. */
  now: number;
  /** True when a tip has already been shown in this browser session. */
  sessionShown: boolean;
};

export function nextTip(input: NextTipInput): Tip | null {
  const { context, seen, lastShownAt, now, sessionShown } = input;

  // One tip per session.
  if (sessionShown) return null;

  // Weekly cadence cap.
  if (lastShownAt !== null && now - lastShownAt < SEVEN_DAYS_MS) return null;

  for (const tip of TIPS) {
    if (tip.context !== context) continue;
    // Skip if the user has already seen this version.
    const seenVersion = seen[tip.id] ?? 0;
    if (seenVersion >= tip.version) continue;
    return tip;
  }

  return null;
}
