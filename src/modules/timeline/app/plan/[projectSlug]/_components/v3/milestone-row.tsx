"use client";

/**
 * One milestone in the list (spec 3.2 and 5.3): 48px (56px on a phone), a
 * diamond in its tone, the name, its marks (⊘ hidden from the shared page,
 * ⚑ key date, ✎ date set here), "Added here" for manual milestones, and the
 * date with a relative phrase for Now and Coming up.
 *
 * On hover or focus the row shows its eye toggle and ⋯ menu. E or a
 * double-click renames it in place (Enter saves, Esc cancels). When Tasks has
 * moved a date the owner set, a strip under the row offers the choice in one
 * click: [Use 5 Sep] or [Keep 29 Aug]. On desktop a handle drags it among the
 * milestones it can trade places with.
 */

import Link from "next/link";
import { memo, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { EffectiveNode } from "@/modules/timeline/server/db/timeline-queries";
import { isLate, planGroupKey, rowDate } from "@/modules/timeline/lib/plan-view";
import { formatShortDay } from "@/lib/projects/project-portfolio-scale";
import { RowMenuButton } from "@/components/app/portfolio/row-menu";
import { FlagGlyph } from "@/components/app/portfolio/timeline-ui";
import styles from "./plan.module.css";

export type RowTone = "done" | "next" | "late" | "key" | "cancelled" | "upcoming";

export function rowTone(node: EffectiveNode, todayIso: string, nextId: string | null, keyId: string | null): RowTone {
  if (node.audienceState === "covered") return "done";
  if (node.audienceState === "cancelled") return "cancelled";
  if (node.id === nextId) return "next";
  if (isLate(node, todayIso)) return "late";
  if (node.id === keyId) return "key";
  return "upcoming";
}

export function EyeOffIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 2l12 12M6.6 6.7a2 2 0 0 0 2.7 2.7M4.3 4.4C2.9 5.3 2 6.6 1.5 8c1.1 2.9 3.6 4.5 6.5 4.5 1.3 0 2.5-.3 3.5-.9M7 3.6c.3 0 .7-.1 1-.1 2.9 0 5.4 1.6 6.5 4.5-.3.8-.7 1.5-1.2 2.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EyeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M1.5 8C2.6 5.1 5.1 3.5 8 3.5s5.4 1.6 6.5 4.5c-1.1 2.9-3.6 4.5-6.5 4.5S2.6 10.9 1.5 8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function PencilMark({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10.8 2.7a1.6 1.6 0 0 1 2.3 2.3L5.6 12.5 2.5 13.5l1-3.1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export const MilestoneRow = memo(function MilestoneRow({
  node,
  todayIso,
  tone,
  isKey,
  selected,
  current,
  hovered,
  settled,
  dropTarget,
  canEdit,
  canDrag,
  hasError,
  renaming,
  onOpen,
  onFocusRow,
  onHover,
  onToggleHidden,
  onMenu,
  onRename,
  onRenameDone,
  onStartRename,
  onUseTasksDate,
  onKeepDate,
  onHandleDown,
  onHandleMove,
  onHandleUp,
  taskHref = null,
}: {
  node: EffectiveNode;
  todayIso: string;
  tone: RowTone;
  isKey: boolean;
  selected: boolean;
  /** The roving tab stop. */
  current: boolean;
  hovered: boolean;
  settled: boolean;
  dropTarget: boolean;
  canEdit: boolean;
  canDrag: boolean;
  hasError: boolean;
  renaming: boolean;
  onOpen: (id: string) => void;
  onFocusRow: (id: string) => void;
  onHover: (id: string | null) => void;
  onToggleHidden: (node: EffectiveNode) => void;
  onMenu: (node: EffectiveNode, anchor: DOMRect | { x: number; y: number }, returnTo: HTMLElement) => void;
  onRename: (node: EffectiveNode, title: string) => void;
  onRenameDone: () => void;
  onStartRename: (id: string) => void;
  onUseTasksDate: (node: EffectiveNode) => void;
  onKeepDate: (node: EffectiveNode) => void;
  onHandleDown: (event: ReactPointerEvent<HTMLSpanElement>, id: string) => void;
  onHandleMove: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  onHandleUp: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  /** Set on the next milestone when it comes from Tasks: a trailing "Open task →". */
  taskHref?: string | null;
}) {
  const { date, relative } = rowDate(node, todayIso);
  const late = isLate(node, todayIso);
  const dateSetHere = node.dateOverrideMode === "date";
  const group = planGroupKey(node);
  const dateDrift =
    node.driftDetected && node.dateOverrideMode === "date" && node.sourceTargetDate && node.sourceTargetDate !== node.targetDate;
  const labelBits = [
    node.title,
    date ? `${date}${relative ? `, ${relative}` : ""}` : "no date yet",
    late ? "missed" : null,
    node.hidden ? "hidden from the shared page" : null,
    isKey ? "key date" : null,
    dateSetHere ? "date set here" : null,
    node.source === "manual" ? "added here" : null,
    node.driftDetected ? "changed in Tasks since" : null,
    hasError ? "not saved" : null,
  ].filter(Boolean);

  return (
    <li
      className={styles.row}
      data-node-id={node.id}
      data-selected={selected ? "" : undefined}
      data-hovered={hovered ? "" : undefined}
      data-hidden={node.hidden ? "" : undefined}
      data-settled-state={group === "done" ? "" : undefined}
      data-cancelled={group === "cancelled" ? "" : undefined}
      data-settled={settled ? "" : undefined}
      data-drop={dropTarget ? "" : undefined}
      onPointerEnter={() => onHover(node.id)}
      onPointerLeave={() => onHover(null)}
      onContextMenu={(event) => {
        event.preventDefault();
        onMenu(node, { x: event.clientX, y: event.clientY }, event.currentTarget.querySelector<HTMLElement>("[data-row-button]") ?? event.currentTarget);
      }}
    >
      <div className={styles.rowLine}>
        <span
          className={styles.handle}
          data-disabled={canDrag ? undefined : ""}
          aria-hidden="true"
          title="Drag to reorder"
          onPointerDown={(event) => onHandleDown(event, node.id)}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        >
          <svg width="10" height="14" viewBox="0 0 10 16" fill="currentColor">
            <circle cx="3" cy="4" r="1.2" />
            <circle cx="3" cy="8" r="1.2" />
            <circle cx="3" cy="12" r="1.2" />
            <circle cx="7" cy="4" r="1.2" />
            <circle cx="7" cy="8" r="1.2" />
            <circle cx="7" cy="12" r="1.2" />
          </svg>
        </span>
        {renaming ? (
          <RenameField node={node} onSave={(title) => onRename(node, title)} onDone={onRenameDone} />
        ) : (
          <button
            type="button"
            className={styles.rowMain}
            tabIndex={current ? 0 : -1}
            aria-label={labelBits.join(", ")}
            aria-pressed={selected}
            data-row-button={node.id}
            onClick={() => onOpen(node.id)}
            onDoubleClick={() => canEdit && onStartRename(node.id)}
            onFocus={() => onFocusRow(node.id)}
          >
            <span className={styles.rowDiamond} data-tone={tone} aria-hidden="true" />
            <span className={styles.rowTitle} title={node.title}>
              {node.title}
            </span>
            <span className={styles.marks} aria-hidden="true">
              {hasError ? (
                <span className={styles.mark} data-tone="error" title="Not saved">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 4.75v3.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="8" cy="10.9" r="0.9" fill="currentColor" />
                  </svg>
                </span>
              ) : null}
              {node.hidden ? (
                <span className={styles.mark} title="Hidden from the shared page">
                  <EyeOffIcon />
                </span>
              ) : null}
              {isKey ? (
                <span className={styles.mark} data-tone="key" title="Key date">
                  <FlagGlyph />
                </span>
              ) : null}
              {dateSetHere ? (
                <span className={styles.mark} title="Date set here">
                  <PencilMark />
                </span>
              ) : null}
              {node.source === "manual" ? <span className={styles.addedHere}>Added here</span> : null}
            </span>
            <span className={styles.rowDate} data-late={late ? "" : undefined} data-empty={date ? undefined : ""}>
              {date ?? "No date"}
              {relative ? <span className={styles.rowRelative}> · {relative}</span> : null}
            </span>
          </button>
        )}
        {taskHref && !renaming ? (
          <Link href={taskHref} className={styles.rowTaskLink} aria-label={`Open the task for ${node.title}`}>
            Open task →
          </Link>
        ) : null}
        {canEdit && !renaming ? (
          <span className={styles.rowControls}>
            <button
              type="button"
              tabIndex={-1}
              className={styles.rowIcon}
              aria-label={node.hidden ? `Show ${node.title} on the shared page` : `Hide ${node.title} from the shared page`}
              title={node.hidden ? "Show on the shared page (H)" : "Hide from the shared page (H)"}
              aria-pressed={node.hidden}
              onClick={() => onToggleHidden(node)}
            >
              {node.hidden ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
            </button>
            <RowMenuButton
              className={styles.rowIcon}
              label={`Actions for ${node.title}`}
              tabIndex={-1}
              onOpen={(anchor, button) => onMenu(node, anchor, button)}
            />
          </span>
        ) : null}
      </div>
      {dateDrift && canEdit ? (
        <div className={styles.driftStrip} role="status">
          <span>Tasks moved this to {formatShortDay(node.sourceTargetDate!, todayIso)}.</span>
          <button type="button" className={styles.chipButton} onClick={() => onUseTasksDate(node)}>
            Use {formatShortDay(node.sourceTargetDate!, todayIso)}
          </button>
          <button type="button" className={styles.chipButton} data-quiet="" onClick={() => onKeepDate(node)}>
            Keep {node.targetDate ? formatShortDay(node.targetDate, todayIso) : "no date"}
          </button>
        </div>
      ) : node.driftDetected && canEdit ? (
        <div className={styles.driftStrip} role="status">
          <span>Tasks changed this after you edited it.</span>
          <button type="button" className={styles.chipButton} onClick={() => onUseTasksDate(node)}>
            Use Tasks&apos; version
          </button>
          <button type="button" className={styles.chipButton} data-quiet="" onClick={() => onKeepDate(node)}>
            Keep mine
          </button>
        </div>
      ) : null}
    </li>
  );
});

function RenameField({
  node,
  onSave,
  onDone,
}: {
  node: EffectiveNode;
  onSave: (title: string) => void;
  onDone: () => void;
}) {
  const [value, setValue] = useState(node.title);
  const ref = useRef<HTMLInputElement>(null);
  const finished = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  function finish(save: boolean) {
    if (finished.current) return;
    finished.current = true;
    const next = value.trim();
    if (save && next && next !== node.title) onSave(next);
    onDone();
  }

  return (
    <span className={styles.renameWrap}>
      <label className="sr-only" htmlFor={`rename-${node.id}`}>
        Rename {node.title}
      </label>
      <input
        id={`rename-${node.id}`}
        ref={ref}
        className={styles.renameInput}
        value={value}
        maxLength={120}
        autoComplete="off"
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            finish(true);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            finish(false);
          }
        }}
      />
      <span className={styles.renameHint} aria-hidden="true">
        Enter to save · Esc to cancel
      </span>
    </span>
  );
}
