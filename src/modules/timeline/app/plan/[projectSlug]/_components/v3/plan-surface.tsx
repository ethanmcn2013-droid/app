"use client";

/**
 * One plan (v3, round 2): one surface to read, edit and share.
 *
 *   header      the tabs, the Project, the plan's name, its key date,
 *               Preview and Share, and the one-sentence status line
 *   runway      the plan on one line, on the shared canvas
 *   list        milestones grouped by what guests see
 *   column      Up next and What guests see, or the milestone panel
 *
 * Every write goes through `useMilestoneEdits` (untouched: rollback, retry,
 * sync, drift, undo and the review mode's local-only path). This file owns
 * layout, selection, hover linking between the runway and the list, the
 * keyboard layer, the row menu, undo toasts and focus return.
 */

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { EffectiveNode } from "@/modules/timeline/server/db/timeline-queries";
import type { TimelineFreshnessView } from "@/modules/timeline/lib/freshness";
import { displayOrder, keyDate, moveRun, planCounts, upNext } from "@/modules/timeline/lib/plan-view";
import { formatShortDay, formatWeekdayDate } from "@/lib/projects/project-portfolio-scale";
import { RowMenu, type RowMenuEntry, type RowMenuState } from "@/components/app/portfolio/row-menu";
import {
  isShortcutBlocked,
  NARROW_QUERY,
  PHONE_QUERY,
  Sheet,
  ShortcutSheet,
  TimelineToasts,
  useMediaQuery,
  useTimelineToasts,
  type ShortcutGroup,
} from "@/components/app/portfolio/timeline-ui";
import { ContextColumn } from "./context-column";
import { MilestoneList, type ListRowActions } from "./milestone-list";
import { MilestonePanel } from "./milestone-panel";
import { PlanHeader } from "./plan-header";
import { PlanRunway, type PlanRunwayHandle } from "./plan-runway";
import { PlanStatusLine } from "./plan-status-line";
import { ShareSheet } from "./share-sheet";
import type { SharePublicationSummary } from "./share-state";
import { useMilestoneEdits } from "./use-milestone-edits";
import styles from "./plan.module.css";

const READ_KEYS: ShortcutGroup = {
  title: "Moving around",
  keys: [
    ["Next or previous milestone", ["J", "K"]],
    ["Next or previous milestone", ["↓", "↑"]],
    ["First or last milestone", ["Home", "End"]],
    ["Open the selected milestone", ["Enter"]],
    ["Milestone actions", ["."]],
    ["Close the panel, a sheet or a menu", ["Esc"]],
    ["Show today on the line", ["T"]],
    ["Preview what guests see", ["P"]],
    ["Share", ["S"]],
    ["Show these shortcuts", ["?"]],
  ],
};

const EDIT_KEYS: ShortcutGroup = {
  title: "Changing a milestone",
  keys: [
    ["Add a milestone", ["N"]],
    ["Rename the selected milestone", ["E"]],
    ["Hide or show it on the shared page", ["H"]],
    ["Move its date a day", ["←", "→"]],
    ["Move its date a week", ["Shift", "← →"]],
    ["Move it up or down", ["Alt", "↑ ↓"]],
  ],
};

export type PlanSurfaceProps = Readonly<{
  initialNodes: EffectiveNode[];
  workspaceSlug: string;
  projectSlug: string;
  planName: string;
  suiteProjectName: string;
  suiteProjectId: string;
  overviewHref: string | null;
  todayIso: string;
  nowMs: number;
  archived: boolean;
  canManage: boolean;
  canPublish: boolean;
  autoSync: boolean;
  /** Review: edits stay on this screen; nothing is written anywhere. */
  reviewMode: boolean;
  freshness: TimelineFreshnessView | null;
  publication: SharePublicationSummary | null;
  /** The guest's page, from the latest publication; null when there is none. */
  guestPreview: ReactNode | null;
  previewHref: string;
  manageHref: string;
  tasksHref: string;
  /** `?mode=edit` (the Milestones deep link) opens the first milestone's panel. */
  openFirstPanel: boolean;
  viewSwitch: ReactNode;
}>;

export function PlanSurface(props: PlanSurfaceProps) {
  const {
    initialNodes,
    workspaceSlug,
    projectSlug,
    todayIso,
    archived,
    canManage,
    canPublish,
    publication,
    previewHref,
    manageHref,
    tasksHref,
  } = props;
  const canEdit = !archived;
  const router = useRouter();
  const edits = useMilestoneEdits({
    initialNodes,
    workspaceSlug,
    projectSlug,
    autoSync: props.autoSync,
    localOnly: props.reviewMode,
  });
  const { nodes } = edits;
  const ordered = displayOrder(nodes);

  const [selectedId, setSelectedId] = useState<string | null>(() =>
    props.openFirstPanel ? (displayOrder(initialNodes)[0]?.id ?? null) : null,
  );
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [addAt, setAddAt] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [menu, setMenu] = useState<RowMenuState | null>(null);
  const { toasts, show, dismiss } = useTimelineToasts();
  const narrow = useMediaQuery(NARROW_QUERY);
  const phone = useMediaQuery(PHONE_QUERY);
  const panelHeadingId = useId();
  const runwayRef = useRef<PlanRunwayHandle>(null);
  const manualAddTriggerRef = useRef<HTMLButtonElement>(null);
  // On a phone the add button lives in the bottom bar, so focus returns there.
  const listAddRef = useRef<HTMLButtonElement>(null);
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  });
  const latest = useCallback((id: string) => nodesRef.current.find((node) => node.id === id), []);

  const selected = selectedId ? (nodes.find((node) => node.id === selectedId) ?? null) : null;
  const rovingId = currentId && nodes.some((n) => n.id === currentId) ? currentId : (selectedId ?? ordered[0]?.id ?? null);
  const next = upNext(nodes, todayIso);
  const key = keyDate(nodes);
  const counts = planCounts(nodes);

  // ── Selection and focus ─────────────────────────────────────────────────
  const focusRow = useCallback((id: string) => {
    requestAnimationFrame(() => {
      const button = document.querySelector<HTMLElement>(`[data-row-button="${CSS.escape(id)}"]`);
      button?.focus({ preventScroll: true });
      button?.scrollIntoView({ block: "nearest" });
    });
  }, []);

  const openPanel = useCallback((id: string, focusField?: "name" | "date") => {
    setSelectedId(id);
    setCurrentId(id);
    if (focusField) {
      // Two frames: the panel mounts, then its field takes focus.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (focusField === "name") document.querySelector<HTMLInputElement>("[data-panel-name]")?.select();
          else document.querySelector<HTMLElement>('[data-milestone-panel] [role="radiogroup"] [aria-checked="true"]')?.focus();
        }),
      );
    }
    const row = document.querySelector(`[data-row-button="${CSS.escape(id)}"]`);
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const closePanel = useCallback(() => {
    const id = selectedId;
    setSelectedId(null);
    if (id) focusRow(id);
  }, [focusRow, selectedId]);

  const openAdd = useCallback((at: string = "top") => {
    setAddAt(at);
  }, []);

  // Manual add restores focus to its initiating control (the add button),
  // on the next frame, whether it completed or was cancelled.
  const closeAdd = useCallback(
    (reason: "complete" | "cancel") => {
      setAddAt(null);
      requestAnimationFrame(() => {
        manualAddTriggerRef.current?.focus();
      });
      if (reason === "complete") show("Milestone added");
    },
    [show],
  );

  // ── Writes with Undo ────────────────────────────────────────────────────
  const toggleHidden = useCallback(
    (node: EffectiveNode) => {
      const was = node.hidden;
      void edits.setHidden(node, !was).then((ok) => {
        if (!ok) return;
        show(was ? "Back on the shared page." : "Hidden from the shared page.", {
          label: "Undo",
          run: () => {
            const now = latest(node.id);
            if (now) void edits.setHidden(now, was);
          },
        });
      });
    },
    [edits, latest, show],
  );

  const redate = useCallback(
    (node: EffectiveNode, day: string) => {
      const previous = { dateOverrideMode: node.dateOverrideMode, targetDate: node.targetDate };
      void edits.setDate(node, day).then((ok) => {
        if (!ok) return;
        show(`Moved to ${formatShortDay(day, todayIso)}.`, {
          label: "Undo",
          run: () => {
            const now = latest(node.id);
            if (now) void edits.restoreDate(now, previous);
          },
        });
      });
    },
    [edits, latest, show, todayIso],
  );

  const move = useCallback(
    (node: EffectiveNode, direction: "up" | "down") => {
      const before = nodesRef.current;
      void edits.moveNodeByKeyboard(node.id, direction).then((ok) => {
        if (!ok) return;
        show(direction === "up" ? "Moved up." : "Moved down.", {
          label: "Undo",
          run: () => void edits.restoreOrder(before),
        });
      });
    },
    [edits, show],
  );

  const reorderByDrag = useCallback(
    (sourceId: string, targetId: string) => {
      const before = nodesRef.current;
      void edits.applyReorder(sourceId, targetId).then((ok) => {
        if (ok) show("Order changed.", { label: "Undo", run: () => void edits.restoreOrder(before) });
      });
    },
    [edits, show],
  );

  const rename = useCallback(
    (node: EffectiveNode, title: string) => {
      const was = node.title;
      const wasOverride = node.labelOverride;
      void edits.saveTitle(node, title).then((ok) => {
        if (!ok) return;
        show(`Renamed to ${title}.`, {
          label: "Undo",
          run: () => {
            const now = latest(node.id);
            if (now) void edits.saveTitle(now, wasOverride === null && node.source === "synced" ? null : was);
          },
        });
      });
    },
    [edits, latest, show],
  );

  /** Drift: take the date (and name) from Tasks, and clear the flag here. */
  const takeTasksVersion = useCallback(
    (node: EffectiveNode) => {
      void edits.takeTasksVersion(node);
    },
    [edits],
  );

  const showAll = useCallback(() => {
    for (const node of nodesRef.current) if (node.hidden) void edits.setHidden(node, false);
  }, [edits]);

  // ── Row menu ────────────────────────────────────────────────────────────
  const openMenu = useCallback(
    (node: EffectiveNode, anchor: DOMRect | { x: number; y: number }, returnTo: HTMLElement) => {
      const run = moveRun(nodesRef.current, node.id);
      const at = run.findIndex((candidate) => candidate.id === node.id);
      const items: RowMenuEntry[] = [
        { id: "open", label: "Open details", hint: ["Enter"], onSelect: () => openPanel(node.id) },
        ...(canEdit
          ? ([
              { id: "rename", label: "Rename", hint: ["E"], onSelect: () => setRenamingId(node.id) },
              { id: "date", label: "Change date", onSelect: () => openPanel(node.id, "date") },
              {
                id: "hide",
                label: node.hidden ? "Show on the shared page" : "Hide from the shared page",
                hint: ["H"],
                onSelect: () => toggleHidden(node),
              },
              { id: "sep", separator: true },
              { id: "up", label: "Move up", hint: ["Alt", "↑"], disabled: at <= 0, onSelect: () => move(node, "up") },
              { id: "down", label: "Move down", hint: ["Alt", "↓"], disabled: at === -1 || at >= run.length - 1, onSelect: () => move(node, "down") },
            ] satisfies RowMenuEntry[])
          : []),
        ...(node.source === "synced"
          ? ([
              { id: "sep2", separator: true },
              { id: "tasks", label: "Open in Tasks", onSelect: () => router.push(tasksHref) },
            ] satisfies RowMenuEntry[])
          : []),
      ];
      setMenu({ anchor, items, label: `Actions for ${node.title}`, returnTo });
    },
    [canEdit, move, openPanel, router, tasksHref, toggleHidden],
  );

  const rowActions: ListRowActions = {
    onOpen: (id) => openPanel(id),
    onFocusRow: setCurrentId,
    onHover: setHoverId,
    onToggleHidden: toggleHidden,
    onMenu: openMenu,
    onRename: rename,
    onRenameDone: () => {
      const id = renamingId;
      setRenamingId(null);
      if (id) focusRow(id);
    },
    onStartRename: (id) => setRenamingId(id),
    onUseTasksDate: takeTasksVersion,
    onKeepDate: (node) => void edits.keepMine(node),
  };

  // ── Keyboard layer ──────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !document.querySelector('[role="dialog"][aria-modal="true"], [role="menu"]')) {
        const target = event.target as HTMLElement;
        if (target.tagName === "INPUT" && target.closest("form")) return; // the add row handles its own Esc
        if (selectedId) {
          event.preventDefault();
          closePanel();
        }
        return;
      }
      if (isShortcutBlocked(event)) return;
      const inList = (event.target as HTMLElement | null)?.closest?.("[data-row-button]");
      const list = displayOrder(nodesRef.current);
      const activeId = selectedId ?? (inList ? inList.getAttribute("data-row-button") : null) ?? rovingId;
      const activeNode = activeId ? list.find((node) => node.id === activeId) : undefined;
      const step = (to: number) => {
        if (list.length === 0) return;
        const target = list[Math.min(list.length - 1, Math.max(0, to))];
        setCurrentId(target.id);
        if (selectedId) setSelectedId(target.id);
        focusRow(target.id);
      };
      const index = Math.max(0, list.findIndex((node) => node.id === activeId));

      if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        if (!canEdit || !activeNode) return;
        event.preventDefault();
        move(activeNode, event.key === "ArrowUp" ? "up" : "down");
        return;
      }
      if (event.altKey) return;

      switch (event.key) {
        case "j":
        case "J":
          event.preventDefault();
          step(index + 1);
          return;
        case "k":
        case "K":
          event.preventDefault();
          step(index - 1);
          return;
        case "ArrowDown":
        case "ArrowUp":
          if (!inList && !selectedId) return;
          event.preventDefault();
          step(index + (event.key === "ArrowDown" ? 1 : -1));
          return;
        case "Home":
        case "End":
          if (!inList) return;
          event.preventDefault();
          step(event.key === "Home" ? 0 : list.length - 1);
          return;
        case "ArrowLeft":
        case "ArrowRight": {
          if (!canEdit || !activeNode || (!inList && !selectedId)) return;
          event.preventDefault();
          const days = (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 7 : 1);
          edits.nudgeDate(activeNode, days, todayIso, (from, to) => {
            show(`Moved to ${formatShortDay(to, todayIso)}.`, {
              label: "Undo",
              run: () => {
                const now = latest(from.id);
                if (now) void edits.restoreDate(now, { dateOverrideMode: from.dateOverrideMode, targetDate: from.targetDate });
              },
            });
          });
          return;
        }
        case ".": {
          if (!activeNode) return;
          event.preventDefault();
          const button = document.querySelector<HTMLElement>(`[data-row-button="${CSS.escape(activeNode.id)}"]`);
          const trigger = button?.closest("li")?.querySelector<HTMLElement>("[aria-haspopup='menu']");
          const rect = (trigger ?? button)?.getBoundingClientRect();
          if (rect && button) openMenu(activeNode, rect, button);
          return;
        }
        case "n":
        case "N":
          if (!canEdit) return;
          event.preventDefault();
          openAdd("top");
          return;
        case "e":
        case "E":
          if (!canEdit || !activeNode) return;
          event.preventDefault();
          if (selectedId) openPanel(activeNode.id, "name");
          else setRenamingId(activeNode.id);
          return;
        case "h":
        case "H":
          if (!canEdit || !activeNode) return;
          event.preventDefault();
          toggleHidden(activeNode);
          return;
        case "p":
        case "P":
          event.preventDefault();
          router.push(previewHref);
          return;
        case "s":
        case "S":
          event.preventDefault();
          setShareOpen(true);
          return;
        case "t":
        case "T":
          event.preventDefault();
          runwayRef.current?.showToday();
          return;
        case "?":
          event.preventDefault();
          setShortcutsOpen(true);
          return;
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [canEdit, closePanel, edits, focusRow, latest, move, openAdd, openMenu, openPanel, previewHref, router, rovingId, selectedId, show, todayIso, toggleHidden]);

  // ── Pieces ──────────────────────────────────────────────────────────────
  const run = selected ? moveRun(nodes, selected.id) : [];
  const panelFor = (node: EffectiveNode, headingId: string, bare: boolean) => (
    <MilestonePanel
      key={node.id}
      node={node}
      todayIso={todayIso}
      keyDateIso={key?.targetDate ?? null}
      canEdit={canEdit}
      status={edits.fieldStatus[node.id] ?? {}}
      position={{ index: run.findIndex((candidate) => candidate.id === node.id), count: run.length }}
      tasksHref={tasksHref}
      headingId={headingId}
      edits={edits}
      onClose={closePanel}
      onToggleHidden={toggleHidden}
      onMove={move}
      onUseTasksDate={takeTasksVersion}
      bare={bare}
    />
  );

  const statusLine = (
    <PlanStatusLine
      publication={publication}
      todayIso={todayIso}
      onOpenShare={() => setShareOpen(true)}
      mode={props.autoSync ? "sync" : archived ? "archived" : "review"}
      syncState={edits.syncState}
      freshness={props.freshness}
      lastRefreshedMs={edits.lastRefreshedMs}
      serverNowMs={props.nowMs}
      onRefresh={() => void edits.runAutoSync()}
      driftCount={canEdit ? nodes.filter((node) => node.driftDetected).length : 0}
      onJumpToDrift={() => {
        const first = displayOrder(nodesRef.current).find((node) => node.driftDetected);
        if (first) {
          setCurrentId(first.id);
          focusRow(first.id);
        }
      }}
    />
  );

  const list = (
    <MilestoneList
      nodes={nodes}
      todayIso={todayIso}
      nextId={next?.id ?? null}
      keyId={key?.id ?? null}
      selectedId={selectedId}
      currentId={rovingId}
      hoverId={hoverId}
      renamingId={renamingId}
      settledId={edits.settledId}
      canEdit={canEdit}
      canDrag={canEdit && !phone}
      fieldStatus={edits.fieldStatus}
      savedAt={edits.savedAt}
      errorFlash={edits.errorFlash}
      reorderAnnouncement={edits.reorderAnnouncement}
      addAt={addAt}
      tasksHref={tasksHref}
      actions={rowActions}
      onOpenAdd={openAdd}
      onCloseAdd={closeAdd}
      onAdd={edits.addMilestone}
      onReorder={reorderByDrag}
      onShowAll={showAll}
      addButtonRef={phone ? listAddRef : manualAddTriggerRef}
    />
  );

  const datedCount = nodes.filter((node) => node.targetDate && node.audienceState !== "cancelled").length;

  return (
    <div className={`${styles.page} thin-scroll`} data-timeline-plan="">
      <div className={styles.column}>
        <PlanHeader
          planName={props.planName}
          viewSwitch={props.viewSwitch}
          keyNode={key}
          todayIso={todayIso}
          counts={counts}
          previewHref={previewHref}
          manageHref={manageHref}
          onShare={() => setShareOpen(true)}
          statusLine={statusLine}
          archived={archived}
          shareLabel="Share"
        />

        {datedCount > 0 ? (
          <PlanRunway
            ref={runwayRef}
            nodes={nodes}
            todayIso={todayIso}
            selectedId={selectedId}
            hoverId={hoverId}
            nextId={next?.id ?? null}
            keyId={key?.id ?? null}
            canEdit={canEdit}
            phone={phone}
            counts={counts}
            next={next}
            onSelect={(id) => openPanel(id)}
            onHover={setHoverId}
            onRedate={redate}
          />
        ) : nodes.length > 0 ? (
          <p className={styles.runwayEmpty}>Give a milestone a date to place it on the line.</p>
        ) : null}

        <div className={styles.body} data-panel-open={selected && !narrow ? "" : undefined}>
          {list}
          <aside className={styles.side} aria-label="Plan details">
            {selected && !narrow ? (
              <section key={selected.id} className={styles.panelRegion} role="region" aria-labelledby={panelHeadingId} data-milestone-panel="">
                {panelFor(selected, panelHeadingId, false)}
              </section>
            ) : null}
            {/* Kept mounted while the panel is open, so the guest's page is
                never re-created on the client (it carries its own script). */}
            <div hidden={Boolean(selected && !narrow)}>
              <ContextColumn
                todayIso={todayIso}
                publication={publication}
                preview={props.guestPreview}
                canManage={canManage}
                manageHref={manageHref}
              />
            </div>
          </aside>
        </div>
      </div>

      {/* Tablet and phone: the panel is a sheet (right-hand on tablet, from
          the bottom on a phone), focus-trapped, with focus return. */}
      {narrow ? (
        <Sheet
          open={selected !== null}
          onClose={closePanel}
          title={selected?.title ?? "Milestone"}
          subtitle={selected?.targetDate ? formatWeekdayDate(selected.targetDate) : "No date yet"}
          side="right"
          width={420}
        >
          {selected ? <div data-milestone-panel="">{panelFor(selected, `${panelHeadingId}-sheet`, true)}</div> : null}
        </Sheet>
      ) : null}

      <div className={styles.phoneBar}>
        <a href={previewHref} className={styles.button}>
          Preview
        </a>
        {canEdit ? (
          <button ref={phone ? manualAddTriggerRef : undefined} type="button" className={styles.buttonPrimary} onClick={() => openAdd("top")}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            Add milestone
          </button>
        ) : (
          <button type="button" className={styles.buttonPrimary} onClick={() => setShareOpen(true)}>
            Share
          </button>
        )}
      </div>

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        workspaceSlug={workspaceSlug}
        planName={props.planName}
        todayIso={todayIso}
        publication={publication}
        manageHref={manageHref}
        previewHref={previewHref}
        canManage={canManage}
        canPublish={canPublish}
      />
      <ShortcutSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} groups={canEdit ? [READ_KEYS, EDIT_KEYS] : [READ_KEYS]} />
      <RowMenu state={menu} onClose={() => setMenu(null)} />
      <TimelineToasts toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
