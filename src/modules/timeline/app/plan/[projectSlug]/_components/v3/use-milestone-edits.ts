"use client";

/**
 * Every write the owner's plan makes, in one place (v3 redesign).
 *
 * LIFTED, NOT REWRITTEN, from the retired `CurationSurface` so the new
 * presentation inherits its proved behaviour unchanged:
 *
 *   - optimistic state with an exact rollback when a write fails, and a
 *     per-milestone retry closure that repeats the same write;
 *   - `upsertNodeOverlayAction` for name (a label override), date (inherit /
 *     a date / no date), hidden, and where guests see it (audience override);
 *   - `reorderNodesAction`, writing the WHOLE shown order so a reload is
 *     deterministic (BV-2), with `buildOwnerKeyboardReorder` and the polite
 *     "Position n of m" announcement;
 *   - `createManualMilestoneAction`, which keeps its draft on failure;
 *   - the pending-write gate (C1a/C1c): while a write is settling, a fresh
 *     server tree must not replace optimistic edits with an older one, so the
 *     refresh waits for the last write to land.
 *
 * ONE REFRESH OWNER. The plan used to run two refreshes from Tasks: the view
 * mode's freshness line and the edit mode's own auto-sync, deliberately kept
 * apart so they never doubled a Tasks read. With one surface there is one
 * owner, here: it runs once on mount, reads `complete` / `totalCount` for the
 * truncation sentence, skips the page refresh when nothing changed or a newer
 * refresh already landed, and distinguishes a retryable failure from a
 * settled refusal (archived, access gone), which offers no Retry.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EffectiveNode } from "@/modules/timeline/server/db/timeline-queries";
import type { AudienceItemState } from "@/modules/timeline/server/db/timeline-schema";
import {
  createManualMilestoneAction,
  reorderNodesAction,
  syncMilestonesAction,
  upsertNodeOverlayAction,
  type UpsertOverlayResult,
} from "@/modules/timeline/server/actions/workspaces";
import { buildOwnerKeyboardReorder, type OwnerReorderDirection } from "@/modules/timeline/lib/owner-reorder";
import { applyRunOrder, displayOrder, moveRun } from "@/modules/timeline/lib/plan-view";
import { addDays } from "@/lib/projects/project-portfolio-scale";

// ── Lane and state derivation (unchanged from CurationSurface) ─────────────

function laneForAudienceState(state: AudienceItemState, targetDate: string | null): EffectiveNode["lane"] {
  if (state === "covered") return "Shipped";
  if (state === "now") return "In flight";
  if (state === "later" || state === "cancelled") return "Later";
  return targetDate ? "Next" : "Later";
}

function sourceStateForDate(node: EffectiveNode, targetDate: string | null): AudienceItemState {
  if (node.audienceStateOverride) return node.audienceStateOverride;
  if (node.status === "shipped") return "covered";
  if (node.status === "refused") return "cancelled";
  if (node.status === "in-flight" || node.status === "waiting") return "now";
  return targetDate ? "next" : "later";
}

const NETWORK_ERROR = "Couldn’t save that change. Check your connection and try again.";
const SYNC_NETWORK_ERROR =
  "Timeline couldn’t refresh milestones from Tasks. Check your connection and try again.";

export type EditField = "name" | "date" | "hidden" | "state" | "order";

export type FieldStatus =
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string; retry: (() => void) | null };

export type SyncState =
  | { kind: "idle" }
  | { kind: "refreshing" }
  /** `retryable: false` is a settled refusal: stated once, no Retry. */
  | { kind: "failed"; message: string; retryable: boolean }
  | { kind: "truncated"; imported: number; total: number | null };

export type AddMilestoneInput = { title: string; state: AudienceItemState; date: string | null };

export function useMilestoneEdits({
  initialNodes,
  workspaceSlug,
  projectSlug,
  autoSync,
  localOnly = false,
}: {
  initialNodes: EffectiveNode[];
  workspaceSlug: string;
  projectSlug: string;
  /** Off for archived Projects and review, which have no Tasks source to refresh from. */
  autoSync: boolean;
  /**
   * Review: edits apply on this screen and nowhere else. No Server Action is
   * called, so the review boundary never reaches for a database (access-mode
   * safety invariant), and the page says so in its status line.
   */
  localOnly?: boolean;
}) {
  const router = useRouter();
  const [nodes, setNodes] = useState(initialNodes);
  const [, startTransition] = useTransition();

  // C1c: in-flight writes. The ref is read by async callbacks; the state lets
  // render decide whether a new server tree may be absorbed.
  const pendingWriteCount = useRef(0);
  const [pendingWrites, setPendingWrites] = useState(0);
  const refreshAfterWrites = useRef(false);

  // C1a: absorb server updates into local state, but only when no writes are
  // settling. While a write is pending the optimistic state is authoritative;
  // the refresh that follows the last write brings the confirmed tree.
  const [absorbed, setAbsorbed] = useState(initialNodes);
  if (initialNodes !== absorbed) {
    setAbsorbed(initialNodes);
    if (pendingWrites === 0) setNodes(initialNodes);
  }

  const [fieldStatus, setFieldStatus] = useState<Record<string, Partial<Record<EditField, FieldStatus>>>>({});
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [errorFlash, setErrorFlash] = useState<{ message: string; ts: number } | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reorderAnnouncement, setReorderAnnouncement] = useState("");
  const [settledId, setSettledId] = useState<string | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [syncState, setSyncState] = useState<SyncState>({ kind: "idle" });
  const [lastRefreshedMs, setLastRefreshedMs] = useState<number | null>(null);
  const didAutoSync = useRef(false);

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

  const handleWriteStart = useCallback(() => {
    pendingWriteCount.current += 1;
    setPendingWrites(pendingWriteCount.current);
  }, []);

  const handleWriteEnd = useCallback(() => {
    pendingWriteCount.current = Math.max(0, pendingWriteCount.current - 1);
    setPendingWrites(pendingWriteCount.current);
    if (pendingWriteCount.current === 0 && refreshAfterWrites.current) {
      refreshAfterWrites.current = false;
      refresh();
    }
  }, [refresh]);

  useEffect(
    () => () => {
      pendingWriteCount.current = 0;
      refreshAfterWrites.current = false;
      for (const timer of [savedTimer.current, errorTimer.current, settleTimer.current]) {
        if (timer) clearTimeout(timer);
      }
    },
    [],
  );

  const patchNode = useCallback((nodeId: string, patch: Partial<EffectiveNode>) => {
    setNodes((current) => current.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)));
  }, []);

  const setStatus = useCallback((nodeId: string, field: EditField, status: FieldStatus | null) => {
    setFieldStatus((current) => {
      const forNode = { ...(current[nodeId] ?? {}) };
      if (status) forNode[field] = status;
      else delete forNode[field];
      return { ...current, [nodeId]: forNode };
    });
  }, []);

  // "Saved" tick, and the error flash it is mutually exclusive with (C2).
  const flashSaved = useCallback(() => {
    setSavedAt(Date.now());
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedAt(null), 1600);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    setErrorFlash(null);
  }, []);

  const flashError = useCallback((message: string) => {
    setErrorFlash({ message, ts: Date.now() });
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setErrorFlash(null), 4000);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSavedAt(null);
  }, []);

  const markSettled = useCallback((nodeId: string) => {
    setSettledId(null);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    requestAnimationFrame(() => {
      setSettledId(nodeId);
      settleTimer.current = setTimeout(() => setSettledId(null), 450);
    });
  }, []);

  /**
   * The one overlay write. Applies `optimistic` at once, writes `overlay`,
   * and on failure restores exactly the fields it changed and leaves a Retry
   * that repeats the same write (C2, the NodeCard pattern).
   */
  const writeOverlay = useCallback(
    function writeOverlay(
      node: EffectiveNode,
      field: EditField,
      optimistic: Partial<EffectiveNode>,
      overlay: Omit<Parameters<typeof upsertNodeOverlayAction>[2], "nodeId">,
    ): Promise<boolean> {
      const revert = Object.fromEntries(
        Object.keys(optimistic).map((key) => [key, node[key as keyof EffectiveNode]]),
      ) as Partial<EffectiveNode>;
      const retry = () => void writeOverlay(node, field, optimistic, overlay);
      patchNode(node.id, optimistic);
      if (localOnly) {
        setStatus(node.id, field, { kind: "saved", at: Date.now() });
        flashSaved();
        return Promise.resolve(true);
      }
      setStatus(node.id, field, { kind: "saving" });
      handleWriteStart();
      return new Promise<boolean>((resolve) => {
        startTransition(async () => {
          try {
            const result: UpsertOverlayResult = await upsertNodeOverlayAction(workspaceSlug, projectSlug, {
              nodeId: node.id,
              ...overlay,
            });
            if ("error" in result) {
              flashError(result.error);
              patchNode(node.id, revert);
              setStatus(node.id, field, { kind: "error", message: result.error, retry });
              resolve(false);
              return;
            }
            setStatus(node.id, field, { kind: "saved", at: Date.now() });
            flashSaved();
            requestRefreshAfterWrite();
            resolve(true);
          } catch {
            flashError(NETWORK_ERROR);
            patchNode(node.id, revert);
            setStatus(node.id, field, { kind: "error", message: NETWORK_ERROR, retry });
            resolve(false);
          } finally {
            handleWriteEnd();
          }
        });
      });
    },
    [flashError, flashSaved, handleWriteEnd, handleWriteStart, localOnly, patchNode, projectSlug, requestRefreshAfterWrite, setStatus, workspaceSlug],
  );

  // ── Name ────────────────────────────────────────────────────────────────
  /** A rename is a label override; `null` goes back to the name from Tasks. */
  const saveTitle = useCallback(
    (node: EffectiveNode, nextTitle: string | null) => {
      const trimmed = nextTitle?.trim() ?? null;
      if (trimmed === "" || (trimmed !== null && trimmed === node.title)) return Promise.resolve(true);
      return writeOverlay(
        node,
        "name",
        trimmed === null ? { labelOverride: null } : { title: trimmed, labelOverride: trimmed },
        { labelOverride: trimmed },
      );
    },
    [writeOverlay],
  );

  // ── Date ────────────────────────────────────────────────────────────────
  /** A date, or `""` for "No date". */
  const setDate = useCallback(
    (node: EffectiveNode, dateStr: string) => {
      const nextDate = dateStr || null;
      const nextMode = dateStr ? "date" : "undated";
      const nextState = sourceStateForDate(node, nextDate);
      return writeOverlay(
        node,
        "date",
        {
          targetDate: nextDate,
          dateOverride: nextDate,
          dateOverrideMode: nextMode,
          audienceState: nextState,
          lane: laneForAudienceState(nextState, nextDate),
        },
        { dateOverride: nextDate, dateOverrideMode: nextMode },
      );
    },
    [writeOverlay],
  );

  /** "Use the date from Tasks". */
  const inheritDate = useCallback(
    (node: EffectiveNode) => {
      const nextState = sourceStateForDate(node, node.sourceTargetDate);
      return writeOverlay(
        node,
        "date",
        {
          targetDate: node.sourceTargetDate,
          dateOverride: null,
          dateOverrideMode: "inherit",
          audienceState: nextState,
          lane: laneForAudienceState(nextState, node.sourceTargetDate),
        },
        { dateOverride: null, dateOverrideMode: "inherit" },
      );
    },
    [writeOverlay],
  );

  /** Put a date setting back exactly as it was (Undo). */
  const restoreDate = useCallback(
    (node: EffectiveNode, previous: Pick<EffectiveNode, "dateOverrideMode" | "targetDate">) => {
      if (previous.dateOverrideMode === "inherit") return inheritDate(node);
      return setDate(node, previous.dateOverrideMode === "undated" ? "" : (previous.targetDate ?? ""));
    },
    [inheritDate, setDate],
  );

  // Keyboard nudge: ← → move a day, Shift a week, debounced into ONE write.
  const nudge = useRef<{ node: EffectiveNode; date: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const nudgeDate = useCallback(
    (node: EffectiveNode, days: number, todayIso: string, onCommit?: (from: EffectiveNode, to: string) => void) => {
      const pending = nudge.current?.node.id === node.id ? nudge.current : null;
      if (pending) clearTimeout(pending.timer);
      else if (nudge.current) {
        clearTimeout(nudge.current.timer);
        const { node: other, date } = nudge.current;
        void setDate(other, date);
      }
      const original = pending?.node ?? node;
      const base = pending?.date ?? node.targetDate ?? todayIso;
      const next = addDays(base, days);
      patchNode(node.id, { targetDate: next, dateOverride: next, dateOverrideMode: "date" });
      const timer = setTimeout(() => {
        nudge.current = null;
        void setDate(original, next).then((ok) => {
          if (ok) onCommit?.(original, next);
        });
      }, 400);
      nudge.current = { node: original, date: next, timer };
    },
    [patchNode, setDate],
  );

  // ── Drift: Tasks changed something the owner had edited ─────────────────
  /** Keep mine: write the owner's overrides again, so they are newer than Tasks. */
  const keepMine = useCallback(
    (node: EffectiveNode) =>
      writeOverlay(
        node,
        "date",
        { driftDetected: false },
        {
          ...(node.labelOverride ? { labelOverride: node.labelOverride } : {}),
          ...(node.dateOverrideMode === "date" && node.targetDate
            ? { dateOverrideMode: "date" as const, dateOverride: node.targetDate }
            : node.dateOverrideMode === "undated"
              ? { dateOverrideMode: "undated" as const, dateOverride: null }
              : {}),
        },
      ),
    [writeOverlay],
  );

  /** Use Tasks: drop the owner's name and date overrides. */
  const takeTasksVersion = useCallback(
    (node: EffectiveNode) => {
      const nextState = sourceStateForDate(node, node.sourceTargetDate);
      return writeOverlay(
        node,
        "date",
        {
          driftDetected: false,
          labelOverride: null,
          targetDate: node.sourceTargetDate,
          dateOverride: null,
          dateOverrideMode: "inherit",
          audienceState: nextState,
          lane: laneForAudienceState(nextState, node.sourceTargetDate),
        },
        { labelOverride: null, dateOverride: null, dateOverrideMode: "inherit" },
      );
    },
    [writeOverlay],
  );

  // ── Shared page ─────────────────────────────────────────────────────────
  const setHidden = useCallback(
    (node: EffectiveNode, hidden: boolean) => writeOverlay(node, "hidden", { hidden }, { hidden }),
    [writeOverlay],
  );

  const setPublicState = useCallback(
    (node: EffectiveNode, state: AudienceItemState) =>
      writeOverlay(
        node,
        "state",
        { audienceState: state, audienceStateOverride: state, lane: laneForAudienceState(state, node.targetDate) },
        { audienceStateOverride: state },
      ),
    [writeOverlay],
  );

  /** "Automatic": the state Tasks implies. */
  const inheritPublicState = useCallback(
    (node: EffectiveNode) =>
      writeOverlay(
        node,
        "state",
        {
          audienceState: node.sourceAudienceState,
          audienceStateOverride: null,
          lane: laneForAudienceState(node.sourceAudienceState, node.targetDate),
        },
        { audienceStateOverride: null },
      ),
    [writeOverlay],
  );

  // ── Order ───────────────────────────────────────────────────────────────
  // Batch-writes EVERY node's order (BV-2), in the order the page shows them.
  const persistReorderedNodes = useCallback(
    (updated: EffectiveNode[], previousNodes: EffectiveNode[], successAnnouncement?: string, movedId?: string) => {
      setNodes(updated);
      if (movedId) markSettled(movedId);
      if (localOnly) {
        if (movedId) setStatus(movedId, "order", { kind: "saved", at: Date.now() });
        if (successAnnouncement) setReorderAnnouncement(successAnnouncement);
        flashSaved();
        return Promise.resolve(true);
      }
      if (movedId) setStatus(movedId, "order", { kind: "saving" });
      handleWriteStart();
      return new Promise<boolean>((resolve) => {
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
              if (movedId) setStatus(movedId, "order", { kind: "error", message: result.error, retry: null });
              if (successAnnouncement) {
                setReorderAnnouncement("The milestone could not be moved. The previous order was restored.");
              }
              resolve(false);
              return;
            }
            flashSaved();
            if (movedId) setStatus(movedId, "order", { kind: "saved", at: Date.now() });
            if (successAnnouncement) setReorderAnnouncement(successAnnouncement);
            requestRefreshAfterWrite();
            resolve(true);
          } catch {
            flashError("Couldn’t save that reorder. Check your connection and try again.");
            setNodes(previousNodes);
            if (movedId) setStatus(movedId, "order", { kind: "error", message: NETWORK_ERROR, retry: null });
            if (successAnnouncement) {
              setReorderAnnouncement("The milestone could not be moved. The previous order was restored.");
            }
            resolve(false);
          } finally {
            handleWriteEnd();
          }
        });
      });
    },
    [flashError, flashSaved, handleWriteEnd, handleWriteStart, localOnly, markSettled, projectSlug, requestRefreshAfterWrite, setStatus, workspaceSlug],
  );

  /**
   * Move up or down among the milestones it can trade places with (same
   * group, same day), announcing "Position n of m" politely.
   */
  const moveNodeByKeyboard = useCallback(
    (sourceId: string, direction: OwnerReorderDirection) => {
      const run = moveRun(nodes, sourceId);
      // Within a run every node shares a group, so the keyboard reorder sees
      // one sibling set; hidden ones move too (they keep their place).
      const result = buildOwnerKeyboardReorder(
        run.map((node) => ({ id: node.id, title: node.title, audienceState: run[0].audienceState, hidden: false })),
        sourceId,
        direction,
      );
      if (!result) return Promise.resolve(false);
      const updated = applyRunOrder(nodes, result.orderedIds);
      const directionLabel = result.direction === "up" ? "up" : "down";
      setReorderAnnouncement(`Moving ${result.title} ${directionLabel}.`);
      return persistReorderedNodes(
        updated,
        nodes,
        `Moved ${result.title} ${directionLabel}. Position ${result.position} of ${result.siblingCount}.`,
        sourceId,
      );
    },
    [nodes, persistReorderedNodes],
  );

  /** Drag-to-reorder: drop `sourceId` where `targetId` is, within its run. */
  const applyReorder = useCallback(
    (sourceId: string, targetId: string) => {
      if (!sourceId || sourceId === targetId) return Promise.resolve(false);
      const run = moveRun(nodes, sourceId).map((node) => node.id);
      const from = run.indexOf(sourceId);
      const to = run.indexOf(targetId);
      if (from < 0 || to < 0) return Promise.resolve(false);
      const ids = [...run];
      ids.splice(from, 1);
      ids.splice(to, 0, sourceId);
      const title = nodes.find((node) => node.id === sourceId)?.title ?? "Milestone";
      return persistReorderedNodes(
        applyRunOrder(nodes, ids),
        nodes,
        `Moved ${title}. Position ${to + 1} of ${run.length}.`,
        sourceId,
      );
    },
    [nodes, persistReorderedNodes],
  );

  /** Put a whole order back (Undo after a reorder). */
  const restoreOrder = useCallback(
    (previous: EffectiveNode[]) => persistReorderedNodes(displayOrder(previous).map((n, i) => ({ ...n, sortOrder: i })), nodes),
    [nodes, persistReorderedNodes],
  );

  // ── Add ─────────────────────────────────────────────────────────────────
  /** C1d: on failure the caller keeps its draft; the error is returned to show inline. */
  const addMilestone = useCallback(
    async (input: AddMilestoneInput): Promise<{ ok: true } | { error: string }> => {
      const title = input.title.trim();
      if (!title) return { error: "What’s the milestone?" };
      if (localOnly) {
        const date = input.date || null;
        setNodes((current) => [
          ...current,
          {
            id: `local:${projectSlug}:${current.length}:${title}`,
            projectSlug,
            workspaceSlug,
            title,
            status: "next",
            targetDate: date,
            sourceTargetDate: date,
            sortOrder: current.length,
            lane: laneForAudienceState(input.state, date),
            audienceState: input.state,
            sourceAudienceState: input.state,
            audienceStateOverride: input.state,
            hidden: false,
            laneOverride: null,
            labelOverride: null,
            dateOverride: null,
            dateOverrideMode: "inherit",
            source: "manual",
            driftDetected: false,
            updatedAt: new Date(),
          },
        ]);
        flashSaved();
        return { ok: true };
      }
      handleWriteStart();
      try {
        const result = await createManualMilestoneAction(workspaceSlug, projectSlug, {
          title,
          state: input.state,
          date: input.date || null,
        });
        if ("error" in result) return { error: result.error };
        flashSaved();
        requestRefreshAfterWrite();
        return { ok: true };
      } catch {
        return { error: "Couldn’t add that milestone. Check your connection and try again." };
      } finally {
        handleWriteEnd();
      }
    },
    [flashSaved, handleWriteEnd, handleWriteStart, localOnly, projectSlug, requestRefreshAfterWrite, workspaceSlug],
  );

  // ── Refresh from Tasks: the one owner ───────────────────────────────────
  const runAutoSync = useCallback(async () => {
    setSyncState({ kind: "refreshing" });
    try {
      const result = await syncMilestonesAction(workspaceSlug, projectSlug);
      if ("error" in result) {
        setSyncState({ kind: "failed", message: result.error, retryable: result.retryable });
        return;
      }
      setLastRefreshedMs(result.refreshedAt ?? Date.now());
      // Truncated, and said so. Rows that did not come back are not proof of
      // absence and nothing was deleted for them.
      if (result.complete === false) {
        setSyncState({ kind: "truncated", imported: result.count, total: result.totalCount ?? null });
      } else {
        setSyncState({ kind: "idle" });
      }
      // An unchanged digest updates freshness without rewriting nodes, and
      // `superseded` means a newer refresh already landed. Otherwise defer the
      // page refresh while owner writes settle (C1c), so a synced tree cannot
      // replace optimistic edits with an older one.
      if (result.changed !== false && result.superseded !== true) requestRefreshAfterWrite();
    } catch {
      // A thrown request is the network, which is what Retry is for.
      setSyncState({ kind: "failed", message: SYNC_NETWORK_ERROR, retryable: true });
    }
  }, [projectSlug, requestRefreshAfterWrite, workspaceSlug]);

  // D11 auto-sync on load: pulls Tasks milestones into the private draft. It
  // never publishes; the shared page only changes when the owner publishes.
  useEffect(() => {
    if (!autoSync || didAutoSync.current) return;
    didAutoSync.current = true;
    void runAutoSync();
  }, [autoSync, runAutoSync]);

  return {
    nodes,
    fieldStatus,
    savedAt,
    errorFlash,
    reorderAnnouncement,
    settledId,
    syncState,
    lastRefreshedMs,
    runAutoSync,
    saveTitle,
    setDate,
    inheritDate,
    restoreDate,
    nudgeDate,
    keepMine,
    takeTasksVersion,
    setHidden,
    setPublicState,
    inheritPublicState,
    moveNodeByKeyboard,
    applyReorder,
    restoreOrder,
    addMilestone,
    patchNode,
    setStatus,
  };
}

export type MilestoneEdits = ReturnType<typeof useMilestoneEdits>;
