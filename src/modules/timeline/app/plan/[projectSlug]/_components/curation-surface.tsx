"use client";

/**
 * CurationSurface, owner-only authoring view for a roadmap project.
 *
 * One artifact, two zoom levels (CREATIVE_SPEC §1 governing principle):
 * this view and the public viewer share the same visual DNA. Curation
 * handles appear here; the lane structure and type are identical.
 *
 * Direct-manipulation, no markdown, no modals (UX_SPEC RW-4).
 * D5 structured manual add at the bottom.
 * D6 two-gate: editing/curating here stays PRIVATE. Publish is
 * a separate explicit action from the /app dashboard.
 */

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { EffectiveNode } from "@/modules/timeline/server/db/timeline-queries";
import {
  createManualMilestoneAction,
  upsertNodeOverlayAction,
  syncMilestonesAction,
  reorderNodesAction,
  type UpsertOverlayResult,
} from "@/modules/timeline/server/actions/workspaces";
import { attentionReason } from "@/modules/timeline/lib/roadmap/needs-attention";
import {
  buildOwnerKeyboardReorder,
  type OwnerReorderDirection,
} from "@/modules/timeline/lib/owner-reorder";
import { PRODUCT_APP_URLS } from "@/lib/product-urls";
import type { AudienceItemState } from "@/modules/timeline/server/db/timeline-schema";
import styles from "./curation-surface.module.css";

const PUBLIC_STATE_OPTIONS: ReadonlyArray<{
  value: AudienceItemState;
  label: string;
}> = [
  { value: "covered", label: "Complete" },
  { value: "now", label: "Now" },
  { value: "next", label: "Next" },
  { value: "later", label: "Later" },
  { value: "cancelled", label: "Not going ahead" },
];

function laneForAudienceState(
  state: AudienceItemState,
  targetDate: string | null,
): EffectiveNode["lane"] {
  if (state === "covered") return "Shipped";
  if (state === "now") return "In flight";
  if (state === "later" || state === "cancelled") return "Later";
  return targetDate ? "Next" : "Later";
}

function sourceStateForDate(
  node: EffectiveNode,
  targetDate: string | null,
): AudienceItemState {
  if (node.audienceStateOverride) return node.audienceStateOverride;
  if (node.status === "shipped") return "covered";
  if (node.status === "refused") return "cancelled";
  if (node.status === "in-flight" || node.status === "waiting") return "now";
  return targetDate ? "next" : "later";
}

// ── Lane helpers ──────────────────────────────────────────────────────────────

/**
 * Lane header carrying the board's earned tone grammar: a 2px rule in the
 * lane tone, a full-strength pip, the label mixed toward the tone, and a
 * whisper wash that releases below (toned lanes only — Later and cancelled
 * stay deliberately plain, exactly as the board's backlog does).
 */
const LANE_TONE: Record<AudienceItemState, string> = {
  covered: "done",
  now: "flight",
  next: "next",
  later: "plain",
  cancelled: "cancelled",
};

function LaneHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className={styles.laneHeader}>
      <span className={styles.lanePip} aria-hidden />
      <span className={styles.laneLabel}>{label}</span>
      <span className={styles.laneCount}>{count}</span>
    </div>
  );
}

// ── Status dot ────────────────────────────────────────────────────────────────

function StatusCircle({ state }: { state: AudienceItemState }) {
  return <span className={styles.statusDot} data-state={state} aria-hidden />;
}

// ── Node card ─────────────────────────────────────────────────────────────────

function NodeCard({
  node,
  workspaceSlug,
  projectSlug,
  onUpdate,
  onWriteStart,
  onWriteEnd,
  onError,
  onOptimisticUpdate,
  onDragStart,
  onDragOver,
  onDrop,
  onPointerDragStart,
  onPointerDragOver,
  onPointerDrop,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  isDraggingOver,
  isSettled = false,
  canReorder = true,
}: {
  node: EffectiveNode;
  workspaceSlug: string;
  projectSlug: string;
  onUpdate: () => void;
  onWriteStart: () => void;
  onWriteEnd: () => void;
  /** C2: surface a transient advisory message when an inline edit silently fails. */
  onError: (message: string) => void;
  onOptimisticUpdate: (
    nodeId: string,
    patch: Partial<EffectiveNode>,
  ) => void;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: (targetId: string) => void;
  onPointerDragStart: (id: string) => void;
  onPointerDragOver: (id: string) => void;
  onPointerDrop: (targetId: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isDraggingOver: boolean;
  isSettled?: boolean;
  canReorder?: boolean;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(node.title);
  const [isPending, startTransition] = useTransition();
  const [rowError, setRowError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // C2 helper, single result-handler shared by all four inline-edit sites.
  // The four sites are structurally identical (write → on success refresh, on
  // error surface a transient message). Extracting kills four copies and makes
  // the error path uniform. `onLocalRevert` is optional because most edits
  // have no local optimistic state, they fire-and-refresh, except for the
  // title input which mirrors the value in local React state.
  function handleEditResult(
    result: UpsertOverlayResult,
    onLocalRevert?: () => void,
    retry?: () => void,
  ) {
    if ("error" in result) {
      onError(result.error);
      onLocalRevert?.();
      setRetryAction(() => retry ?? null);
      setRowError(result.error);
      return;
    }
    setRetryAction(null);
    setRowError(null);
    onUpdate();
  }

  function saveTitle(nextTitle: string) {
    const previousTitle = node.title;
    const previousOverride = node.labelOverride;
    onOptimisticUpdate(node.id, {
      title: nextTitle,
      labelOverride: nextTitle || null,
    });
    onWriteStart();
    startTransition(async () => {
      try {
        const result = await upsertNodeOverlayAction(workspaceSlug, projectSlug, {
          nodeId: node.id,
          labelOverride: nextTitle || null,
        });
        handleEditResult(
          result,
          () => {
            setTitleValue(previousTitle);
            onOptimisticUpdate(node.id, {
              title: previousTitle,
              labelOverride: previousOverride,
            });
          },
          () => saveTitle(nextTitle),
        );
      } catch {
        const message =
          "Couldn't save that change. Check your connection and try again.";
        onError(message);
        setRowError(message);
        setRetryAction(() => () => saveTitle(nextTitle));
        setTitleValue(previousTitle);
        onOptimisticUpdate(node.id, {
          title: previousTitle,
          labelOverride: previousOverride,
        });
      } finally {
        onWriteEnd();
      }
    });
  }

  function commitTitle() {
    const nextTitle = titleValue.trim();
    if (!nextTitle) {
      setTitleValue(node.title);
      setEditingTitle(false);
      return;
    }
    if (nextTitle === node.title) {
      setEditingTitle(false);
      return;
    }
    saveTitle(nextTitle);
    setEditingTitle(false);
  }

  function toggleHidden() {
    onWriteStart();
    startTransition(async () => {
      try {
        const result = await upsertNodeOverlayAction(workspaceSlug, projectSlug, {
          nodeId: node.id,
          hidden: !node.hidden,
        });
        handleEditResult(result, undefined, toggleHidden);
      } catch {
        const message =
          "Couldn't save that change. Check your connection and try again.";
        onError(message);
        setRowError(message);
        setRetryAction(() => toggleHidden);
      } finally {
        onWriteEnd();
      }
    });
  }

  function setPublicState(state: AudienceItemState) {
    const previousState = node.audienceState;
    const previousOverride = node.audienceStateOverride;
    const previousLane = node.lane;
    onOptimisticUpdate(node.id, {
      audienceState: state,
      audienceStateOverride: state,
      lane: laneForAudienceState(state, node.targetDate),
    });
    onWriteStart();
    startTransition(async () => {
      try {
        const result = await upsertNodeOverlayAction(workspaceSlug, projectSlug, {
          nodeId: node.id,
          audienceStateOverride: state,
        });
        handleEditResult(
          result,
          () =>
            onOptimisticUpdate(node.id, {
              audienceState: previousState,
              audienceStateOverride: previousOverride,
              lane: previousLane,
            }),
          () => setPublicState(state),
        );
      } catch {
        const message =
          "Couldn't save that change. Check your connection and try again.";
        onError(message);
        setRowError(message);
        setRetryAction(() => () => setPublicState(state));
        onOptimisticUpdate(node.id, {
          audienceState: previousState,
          audienceStateOverride: previousOverride,
          lane: previousLane,
        });
      } finally {
        onWriteEnd();
      }
    });
  }

  function setDate(dateStr: string) {
    const nextDate = dateStr || null;
    const nextMode = dateStr ? "date" : "undated";
    const previousDate = node.targetDate;
    const previousDateOverride = node.dateOverride;
    const previousDateMode = node.dateOverrideMode;
    const previousState = node.audienceState;
    const previousLane = node.lane;
    const nextState = sourceStateForDate(node, nextDate);
    onOptimisticUpdate(node.id, {
      targetDate: nextDate,
      dateOverride: nextDate,
      dateOverrideMode: nextMode,
      audienceState: nextState,
      lane: laneForAudienceState(nextState, nextDate),
    });
    onWriteStart();
    startTransition(async () => {
      try {
        const result = await upsertNodeOverlayAction(workspaceSlug, projectSlug, {
          nodeId: node.id,
          dateOverride: nextDate,
          dateOverrideMode: nextMode,
        });
        handleEditResult(
          result,
          () =>
            onOptimisticUpdate(node.id, {
              targetDate: previousDate,
              dateOverride: previousDateOverride,
              dateOverrideMode: previousDateMode,
              audienceState: previousState,
              lane: previousLane,
            }),
          () => setDate(dateStr),
        );
      } catch {
        const message =
          "Couldn't save that change. Check your connection and try again.";
        onError(message);
        setRowError(message);
        setRetryAction(() => () => setDate(dateStr));
        onOptimisticUpdate(node.id, {
          targetDate: previousDate,
          dateOverride: previousDateOverride,
          dateOverrideMode: previousDateMode,
          audienceState: previousState,
          lane: previousLane,
        });
      } finally {
        onWriteEnd();
      }
    });
  }

  function inheritDate() {
    const previousDate = node.targetDate;
    const previousDateOverride = node.dateOverride;
    const previousDateMode = node.dateOverrideMode;
    const previousState = node.audienceState;
    const previousLane = node.lane;
    const nextState = sourceStateForDate(node, node.sourceTargetDate);
    onOptimisticUpdate(node.id, {
      targetDate: node.sourceTargetDate,
      dateOverride: null,
      dateOverrideMode: "inherit",
      audienceState: nextState,
      lane: laneForAudienceState(nextState, node.sourceTargetDate),
    });
    onWriteStart();
    startTransition(async () => {
      try {
        const result = await upsertNodeOverlayAction(
          workspaceSlug,
          projectSlug,
          {
            nodeId: node.id,
            dateOverride: null,
            dateOverrideMode: "inherit",
          },
        );
        handleEditResult(
          result,
          () =>
            onOptimisticUpdate(node.id, {
              targetDate: previousDate,
              dateOverride: previousDateOverride,
              dateOverrideMode: previousDateMode,
              audienceState: previousState,
              lane: previousLane,
            }),
          inheritDate,
        );
      } catch {
        const message =
          "Couldn't save that change. Check your connection and try again.";
        onError(message);
        setRowError(message);
        setRetryAction(() => inheritDate);
        onOptimisticUpdate(node.id, {
          targetDate: previousDate,
          dateOverride: previousDateOverride,
          dateOverrideMode: previousDateMode,
          audienceState: previousState,
          lane: previousLane,
        });
      } finally {
        onWriteEnd();
      }
    });
  }

  function inheritPublicState() {
    const previousState = node.audienceState;
    const previousOverride = node.audienceStateOverride;
    const previousLane = node.lane;
    onOptimisticUpdate(node.id, {
      audienceState: node.sourceAudienceState,
      audienceStateOverride: null,
      lane: laneForAudienceState(
        node.sourceAudienceState,
        node.targetDate,
      ),
    });
    onWriteStart();
    startTransition(async () => {
      try {
        const result = await upsertNodeOverlayAction(
          workspaceSlug,
          projectSlug,
          {
            nodeId: node.id,
            audienceStateOverride: null,
          },
        );
        handleEditResult(
          result,
          () =>
            onOptimisticUpdate(node.id, {
              audienceState: previousState,
              audienceStateOverride: previousOverride,
              lane: previousLane,
            }),
          inheritPublicState,
        );
      } catch {
        const message =
          "Couldn't save that change. Check your connection and try again.";
        onError(message);
        setRowError(message);
        setRetryAction(() => inheritPublicState);
        onOptimisticUpdate(node.id, {
          audienceState: previousState,
          audienceStateOverride: previousOverride,
          lane: previousLane,
        });
      } finally {
        onWriteEnd();
      }
    });
  }

  const isShipped =
    node.audienceState === "covered" ||
    node.audienceState === "cancelled";
  const [attentionNow] = useState(Date.now);

  // Tier 3 attention signal, surface drift at edit time (R·22). Calendar-day
  // anchored, so server-render and client-hydration agree within a calendar
  // day; no hydration mismatch in practice. Owner-only surface (route gates
  // ownership) so no isOwner check needed here.
  const attention = attentionReason(
    { status: node.status, targetDate: node.targetDate, updatedAt: node.updatedAt },
    attentionNow,
  );

  return (
    <div
      data-node-id={node.id}
      draggable={canReorder}
      onDragStart={() => {
        if (canReorder) onDragStart(node.id);
      }}
      onDragOver={(e) => {
        if (!canReorder) return;
        e.preventDefault();
        onDragOver(node.id);
      }}
      onDrop={(e) => {
        if (!canReorder) return;
        e.preventDefault();
        onDrop(node.id);
      }}
      className={`${styles.card}${isSettled ? " tl-settle" : ""}`}
      data-hidden={node.hidden ? "true" : undefined}
      data-pending={isPending ? "true" : undefined}
      data-drag-over={isDraggingOver ? "true" : undefined}
      data-can-reorder={canReorder ? "true" : undefined}
    >
      {/* Drag handle, BV-1: Pointer Events for mouse+touch+pen (iOS Safari) */}
      <span
        aria-hidden
        className={styles.dragHandle}
        style={{ visibility: canReorder ? "visible" : "hidden" }}
        onPointerDown={(e) => {
          if (!canReorder) return;
          // Only primary button / first touch
          if (e.pointerType === "mouse" && e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          onPointerDragStart(node.id);
        }}
        onPointerMove={(e) => {
          if (!canReorder) return;
          if (e.buttons === 0 && e.pointerType === "mouse") return;
          // Find the element under the pointer (excluding the handle itself)
          const target = document.elementFromPoint(e.clientX, e.clientY);
          const card = target?.closest("[data-node-id]");
          const targetId = card?.getAttribute("data-node-id");
          if (targetId && targetId !== node.id) onPointerDragOver(targetId);
        }}
        onPointerUp={(e) => {
          if (!canReorder) return;
          const target = document.elementFromPoint(e.clientX, e.clientY);
          const card = target?.closest("[data-node-id]");
          const targetId = card?.getAttribute("data-node-id");
          if (targetId && targetId !== node.id) onPointerDrop(targetId);
          else onPointerDrop(node.id); // dropped on self, no-op in handler
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="9" cy="5" r="1.4" />
          <circle cx="9" cy="12" r="1.4" />
          <circle cx="9" cy="19" r="1.4" />
          <circle cx="15" cy="5" r="1.4" />
          <circle cx="15" cy="12" r="1.4" />
          <circle cx="15" cy="19" r="1.4" />
        </svg>
      </span>
      {/* Status dot */}
      <StatusCircle state={node.audienceState} />

      {/* Main content */}
      <div className={styles.cardBody}>
          {/* Title */}
          {editingTitle ? (
            <input
              ref={inputRef}
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") {
                  setTitleValue(node.title);
                  setEditingTitle(false);
                }
              }}
              autoFocus
              maxLength={120}
              className={styles.titleInput}
              data-settled={isShipped ? "true" : undefined}
            />
          ) : (
            <button
              type="button"
              className={styles.titleButton}
              data-settled={isShipped ? "true" : undefined}
              onClick={() => {
                setTitleValue(node.title);
                setEditingTitle(true);
              }}
            >
              {node.title}
              {node.labelOverride && (
                <span
                  className={styles.editedMark}
                  title="Label overridden from Tasks"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </span>
              )}
            </button>
          )}

          {/* Drift affordance (D10 / ARCH_SPEC §1.5(2)) */}
          {node.driftDetected && (
            <p className={styles.driftNote}>
              Source changed in Tasks. Your edits are shown.
            </p>
          )}

          {/* Tier 3 attention pill (R·22), matches ItemRow's calm amber
              treatment from R·21. Owner-only surface by route, so no
              isOwner gate. Pure derived signal: never persists, never
              fires a write, just shows the owner what to look at. */}
          {attention && (
            <span
              className={styles.attentionPill}
              aria-label={
                attention === "overdue"
                  ? "Needs attention: overdue"
                  : "Needs attention: idle"
              }
              title={
                attention === "overdue"
                  ? "Past its target date"
                  : "Idle for 14+ days"
              }
            >
              {attention === "overdue" ? "Overdue" : "Idle"}
            </span>
          )}

          {/* Meta row: lane selector + date */}
          <div className={styles.metaRow}>
            {/* Public-state segmented control */}
            <div
              role="radiogroup"
              aria-label={`Public state for ${node.title}`}
              className={styles.stateGroup}
            >
              {PUBLIC_STATE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={node.audienceState === option.value}
                  disabled={isPending}
                  onClick={() => setPublicState(option.value)}
                  className={styles.stateOption}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {node.audienceStateOverride ? (
              <button
                type="button"
                disabled={isPending}
                onClick={inheritPublicState}
                className={styles.quietAction}
              >
                Use Tasks state
              </button>
            ) : null}

            {/* Date input, M2/fix3: same .date-input-wrapper/.date-input-custom treatment
                as ManualAddForm. Button wraps the SVG and calls showPicker?.(). */}
            <div className={`date-input-wrapper ${styles.dateWrapper}`}>
              <input
                ref={dateInputRef}
                type="date"
                aria-label={`Target date for ${node.title}`}
                value={node.targetDate ?? ""}
                onChange={(e) => setDate(e.target.value)}
                disabled={isPending}
                className={`date-input-custom ${styles.dateField}`}
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label="Pick a date"
                onClick={() => {
                  try { dateInputRef.current?.showPicker?.(); } catch { /* showPicker unsupported or not user-activated */ }
                }}
                className="date-input-icon-btn"
              >
                <svg
                  aria-hidden
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="date-input-icon"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </button>
            </div>
            {node.dateOverrideMode !== "inherit" ? (
              <button
                type="button"
                disabled={isPending}
                onClick={inheritDate}
                className={styles.quietAction}
              >
                Use Tasks date
              </button>
            ) : null}

            {/* Source indicator, chain-link icon per CREATIVE_SPEC (DRAG: replace ⇄ glyph) */}
            {node.source === "synced" && (
              <span className={styles.sourceChip} title="Synced from Signal Tasks">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                Tasks
              </span>
            )}
          </div>
          {rowError ? (
            <div role="alert" className={styles.rowError}>
              <span>{rowError}</span>
              {retryAction ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={retryAction}
                  className={styles.retryButton}
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={styles.cardControls}>
          {canReorder ? (
            <div
              role="group"
              aria-label={`Reorder ${node.title}`}
              style={{ display: "inline-flex", gap: 2 }}
            >
              <button
                type="button"
                disabled={isPending || !canMoveUp}
                onClick={() => onMoveUp(node.id)}
                aria-label={`Move ${node.title} up`}
                title="Move up"
                className={styles.iconButton}
              >
                <svg
                  aria-hidden
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m18 15-6-6-6 6" />
                </svg>
              </button>
              <button
                type="button"
                disabled={isPending || !canMoveDown}
                onClick={() => onMoveDown(node.id)}
                aria-label={`Move ${node.title} down`}
                title="Move down"
                className={styles.iconButton}
              >
                <svg
                  aria-hidden
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </div>
          ) : null}

          {/* Right: hide toggle */}
          <button
            type="button"
            disabled={isPending}
            onClick={toggleHidden}
            aria-label={node.hidden ? "Show this milestone" : "Hide this milestone"}
            title={node.hidden ? "Show" : "Hide from public roadmap"}
            className={styles.iconButton}
            data-active={node.hidden ? "true" : undefined}
          >
            {node.hidden ? (
              // Eye-slash
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              // Eye
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
      </div>
    </div>
  );
}

// ── D5 manual add form ────────────────────────────────────────────────────────

/**
 * ManualAddForm, lifted open state (H2).
 *
 * `open` and `onClose` are now owned by CurationSurface (single source of
 * truth). Draft fields (title, lane, date) are also hoisted to the parent so
 * they survive the isEmpty branch swap mid-typing. The form has no internal
 * open gate; it renders unconditionally when mounted. C1d: on server error,
 * the parent keeps `manualAddOpen=true` so the form stays mounted with fields
 * intact (trivially guaranteed since draft lives in the parent).
 */
function ManualAddForm({
  workspaceSlug,
  projectSlug,
  onAdd,
  onWriteStart,
  onWriteEnd,
  onClose,
  title,
  setTitle,
  lane,
  setLane,
  date,
  setDate,
}: {
  workspaceSlug: string;
  projectSlug: string;
  onAdd: () => void;
  onWriteStart: () => void;
  onWriteEnd: () => void;
  onClose: (reason: "complete" | "cancel") => void;
  title: string;
  setTitle: (v: string) => void;
  lane: "Next" | "In flight" | "Shipped";
  setLane: (v: "Next" | "In flight" | "Shipped") => void;
  date: string;
  setDate: (v: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const manualDateInputRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    if (!title.trim()) {
      setError("What's the milestone?");
      return;
    }
    const laneToState: Record<
      string,
      "next" | "now" | "covered"
    > = {
      "Next": "next",
      "In flight": "now",
      "Shipped": "covered",
    };
    onWriteStart();
    startTransition(async () => {
      try {
        const result = await createManualMilestoneAction(
          workspaceSlug,
          projectSlug,
          {
            title: title.trim(),
            state: laneToState[lane],
            date: date || null,
          },
        );
        if ("error" in result) {
          setError(result.error);
          // C1d: keep form open with fields intact, do NOT call onClose or reset.
          // Draft lives in the parent so fields are preserved regardless of isEmpty swap.
          return;
        }
        // Success: clear hoisted draft, close (parent sets manualAddOpen=false)
        setTitle("");
        setDate("");
        setLane("Next");
        setError(null);
        onAdd();
        onClose("complete");
      } catch {
        setError(
          "Couldn't add that milestone. Check your connection and try again.",
        );
      } finally {
        onWriteEnd();
      }
    });
  }

  return (
    <div className={`${styles.addForm} tl-rise-in`}>
      <div className={styles.addFormGrid}>
        {/* Title */}
        <div>
          <label htmlFor="manual-milestone-title" className={styles.fieldLabel}>
            What&apos;s the milestone?
          </label>
          <input
            id="manual-milestone-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tasting menu confirmed"
            maxLength={80}
            autoFocus
            className={`manual-add-title-input ${styles.textField}`}
          />
        </div>

        {/* Lane */}
        <div>
          <label id="manual-add-lane-label" className={styles.fieldLabel}>
            Which lane?
          </label>
          <div
            role="radiogroup"
            aria-labelledby="manual-add-lane-label"
            className={styles.stateGroup}
            style={{ width: "fit-content" }}
          >
            {(["Next", "In flight", "Shipped"] as const).map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={lane === l}
                onClick={() => setLane(l)}
                className={styles.stateOption}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Date, M2: native date input with custom calendar affordance.
            OS calendar-picker-indicator is CSS-suppressed via .date-input-custom
            (scoped, does NOT affect other date inputs). A custom SVG calendar
            icon is rendered as a sibling inside a position:relative wrapper;
            pointer-events:none on the icon lets clicks fall through to the input.
            Keyboard and screen-reader behavior unchanged, the native <input> is
            the real control. focus-visible ring applied via globals.css. */}
        <div>
          <label htmlFor="manual-milestone-date" className={styles.fieldLabel}>
            Date (optional)
          </label>
          <div className={`date-input-wrapper ${styles.dateWrapper}`} style={{ width: "100%" }}>
            <input
              id="manual-milestone-date"
              ref={manualDateInputRef}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`date-input-custom ${styles.dateField}`}
              style={{ width: "100%", background: "var(--paper)" }}
            />
            {/* M2/fix4: button wraps the SVG so clicking it calls showPicker?.(). Cross-browser:
                on Firefox the WebKit pseudo-element doesn't exist; the button is the real trigger.
                tabIndex={-1} keeps the input as the only tab stop. try/catch swallows
                showPicker throws (not user-activated, or unsupported). The WebKit
                indicator opacity:0 fallback in globals.css remains for non-showPicker browsers. */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Pick a date"
              onClick={() => {
                try { manualDateInputRef.current?.showPicker?.(); } catch { /* showPicker unsupported or not user-activated */ }
              }}
              className="date-input-icon-btn"
            >
              <svg
                aria-hidden
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="date-input-icon"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className={styles.formError}>{error}</p>
        )}

        <div className={styles.formActions}>
          <button
            type="button"
            onClick={handleAdd}
            disabled={isPending}
            className={styles.primaryButton}
          >
            {isPending ? "Adding…" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => {
              // Draft fields are hoisted, clear them on explicit cancel
              setTitle("");
              setDate("");
              setLane("Next");
              setError(null);
              onClose("cancel");
            }}
            className={styles.secondaryButton}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sync button ───────────────────────────────────────────────────────────────

/**
 * H3: when sync returns 0 milestones, replace the ghost "No milestones found
 * in Tasks." text with a weighted inline chip + actionable copy + Open Tasks
 * link. Uses paper surface + hairline border + ink-soft text, calm, on-voice.
 */
function SyncButton({
  workspaceSlug,
  projectSlug,
  onSync,
}: {
  workspaceSlug: string;
  projectSlug: string;
  onSync: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<"zero" | "count" | "error" | null>(null);
  const [syncCount, setSyncCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const tasksUrl = PRODUCT_APP_URLS.tasks;

  function handleSync() {
    // Fix 2: clear previous result at the START of each sync so zero/error
    // results from the prior run don't linger while the new request is in-flight.
    setResult(null);
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const res = await syncMilestonesAction(workspaceSlug, projectSlug);
        if ("error" in res) {
          setErrorMsg(res.error);
          setResult("error");
          // Fix 2: error persists, NO auto-clear timer. User must re-trigger sync.
        } else if (res.count === 0) {
          setResult("zero");
          onSync();
          // Fix 2: zero persists, NO auto-clear timer. User must re-trigger sync.
        } else {
          setSyncCount(res.count);
          setResult("count");
          onSync();
          // Fix 2: ONLY the success-count result auto-clears after 5s.
          setTimeout(() => { setResult(null); }, 5000);
        }
      } catch {
        setErrorMsg(
          "Timeline couldn't refresh milestones from Tasks. Check your connection and try again.",
        );
        setResult("error");
      }
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={handleSync}
        disabled={isPending}
        className={`sync-button ${styles.syncButton}`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="1 4 1 10 7 10"/>
          <path d="M3.51 15a9 9 0 1 0 .49-3.37"/>
        </svg>
        {isPending ? "Syncing…" : "Sync from Tasks"}
      </button>

      {/* H3, zero-result chip: paper surface, hairline border, ink-soft text.
          Fix 5: copy names real Tasks affordance ("Milestone" button), no em-dash.
          Fix 6: flex + maxWidth so chip wraps cleanly at 320px. */}
      {result === "zero" && (
        <span className={styles.syncZeroChip}>
          <span>
            No milestones found yet.{" "}
            <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>
              Open a task in Signal Tasks and tap the Milestone button. It&apos;ll appear here automatically.
            </span>
          </span>{" "}
          <a href={tasksUrl}>Open Tasks</a>
        </span>
      )}

      {/* Count confirmation */}
      {result === "count" && (
        <span role="status" className={styles.syncCount}>
          {syncCount} milestone{syncCount === 1 ? "" : "s"} synced.
        </span>
      )}

      {/* Error state uses the shared alarm token. */}
      {result === "error" && (
        <span role="alert" className={styles.syncError}>{errorMsg}</span>
      )}
    </div>
  );
}

// ── Main surface ──────────────────────────────────────────────────────────────

export function CurationSurface({
  initialNodes,
  workspaceSlug,
  projectSlug,
  shareHref,
}: {
  initialNodes: EffectiveNode[];
  workspaceSlug: string;
  projectSlug: string;
  shareHref: string;
}) {
  const router = useRouter();
  const [nodes, setNodes] = useState(initialNodes);
  // H2: lifted open state, single source of truth for the manual add form.
  // When isEmpty===true and manualAddOpen===true, ManualAddForm replaces the
  // empty-state container in situ. When nodes exist, the bottom affordance also
  // drives this state. ManualAddForm has no internal open gate.
  const [manualAddOpen, setManualAddOpen] = useState(false);
  const manualAddTriggerRef = useRef<HTMLButtonElement>(null);
  const restoreFocusAfterNodeCount = useRef<number | null>(null);
  // Fix 1: hoisted draft state, survives isEmpty branch swap mid-typing.
  const [draftTitle, setDraftTitle] = useState("");
  const [draftLane, setDraftLane] = useState<"Next" | "In flight" | "Shipped">("Next");
  const [draftDate, setDraftDate] = useState("");
  // C1c: track in-flight upsert writes; RSC prop sync is suppressed while > 0
  const pendingWriteCount = useRef(0);
  const refreshAfterWrites = useRef(false);
  const [, startTransition] = useTransition();
  // D11 auto-sync: fires once on mount (pull-on-visit). Does NOT publish.
  const [autoSyncState, setAutoSyncState] = useState<
    | { status: "idle" }
    | { status: "syncing" }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const didAutoSync = useRef(false);
  // "Saved" tick DRAG: shows for 1.5s after any successful overlay upsert
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // C2: error flash state, surfaces a transient `role="status"` message when
  // a NodeCard inline edit or a reorder action returns `{ error: string }`.
  // Mutually exclusive with savedAt (see flashSaved / flashError below).
  const [errorFlash, setErrorFlash] = useState<{ message: string; ts: number } | null>(null);
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Drag-to-reorder state (UX-1)
  // HTML5 drag (mouse/desktop) and Pointer Events drag (touch/iOS Safari) share
  // the same reorder logic; pointer state kept in a separate ref so the two
  // paths don't interfere when a non-touch device fires both event sequences.
  const dragNodeId = useRef<string | null>(null);
  const pointerDragNodeId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [reorderAnnouncement, setReorderAnnouncement] = useState("");
  // Wave 4 settle: the row that just landed carries a brief tint fade so a
  // successful reorder reads as arrival, not teleportation.
  const [settledId, setSettledId] = useState<string | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markSettled = useCallback((nodeId: string) => {
    setSettledId(null);
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    // Re-arm on the next frame so consecutive moves of the same row restart
    // the CSS animation instead of silently continuing the old one.
    requestAnimationFrame(() => {
      setSettledId(nodeId);
      settleTimerRef.current = setTimeout(() => setSettledId(null), 450);
    });
  }, []);

  // UX-2: router.refresh() instead of window.location.reload()
  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  const requestRefreshAfterWrite = useCallback(() => {
    refreshAfterWrites.current = true;
    if (pendingWriteCount.current === 0) {
      refreshAfterWrites.current = false;
      refresh();
    }
  }, [refresh]);

  const openManualAdd = useCallback(() => {
    setManualAddOpen(true);
  }, []);

  const closeManualAdd = useCallback((reason: "complete" | "cancel") => {
    restoreFocusAfterNodeCount.current =
      reason === "complete" ? nodes.length : null;
    setManualAddOpen(false);
    requestAnimationFrame(() => {
      manualAddTriggerRef.current?.focus();
    });
  }, [nodes.length]);

  useEffect(() => {
    const previousCount = restoreFocusAfterNodeCount.current;
    if (
      manualAddOpen ||
      previousCount === null ||
      nodes.length === previousCount
    ) {
      return;
    }
    restoreFocusAfterNodeCount.current = null;
    const frame = requestAnimationFrame(() => {
      manualAddTriggerRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [manualAddOpen, nodes.length]);

  const handleOptimisticUpdate = useCallback(
    (nodeId: string, patch: Partial<EffectiveNode>) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId ? { ...node, ...patch } : node,
        ),
      );
    },
    [],
  );

  // "Saved" tick helper
  const flashSaved = useCallback(() => {
    setSavedAt(Date.now());
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedAt(null), 1500);
    // C2: clear any stale error flash, success supersedes the prior failure.
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setErrorFlash(null);
  }, []);

  // C2: error flash for silent-fail writes (NodeCard inline edits + reorder).
  // Longer-lived than savedAt (4s vs 1.5s) so a user who looked away while
  // an edit was in flight has time to register the message.
  const flashError = useCallback((message: string) => {
    setErrorFlash({ message, ts: Date.now() });
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorFlash(null), 4000);
    // Mutual exclusivity, a fresh error supersedes a "Saved" tick.
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSavedAt(null);
  }, []);

  // C1a: absorb RSC prop updates into local state, but only when no writes are
  // settling. While pendingWriteCount > 0 the optimistic state is authoritative;
  // once the count returns to 0 the next RSC push (from router.refresh()) applies.
  useEffect(() => {
    if (pendingWriteCount.current === 0) setNodes(initialNodes);
  }, [initialNodes]);

  useEffect(
    () => () => {
      pendingWriteCount.current = 0;
      refreshAfterWrites.current = false;
    },
    [],
  );

  // C1c write-count helpers, passed into NodeCard and ManualAddForm
  const handleWriteStart = useCallback(() => {
    pendingWriteCount.current += 1;
  }, []);

  const handleWriteEnd = useCallback(() => {
    pendingWriteCount.current = Math.max(0, pendingWriteCount.current - 1);
    if (
      pendingWriteCount.current === 0 &&
      refreshAfterWrites.current
    ) {
      refreshAfterWrites.current = false;
      refresh();
    }
  }, [refresh]);

  const runAutoSync = useCallback(async () => {
    setAutoSyncState({ status: "syncing" });
    try {
      const result = await syncMilestonesAction(workspaceSlug, projectSlug);
      if ("error" in result) {
        setAutoSyncState({ status: "error", message: result.error });
        return;
      }
      setAutoSyncState({ status: "idle" });
      // C1c: defer the refresh while owner writes are settling so the synced
      // server result cannot replace optimistic edits with an older RSC tree.
      requestRefreshAfterWrite();
    } catch {
      setAutoSyncState({
        status: "error",
        message:
          "Timeline couldn't refresh milestones from Tasks. Check your connection and try again.",
      });
    }
  }, [projectSlug, requestRefreshAfterWrite, workspaceSlug]);

  // D11 auto-sync on load: pulls Tasks milestones into the private draft.
  // D6 two-gate is preserved, syncMilestonesAction only revalidates /app and
  // /app/timeline/[slug], never the public /{workspaceSlug} path.
  useEffect(() => {
    if (didAutoSync.current) return;
    didAutoSync.current = true;
    void runAutoSync();
  }, [runAutoSync]);

  // DRAG: justPublished localStorage persistence
  // Initialise from localStorage so the chip animation fires on first load
  // after a publish, even if the page was reloaded.
  // ── Shared reorder logic ────────────────────────────────────────────────────
  // Used by both HTML5 drag and Pointer Events paths. Computes the new order,
  // updates optimistic state, then batch-writes ALL sortOverride values (BV-2).

  function persistReorderedNodes(
    updated: EffectiveNode[],
    previousNodes: EffectiveNode[],
    successAnnouncement?: string,
    movedId?: string,
  ) {
    setNodes(updated);
    if (movedId) markSettled(movedId);
    startTransition(async () => {
      try {
        const result = await reorderNodesAction(
          workspaceSlug,
          projectSlug,
          updated.map((node) => node.id),
        );
        if ("error" in result) {
          flashError(result.error);
          setNodes(previousNodes);
          if (successAnnouncement) {
            setReorderAnnouncement(
              "The milestone could not be moved. The previous order was restored.",
            );
          }
          return;
        }
        flashSaved();
        if (successAnnouncement) {
          setReorderAnnouncement(successAnnouncement);
        }
      } catch {
        flashError("Couldn't save that reorder. Check your connection and try again.");
        setNodes(previousNodes);
        if (successAnnouncement) {
          setReorderAnnouncement(
            "The milestone could not be moved. The previous order was restored.",
          );
        }
      }
    });
  }

  function applyReorder(sourceId: string, targetId: string) {
    if (!sourceId || sourceId === targetId) return;

    const ordered = [...nodes];
    const srcIdx = ordered.findIndex((n) => n.id === sourceId);
    const tgtIdx = ordered.findIndex((n) => n.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0) return;

    const [moved] = ordered.splice(srcIdx, 1);
    const insertAt = ordered.findIndex((n) => n.id === targetId);
    ordered.splice(insertAt, 0, moved);

    // Assign sortOverride 0..n for the full list
    const updated = ordered.map((n, i) => ({ ...n, sortOrder: i }));
    // C2: snapshot before the optimistic mutation so a failed write can revert
    // to the exact prior order. Same shape as the NodeCard inline-edit pattern.
    const previousNodes = nodes;
    // BV-2: batch-write ALL sibling sortOverrides so reload order is deterministic.
    persistReorderedNodes(updated, previousNodes, undefined, sourceId);
  }

  function moveNodeByKeyboard(
    sourceId: string,
    direction: OwnerReorderDirection,
  ) {
    const result = buildOwnerKeyboardReorder(nodes, sourceId, direction);
    if (!result) return;

    const byId = new Map(nodes.map((node) => [node.id, node]));
    const updated = result.orderedIds.map((id, index) => ({
      ...byId.get(id)!,
      sortOrder: index,
    }));
    const directionLabel = result.direction === "up" ? "up" : "down";
    setReorderAnnouncement(`Moving ${result.title} ${directionLabel}.`);
    persistReorderedNodes(
      updated,
      nodes,
      `Moved ${result.title} ${directionLabel}. Position ${result.position} of ${result.siblingCount}.`,
      sourceId,
    );
  }

  // ── HTML5 drag handlers (mouse / desktop) ───────────────────────────────────

  function handleDragStart(id: string) {
    dragNodeId.current = id;
  }

  function handleDragOver(id: string) {
    if (id !== dragNodeId.current) setDragOverId(id);
  }

  function handleDrop(targetId: string) {
    const sourceId = dragNodeId.current;
    dragNodeId.current = null;
    setDragOverId(null);
    if (!sourceId) return;
    applyReorder(sourceId, targetId);
  }

  // ── Pointer Events handlers (touch / iOS Safari / pen) ─────────────────────
  // BV-1: touch-action:none on the handle stops the browser scroll chain,
  // enabling setPointerCapture to route all pointer events to the handle.

  function handlePointerDragStart(id: string) {
    pointerDragNodeId.current = id;
  }

  function handlePointerDragOver(id: string) {
    if (id !== pointerDragNodeId.current) setDragOverId(id);
  }

  function handlePointerDrop(targetId: string) {
    const sourceId = pointerDragNodeId.current;
    pointerDragNodeId.current = null;
    setDragOverId(null);
    if (!sourceId) return;
    applyReorder(sourceId, targetId);
  }

  // Group by the exact state the signed artifact will render.
  const publicStates = PUBLIC_STATE_OPTIONS.filter((option) =>
    nodes.some(
      (node) =>
        node.audienceState === option.value &&
        !node.hidden,
    ),
  );
  const hiddenNodes = nodes.filter((n) => n.hidden);

  const isEmpty = nodes.length === 0;

  const isSaved = savedAt !== null;

  return (
    <div>
      <div
        className="mb-6 flex flex-col justify-between gap-3 rounded-lg border border-line-soft bg-bg-deep px-4 py-3 sm:flex-row sm:items-center"
      >
        <span className="text-xs leading-5 text-ink-soft">
          Owner draft · changes stay private until you create or update a
          shared artifact.
        </span>
        <Link
          href={shareHref}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-line-soft bg-white px-3 text-xs font-medium text-ink hover:border-ink-ghost focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Preview public copy
        </Link>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarCluster}>
          <h2 className={styles.toolbarHeading}>Milestones</h2>
          {/* DRAG: "Saved" 1.5s tick */}
          {isSaved && (
            <span className={styles.savedTick}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Saved
            </span>
          )}
          {/* C2: transient advisory flash for silent-fail writes.
              role="status" (not alert), non-blocking, polite-announce.
              Mutually exclusive with the Saved tick. Auto-clears at 4s. */}
          {errorFlash && !isSaved && (
            <span role="status" className={styles.errorFlash}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {errorFlash.message}
            </span>
          )}
          {autoSyncState.status === "syncing" && (
            <span className={styles.syncingNote}>Syncing…</span>
          )}
        </div>
        <SyncButton
          workspaceSlug={workspaceSlug}
          projectSlug={projectSlug}
          onSync={() => {
            setAutoSyncState({ status: "idle" });
            refresh();
          }}
        />
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {reorderAnnouncement}
      </p>

      {autoSyncState.status === "error" ? (
        <div
          role="alert"
          className="mb-5 flex flex-col gap-3 rounded-lg border border-line-soft bg-bg-deep px-4 py-3 text-xs text-ink-soft sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            Tasks milestones could not refresh automatically.{" "}
            {autoSyncState.message}
          </span>
          <button
            type="button"
            onClick={() => void runAutoSync()}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg border border-line-soft bg-white px-3 font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Retry sync
          </button>
        </div>
      ) : null}

      {/* Empty state, H2: single primary CTA + quiet inline manual-add link.
          When manualAddOpen, ManualAddForm replaces the container in situ.
          No scrollIntoView. No detached anchor div. */}
      {isEmpty ? (
        manualAddOpen ? (
          /* H2: form replaces empty state in the same container/position.
             Fix 7: matching padding to empty state to prevent layout jump on swap. */
          <div className={styles.emptyState}>
            <ManualAddForm
              workspaceSlug={workspaceSlug}
              projectSlug={projectSlug}
              onAdd={() => {
                flashSaved();
                requestRefreshAfterWrite();
              }}
              onWriteStart={handleWriteStart}
              onWriteEnd={handleWriteEnd}
              onClose={closeManualAdd}
              title={draftTitle}
              setTitle={setDraftTitle}
              lane={draftLane}
              setLane={setDraftLane}
              date={draftDate}
              setDate={setDraftDate}
            />
          </div>
        ) : (
          <div className={styles.emptyState}>
            <span className={styles.emptyMark} aria-hidden>
              {/* The milestone diamond, drawn — the same mark a task earns on the board. */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                <path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" />
              </svg>
            </span>
            <p className={styles.emptyTitle}>Your plan fills itself in.</p>
            <p className={styles.emptyCopy}>
              Mark tasks as milestones in Signal Tasks and they&apos;ll appear here automatically.
            </p>
            <div className={styles.emptyActions}>
              <a href={PRODUCT_APP_URLS.tasks} className={styles.emptyPrimary}>
                Open Tasks
              </a>
            </div>
            {/* Quiet inline manual-add link, no background, no border, no pill. */}
            <button
              ref={manualAddTriggerRef}
              type="button"
              onClick={openManualAdd}
              className={styles.addTrigger}
            >
              or add one manually
            </button>
          </div>
        )
      ) : (
        <>
          {/* Lane-grouped node list with drag-to-reorder (UX-1) */}
          <div className={styles.listFrame}>
            {publicStates.map((stateOption) => {
              const stateNodes = nodes.filter(
                (node) =>
                  node.audienceState === stateOption.value &&
                  !node.hidden,
              );
              return (
                <div
                  key={stateOption.value}
                  className={styles.laneGroup}
                  data-tone={LANE_TONE[stateOption.value]}
                >
                  <LaneHeader
                    label={stateOption.label}
                    count={stateNodes.length}
                  />
                  {stateNodes.map((node, nodeIndex) => (
                    <NodeCard
                      key={node.id}
                      node={node}
                      workspaceSlug={workspaceSlug}
                      projectSlug={projectSlug}
                      onUpdate={() => {
                        flashSaved();
                        requestRefreshAfterWrite();
                      }}
                      onWriteStart={handleWriteStart}
                      onWriteEnd={handleWriteEnd}
                      onError={flashError}
                      onOptimisticUpdate={handleOptimisticUpdate}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onPointerDragStart={handlePointerDragStart}
                      onPointerDragOver={handlePointerDragOver}
                      onPointerDrop={handlePointerDrop}
                      onMoveUp={(id) => moveNodeByKeyboard(id, "up")}
                      onMoveDown={(id) => moveNodeByKeyboard(id, "down")}
                      canMoveUp={nodeIndex > 0}
                      canMoveDown={nodeIndex < stateNodes.length - 1}
                      isDraggingOver={dragOverId === node.id}
                      isSettled={settledId === node.id}
                    />
                  ))}
                </div>
              );
            })}
          </div>

          {/* Hidden milestones remain recoverable from the owner surface. */}
          {hiddenNodes.length > 0 && (
            <details className={`${styles.hiddenDetails} tl-fold`}>
              <summary className={styles.hiddenSummary}>
                <span>Hidden milestones</span>
                <span className={styles.hiddenCount}>{hiddenNodes.length}</span>
              </summary>
              <div className={styles.hiddenBody}>
                {hiddenNodes.map((node) => (
                  <NodeCard
                    key={node.id}
                    node={node}
                    workspaceSlug={workspaceSlug}
                    projectSlug={projectSlug}
                    onUpdate={() => {
                      flashSaved();
                      requestRefreshAfterWrite();
                    }}
                    onWriteStart={handleWriteStart}
                    onWriteEnd={handleWriteEnd}
                    onError={flashError}
                    onOptimisticUpdate={handleOptimisticUpdate}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onPointerDragStart={handlePointerDragStart}
                    onPointerDragOver={handlePointerDragOver}
                    onPointerDrop={handlePointerDrop}
                    onMoveUp={(id) => moveNodeByKeyboard(id, "up")}
                    onMoveDown={(id) => moveNodeByKeyboard(id, "down")}
                    canMoveUp={false}
                    canMoveDown={false}
                    isDraggingOver={false}
                    canReorder={false}
                  />
                ))}
              </div>
            </details>
          )}
        </>
      )}

      {/* D5 manual add, only shown when nodes exist (non-empty).
          H2: drives the same lifted manualAddOpen state; no second mechanism.
          When isEmpty, the form lives in the empty-state container above. */}
      {!isEmpty && (
        <div style={{ marginTop: 24 }}>
          {manualAddOpen ? (
            /* Fix 1: pass hoisted draft props so the form is state-continuous
               regardless of which render position (empty or non-empty) is active. */
            <ManualAddForm
              workspaceSlug={workspaceSlug}
              projectSlug={projectSlug}
              onAdd={() => {
                flashSaved();
                requestRefreshAfterWrite();
              }}
              onWriteStart={handleWriteStart}
              onWriteEnd={handleWriteEnd}
              onClose={closeManualAdd}
              title={draftTitle}
              setTitle={setDraftTitle}
              lane={draftLane}
              setLane={setDraftLane}
              date={draftDate}
              setDate={setDraftDate}
            />
          ) : (
            <button
              ref={manualAddTriggerRef}
              type="button"
              onClick={openManualAdd}
              className={styles.addTrigger}
              style={{ display: "block" }}
            >
              <span className={styles.addTriggerAccent}>+ Add a milestone</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
