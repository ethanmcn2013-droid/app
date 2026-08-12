"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  USERS,
  type Notification,
  type Task,
  type UserId,
} from "@/lib/data";
import { Avatar } from "@/components/showcase/avatar";
import type { DailyDigest } from "@/server/db/daily-digest";
import { formatRelativeTime } from "@/lib/utils";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import type { Nudge } from "@/lib/nudges/generate-nudges";
import type { WeeklyDigestSnapshot } from "@/server/ai";
import { weeklyDigestNarrationAction } from "@/server/actions/ai";
import { ShareThisWeekButton } from "@/components/app/share-this-week-button";
import { CopySlackSummary } from "@/components/app/copy-slack-summary";
import { RollForwardButton } from "@/components/app/inbox/roll-forward-button";
import { useHydrated } from "@/lib/use-hydrated";
import { buildGreeting } from "@/lib/personality";
import type { PersonalityPrefs } from "@/lib/personality-prefs";
import { TipCard } from "@/components/app/tip-card";

/**
 * Inbox renders two surfaces stacked:
 *
 *   1. **Today's digest**, the plain-English summary of yesterday's
 *      completions and today's due-tasks. This is exactly what the
 *      daily email *would* send tomorrow morning. Showing it inline
 *      is the design contract: zero-spam, single source.
 *
 *   2. **Direct alerts**, instant pings (only @mentions and blocks).
 *      Empty 95% of the time; loud when it isn't.
 */
export function InboxApp({
  notifications,
  digest,
  nudges,
  weeklySnapshot,
  weeklyEnabled,
  workspaceId,
  workspaceName,
  workspaceSlug,
  overdueCount,
  userName,
  personalityPrefs,
  pinnedHour,
}: {
  notifications: Notification[];
  digest: DailyDigest;
  nudges: Nudge[];
  /** Optional. When omitted (legacy callers) the weekly section is
   *  hidden entirely. */
  weeklySnapshot?: WeeklyDigestSnapshot;
  /** True when the workspace has the AI key configured AND the
   *  snapshot has at least one signal worth narrating. The recap
   *  hides cleanly when either is false. */
  weeklyEnabled?: boolean;
  /** Pass through so the streaming action can target the right
   *  workspace from the client. */
  workspaceId?: string;
  /** Display name of the active workspace, surfaced in the
   *  Slack-ready summary headline. Optional so legacy callers that
   *  predate the copy-slack-summary button still type-check. */
  workspaceName?: string;
  /** URL slug of the active workspace, used to build the
   *  `tasks.signalstudio.ie/p/{slug}` link in the Slack-ready summary. */
  workspaceSlug?: string;
  /** Server-computed count of tasks overdue today. Drives whether
   *  the roll-forward button renders at all (zero → hidden). */
  overdueCount?: number;
  /** C1: real display name resolved from DB at the page level; takes
   *  priority over the USERS Proxy fallback so Clerk users see their
   *  actual name instead of "Someone" in the greeting. */
  userName?: string;
  /** Personality prefs threaded from the page. When omitted, greeting
   *  and tips default to off (safe fallback for legacy callers). */
  personalityPrefs?: PersonalityPrefs;
  /** Demo/review only: pins the greeting's hour to the demo clock so the
   *  salutation cannot drift from the pinned "today" (or contradict the
   *  digest's "Good morning" on the same screen). Omitted in production,
   *  where the visitor's own local hour is the right one. */
  pinnedHour?: number;
}) {
  const { openTask } = useTaskPanel();
  const me = USERS[digest.user];
  const displayName = userName ?? me.name;

  return (
    /* bg-bg: the inbox reads on white — its quiet uppercase kickers sit
       directly on the page ground, and the room wash (T·95) puts them a
       hair under the 4.5:1 Axe bar. The lab specifies the room views,
       not the inbox; white stays its ground. */
    <div className="thin-scroll flex-1 overflow-auto bg-bg px-4 py-5 md:px-8 md:py-6">
      <div className="mx-auto max-w-[820px] space-y-8">
        <GreetingBanner
          name={userName ?? null}
          dueToday={digest.dueToday.length}
          overdueCount={overdueCount ?? 0}
          enabled={personalityPrefs?.greeting ?? false}
          pinnedHour={pinnedHour}
        />

        <TipCard context="inbox" enabled={personalityPrefs?.tips ?? false} />

        <NudgesSection nudges={nudges} onOpen={openTask} />

        {weeklySnapshot && weeklyEnabled ? (
          <WeeklyRecapSection snapshot={weeklySnapshot} />
        ) : null}

        {/* Today's digest */}
        <section>
          <SectionHead
            eyebrow="Daily digest"
            title={`Good morning, ${displayName}.`}
            subtitle="Your one summary for the day. We don’t send anything else unless someone tags you directly."
            action={
              <div className="flex items-center gap-2">
                {workspaceId && weeklySnapshot ? (
                  <ShareThisWeekButton
                    workspaceId={workspaceId}
                    closedThisWeek={weeklySnapshot.closedThisWeek}
                  />
                ) : null}
                {workspaceId &&
                weeklySnapshot &&
                workspaceName &&
                workspaceSlug ? (
                  <CopySlackSummary
                    workspaceName={workspaceName}
                    workspaceSlug={workspaceSlug}
                    closedThisWeek={weeklySnapshot.closedThisWeek}
                    closedTitles={weeklySnapshot.closedTitles}
                  />
                ) : null}
                {typeof overdueCount === "number" && overdueCount > 0 ? (
                  <RollForwardButton overdueCount={overdueCount} />
                ) : null}
              </div>
            }
          />

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <DigestCard
              tone="emerald"
              title="Closed yesterday"
              empty="No tasks were marked done in the last 24 hours."
              tasks={digest.completedYesterday}
              onOpen={openTask}
            />
            <DigestCard
              tone="brand"
              title="Due today"
              empty="Nothing on your plate is due in the next 24 hours."
              tasks={digest.dueToday}
              onOpen={openTask}
            />
          </div>

          <Mentions list={digest.mentions} onOpen={openTask} />
        </section>

        {/* Direct alerts */}
        <section>
          <SectionHead
            eyebrow="Direct alerts"
            title={
              notifications.length === 0
                ? "Inbox zero. Quiet here on purpose."
                : `${notifications.length} ${notifications.length === 1 ? "alert" : "alerts"} for you.`
            }
            subtitle="We only insert here for direct @mentions and blocks. Lane moves, status flips, simple edits, none of it. Read once, move on."
          />
          {notifications.length === 0 ? (
            <EmptyAlerts />
          ) : (
            <ul className="mt-4 space-y-2">
              {notifications.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onOpen={openTask}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Nudges, the "what's stuck" feed. Cheeky on purpose; the brand can
// afford a smirk because the policy underneath is restrained.
// ────────────────────────────────────────────────────────────────────

const DISMISSED_KEY = "tasks_dismissed_nudges";

function readDismissedNudges(): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function NudgesSection({
  nudges,
  onOpen,
}: {
  nudges: Nudge[];
  onOpen: (id: string) => void;
}) {
  const [dismissed, setDismissed] = useState(readDismissedNudges);
  const mounted = useHydrated();

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  };

  if (!mounted) return null;

  const visible = nudges.filter((n) => !dismissed.has(n.id));
  if (visible.length === 0) return null;

  return (
    <section>
      <SectionHead
        eyebrow="What’s stuck"
        title={`${visible.length} ${visible.length === 1 ? "thing wants" : "things want"} a nudge.`}
        subtitle="Idle work, past-due dates, tasks that are free to move. Dismiss anything you don’t need."
      />
      <ul className="mt-4 space-y-2">
        <AnimatePresence initial={false}>
          {visible.map((n) => (
            <NudgeCard
              key={n.id}
              nudge={n}
              onOpen={onOpen}
              onDismiss={dismiss}
            />
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

function NudgeCard({
  nudge,
  onOpen,
  onDismiss,
}: {
  nudge: Nudge;
  onOpen: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const tone = nudge.severity >= 75 ? "urgent" : nudge.severity >= 50 ? "warn" : "info";
  const palette =
    tone === "urgent"
      ? "border-rose-200/80 bg-rose-50/60"
      : tone === "warn"
        ? "border-amber-200/80 bg-amber-50/40"
        : "border-line-soft bg-bg-elevated/60";
  const iconColor =
    tone === "urgent"
      ? "text-rose-500"
      : tone === "warn"
        ? "text-amber-600"
        : "text-ink-quiet";

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className={
        "group relative flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors " +
        palette
      }
    >
      <span className={"mt-0.5 flex-shrink-0 " + iconColor}>
        <NudgeIcon kind={nudge.kind} />
      </span>
      <button
        type="button"
        onClick={() => nudge.taskId && onOpen(nudge.taskId)}
        disabled={!nudge.taskId}
        className="min-w-0 flex-1 text-left"
      >
        <div className="line-clamp-1 text-[13.5px] font-medium text-ink">
          {nudge.headline}
        </div>
        <p className="mt-0.5 text-[12.5px] leading-[1.5] text-ink-soft">
          {nudge.body}
        </p>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(nudge.id);
        }}
        aria-label="Dismiss nudge"
        className="ml-2 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-ink-quiet opacity-0 transition-opacity hover:bg-bg-sunken hover:text-ink-soft group-hover:opacity-100 focus-visible:opacity-100"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        >
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="6" y1="18" x2="18" y2="6" />
        </svg>
      </button>
    </motion.li>
  );
}

function NudgeIcon({ kind }: { kind: Nudge["kind"] }) {
  switch (kind) {
    case "idle-doing":
    case "idle-review":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "past-due":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
    case "blocker-cleared":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case "review-pile":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      );
    case "doing-empty":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "llm-narration":
      return (
        // Sparkle for AI-authored nudges so the surface is honest
        // about its source. Stroke matches the brand gradient
        // accent used elsewhere in the AI affordances.
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3 L13.5 9 L20 10.5 L13.5 12 L12 18 L10.5 12 L4 10.5 L10.5 9 Z" />
        </svg>
      );
  }
}

function SectionHead({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Optional right-aligned affordance (e.g. the share-this-week
   *  button on the daily-digest header). Sits flush with the title
   *  row so the eyebrow + headline keep their breathing room. */
  action?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-quiet">
        {eyebrow}
      </div>
      <div className="mt-1 flex items-start justify-between gap-3">
        <h2 className="text-balance text-[20px] font-semibold tracking-[-0.01em] text-ink">
          {title}
        </h2>
        {action ? <div className="pt-0.5">{action}</div> : null}
      </div>
      <p className="mt-1 max-w-[58ch] text-[13px] leading-[1.55] text-ink-soft">
        {subtitle}
      </p>
    </div>
  );
}

function DigestCard({
  title,
  tone,
  tasks,
  empty,
  onOpen,
}: {
  title: string;
  tone: "brand" | "emerald";
  tasks: Task[];
  empty: string;
  onOpen: (id: string) => void;
}) {
  const dotColor = tone === "brand" ? "var(--brand)" : "#10b981";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border border-line-soft bg-white p-4"
    >
      <div className="flex items-center gap-2">
        <span
          className="block h-1.5 w-1.5 rounded-full"
          style={{ background: dotColor }}
        />
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
          {title}
        </span>
        <span className="ml-auto text-[12px] tabular-nums text-ink-quiet">
          {tasks.length}
        </span>
      </div>
      {tasks.length === 0 ? (
        <p className="mt-3 text-[12.5px] leading-[1.5] text-ink-faint">
          {empty}
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {tasks.slice(0, 6).map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onOpen(t.id)}
                className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-bg-sunken/60"
              >
                <Avatar user={t.assignees[0]} size={14} />
                <span className="line-clamp-1 flex-1 text-[12.5px] text-ink">
                  {t.title}
                </span>
                {t.due ? (
                  <span className="flex-shrink-0 rounded bg-bg-sunken px-1.5 py-0.5 text-[10.5px] text-ink-soft">
                    {t.due}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
          {tasks.length > 6 ? (
            <li className="px-1.5 text-[11px] text-ink-quiet">
              + {tasks.length - 6} more
            </li>
          ) : null}
        </ul>
      )}
    </motion.div>
  );
}

function Mentions({
  list,
  onOpen,
}: {
  list: DailyDigest["mentions"];
  onOpen: (id: string) => void;
}) {
  if (list.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="mt-3 rounded-xl border border-brand/20 bg-brand-soft/40 p-4"
    >
      <div className="flex items-center gap-2">
        <span
          className="block h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--brand)" }}
        />
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand">
          Mentioned in the last 24h
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {list.map((m, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onOpen(m.taskId)}
              className="flex w-full items-start gap-2 rounded-md p-1.5 text-left transition-colors hover:bg-white/60"
            >
              <Avatar user={m.from} size={18} />
              <div className="flex-1">
                <div className="text-[12px] text-ink-soft">
                  <span className="font-medium text-ink">{m.fromName}</span>{" "}
                  on <span className="font-medium text-ink">{m.taskTitle}</span>
                </div>
                <div className="mt-0.5 text-[12.5px] text-ink-soft">
                  &ldquo;{m.snippet}&rdquo;
                </div>
              </div>
              <span className="flex-shrink-0 text-[11px] tabular-nums text-ink-quiet">
                {formatRelativeTime(m.createdAt)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function EmptyAlerts() {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-line-soft bg-white/40 p-8 text-center">
      <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-bg-sunken text-ink-quiet">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9z" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <div className="mt-3 text-[14px] font-medium text-ink">
        Nothing for you right now.
      </div>
      <p className="mx-auto mt-1 max-w-[40ch] text-[12.5px] leading-[1.5] text-ink-soft">
        That&rsquo;s by design, we don&rsquo;t ping you every time a card
        moves. Get back to work.
      </p>
    </div>
  );
}

function NotificationRow({
  notification: n,
  onOpen,
}: {
  notification: Notification;
  onOpen: (id: string) => void;
}) {
  const sentence = renderNotificationSentence(n);
  if (!sentence) return null;
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border border-line-soft bg-white p-3 transition-colors hover:border-ink-soft/30"
    >
      <button
        type="button"
        onClick={() => n.taskId && onOpen(n.taskId)}
        className="flex w-full items-start gap-3 text-left"
      >
        {sentence.actor ? (
          <Avatar user={sentence.actor} size={22} />
        ) : (
          <span className="block h-[22px] w-[22px] rounded-full bg-brand-soft" />
        )}
        <div className="flex-1">
          <div className="text-[12.5px] text-ink-soft">{sentence.line}</div>
          {sentence.body ? (
            <div className="mt-1 text-[12.5px] leading-[1.5] text-ink">
              &ldquo;{sentence.body}&rdquo;
            </div>
          ) : null}
        </div>
        <span className="flex-shrink-0 text-[11px] tabular-nums text-ink-quiet">
          {formatRelativeTime(n.createdAt)}
        </span>
      </button>
    </motion.li>
  );
}

function renderNotificationSentence(n: Notification): {
  actor: UserId | null;
  line: React.ReactNode;
  body?: string;
} | null {
  switch (n.payload.kind) {
    case "mention":
      return {
        actor: n.payload.from,
        line: (
          <>
            <span className="font-medium text-ink">
              {USERS[n.payload.from]?.name ?? n.payload.from}
            </span>{" "}
            mentioned you on{" "}
            <span className="font-medium text-ink">
              {n.payload.taskTitle}
            </span>
          </>
        ),
        body: n.payload.snippet,
      };
    case "blocked":
      return {
        actor: null,
        line: (
          <>
            <span className="font-medium text-ink">{n.payload.taskTitle}</span>{" "}
            is blocked by{" "}
            <span className="font-medium text-ink">
              {n.payload.blockerTitle}
            </span>
          </>
        ),
      };
    case "dueToday":
      return {
        actor: null,
        line: (
          <>
            <span className="font-medium text-ink">{n.payload.taskTitle}</span>{" "}
            is due today.
          </>
        ),
      };
    case "nudge": {
      // Recipient line: "{Name} sent a gentle reminder about '{title}'."
      // The task title is resolved at query time via the getNotificationsForUser
      // join; the payload intentionally carries only ids (D-008 privacy rule).
      // We resolve the sender's display name from the USERS proxy (covers seeded
      // personas) with a safe "A teammate" fallback for real Clerk ids whose
      // display name we don't have on the client.
      const senderMeta = USERS[n.payload.fromUserId];
      const senderName = senderMeta?.name ?? "A teammate";
      // taskTitle is carried by the NotificationRow via n.taskId; we don't
      // have it in the payload (by design). Use the task link affordance: the
      // row's onOpen already opens the task panel when n.taskId is set.
      return {
        actor: n.payload.fromUserId,
        line: (
          <>
            <span className="font-medium text-ink">{senderName}</span>{" "}
            sent a gentle reminder.
          </>
        ),
      };
    }
    case "milestone": {
      // System-generated: actor is null, renders the brand-soft dot avatar.
      const { count } = n.payload;
      return {
        actor: null,
        line: <>That was your {count}th completed task.</>,
      };
    }
    default:
      return null;
  }
}

// ────────────────────────────────────────────────────────────────────
// GreetingBanner — one-per-session contextual greeting above the inbox.
// Reads counts from props already available to InboxApp; computes the
// hour client-side on mount so there is no server/client mismatch.
// ────────────────────────────────────────────────────────────────────

const GREETING_SESSION_KEY = "personality:greeted:v1";

function GreetingBanner({
  name,
  dueToday,
  overdueCount,
  enabled,
  pinnedHour,
}: {
  name: string | null;
  dueToday: number;
  overdueCount: number;
  enabled: boolean;
  pinnedHour?: number;
}) {
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Defer past the paint frame so setState is not called synchronously
    // inside the effect body (react-hooks/set-state-in-effect).
    const timer = window.setTimeout(() => {
      try {
        if (sessionStorage.getItem(GREETING_SESSION_KEY)) return;
      } catch {
        // sessionStorage unavailable (private browsing edge case)
        return;
      }
      // Demo pins the hour to the demo clock; production greets by the
      // visitor's own local hour (computed on mount, so no SSR mismatch).
      const hour = pinnedHour ?? new Date().getHours();
      const result = buildGreeting({
        name,
        hour,
        dueToday,
        overdue: overdueCount,
        doneToday: 0,
      });
      if (!result) return;
      try {
        sessionStorage.setItem(GREETING_SESSION_KEY, "1");
      } catch {
        // ignore write failure
      }
      setLine(result.line);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [name, dueToday, overdueCount, enabled, pinnedHour]);

  if (!line) return null;

  return (
    <div className="rounded-lg border border-line-soft bg-bg-elevated px-4 py-3 text-[13px] leading-[1.5] text-ink-soft">
      {line}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Weekly recap, the LLM-narrated Sunday digest. Hidden until the
// user explicitly asks for it. Anti-spam contract holds: nothing
// pings, nothing auto-runs. The button is the consent.
// ────────────────────────────────────────────────────────────────────

const WEEKLY_CACHE_KEY = "tasks_weekly_recap_cache_v1";

type WeeklyCacheEntry = {
  /** Iso date the recap was generated (YYYY-MM-DD). */
  forDate: string;
  /** The narrated text. */
  text: string;
};

function readWeeklyCache(): WeeklyCacheEntry | null {
  try {
    const raw = localStorage.getItem(WEEKLY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WeeklyCacheEntry;
    if (!parsed?.forDate || !parsed?.text) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeWeeklyCache(entry: WeeklyCacheEntry) {
  try {
    localStorage.setItem(WEEKLY_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // ignore, quota / private mode
  }
}

/** No-op subscriber. The cache only changes from this component's
 *  own writes, which call `setState` directly, we don't need to
 *  listen for storage events. The subscriber is here purely to
 *  satisfy `useSyncExternalStore`'s contract. */
function weeklyCacheSubscribe(_onChange: () => void): () => void {
  void _onChange;
  return () => {};
}

/** Server snapshot used during SSR / first render. We can't read
 *  localStorage on the server, so the section renders as if no
 *  cache exists; the client snapshot replaces it post-hydration. */
function weeklyCacheServerSnapshot(): WeeklyCacheEntry | null {
  return null;
}

function WeeklyRecapSection({
  snapshot,
}: {
  snapshot: WeeklyDigestSnapshot;
}) {
  const reduce = useReducedMotion();
  // Subscribe to localStorage via useSyncExternalStore so the
  // initial cached read happens during render (post-hydration) and
  // doesn't trip the no-setState-in-effect rule. The store ignores
  // change events, the cache only changes via our own writes,
  // which already setState directly.
  const cached = useSyncExternalStore(
    weeklyCacheSubscribe,
    readWeeklyCache,
    weeklyCacheServerSnapshot,
  );
  const [text, setText] = useState<string>(() => cached?.text ?? "");
  const [hasRun, setHasRun] = useState<boolean>(() => Boolean(cached));
  const [isStreaming, startTransition] = useTransition();

  const run = useCallback(() => {
    if (isStreaming) return;
    setHasRun(true);
    setText("");
    startTransition(async () => {
      try {
        const stream = await weeklyDigestNarrationAction();
        const reader = stream.getReader();
        let acc = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (typeof value === "string") {
            acc += value;
            setText(acc);
          }
        }
        const today = new Date().toISOString().slice(0, 10);
        writeWeeklyCache({ forDate: today, text: acc });
      } catch (err) {
        console.warn("weekly-recap: stream failed", err);
        setText("Couldn’t write the recap. Try again in a moment.");
      }
    });
  }, [isStreaming]);

  // Empty-state guard: if literally nothing happened this week and
  // there's no cached recap, hide the section entirely. The brand
  // doesn't fabricate content for empty workspaces.
  const isQuietWeek =
    snapshot.closedThisWeek === 0 && snapshot.openCount === 0;
  if (isQuietWeek && !cached) return null;

  // Subhead copy varies by state, keep it dry, no exclamation
  // points. The numbers do the talking.
  const subtitle = (() => {
    if (snapshot.closedThisWeek === 0 && snapshot.openCount > 0) {
      return `${snapshot.openCount} still open. Quiet on closeouts.`;
    }
    if (snapshot.closedThisWeek > 0 && snapshot.stillCirclingTitles.length > 0) {
      return `${snapshot.closedThisWeek} closed, ${snapshot.stillCirclingTitles.length} still circling.`;
    }
    if (snapshot.closedThisWeek > 0) {
      return `${snapshot.closedThisWeek} closeout${snapshot.closedThisWeek === 1 ? "" : "s"} this week.`;
    }
    return "Sunday is for resets.";
  })();

  return (
    <section>
      <SectionHead
        eyebrow="Weekly recap"
        title="Your week, narrated."
        subtitle={subtitle}
      />

      <motion.div
        layout
        className="relative mt-4 overflow-hidden rounded-xl border border-line-soft bg-white p-5"
        style={{
          background:
            "linear-gradient(180deg, rgba(79,70,229,0.04) 0%, rgba(255,255,255,1) 60%)",
        }}
      >
        <div className="flex items-center gap-2 pb-3">
          <span
            aria-hidden
            className="block h-1.5 w-1.5 rounded-full"
            style={{
              background:
                "linear-gradient(135deg, var(--brand) 0%, #4338ca 100%)",
            }}
          />
          <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
            {cached?.forDate
              ? `Generated ${formatCacheDate(cached.forDate)}`
              : "Sunday digest"}
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            {hasRun && !isStreaming ? (
              <button
                type="button"
                onClick={run}
                className="text-[10.5px] uppercase tracking-[0.08em] text-ink-faint transition-colors hover:text-brand"
              >
                Regenerate
              </button>
            ) : null}
          </span>
        </div>

        {!hasRun ? (
          <button
            type="button"
            onClick={run}
            className="group flex w-full items-center justify-between gap-3 rounded-lg border border-dashed border-line-soft bg-bg-sunken/30 px-4 py-3 text-left transition-all duration-300 hover:border-brand/40 hover:bg-brand-soft/30"
            style={{ transitionTimingFunction: "var(--ease-out-expo)" }}
          >
            <span>
              <span className="block text-[13.5px] font-medium text-ink">
                Narrate the week
              </span>
              <span className="mt-0.5 block text-[12px] text-ink-soft">
                4-5 sentences. Closes, hold-ups, a Sunday vibe-check.
              </span>
            </span>
            <span className="inline-flex h-7 items-center rounded-full bg-ink px-3 text-[10.5px] font-medium uppercase tracking-[0.08em] text-white transition-opacity group-hover:opacity-90">
              Run
            </span>
          </button>
        ) : (
          <motion.p
            initial={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, y: 4 }
            }
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.32,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="text-[14px] leading-[1.65] text-ink"
          >
            {text || (
              <span className="text-ink-faint">Reading the week…</span>
            )}
            {isStreaming && text ? (
              <motion.span
                aria-hidden
                className="ml-0.5 inline-block h-[12px] w-[2px] -translate-y-[1px] bg-brand align-middle"
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{
                  duration: 0.9,
                  ease: "easeInOut",
                  repeat: Infinity,
                }}
              />
            ) : null}
          </motion.p>
        )}

        {/* Tiny stat strip at the bottom, the rules-based facts the
            LLM was given. Honesty about the source of truth. */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line-soft pt-3 text-[11px] text-ink-quiet">
          <Stat label="Closed" value={snapshot.closedThisWeek} />
          <span aria-hidden className="text-line-soft">
            ·
          </span>
          <Stat label="Open" value={snapshot.openCount} />
          {snapshot.stillCirclingTitles.length > 0 ? (
            <>
              <span aria-hidden className="text-line-soft">
                ·
              </span>
              <Stat
                label="Idle ≥ 3d"
                value={snapshot.stillCirclingTitles.length}
              />
            </>
          ) : null}
        </div>
      </motion.div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-[12px] font-semibold tabular-nums text-ink">
        {value}
      </span>
      <span className="uppercase tracking-[0.1em]">{label}</span>
    </span>
  );
}

function formatCacheDate(iso: string): string {
  // iso is YYYY-MM-DD, we just want a short, friendly form.
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return "today";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
