"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
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
import { AppPageHeader } from "@/components/app/page-header";
import { ShellIcon } from "@/components/shell/shell-icons";
import { useHydrated } from "@/lib/use-hydrated";
import { buildGreeting } from "@/lib/personality";
import type { PersonalityPrefs } from "@/lib/personality-prefs";
import { TipCard } from "@/components/app/tip-card";
import type { DirectedAttention } from "@/server/conversations/attention";
import { ConversationAttentionSection } from "./conversation-attention";
import styles from "./inbox.module.css";

/**
 * Inbox v3: a calm, list-first inbox on the shared 1180px page column.
 *
 * Main column, in the order a person acts on it:
 *   - **Project messages**, mentions and Task Discussion from Projects.
 *   - **What's stuck**, rules-based nudges the reader can dismiss.
 *   - **Daily digest**, exactly what the morning email would send: what is
 *     due, who mentioned you, what closed. Showing it inline is the design
 *     contract: zero spam, single source.
 *   - **Direct alerts**, instant pings (only @mentions and blocks). Empty
 *     most of the time, so it sits last when empty and first when not.
 *
 * Side column: this week's numbers with the share actions, the optional
 * narrated recap, the tip line and a short legend of how the inbox decides
 * what lands here. Under ~880px of content width the side column drops
 * below the main one.
 *
 * The personality greeting is the page subtitle, not a banner, so the
 * reader is greeted once.
 */
export function InboxApp({
  notifications,
  attention,
  attentionAvailable = true,
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
  attention?: readonly DirectedAttention[];
  attentionAvailable?: boolean;
  digest: DailyDigest;
  nudges: Nudge[];
  /** Optional. When omitted (legacy callers) the weekly card is
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
   *  salutation cannot drift from the pinned "today". Omitted in
   *  production, where the visitor's own local hour is the right one. */
  pinnedHour?: number;
}) {
  const { openTask } = useTaskPanel();
  const displayName = userName?.trim() || null;
  const showAttention = attention !== undefined || !attentionAvailable;
  const greeting = useSessionGreeting({
    name: userName ?? null,
    dueToday: digest.dueToday.length,
    overdueCount: overdueCount ?? 0,
    enabled: personalityPrefs?.greeting ?? false,
    pinnedHour,
  });

  const alerts = (
    <AlertsSection
      key="alerts"
      notifications={notifications}
      attentionShown={showAttention}
      onOpen={openTask}
    />
  );

  return (
    <MotionConfig reducedMotion="user">
      <AppPageHeader
        description={greeting ?? "Anything that needs you, plus one summary a day."}
        actions={
          typeof overdueCount === "number" && overdueCount > 0 ? (
            <RollForwardButton overdueCount={overdueCount} />
          ) : null
        }
      />
      <div className={`${styles.scroll} thin-scroll`}>
        <div className={`${styles.inner} mx-auto w-full max-w-[1180px] px-4 md:px-8`}>
          <div className={styles.grid}>
            <div className={styles.column}>
              {notifications.length > 0 ? alerts : null}

              {showAttention ? (
                <ConversationAttentionSection initial={attention ?? []} available={attentionAvailable} />
              ) : null}

              <NudgesSection nudges={nudges} onOpen={openTask} />

              <DigestSection
                digest={digest}
                digestUserName={displayName}
                onOpen={openTask}
              />

              {notifications.length === 0 ? alerts : null}
            </div>

            <aside className={`${styles.column} ${styles.side}`} aria-label="Summary">
              {weeklySnapshot ? (
                <WeekSection
                  snapshot={weeklySnapshot}
                  narrationEnabled={Boolean(weeklyEnabled)}
                  actions={
                    workspaceId ? (
                      <>
                        <ShareThisWeekButton
                          workspaceId={workspaceId}
                          closedThisWeek={weeklySnapshot.closedThisWeek}
                        />
                        {workspaceName && workspaceSlug ? (
                          <CopySlackSummary
                            workspaceName={workspaceName}
                            workspaceSlug={workspaceSlug}
                            closedThisWeek={weeklySnapshot.closedThisWeek}
                            closedTitles={weeklySnapshot.closedTitles}
                          />
                        ) : null}
                      </>
                    ) : null
                  }
                />
              ) : null}

              <div className={styles.tip}>
                <TipCard context="inbox" enabled={personalityPrefs?.tips ?? false} />
              </div>

              <HowItWorks />
            </aside>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}

// ────────────────────────────────────────────────────────────────────
// Shared pieces
// ────────────────────────────────────────────────────────────────────

function CardHead({
  id,
  title,
  count,
  countTone,
  end,
}: {
  id: string;
  title: string;
  count?: number;
  countTone?: "accent" | "danger";
  end?: React.ReactNode;
}) {
  return (
    <div className={styles.cardHead}>
      <h2 id={id} className={styles.cardTitle}>
        {title}
        {typeof count === "number" ? (
          <span className={styles.cardCount} data-tone={count > 0 ? countTone : undefined}>
            <span className="sr-only">(</span>
            {count}
            <span className="sr-only">)</span>
          </span>
        ) : null}
      </h2>
      {end}
    </div>
  );
}

const CLOSE_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
    <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
  </svg>
);

const CHECK_ICON = (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m3.5 8.5 3 3 6-7" />
  </svg>
);

function SparkleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2.5 9.1 6.9 13.5 8 9.1 9.1 8 13.5 6.9 9.1 2.5 8 6.9 6.9Z" />
    </svg>
  );
}

function FlagIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 14V2.75M3.5 3h8l-1.75 3 1.75 3h-8" />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────
// Nudges, the "what's stuck" feed. Dry on purpose; the policy
// underneath is restrained.
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

const NUDGE_LABEL: Record<Nudge["kind"], string> = {
  "idle-doing": "Gone quiet",
  "idle-review": "Waiting on review",
  "past-due": "Past due",
  "blocker-cleared": "Free to move",
  "review-pile": "Reviews waiting",
  "doing-empty": "Nothing started",
  "llm-narration": "Suggested",
};

function nudgeTone(nudge: Nudge): "danger" | "warning" | "success" | undefined {
  if (nudge.kind === "blocker-cleared") return "success";
  if (nudge.severity >= 75) return "danger";
  if (nudge.severity >= 50) return "warning";
  return undefined;
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

  // The dismissed list lives in this browser, so the card waits for
  // hydration rather than flashing nudges the reader already cleared.
  const visible = mounted ? nudges.filter((n) => !dismissed.has(n.id)) : [];

  return (
    <AnimatePresence>
      {visible.length > 0 ? (
        <motion.section
          key="nudges"
          aria-labelledby="inbox-stuck"
          className={styles.card}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <CardHead id="inbox-stuck" title="What’s stuck" count={visible.length} countTone="danger" />
          <p className={styles.cardNote}>
            Work that has gone quiet or slipped its date. Dismiss anything you don’t need.
          </p>
          <ul className={styles.list}>
            <AnimatePresence initial={false}>
              {visible.map((n) => (
                <NudgeRow key={n.id} nudge={n} onOpen={onOpen} onDismiss={dismiss} />
              ))}
            </AnimatePresence>
          </ul>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}

function NudgeRow({
  nudge,
  onOpen,
  onDismiss,
}: {
  nudge: Nudge;
  onOpen: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const tone = nudgeTone(nudge);
  return (
    <motion.li
      layout="position"
      className={styles.row}
      exit={{ opacity: 0, height: 0, minHeight: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      style={{ overflow: "hidden" }}
    >
      <button
        type="button"
        onClick={() => nudge.taskId && onOpen(nudge.taskId)}
        disabled={!nudge.taskId}
        className={styles.rowButton}
      >
        <span className={styles.glyph} data-tone={tone}>
          <NudgeIcon kind={nudge.kind} />
        </span>
        <span className={styles.rowMain}>
          <span className={styles.rowTitle}>{nudge.headline}</span>
          <span className={styles.rowBody}>{nudge.body}</span>
        </span>
      </button>
      <span className={styles.rowEnd}>
        <span className={`${styles.pill} ${styles.wideOnly}`} data-tone={tone}>{NUDGE_LABEL[nudge.kind]}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(nudge.id);
          }}
          aria-label="Dismiss nudge"
          title="Dismiss"
          className={styles.dismiss}
        >
          {CLOSE_ICON}
        </button>
      </span>
    </motion.li>
  );
}

function NudgeIcon({ kind }: { kind: Nudge["kind"] }) {
  switch (kind) {
    case "idle-doing":
    case "idle-review":
      return <ShellIcon.clock size={15} />;
    case "past-due":
      return <ShellIcon.alert size={15} />;
    case "blocker-cleared":
      return <ShellIcon.checkCircle size={15} />;
    case "review-pile":
      return <ShellIcon.layers size={15} />;
    case "doing-empty":
      return (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8.75 1.75 3.5 9h4l-.75 5.25L12.5 7h-4Z" />
        </svg>
      );
    case "llm-narration":
      // Sparkle for written nudges so the surface is honest about its
      // source.
      return <SparkleIcon size={15} />;
  }
}

// ────────────────────────────────────────────────────────────────────
// Daily digest: due, mentions, closed.
// ────────────────────────────────────────────────────────────────────

const DIGEST_ROW_LIMIT = 6;

function formatDigestDate(iso: string): string {
  // `forDate` is a calendar date (YYYY-MM-DD). Read it at noon UTC and
  // format in UTC so server and client agree on the day.
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(d);
}

function DigestSection({
  digest,
  digestUserName,
  onOpen,
}: {
  digest: DailyDigest;
  digestUserName: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    <section aria-labelledby="inbox-digest" className={styles.card}>
      <CardHead
        id="inbox-digest"
        title="Daily digest"
        end={<span className={styles.cardMeta}>{formatDigestDate(digest.forDate)}</span>}
      />

      <DigestGroup
        label="Due in the next 24 hours"
        tasks={digest.dueToday}
        empty="Nothing on your plate is due in the next 24 hours."
        digestUser={digest.user}
        digestUserName={digestUserName}
        onOpen={onOpen}
      />

      {digest.mentions.length > 0 ? (
        <div className={styles.group}>
          <p className={styles.groupLabel}>
            Mentioned in the last 24 hours
            <span className={styles.groupCount}>{digest.mentions.length}</span>
          </p>
          <ul className={styles.list}>
            {digest.mentions.map((m, i) => (
              <li key={i} className={styles.row}>
                <button type="button" onClick={() => onOpen(m.taskId)} className={styles.rowButton}>
                  <Avatar user={m.from} name={m.fromName} size={22} />
                  <span className={styles.rowMain}>
                    <span className={styles.rowLine}>
                      <strong>{m.fromName}</strong> on <strong>{m.taskTitle}</strong>
                    </span>
                    <span className={styles.quote}>{m.snippet}</span>
                  </span>
                  <span className={styles.time}>{formatRelativeTime(m.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <DigestGroup
        label="Closed yesterday"
        tasks={digest.completedYesterday}
        done
        empty="No tasks were marked done in the last 24 hours."
        digestUser={digest.user}
        digestUserName={digestUserName}
        onOpen={onOpen}
      />
    </section>
  );
}

function DigestGroup({
  label,
  tasks,
  done = false,
  empty,
  digestUser,
  digestUserName,
  onOpen,
}: {
  label: string;
  tasks: Task[];
  done?: boolean;
  empty: string;
  digestUser: UserId;
  digestUserName: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    <div className={styles.group}>
      <p className={styles.groupLabel}>
        {label}
        <span className={styles.groupCount}>{tasks.length}</span>
      </p>
      {tasks.length === 0 ? (
        <p className={styles.groupEmpty}>{empty}</p>
      ) : (
        <ul className={styles.list}>
          {tasks.slice(0, DIGEST_ROW_LIMIT).map((t) => {
            // The digest belongs to the signed-in reader, so their own face
            // on every row is noise. Show an avatar only when the Task is
            // someone else's, and only pass the profile name for the
            // reader's own id.
            const mine = t.assignees.length === 0 || t.assignees.includes(digestUser);
            const other = mine ? null : t.assignees[0];
            return (
              <li key={t.id} className={styles.row} data-align="center">
                <button type="button" onClick={() => onOpen(t.id)} className={styles.rowButton}>
                  <span className={styles.check} data-state={done ? "done" : undefined} aria-hidden="true">
                    {done ? CHECK_ICON : null}
                  </span>
                  <span className={styles.rowMain}>
                    <span className={styles.rowTitle} data-done={done ? "" : undefined}>{t.title}</span>
                  </span>
                  {other ? (
                    <Avatar user={other} name={other === digestUser ? digestUserName ?? undefined : undefined} size={20} />
                  ) : null}
                  {!done && t.due ? <span className={styles.pill}>{t.due}</span> : null}
                </button>
              </li>
            );
          })}
          {tasks.length > DIGEST_ROW_LIMIT ? (
            <li className={styles.more}>+ {tasks.length - DIGEST_ROW_LIMIT} more</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Direct alerts: @mentions, blocks, reminders, milestones.
// ────────────────────────────────────────────────────────────────────

function AlertsSection({
  notifications,
  attentionShown,
  onOpen,
}: {
  notifications: Notification[];
  attentionShown: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <section aria-labelledby="inbox-alerts" className={styles.card}>
      <CardHead id="inbox-alerts" title="Direct alerts" count={notifications.length} countTone="accent" />
      {notifications.length === 0 ? (
        <div className={styles.zero}>
          <span className={styles.zeroIcon}>
            <ShellIcon.bell size={16} />
          </span>
          <h3 className={styles.zeroTitle}>
            {attentionShown ? "No task alerts right now." : "Inbox zero. Quiet here on purpose."}
          </h3>
          <p className={styles.zeroBody}>
            Alerts land here only when someone @mentions you or a task of yours is held up. Card moves and edits never ping you.
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          <AnimatePresence initial={false}>
            {notifications.map((n) => (
              <NotificationRow key={n.id} notification={n} onOpen={onOpen} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
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
      className={styles.row}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <button
        type="button"
        onClick={() => n.taskId && onOpen(n.taskId)}
        className={styles.rowButton}
      >
        {sentence.actor ? (
          <Avatar user={sentence.actor} size={24} />
        ) : (
          <span className={styles.glyph} data-size="sm" data-tone={sentence.tone ?? "accent"}>
            {sentence.icon ?? <ShellIcon.bell size={13} />}
          </span>
        )}
        <span className={styles.rowMain}>
          <span className={styles.rowLine}>{sentence.line}</span>
          {sentence.body ? <span className={styles.quote}>{sentence.body}</span> : null}
        </span>
        <span className={styles.time}>{formatRelativeTime(n.createdAt)}</span>
      </button>
    </motion.li>
  );
}

function renderNotificationSentence(n: Notification): {
  actor: UserId | null;
  line: React.ReactNode;
  body?: string;
  icon?: React.ReactNode;
  tone?: "accent" | "warning" | "success";
} | null {
  switch (n.payload.kind) {
    case "mention":
      return {
        actor: n.payload.from,
        line: (
          <>
            <strong>{USERS[n.payload.from]?.name ?? n.payload.from}</strong> mentioned you on{" "}
            <strong>{n.payload.taskTitle}</strong>
          </>
        ),
        body: n.payload.snippet,
      };
    case "blocked":
      return {
        actor: null,
        icon: <ShellIcon.alert size={13} />,
        tone: "warning",
        line: (
          <>
            <strong>{n.payload.taskTitle}</strong> is waiting on <strong>{n.payload.blockerTitle}</strong>
          </>
        ),
      };
    case "dueToday":
      return {
        actor: null,
        icon: <ShellIcon.clock size={13} />,
        line: (
          <>
            <strong>{n.payload.taskTitle}</strong> is due today.
          </>
        ),
      };
    case "nudge": {
      // Recipient line: "{Name} sent a gentle reminder."
      // The task title is resolved at query time via the getNotificationsForUser
      // join; the payload intentionally carries only ids (D-008 privacy rule).
      // We resolve the sender's display name from the USERS proxy (covers seeded
      // personas) with a safe "A teammate" fallback for real Clerk ids whose
      // display name we don't have on the client. The row's onOpen already
      // opens the task panel when n.taskId is set.
      const senderMeta = USERS[n.payload.fromUserId];
      const senderName = senderMeta?.name ?? "A teammate";
      return {
        actor: n.payload.fromUserId,
        line: (
          <>
            <strong>{senderName}</strong> sent a gentle reminder.
          </>
        ),
      };
    }
    case "milestone": {
      // System-generated: no actor, renders the milestone flag.
      const { count } = n.payload;
      return {
        actor: null,
        icon: <FlagIcon size={13} />,
        tone: "success",
        line: <>That was your {count}th completed task.</>,
      };
    }
    default:
      return null;
  }
}

// ────────────────────────────────────────────────────────────────────
// Greeting: the page subtitle, once per session.
// ────────────────────────────────────────────────────────────────────

const GREETING_SESSION_KEY = "personality:greeted:v1";

function useSessionGreeting({
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
}): string | null {
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

  return line;
}

// ────────────────────────────────────────────────────────────────────
// This week: the numbers, the share actions and the narrated recap.
// ────────────────────────────────────────────────────────────────────

function WeekSection({
  snapshot,
  narrationEnabled,
  actions,
}: {
  snapshot: WeeklyDigestSnapshot;
  narrationEnabled: boolean;
  actions: React.ReactNode;
}) {
  const stats = [
    { label: "Closed", value: snapshot.closedThisWeek },
    { label: "Still open", value: snapshot.openCount },
    { label: "Gone quiet", value: snapshot.stillCirclingTitles.length },
  ];
  return (
    <section aria-labelledby="inbox-week" className={styles.card}>
      <CardHead id="inbox-week" title="This week" end={<span className={styles.cardMeta}>Last 7 days</span>} />
      <dl className={styles.stats}>
        {stats.map((stat) => (
          <div key={stat.label} className={styles.stat}>
            <dt className={styles.statLabel}>{stat.label}</dt>
            <dd className={styles.statValue}>{stat.value}</dd>
          </div>
        ))}
      </dl>
      {snapshot.closedThisWeek > 0 && actions ? <div className={styles.cardFoot}>{actions}</div> : null}
      {narrationEnabled ? <WeeklyRecap snapshot={snapshot} /> : null}
    </section>
  );
}

// Weekly recap, the narrated Sunday digest. Hidden until the reader
// explicitly asks for it. Anti-spam contract holds: nothing pings,
// nothing auto-runs. The button is the consent.

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
 *  localStorage on the server, so the recap renders as if no
 *  cache exists; the client snapshot replaces it post-hydration. */
function weeklyCacheServerSnapshot(): WeeklyCacheEntry | null {
  return null;
}

function WeeklyRecap({ snapshot }: { snapshot: WeeklyDigestSnapshot }) {
  // Subscribe to localStorage via useSyncExternalStore so the
  // initial cached read happens during render (post-hydration) and
  // doesn't trip the no-setState-in-effect rule.
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
  // there's no cached recap, hide the recap entirely. The brand
  // doesn't fabricate content for empty workspaces.
  const isQuietWeek = snapshot.closedThisWeek === 0 && snapshot.openCount === 0;
  if (isQuietWeek && !cached) return null;

  return (
    <div className={styles.recap}>
      <div className={styles.recapHead}>
        <p className={styles.recapTitle}>
          <span className={styles.glyph} data-size="sm" data-tone="accent">
            <SparkleIcon size={13} />
          </span>
          Weekly recap
          {cached?.forDate ? (
            <span className={styles.recapWhen}>· {formatCacheDate(cached.forDate)}</span>
          ) : null}
        </p>
        {hasRun && !isStreaming ? (
          <button type="button" onClick={run} className={styles.textButton}>
            Regenerate
          </button>
        ) : null}
      </div>

      {!hasRun ? (
        <button type="button" onClick={run} className={styles.narrate}>
          <span className={styles.rowMain}>
            <span className={styles.rowTitle}>Narrate the week</span>
            <span className={styles.rowBody}>A few plain sentences on what closed and what is still open.</span>
          </span>
          <ShellIcon.arrowRight size={14} />
        </button>
      ) : (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className={styles.recapText}
          aria-live="polite"
        >
          {text || <span className={styles.recapWaiting}>Reading the week…</span>}
          {isStreaming && text ? (
            <motion.span
              aria-hidden
              className={styles.caret}
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 0.9, ease: "easeInOut", repeat: Infinity }}
            />
          ) : null}
        </motion.p>
      )}
    </div>
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
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

// ────────────────────────────────────────────────────────────────────
// How it works: the inbox's policy in three lines, for first contact.
// ────────────────────────────────────────────────────────────────────

function HowItWorks() {
  const items = [
    {
      title: "Direct alerts",
      body: "Only @mentions and tasks that are held up. Nothing else pings you.",
      icon: <ShellIcon.bell size={13} />,
      tone: "accent",
    },
    {
      title: "Daily digest",
      body: "One summary a day of what is due, who mentioned you and what closed. It matches the morning email.",
      icon: <ShellIcon.sun size={13} />,
      tone: undefined,
    },
    {
      title: "What’s stuck",
      body: "Work that has gone quiet or slipped its date. Dismiss what you don’t need.",
      icon: <ShellIcon.clock size={13} />,
      tone: "warning",
    },
  ];
  return (
    <section aria-labelledby="inbox-how" className={styles.card}>
      <CardHead id="inbox-how" title="How your inbox works" />
      <ul className={styles.legend}>
        {items.map((item) => (
          <li key={item.title} className={styles.legendItem}>
            <span className={styles.glyph} data-size="sm" data-tone={item.tone}>{item.icon}</span>
            <span>
              <span className={styles.legendTitle}>{item.title}</span>
              <span className={styles.legendBody}>{item.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
