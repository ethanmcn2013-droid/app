"use client";

/**
 * The plan's status, as one sentence of up to three clauses (spec 3.2):
 *
 *   ● Shared page live · 1 link · 2 changes not on it yet · Updated from Tasks 2 min ago
 *
 * Replaces the separate visibility and freshness lines. The sharing part is
 * one button that opens the share sheet. The freshness part is its own
 * words with its own Refresh; the two never merge into one control.
 *
 * Freshness is presentational: the refresh itself has ONE owner,
 * `useMilestoneEdits`, which runs it once on arrival and reads the result's
 * `complete` and `totalCount` so a truncated refresh is said out loud. This
 * line reports:
 *
 *   - "Updated from Tasks 2 minutes ago · Refresh", from the persisted sync
 *     state or the refresh that just landed;
 *   - a retryable failure, visibly, in the warning tone, with Try again;
 *   - a SETTLED refusal (archived, access gone) once, politely, with no
 *     control, and Refresh disabled and described by it: a button that
 *     cannot work is worse than no button;
 *   - the truncation sentence when Tasks has more milestones than one refresh
 *     can read.
 */

import { useEffect, useState } from "react";
import {
  formatLastRefreshed,
  truncationNotice,
  type TimelineFreshnessView,
} from "@/modules/timeline/lib/freshness";
import { changesClause, linkCount, shareClause, shareStateOf, type SharePublicationSummary } from "./share-state";
import type { SyncState } from "./use-milestone-edits";
import styles from "./plan.module.css";

/** Ties the disabled Refresh control to the one statement of why it is disabled. */
export const SETTLED_REFUSAL_ID = "timeline-sync-settled-refusal";

export function PlanStatusLine({
  publication,
  todayIso,
  onOpenShare,
  mode,
  syncState,
  freshness,
  lastRefreshedMs,
  serverNowMs,
  onRefresh,
  driftCount = 0,
  onJumpToDrift,
}: {
  publication: SharePublicationSummary | null;
  todayIso: string;
  onOpenShare: () => void;
  /** `sync`: a live plan that refreshes from Tasks. */
  mode: "sync" | "review" | "archived";
  syncState: SyncState;
  freshness: TimelineFreshnessView | null;
  lastRefreshedMs: number | null;
  /** The loader's clock, so the first client render matches the server's. */
  serverNowMs: number;
  onRefresh: () => void;
  /** Milestones Tasks changed after they were edited here. */
  driftCount?: number;
  onJumpToDrift?: () => void;
}) {
  const kind = shareStateOf(publication);
  const pending = changesClause(publication?.divergedTitles.length ?? 0);

  return (
    <div className={styles.statusLine}>
      <button
        type="button"
        className={styles.statusShare}
        onClick={onOpenShare}
        aria-haspopup="dialog"
        data-timeline-visibility={kind === "live" ? "live" : "private"}
      >
        <span className={styles.statusDot} data-state={kind} aria-hidden="true" />
        <span className={styles.statusStrong}>{shareClause(publication, todayIso)}</span>
        {kind === "live" && publication ? (
          <>
            <span className={styles.statusSep} aria-hidden="true">
              ·
            </span>
            <span>{linkCount(publication.activeShareCount)}</span>
          </>
        ) : null}
        {pending ? (
          <>
            <span className={styles.statusSep} aria-hidden="true">
              ·
            </span>
            <span className={styles.statusPending}>{pending}</span>
          </>
        ) : null}
        <svg className={styles.statusChevron} width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {driftCount > 0 && onJumpToDrift ? (
        <button type="button" className={styles.driftCounter} onClick={onJumpToDrift}>
          {driftCount === 1 ? "1 milestone changed in Tasks" : `${driftCount} milestones changed in Tasks`}
        </button>
      ) : null}
      {mode === "sync" ? (
        <Freshness
          syncState={syncState}
          freshness={freshness}
          lastRefreshedMs={lastRefreshedMs}
          serverNowMs={serverNowMs}
          onRefresh={onRefresh}
        />
      ) : (
        <span className={styles.statusPart}>
          {mode === "archived" ? "Read only" : "Sample plan. Changes stay on this screen."}
        </span>
      )}
    </div>
  );
}

function Freshness({
  syncState,
  freshness,
  lastRefreshedMs,
  serverNowMs,
  onRefresh,
}: {
  syncState: SyncState;
  freshness: TimelineFreshnessView | null;
  lastRefreshedMs: number | null;
  serverNowMs: number;
  onRefresh: () => void;
}) {
  const [nowMs, setNowMs] = useState(serverNowMs);

  // The server's clock renders first, so hydration cannot mismatch; the
  // reader's clock takes over on the first tick.
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const settledRefusal = syncState.kind === "failed" && !syncState.retryable ? syncState.message : null;
  const persistedTruncation = freshness ? truncationNotice(freshness) : null;
  const liveTruncation =
    syncState.kind === "truncated"
      ? truncationNotice({ truncated: true, importedCount: syncState.imported, sourceCount: syncState.total })
      : null;
  const truncation = liveTruncation ?? persistedTruncation;
  const last = lastRefreshedMs ?? freshness?.lastSuccessAtMs ?? null;
  const when = formatLastRefreshed(last, Math.max(nowMs, last ?? 0)).replace(/^Last refreshed/, "Updated from Tasks");
  const stale = last !== null && nowMs - last > 24 * 60 * 60 * 1000;

  return (
    <span className={styles.statusPart}>
      {syncState.kind === "failed" && syncState.retryable ? (
        <span role="status" aria-live="polite" className={styles.statusWarn}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2.2 14.3 13H1.7Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M8 6.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="11.3" r="0.8" fill="currentColor" />
          </svg>
          Could not refresh from Tasks. {syncState.message}
          <button type="button" className={styles.textButton} onClick={onRefresh}>
            Try again
          </button>
        </span>
      ) : (
        <>
          <span role="status" aria-live="polite">
            {syncState.kind === "refreshing" ? "Refreshing from Tasks…" : stale ? when.replace(/^Updated/, "Last updated") : when}
          </span>
          {syncState.kind === "refreshing" ? null : (
            <button
              type="button"
              className={styles.textButton}
              onClick={onRefresh}
              disabled={settledRefusal !== null}
              aria-describedby={settledRefusal ? SETTLED_REFUSAL_ID : undefined}
            >
              Refresh
            </button>
          )}
        </>
      )}

      {settledRefusal ? (
        <span id={SETTLED_REFUSAL_ID} role="status">
          {settledRefusal}
        </span>
      ) : null}

      {truncation ? (
        <span role="status" className={styles.statusQuiet}>
          {truncation}
        </span>
      ) : null}
    </span>
  );
}
