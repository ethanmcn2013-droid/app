import type { Task, UserId } from "@/lib/data";

export type NudgeKind =
  | "idle-doing"
  | "idle-review"
  | "past-due"
  | "blocker-cleared"
  | "review-pile"
  | "doing-empty"
  /**
   * LLM-authored nudge. NOT produced by `generateNudges` — kept pure
   * rules here on purpose. The kind exists in the union so the inbox
   * (and any future renderer) can format an LLM-sourced nudge with
   * the same shape and animations as a rules-based one. AI assist
   * lives in `src/server/actions/ai.ts`; rendering is in the inbox.
   */
  | "llm-narration";

export type Nudge = {
  /** Stable id derived from {kind, taskId, severity bucket} so the
   *  client-side dismiss list stays meaningful across renders. */
  id: string;
  kind: NudgeKind;
  /** Optional anchoring task for click-through. */
  taskId?: string;
  /** Punchy one-liner. */
  headline: string;
  /** The wry "yeah, we noticed" sub-line. */
  body: string;
  /** Higher = more urgent. Used for ordering. */
  severity: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function pickRand<T>(arr: T[], seed: string): T {
  // Deterministic so the same nudge id always picks the same flavor.
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return arr[Math.abs(h) % arr.length];
}

// ────────────────────────────────────────────────────────────────────
// Cheeky copy banks. Each rule has a few variants so the inbox doesn't
// read identical week-over-week. Tone reference: dry, observational,
// never preachy. We notice; we don't lecture.
// ────────────────────────────────────────────────────────────────────

const IDLE_DOING_4: string[] = [
  "Day 4 of being in-progress. The progress is implied.",
  "This is starting to look load-bearing. Maybe poke it?",
  "Quietly enjoying its life in the In progress lane.",
];

const IDLE_DOING_7: string[] = [
  "Officially marinating. {n} days unmoved.",
  "This card knows your name now.",
  "Older than most TikTok trends. Just saying.",
];

const IDLE_REVIEW_4: string[] = [
  "In review for {n} days. Are we reviewing it or admiring it?",
  "Five days in review reads less like review and more like a museum exhibit.",
  "Review status: pending, vibes: stagnant.",
];

const PAST_DUE_NEAR: string[] = [
  "Due was {n} day ago. We're aware. Just sitting with it.",
  "Yesterday wanted to be the day. Wasn't.",
  "Mildly past due. Still recoverable. Still possible.",
];

const PAST_DUE_FAR: string[] = [
  "{n} days past due. The deadline was a suggestion, apparently.",
  "We've stopped counting. (Lie. It's {n} days.)",
  "This due date filed a missing-persons report.",
];

const BLOCKER_CLEARED: string[] = [
  "Your blocker shipped. Downstream is just vibing.",
  "Upstream's done. Nothing's stopping you. Except, you know, you.",
  "All clear. Permission granted. The path is open.",
];

const REVIEW_PILE: string[] = [
  "{n} tasks in In review. Bottleneck-shaped, isn't it?",
  "{n} reviews queued. The reviewer's name rhymes with 'you'.",
  "{n} tasks waiting on a yes-or-no. Most are yes. Just guessing.",
];

const DOING_EMPTY: string[] = [
  "{todo} in To do, zero in progress. We can do one.",
  "Nothing currently in flight. The runway is yours.",
  "In progress is suspiciously empty. Coincidence?",
];

// ────────────────────────────────────────────────────────────────────
// Rule engine
// ────────────────────────────────────────────────────────────────────

export function generateNudges(
  tasks: Task[],
  currentUser: UserId,
  now: Date = new Date(),
): Nudge[] {
  const out: Nudge[] = [];

  const myOpen = tasks.filter(
    (t) => t.assignees.includes(currentUser) && t.lane !== "done",
  );

  // Rule 1 — idle in_progress
  for (const t of myOpen.filter((t) => t.lane === "doing")) {
    const days = idleDaysFor(t, now);
    if (days >= 7) {
      const tpl = pickRand(IDLE_DOING_7, t.id + "doing7");
      out.push({
        id: `idle-doing-${t.id}-7`,
        kind: "idle-doing",
        taskId: t.id,
        headline: t.title,
        body: tpl.replace("{n}", String(days)),
        severity: 80,
      });
    } else if (days >= 4) {
      const tpl = pickRand(IDLE_DOING_4, t.id + "doing4");
      out.push({
        id: `idle-doing-${t.id}-4`,
        kind: "idle-doing",
        taskId: t.id,
        headline: t.title,
        body: tpl.replace("{n}", String(days)),
        severity: 60,
      });
    }
  }

  // Rule 2 — idle in_review (any reviewer; the bottleneck shows for all)
  for (const t of tasks.filter((t) => t.lane === "review")) {
    const days = idleDaysFor(t, now);
    if (days >= 4) {
      const tpl = pickRand(IDLE_REVIEW_4, t.id + "review4");
      out.push({
        id: `idle-review-${t.id}`,
        kind: "idle-review",
        taskId: t.id,
        headline: t.title,
        body: tpl.replace("{n}", String(days)),
        severity: 50,
      });
    }
  }

  // Rule 3 — past due (mine)
  for (const t of myOpen) {
    if (!t.dueAt) continue;
    const dDays = Math.floor((now.getTime() - t.dueAt.getTime()) / DAY_MS);
    if (dDays > 0 && dDays <= 3) {
      const tpl = pickRand(PAST_DUE_NEAR, t.id + "due-near");
      out.push({
        id: `past-due-${t.id}-near`,
        kind: "past-due",
        taskId: t.id,
        headline: t.title,
        body: tpl.replace("{n}", String(dDays)),
        severity: 75,
      });
    } else if (dDays > 3) {
      const tpl = pickRand(PAST_DUE_FAR, t.id + "due-far");
      out.push({
        id: `past-due-${t.id}-far`,
        kind: "past-due",
        taskId: t.id,
        headline: t.title,
        body: tpl
          .replace("{n}", String(dDays))
          .replace("{n}", String(dDays)),
        severity: 90,
      });
    }
  }

  // Rule 4 — blocker cleared (every blocker is done, but task is still
  // todo). Only fire for tasks the current user owns.
  for (const t of myOpen.filter(
    (t) => t.lane === "todo" && t.blockedBy && t.blockedBy.length > 0,
  )) {
    const blockers = (t.blockedBy ?? []).map((id) =>
      tasks.find((x) => x.id === id),
    );
    const allDone =
      blockers.length > 0 &&
      blockers.every((b) => b && b.lane === "done");
    if (!allDone) continue;
    const tpl = pickRand(BLOCKER_CLEARED, t.id + "blocker");
    out.push({
      id: `blocker-cleared-${t.id}`,
      kind: "blocker-cleared",
      taskId: t.id,
      headline: t.title,
      body: tpl,
      severity: 70,
    });
  }

  // Rule 5 — review pile (>= 4 tasks in review)
  const reviewCount = tasks.filter((t) => t.lane === "review").length;
  if (reviewCount >= 4) {
    const tpl = pickRand(REVIEW_PILE, "review-pile-" + reviewCount);
    out.push({
      id: `review-pile-${reviewCount}`,
      kind: "review-pile",
      headline: "Review queue is getting top-heavy",
      body: tpl.replace("{n}", String(reviewCount)),
      severity: 40,
    });
  }

  // Rule 6 — doing-empty (>= 5 todo, 0 in progress)
  const todoCount = myOpen.filter((t) => t.lane === "todo").length;
  const doingCount = myOpen.filter((t) => t.lane === "doing").length;
  if (todoCount >= 5 && doingCount === 0) {
    const tpl = pickRand(DOING_EMPTY, "doing-empty-" + todoCount);
    out.push({
      id: `doing-empty-${todoCount}`,
      kind: "doing-empty",
      headline: "Pick something",
      body: tpl.replace("{todo}", String(todoCount)),
      severity: 30,
    });
  }

  // Sort high → low severity, cap to 6 to avoid spam.
  out.sort((a, b) => b.severity - a.severity);
  return out.slice(0, 6);
}

/** Approximate idle days from `idleDays` field if present, else from
 *  `updatedAt`. Floors fractional days to whole days. */
function idleDaysFor(t: Task, now: Date): number {
  if (typeof t.idleDays === "number") return t.idleDays;
  return Math.floor((now.getTime() - t.updatedAt.getTime()) / DAY_MS);
}
