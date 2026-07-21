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
  upsertNodeOverlayAction,
  syncMilestonesAction,
  reorderNodesAction,
  type UpsertOverlayResult,
} from "@/modules/timeline/server/actions/workspaces";
import { attentionReason } from "@/modules/timeline/lib/roadmap/needs-attention";

const LANE_LABELS = ["Next", "In flight", "Shipped", "Later"] as const;
type LaneLabel = typeof LANE_LABELS[number];

// ── Lane helpers ──────────────────────────────────────────────────────────────

/** Human-readable eyebrow for a lane separator. Matches CREATIVE_SPEC §1.1. */
function LaneSeparator({ lane }: { lane: LaneLabel }) {
  return (
    <div
      style={{
        paddingTop: 32,
        borderTop: "1px solid var(--hairline)",
        marginBottom: 4,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono-stack)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "var(--ink-quiet)",
        }}
      >
        {lane}
      </span>
    </div>
  );
}

// ── Status circle ─────────────────────────────────────────────────────────────

function StatusCircle({ lane, isMilestone }: { lane: LaneLabel; isMilestone: boolean }) {
  const accentBorder = `1.5px solid var(--indigo, #4f46e5)`;
  const ghostBorder = `1.5px solid var(--ink-ghost, #d4d4d8)`;

  const style: React.CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
    display: "inline-block",
    marginTop: 2,
  };

  if (lane === "Shipped") {
    return (
      <span
        style={{
          ...style,
          background: "var(--ink-ghost, #d4d4d8)",
          border: ghostBorder,
        }}
      />
    );
  }
  if (lane === "In flight") {
    return (
      <span
        style={{
          ...style,
          background: "color-mix(in srgb, var(--ink-ghost, #d4d4d8) 50%, transparent)",
          border: isMilestone ? accentBorder : ghostBorder,
        }}
      />
    );
  }
  if (lane === "Later") {
    return (
      <span
        style={{
          ...style,
          background: "transparent",
          border: "1.5px dashed var(--ink-ghost, #d4d4d8)",
        }}
      />
    );
  }
  // Next
  return (
    <span
      style={{
        ...style,
        background: "transparent",
        border: isMilestone ? accentBorder : ghostBorder,
      }}
    />
  );
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
  onDragStart,
  onDragOver,
  onDrop,
  onPointerDragStart,
  onPointerDragOver,
  onPointerDrop,
  isDraggingOver,
}: {
  node: EffectiveNode;
  workspaceSlug: string;
  projectSlug: string;
  onUpdate: () => void;
  onWriteStart: () => void;
  onWriteEnd: () => void;
  /** C2: surface a transient advisory message when an inline edit silently fails. */
  onError: (message: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: (targetId: string) => void;
  onPointerDragStart: (id: string) => void;
  onPointerDragOver: (id: string) => void;
  onPointerDrop: (targetId: string) => void;
  isDraggingOver: boolean;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(node.title);
  const [isPending, startTransition] = useTransition();
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
  ) {
    if ("error" in result) {
      onError(result.error);
      onLocalRevert?.();
      return;
    }
    onUpdate();
  }

  function commitTitle() {
    if (titleValue.trim() === node.title) {
      setEditingTitle(false);
      return;
    }
    onWriteStart();
    startTransition(async () => {
      try {
        const result = await upsertNodeOverlayAction(workspaceSlug, projectSlug, {
          nodeId: node.id,
          labelOverride: titleValue.trim() || null,
        });
        handleEditResult(result, () => setTitleValue(node.title));
      } catch {
        onError("Couldn't save that change. Check your connection and try again.");
        setTitleValue(node.title);
      } finally {
        onWriteEnd();
      }
    });
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
        handleEditResult(result);
      } catch {
        onError("Couldn't save that change. Check your connection and try again.");
      } finally {
        onWriteEnd();
      }
    });
  }

  function setLane(lane: LaneLabel) {
    onWriteStart();
    startTransition(async () => {
      try {
        const result = await upsertNodeOverlayAction(workspaceSlug, projectSlug, {
          nodeId: node.id,
          laneOverride: lane !== node.lane ? lane : null,
        });
        handleEditResult(result);
      } catch {
        onError("Couldn't save that change. Check your connection and try again.");
      } finally {
        onWriteEnd();
      }
    });
  }

  function setDate(dateStr: string) {
    onWriteStart();
    startTransition(async () => {
      try {
        const result = await upsertNodeOverlayAction(workspaceSlug, projectSlug, {
          nodeId: node.id,
          dateOverride: dateStr || null,
        });
        handleEditResult(result);
      } catch {
        onError("Couldn't save that change. Check your connection and try again.");
      } finally {
        onWriteEnd();
      }
    });
  }

  const isShipped = node.lane === "Shipped";
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
      draggable
      onDragStart={() => onDragStart(node.id)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(node.id); }}
      onDrop={(e) => { e.preventDefault(); onDrop(node.id); }}
      style={{
        paddingBlock: 12,
        paddingInline: 16,
        borderBottom: "1px solid var(--hairline)",
        opacity: node.hidden ? 0.4 : isPending ? 0.7 : 1,
        transition: "opacity 160ms ease-out",
        borderLeft: isDraggingOver
          ? "2px solid var(--indigo, #4f46e5)"
          : "2px solid var(--indigo-soft, rgba(79,70,229,0.12))",
        background: isDraggingOver ? "var(--paper-soft, #fafafa)" : "var(--paper)",
        cursor: "grab",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        {/* Drag handle, BV-1: Pointer Events for mouse+touch+pen (iOS Safari) */}
        <span
          aria-hidden
          onPointerDown={(e) => {
            // Only primary button / first touch
            if (e.pointerType === "mouse" && e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            onPointerDragStart(node.id);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 0 && e.pointerType === "mouse") return;
            // Find the element under the pointer (excluding the handle itself)
            const target = document.elementFromPoint(e.clientX, e.clientY);
            const card = target?.closest("[data-node-id]");
            const targetId = card?.getAttribute("data-node-id");
            if (targetId && targetId !== node.id) onPointerDragOver(targetId);
          }}
          onPointerUp={(e) => {
            const target = document.elementFromPoint(e.clientX, e.clientY);
            const card = target?.closest("[data-node-id]");
            const targetId = card?.getAttribute("data-node-id");
            if (targetId && targetId !== node.id) onPointerDrop(targetId);
            else onPointerDrop(node.id); // dropped on self, no-op in handler
          }}
          style={{
            flexShrink: 0,
            marginTop: 4,
            color: "var(--ink-faint)",
            cursor: "grab",
            lineHeight: 1,
            fontSize: 10,
            letterSpacing: "0.1em",
            userSelect: "none",
            touchAction: "none", // required for Pointer Events on touch (iOS Safari)
          }}
        >
          ⠿
        </span>
        {/* Status circle */}
        <StatusCircle lane={node.lane} isMilestone />

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
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
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--ink)",
                letterSpacing: "-0.01em",
                lineHeight: 1.4,
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--indigo, #4f46e5)",
                outline: "none",
                width: "100%",
                padding: "0 0 2px",
                textDecoration: isShipped ? "line-through" : "none",
                opacity: isShipped ? 0.7 : 1,
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              style={{
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                lineHeight: 1.4,
                background: "none",
                border: "none",
                padding: 0,
                cursor: "text",
                textAlign: "left",
                textDecoration: isShipped
                  ? "line-through"
                  : "none",
                opacity: isShipped ? 0.7 : 1,
                color: isShipped
                  ? "color-mix(in srgb, var(--ink) 70%, transparent)"
                  : "var(--ink)",
              }}
            >
              {node.title}
              {node.labelOverride && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 10,
                    color: "var(--ink-quiet)",
                    fontWeight: 400,
                    verticalAlign: "middle",
                  }}
                  title="Label overridden from Tasks"
                >
                  ✎
                </span>
              )}
            </button>
          )}

          {/* Drift affordance (D10 / ARCH_SPEC §1.5(2)) */}
          {node.driftDetected && (
            <p
              style={{
                fontSize: 10,
                color: "var(--ink-quiet)",
                marginTop: 2,
                fontFamily: "var(--font-mono-stack)",
              }}
            >
              Source changed in Tasks. Your edits are shown.
            </p>
          )}

          {/* Tier 3 attention pill (R·22), matches ItemRow's calm amber
              treatment from R·21. Owner-only surface by route, so no
              isOwner gate. Pure derived signal: never persists, never
              fires a write, just shows the owner what to look at. */}
          {attention && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                marginTop: 4,
                padding: "1px 6px",
                borderRadius: 4,
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                background:
                  "color-mix(in srgb, var(--status-flight) 12%, transparent)",
                color: "var(--status-flight)",
              }}
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
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "var(--status-flight)",
                }}
              />
              {attention === "overdue" ? "Overdue" : "Idle"}
            </span>
          )}

          {/* Meta row: lane selector + date */}
          <div
            style={{
              marginTop: 6,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
            }}
          >
            {/* Lane segmented control */}
            <div
              role="radiogroup"
              aria-label="Lane"
              style={{
                display: "flex",
                gap: 0,
                border: "1px solid var(--hairline)",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              {LANE_LABELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={node.lane === l}
                  onClick={() => setLane(l)}
                  style={{
                    fontSize: 11,
                    padding: "4px 10px",
                    border: "none",
                    background:
                      node.lane === l
                        ? "var(--ink)"
                        : "transparent",
                    color:
                      node.lane === l
                        ? "var(--paper)"
                        : "var(--ink-quiet)",
                    cursor: "pointer",
                    fontWeight: node.lane === l ? 500 : 400,
                    transition: "background 120ms, color 120ms",
                  }}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* Date input, M2/fix3: same .date-input-wrapper/.date-input-custom treatment
                as ManualAddForm. Button wraps the SVG and calls showPicker?.(). */}
            <div className="date-input-wrapper" style={{ display: "inline-flex" }}>
              <input
                ref={dateInputRef}
                type="date"
                aria-label={`Target date for ${node.title}`}
                value={node.targetDate ?? ""}
                onChange={(e) => setDate(e.target.value)}
                className="date-input-custom"
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono-stack)",
                  color: "var(--ink-quiet)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 4,
                  padding: "3px 7px",
                  paddingRight: 22,
                  background: "transparent",
                  cursor: "pointer",
                }}
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

            {/* Source indicator, chain-link icon per CREATIVE_SPEC (DRAG: replace ⇄ glyph) */}
            {node.source === "synced" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 9,
                  color: "var(--ink-faint)",
                  fontFamily: "var(--font-mono-stack)",
                  letterSpacing: "0.05em",
                }}
                title="Synced from Signal Tasks"
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                Tasks
              </span>
            )}
          </div>
        </div>

        {/* Right: hide toggle */}
        <button
          type="button"
          onClick={toggleHidden}
          aria-label={node.hidden ? "Show this milestone" : "Hide this milestone"}
          title={node.hidden ? "Show" : "Hide from public roadmap"}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: node.hidden ? "var(--indigo, #4f46e5)" : "var(--ink-ghost)",
            padding: 4,
            borderRadius: 4,
            flexShrink: 0,
            fontSize: 13,
            lineHeight: 1,
            transition: "color 120ms",
          }}
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
  onClose: () => void;
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
    const laneToStatus: Record<string, "next" | "in-flight" | "shipped"> = {
      "Next": "next",
      "In flight": "in-flight",
      "Shipped": "shipped",
    };
    const nodeId = `ms-manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    onWriteStart();
    startTransition(async () => {
      try {
        const result = await upsertNodeOverlayAction(workspaceSlug, projectSlug, {
          nodeId,
          source: "manual",
          manualTitle: title.trim(),
          manualStatus: laneToStatus[lane],
          manualTargetDate: date || null,
        });
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
        onClose();
      } finally {
        onWriteEnd();
      }
    });
  }

  return (
    <div
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: 10,
        padding: 16,
        background: "var(--paper-soft, #fafafa)",
        marginTop: 8,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Title */}
        <div>
          <label
            htmlFor="manual-milestone-date"
            style={{ fontSize: 11, color: "var(--ink-quiet)", display: "block", marginBottom: 4 }}
          >
            What&apos;s the milestone?
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tasting menu confirmed"
            maxLength={80}
            autoFocus
            className="manual-add-title-input"
            style={{
              width: "100%",
              fontSize: 13,
              padding: "6px 10px",
              border: "1px solid var(--hairline)",
              borderRadius: 6,
              background: "var(--paper)",
              color: "var(--ink)",
            }}
          />
        </div>

        {/* Lane */}
        <div>
          <label
            id="manual-add-lane-label"
            style={{ fontSize: 11, color: "var(--ink-quiet)", display: "block", marginBottom: 4 }}
          >
            Which lane?
          </label>
          <div
            role="radiogroup"
            aria-labelledby="manual-add-lane-label"
            style={{ display: "flex", gap: 0, border: "1px solid var(--hairline)", borderRadius: 6, overflow: "hidden", width: "fit-content" }}
          >
            {(["Next", "In flight", "Shipped"] as const).map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={lane === l}
                onClick={() => setLane(l)}
                style={{
                  fontSize: 11,
                  padding: "4px 10px",
                  border: "none",
                  background: lane === l ? "var(--ink)" : "transparent",
                  color: lane === l ? "var(--paper)" : "var(--ink-quiet)",
                  cursor: "pointer",
                  transition: "background 120ms, color 120ms",
                }}
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
          <label
            style={{ fontSize: 11, color: "var(--ink-quiet)", display: "block", marginBottom: 4 }}
          >
            Date (optional)
          </label>
          <div className="date-input-wrapper">
            <input
              id="manual-milestone-date"
              ref={manualDateInputRef}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="date-input-custom"
              style={{
                fontSize: 12,
                fontFamily: "var(--font-mono-stack)",
                padding: "4px 8px",
                paddingRight: 28,
                border: "1px solid var(--hairline)",
                borderRadius: 6,
                background: "var(--paper)",
                color: "var(--ink-quiet)",
                width: "100%",
              }}
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
          <p role="alert" style={{ fontSize: 11, color: "var(--alarm)", margin: 0 }}>{error}</p>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={handleAdd}
            disabled={isPending}
            style={{
              fontSize: 12,
              fontWeight: 500,
              padding: "6px 14px",
              borderRadius: 999,
              background: "var(--ink)",
              color: "var(--paper)",
              border: "none",
              cursor: isPending ? "default" : "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
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
              onClose();
            }}
            style={{
              fontSize: 12,
              padding: "6px 14px",
              borderRadius: 999,
              background: "transparent",
              color: "var(--ink-quiet)",
              border: "1px solid var(--hairline)",
              cursor: "pointer",
            }}
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
  const tasksUrl = process.env.NEXT_PUBLIC_TASKS_URL ?? "https://tasks.signalstudio.ie";

  function handleSync() {
    // Fix 2: clear previous result at the START of each sync so zero/error
    // results from the prior run don't linger while the new request is in-flight.
    setResult(null);
    setErrorMsg(null);
    startTransition(async () => {
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
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={handleSync}
        disabled={isPending}
        className="sync-button"
        style={{
          fontSize: 12,
          fontWeight: 500,
          padding: "6px 14px",
          borderRadius: 999,
          background: "transparent",
          color: "var(--ink-soft)",
          border: "1px solid var(--hairline)",
          cursor: isPending ? "default" : "pointer",
          opacity: isPending ? 0.6 : 1,
          display: "flex",
          alignItems: "center",
          gap: 6,
          transition: "background 120ms, border-color 120ms, opacity 160ms",
        }}
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
        <span
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 5,
            maxWidth: "min(400px, 92vw)",
            fontSize: 11,
            fontWeight: 500,
            color: "var(--ink-soft)",
            background: "var(--paper)",
            border: "1px solid var(--hairline)",
            borderRadius: 6,
            padding: "3px 9px",
            lineHeight: 1.4,
          }}
        >
          <span>
            No milestones found yet.{" "}
            <span style={{ fontWeight: 400, color: "var(--ink-quiet)" }}>
              Open a task in Signal Tasks and tap the Milestone button. It&apos;ll appear here automatically.
            </span>
          </span>{" "}
          <a
            href={tasksUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--indigo, #4f46e5)",
              textDecoration: "none",
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            Open Tasks
          </a>
        </span>
      )}

      {/* Count confirmation */}
      {result === "count" && (
        <span style={{ fontSize: 11, color: "var(--ink-quiet)" }}>
          {syncCount} milestone{syncCount === 1 ? "" : "s"} synced.
        </span>
      )}

      {/* Error, Fix 3: var(--alarm) = #ef4444 (confirmed in globals.css line 52) */}
      {result === "error" && (
        <span style={{ fontSize: 11, color: "var(--alarm)" }}>{errorMsg}</span>
      )}
    </div>
  );
}

// ── Main surface ──────────────────────────────────────────────────────────────

export function CurationSurface({
  initialNodes,
  workspaceSlug,
  projectSlug,
  isPublished,
  publicUrl,
}: {
  initialNodes: EffectiveNode[];
  workspaceSlug: string;
  projectSlug: string;
  isPublished: boolean;
  publicUrl: string;
}) {
  const router = useRouter();
  const [nodes, setNodes] = useState(initialNodes);
  // H2: lifted open state, single source of truth for the manual add form.
  // When isEmpty===true and manualAddOpen===true, ManualAddForm replaces the
  // empty-state container in situ. When nodes exist, the bottom affordance also
  // drives this state. ManualAddForm has no internal open gate.
  const [manualAddOpen, setManualAddOpen] = useState(false);
  // Fix 1: hoisted draft state, survives isEmpty branch swap mid-typing.
  const [draftTitle, setDraftTitle] = useState("");
  const [draftLane, setDraftLane] = useState<"Next" | "In flight" | "Shipped">("Next");
  const [draftDate, setDraftDate] = useState("");
  // C1c: track in-flight upsert writes; RSC prop sync is suppressed while > 0
  const pendingWriteCount = useRef(0);
  const [, startTransition] = useTransition();
  // D11 auto-sync: fires once on mount (pull-on-visit). Does NOT publish.
  const [autoSyncing, setAutoSyncing] = useState(false);
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

  // UX-2: router.refresh() instead of window.location.reload()
  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

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
    return () => { pendingWriteCount.current = 0; };
  }, [initialNodes]);

  // C1c write-count helpers, passed into NodeCard and ManualAddForm
  const handleWriteStart = useCallback(() => {
    pendingWriteCount.current += 1;
  }, []);

  const handleWriteEnd = useCallback(() => {
    pendingWriteCount.current = Math.max(0, pendingWriteCount.current - 1);
  }, []);

  // D11 auto-sync on load: pulls Tasks milestones into the private draft.
  // D6 two-gate is preserved, syncMilestonesAction only revalidates /app and
  // /app/plan/[slug], never the public /{workspaceSlug} path.
  useEffect(() => {
    if (didAutoSync.current) return;
    didAutoSync.current = true;
    setAutoSyncing(true);
    syncMilestonesAction(workspaceSlug, projectSlug).then(() => {
      setAutoSyncing(false);
      // C1c: only refresh if no writes are in flight, avoids clobbering
      // optimistic state mid-write with stale RSC data.
      if (pendingWriteCount.current === 0) {
        router.refresh();
      }
    }).catch(() => {
      setAutoSyncing(false);
    });
  }, [workspaceSlug, projectSlug, router]);

  // DRAG: justPublished localStorage persistence
  // Initialise from localStorage so the chip animation fires on first load
  // after a publish, even if the page was reloaded.
  // ── Shared reorder logic ────────────────────────────────────────────────────
  // Used by both HTML5 drag and Pointer Events paths. Computes the new order,
  // updates optimistic state, then batch-writes ALL sortOverride values (BV-2).

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
    setNodes(updated);

    // BV-2: batch-write ALL sibling sortOverrides so reload order is deterministic.
    // reorderNodesAction writes every node in the ordered list, not just the moved one.
    startTransition(async () => {
      try {
        const result = await reorderNodesAction(
          workspaceSlug,
          projectSlug,
          updated.map((n) => n.id),
        );
        if ("error" in result) {
          flashError(result.error);
          setNodes(previousNodes);
          return;
        }
        flashSaved();
      } catch {
        flashError("Couldn't save that reorder. Check your connection and try again.");
        setNodes(previousNodes);
      }
    });
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

  // Group by lane for display
  const lanes = LANE_LABELS.filter((l) =>
    nodes.some((n) => n.lane === l && !n.hidden),
  );
  const hiddenNodes = nodes.filter((n) => n.hidden);

  const isEmpty = nodes.length === 0;

  const isSaved = savedAt !== null;

  return (
    <div>
      {/* Plan-state banner, single element for both published and unpublished-with-nodes states.
          M4: when unpublished and ≥1 visible node exists, show a quiet nudge. Same element,
          two states, no second competing banner. Kept quiet: no coloured bar, no loud CTA. */}
      {isPublished ? (
        <div
          style={{
            marginBottom: 24,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid var(--hairline)",
            background: "var(--paper-soft, #fafafa)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            Published, anyone with the link can read this.
          </span>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 11,
              color: "var(--ink-quiet)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            View public roadmap
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        </div>
      ) : nodes.filter((n) => !n.hidden).length > 0 ? (
        /* M4 unpublished-with-nodes nudge, quiet, declarative, same visual register as published banner */
        <div
          style={{
            marginBottom: 24,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid var(--hairline)",
            background: "var(--paper-soft, #fafafa)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 12, color: "var(--ink-quiet)" }}>
            Not published yet.{" "}
            <Link
              href="/app#publish"
              style={{ color: "var(--ink-soft)", textDecoration: "underline", textUnderlineOffset: "2px" }}
            >
              Publish it from your dashboard.
            </Link>
          </span>
        </div>
      ) : null}

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "var(--ink-quiet)",
              margin: 0,
            }}
          >
            Milestones
          </h2>
          {/* DRAG: "Saved" 1.5s tick */}
          {isSaved && (
            <span
              style={{
                fontSize: 10,
                color: "var(--ink-quiet)",
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                transition: "opacity 160ms",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Saved
            </span>
          )}
          {/* C2: transient advisory flash for silent-fail writes.
              role="status" (not alert), non-blocking, polite-announce.
              Mutually exclusive with the Saved tick. Auto-clears at 4s. */}
          {errorFlash && !isSaved && (
            <span
              role="status"
              style={{
                fontSize: 10,
                color: "var(--ink-soft)",
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                transition: "opacity 160ms",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {errorFlash.message}
            </span>
          )}
          {autoSyncing && (
            <span style={{ fontSize: 10, color: "var(--ink-faint)" }}>
              Syncing…
            </span>
          )}
        </div>
        <SyncButton
          workspaceSlug={workspaceSlug}
          projectSlug={projectSlug}
          onSync={refresh}
        />
      </div>

      {/* Empty state, H2: single primary CTA + quiet inline manual-add link.
          When manualAddOpen, ManualAddForm replaces the container in situ.
          No scrollIntoView. No detached anchor div. */}
      {isEmpty ? (
        manualAddOpen ? (
          /* H2: form replaces empty state in the same container/position.
             Fix 7: matching padding to empty state to prevent layout jump on swap. */
          <div style={{ padding: "48px 24px" }}>
            <ManualAddForm
              workspaceSlug={workspaceSlug}
              projectSlug={projectSlug}
              onAdd={() => { flashSaved(); refresh(); }}
              onWriteStart={handleWriteStart}
              onWriteEnd={handleWriteEnd}
              onClose={() => setManualAddOpen(false)}
              title={draftTitle}
              setTitle={setDraftTitle}
              lane={draftLane}
              setLane={setDraftLane}
              date={draftDate}
              setDate={setDraftDate}
            />
          </div>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "48px 24px",
              color: "var(--ink-quiet)",
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 16, opacity: 0.4 }}>◇</div>
            <p
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: "var(--ink-soft)",
                marginBottom: 8,
              }}
            >
              Your plan fills itself in.
            </p>
            <p
              style={{
                fontSize: 13,
                color: "var(--ink-quiet)",
                lineHeight: 1.55,
                maxWidth: 320,
                margin: "0 auto 16px",
              }}
            >
              Mark tasks as milestones in Signal Tasks and they&apos;ll appear here automatically.
            </p>
            {/* Fix 8: marginBottom 16 (was 12) */}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
              <a
                href={process.env.NEXT_PUBLIC_TASKS_URL ?? "https://tasks.signalstudio.ie"}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  padding: "8px 18px",
                  borderRadius: 999,
                  background: "var(--ink)",
                  color: "var(--paper)",
                  textDecoration: "none",
                }}
              >
                Open Tasks
              </a>
            </div>
            {/* Quiet inline manual-add link, no background, no border, no pill.
                Fix 9: hover underline via className. */}
            <button
              type="button"
              onClick={() => setManualAddOpen(true)}
              className="quiet-link-hover"
              style={{
                fontSize: 13,
                color: "var(--ink-quiet)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                lineHeight: 1.5,
              }}
            >
              or add one manually
            </button>
          </div>
        )
      ) : (
        <>
          {/* Lane-grouped node list with drag-to-reorder (UX-1) */}
          <div
            style={{
              border: "1px solid var(--hairline)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {lanes.map((lane, li) => {
              const laneNodes = nodes.filter((n) => n.lane === lane && !n.hidden);
              return (
                <div key={lane}>
                  {li > 0 && (
                    <div style={{ paddingInline: 16 }}>
                      <LaneSeparator lane={lane} />
                    </div>
                  )}
                  {li === 0 && (
                    <div style={{ paddingInline: 16, paddingTop: 16, marginBottom: -4 }}>
                      <span
                        style={{
                          fontFamily: "var(--font-mono-stack)",
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: "0.14em",
                          color: "var(--ink-quiet)",
                        }}
                      >
                        {lane}
                      </span>
                    </div>
                  )}
                  {laneNodes.map((node) => (
                    <NodeCard
                      key={node.id}
                      node={node}
                      workspaceSlug={workspaceSlug}
                      projectSlug={projectSlug}
                      onUpdate={() => { flashSaved(); refresh(); }}
                      onWriteStart={handleWriteStart}
                      onWriteEnd={handleWriteEnd}
                      onError={flashError}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onPointerDragStart={handlePointerDragStart}
                      onPointerDragOver={handlePointerDragOver}
                      onPointerDrop={handlePointerDrop}
                      isDraggingOver={dragOverId === node.id}
                    />
                  ))}
                </div>
              );
            })}
          </div>

          {/* Hidden nodes count */}
          {hiddenNodes.length > 0 && (
            <p
              style={{
                fontSize: 11,
                color: "var(--ink-quiet)",
                marginTop: 12,
                textAlign: "center",
              }}
            >
              {hiddenNodes.length} hidden
            </p>
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
              onAdd={() => { flashSaved(); refresh(); }}
              onWriteStart={handleWriteStart}
              onWriteEnd={handleWriteEnd}
              onClose={() => setManualAddOpen(false)}
              title={draftTitle}
              setTitle={setDraftTitle}
              lane={draftLane}
              setLane={setDraftLane}
              date={draftDate}
              setDate={setDraftDate}
            />
          ) : (
            /* Fix 9: hover underline via className */
            <button
              type="button"
              onClick={() => setManualAddOpen(true)}
              className="quiet-link-hover"
              style={{
                fontSize: 12,
                color: "var(--indigo, #4f46e5)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "8px 0",
                display: "block",
              }}
            >
              + Add a milestone
            </button>
          )}
        </div>
      )}
    </div>
  );
}
