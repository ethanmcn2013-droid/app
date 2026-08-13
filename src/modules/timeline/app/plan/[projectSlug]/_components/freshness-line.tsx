"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatLastRefreshed,
  truncationNotice,
  type TimelineFreshnessView,
} from "@/modules/timeline/lib/freshness";
import { syncMilestonesAction } from "@/modules/timeline/server/actions/workspaces";

/**
 * "Last refreshed …", Retry, and the truncation sentence — on View as well as
 * Edit (plan §6.5, F7).
 *
 * ── WHAT WAS MISSING ───────────────────────────────────────────────────────
 * Two things, and the second is worse than the first.
 *
 *   1. Only EDIT refreshed. Opening the timeline view showed whatever the last
 *      edit-mode visit happened to leave behind, with nothing on screen saying
 *      how old it was. "View and Edit both execute the safe freshness path."
 *
 *   2. `syncMilestonesAction` has returned `complete: false` and `totalCount`
 *      since WP1 and no surface read either of them. A Project past the row cap
 *      showed the first 201 milestones and said nothing, so the owner read a
 *      complete-looking plan that was quietly missing work. Preserving the rest
 *      instead of deleting it was half the repair. This is the other half.
 *
 * ── WHY THE AUTO-REFRESH IS ONLY ON VIEW ───────────────────────────────────
 * Edit already runs one, on mount, inside `CurationSurface`, with its own
 * retry and settled-refusal handling. Running a second here would double every
 * owner's Tasks read and race with the first for the same generation. So this
 * component refreshes on View and reports on both — the freshness facts it
 * renders come from the persisted sync state, which the edit-mode refresh
 * writes too.
 */
export function FreshnessLine({
  workspaceSlug,
  projectSlug,
  freshness,
  serverNowMs,
  autoRefresh,
}: {
  workspaceSlug: string;
  projectSlug: string;
  freshness: TimelineFreshnessView | null;
  /** The loader's clock, so the first client render matches the server's. */
  serverNowMs: number;
  autoRefresh: boolean;
}) {
  const router = useRouter();
  const [nowMs, setNowMs] = useState(serverNowMs);
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "refreshing" }
    | { kind: "failed"; message: string; retryable: boolean }
    | { kind: "truncated"; imported: number; total: number | null }
  >({ kind: "idle" });
  const started = useRef(false);

  const refresh = useCallback(async () => {
    setState({ kind: "refreshing" });
    try {
      const result = await syncMilestonesAction(workspaceSlug, projectSlug);
      if ("error" in result) {
        setState({ kind: "failed", message: result.error, retryable: result.retryable });
        return;
      }
      if (result.complete === false) {
        // Truncated, and said so. The rows that did not come back are not
        // proof of absence and nothing was deleted for them.
        setState({
          kind: "truncated",
          imported: result.count,
          total: result.totalCount ?? null,
        });
      } else {
        setState({ kind: "idle" });
      }
      // Only re-fetch the page when something actually moved. An unchanged
      // digest updates freshness without rewriting nodes (plan §6.5), and a
      // refresh of a page that is already correct is pure cost. `superseded`
      // means a newer refresh already landed and its own refresh is in flight.
      if (result.changed !== false && result.superseded !== true) router.refresh();
    } catch {
      setState({
        kind: "failed",
        message:
          "Timeline couldn’t refresh milestones from Tasks. Check your connection and try again.",
        retryable: true,
      });
    }
  }, [projectSlug, router, workspaceSlug]);

  useEffect(() => {
    if (!autoRefresh || started.current) return;
    started.current = true;
    void refresh();
  }, [autoRefresh, refresh]);

  // The server's clock renders first, so hydration cannot mismatch; the
  // reader's clock takes over on the first tick and keeps the sentence honest
  // while the page stays open. Deliberately no synchronous catch-up on mount:
  // the label is measured in minutes, the two clocks differ by seconds, and a
  // setState inside an effect body buys a cascading render for nothing.
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const persistedTruncation = freshness ? truncationNotice(freshness) : null;
  const liveTruncation =
    state.kind === "truncated"
      ? truncationNotice({
          truncated: true,
          importedCount: state.imported,
          sourceCount: state.total,
        })
      : null;
  const truncation = liveTruncation ?? persistedTruncation;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-5 text-ink-quiet">
      <span role="status" aria-live="polite">
        {state.kind === "refreshing"
          ? "Refreshing from Tasks…"
          : formatLastRefreshed(freshness?.lastSuccessAtMs ?? null, nowMs)}
      </span>

      {state.kind === "failed" ? (
        <>
          <span className="text-ink-soft">{state.message}</span>
          {/* A refusal that Retry cannot change offers no Retry. An archived
              Project and a revoked Project answer the same way every time, and
              a button that cannot work is worse than no button. */}
          {state.retryable ? (
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex min-h-[44px] items-center rounded-lg px-2 font-medium text-ink underline decoration-line-soft underline-offset-4 hover:decoration-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Retry
            </button>
          ) : null}
        </>
      ) : null}

      {truncation ? (
        <span role="status" className="text-ink-soft">
          {truncation}
        </span>
      ) : null}
    </div>
  );
}
