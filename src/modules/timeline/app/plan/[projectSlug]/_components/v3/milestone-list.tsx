"use client";

/**
 * The plan as a grouped list (spec 3.2): Now, Coming up, Later, No date yet,
 * then Done and Not going ahead folded away. One Tab stop with a roving row;
 * J/K or the arrows move, Enter opens. Only the last open group ends with a
 * ghost "+ Add a milestone" row (one Tab stop, not one per group); the
 * header's "Add milestone (N)" is the keyboard path. Desktop rows drag by their handle among the
 * milestones they can trade places with (same group, same day).
 */

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { EffectiveNode } from "@/modules/timeline/server/db/timeline-queries";
import type { AudienceItemState } from "@/modules/timeline/server/db/timeline-schema";
import { groupPlanNodes, moveRun, type PlanGroupKey } from "@/modules/timeline/lib/plan-view";
import { ChevronRight, FlagGlyph, Kbd } from "@/components/app/portfolio/timeline-ui";
import { AddMilestoneRow } from "./add-milestone-row";
import { EyeOffIcon, MilestoneRow, PencilMark, rowTone } from "./milestone-row";
import type { AddMilestoneInput, FieldStatus, EditField } from "./use-milestone-edits";
import styles from "./plan.module.css";

const ADDABLE: ReadonlySet<PlanGroupKey> = new Set(["now", "next", "later", "undated"]);

export type ListRowActions = Readonly<{
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
}>;

export function MilestoneList({
  nodes,
  todayIso,
  nextId,
  keyId,
  selectedId,
  currentId,
  hoverId,
  renamingId,
  settledId,
  canEdit,
  canDrag,
  fieldStatus,
  savedAt,
  errorFlash,
  reorderAnnouncement,
  addAt,
  tasksHref,
  actions,
  onOpenAdd,
  onCloseAdd,
  onAdd,
  onReorder,
  onShowAll,
  addButtonRef,
}: {
  nodes: readonly EffectiveNode[];
  todayIso: string;
  nextId: string | null;
  keyId: string | null;
  selectedId: string | null;
  currentId: string | null;
  hoverId: string | null;
  renamingId: string | null;
  settledId: string | null;
  canEdit: boolean;
  canDrag: boolean;
  fieldStatus: Record<string, Partial<Record<EditField, FieldStatus>>>;
  savedAt: number | null;
  errorFlash: { message: string } | null;
  reorderAnnouncement: string;
  /** Where the composer is open: "top", a group key, "key" (the empty state), or null. */
  addAt: string | null;
  tasksHref: string;
  actions: ListRowActions;
  onOpenAdd: (at: string) => void;
  onCloseAdd: (reason: "complete" | "cancel") => void;
  onAdd: (input: AddMilestoneInput) => Promise<{ ok: true } | { error: string }>;
  onReorder: (sourceId: string, targetId: string) => void;
  onShowAll: () => void;
  addButtonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<PlanGroupKey>>(() => new Set(["done", "cancelled"]));
  const [dropId, setDropId] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);

  const groups = groupPlanNodes(nodes);
  const shown = nodes.filter((node) => !node.hidden);
  const allHidden = nodes.length > 0 && shown.length === 0;
  const hasError = (id: string) => Object.values(fieldStatus[id] ?? {}).some((status) => status?.kind === "error");
  const openGroups = groups.filter((group) => !group.collapsedByDefault);
  const foldedGroups = groups.filter((group) => group.collapsedByDefault);
  const lastAddable = [...openGroups].reverse().find((group) => ADDABLE.has(group.key))?.key ?? null;
  // Count the same set the runway counts ("2 of 9 done"), and say why the
  // list holds more.
  const cancelledCount = nodes.filter((node) => node.audienceState === "cancelled").length;
  const hiddenCount = nodes.filter((node) => node.hidden && node.audienceState !== "cancelled").length;
  const activeCount = nodes.length - cancelledCount - hiddenCount;

  function toggle(key: PlanGroupKey) {
    setCollapsed((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ── Drag to reorder (pointer events: mouse, pen and touch) ──────────────
  function onHandleDown(event: ReactPointerEvent<HTMLSpanElement>, id: string) {
    if (!canDrag || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (moveRun(nodes, id).length < 2) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragId.current = id;
  }

  function onHandleMove(event: ReactPointerEvent<HTMLSpanElement>) {
    const source = dragId.current;
    if (!source) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-node-id]");
    const targetId = target?.getAttribute("data-node-id") ?? null;
    const run = moveRun(nodes, source).map((node) => node.id);
    setDropId(targetId && targetId !== source && run.includes(targetId) ? targetId : null);
  }

  function onHandleUp() {
    const source = dragId.current;
    const target = dropId;
    dragId.current = null;
    setDropId(null);
    if (source && target) onReorder(source, target);
  }

  const status = errorFlash ? (
    <span className={styles.saveNote} data-tone="error" role="status">
      {errorFlash.message}
    </span>
  ) : savedAt ? (
    <span key={savedAt} className={styles.saveNote} role="status">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Saved
    </span>
  ) : null;

  // A milestone added from a group's ghost row starts in that group.
  const stateFor = (at: string | null): AudienceItemState =>
    at === "now" ? "now" : at === "later" || at === "key" ? "later" : "next";
  const composer = (placeholder?: string) => (
    <AddMilestoneRow
      todayIso={todayIso}
      onAdd={(input) => onAdd({ ...input, state: stateFor(addAt) })}
      onClose={onCloseAdd}
      placeholder={placeholder}
    />
  );

  function renderRows(group: (typeof groups)[number]) {
    return (
      <ol className={styles.rows} aria-labelledby={`plan-group-${group.key}`}>
        {group.nodes.map((node) => (
          <MilestoneRow
            key={node.id}
            node={node}
            todayIso={todayIso}
            tone={rowTone(node, todayIso, nextId, keyId)}
            isKey={node.id === keyId}
            selected={node.id === selectedId}
            current={node.id === currentId}
            hovered={node.id === hoverId}
            settled={node.id === settledId}
            dropTarget={node.id === dropId}
            canEdit={canEdit}
            canDrag={canDrag && moveRun(nodes, node.id).length > 1}
            hasError={hasError(node.id)}
            renaming={node.id === renamingId}
            onOpen={actions.onOpen}
            onFocusRow={actions.onFocusRow}
            onHover={actions.onHover}
            onToggleHidden={actions.onToggleHidden}
            onMenu={actions.onMenu}
            onRename={actions.onRename}
            onRenameDone={actions.onRenameDone}
            onStartRename={actions.onStartRename}
            onUseTasksDate={actions.onUseTasksDate}
            onKeepDate={actions.onKeepDate}
            onHandleDown={onHandleDown}
            onHandleMove={onHandleMove}
            onHandleUp={onHandleUp}
            taskHref={node.id === nextId && node.source === "synced" ? tasksHref : null}
          />
        ))}
      </ol>
    );
  }

  return (
    <section className={styles.list} aria-labelledby="plan-milestones-title">
      <div className={styles.listHead}>
        <h2 id="plan-milestones-title" className={styles.listTitle}>
          Milestones <span className={styles.listCount}>· {activeCount}</span>
          {hiddenCount > 0 ? <span className={styles.listCountNote}> · {hiddenCount} hidden</span> : null}
          {cancelledCount > 0 ? <span className={styles.listCountNote}> · {cancelledCount} not going ahead</span> : null}
        </h2>
        <div className={styles.listHeadEnd}>
          {status}
          {canEdit ? (
            <button
              ref={addButtonRef}
              type="button"
              className={`${styles.button} ${styles.small} ${styles.phoneHide}`}
              onClick={() => onOpenAdd("top")}
              aria-expanded={addAt === "top"}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              Add milestone
              <Kbd className={styles.kbdInline}>N</Kbd>
            </button>
          ) : null}
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {reorderAnnouncement}
      </p>

      {addAt === "top" && canEdit ? <div className={styles.addTop}>{composer()}</div> : null}

      {nodes.length === 0 ? (
        addAt === "key" && canEdit ? (
          <div className={styles.addTop}>{composer("Name the day that matters, like Wedding day 3 Oct")}</div>
        ) : addAt === "top" ? null : (
          <div className={styles.empty}>
            <span className={styles.emptyMark} aria-hidden="true">
              <FlagGlyph size={16} />
            </span>
            <p className={styles.emptyTitle}>Start with the day that matters</p>
            <p className={styles.emptyBody}>
              The wedding, the launch, the last day of term. Everything else lines up before it.
            </p>
            <div className={styles.emptyActions}>
              {canEdit ? (
                <button type="button" className={styles.buttonPrimary} onClick={() => onOpenAdd("key")}>
                  Set the key date
                </button>
              ) : null}
            </div>
            <p className={styles.emptyNote}>
              Or mark tasks as milestones in Tasks and they&apos;ll appear here.{" "}
              <a href={tasksHref} className={styles.link}>
                Open Tasks
              </a>
            </p>
          </div>
        )
      ) : null}

      {allHidden ? (
        <div className={styles.notice}>
          <EyeOffIcon />
          <p>Every milestone is hidden, so guests see an empty page.</p>
          {canEdit ? (
            <button type="button" className={`${styles.button} ${styles.small}`} onClick={onShowAll}>
              Show all
            </button>
          ) : null}
        </div>
      ) : null}

      <div className={styles.groups}>
        {openGroups.map((group) => (
          <div key={group.key} className={styles.group}>
            <h3 id={`plan-group-${group.key}`} className={styles.groupHead}>
              {group.label}
              <span className={styles.groupCount}>· {group.nodes.length}</span>
            </h3>
            {renderRows(group)}
            {canEdit && ADDABLE.has(group.key) ? (
              addAt === group.key ? (
                composer(group.key === "undated" ? "Name a milestone" : undefined)
              ) : group.key !== lastAddable ? null : (
                <button type="button" className={styles.ghostRow} onClick={() => onOpenAdd(group.key)}>
                  <span className={styles.ghostPlus} aria-hidden="true">
                    +
                  </span>
                  Add a milestone
                </button>
              )
            ) : null}
          </div>
        ))}
        {foldedGroups.length > 0 ? (
          <div className={styles.folds}>
            {foldedGroups.map((group) => {
              const isCollapsed = collapsed.has(group.key);
              return (
                <div key={group.key} className={styles.fold} data-open={isCollapsed ? undefined : ""}>
                  <button
                    type="button"
                    id={`plan-group-${group.key}`}
                    className={styles.foldHead}
                    aria-expanded={!isCollapsed}
                    onClick={() => toggle(group.key)}
                  >
                    <ChevronRight size={12} className={styles.foldChevron} />
                    {group.label}
                    <span className={styles.groupCount}>· {group.nodes.length}</span>
                  </button>
                  {isCollapsed ? null : renderRows(group)}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {nodes.length > 0 ? (
        <div className={styles.legend} aria-label="Marks">
          <span className={styles.legendItem}>
            <EyeOffIcon size={13} /> Hidden from the shared page
          </span>
          <span className={styles.legendItem}>
            <FlagGlyph size={12} /> Key date
          </span>
          <span className={styles.legendItem}>
            <PencilMark size={12} /> Date set here
          </span>
        </div>
      ) : null}
    </section>
  );
}
