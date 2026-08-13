"use client";

/**
 * WP5 lab · the guarded Project transition, plan §3.5 and §7.4.
 *
 * All four variants drive this one machine. The rules it enforces are the ones
 * the plan calls release blockers, so no variant may reimplement them:
 *
 *   1. One selection at a time. A second pick while a switch is pending is
 *      refused outright — not queued, not replaced (plan §3.5.1).
 *   2. The committed Project stays committed until the destination verifies.
 *      An unverified name is never shown over the old Project's data (§7.4).
 *   3. Failure before the commit leaves you exactly where you were, and says
 *      so using both names.
 *   4. Failure after the commit keeps the new Project selected. Old data does
 *      not come back to fill the hole.
 *
 * The lab simulates latency and failure. The state shape is the real one.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PROJECT_TRUTH_IDS,
  type FixtureProjectId,
  type FixtureScenarioId,
} from "@/lib/project-truth-fixture";
import { buildCatalog, rowFor, type LabCatalog, type LabRow } from "./model";
import { labState, type LabState, type LabStateId } from "./states";

export type SwitchStatus =
  | { kind: "idle" }
  /** Held behind an unfinished save (§7.4, unsaved autosave). */
  | { kind: "queued"; target: LabRow }
  | { kind: "pending"; target: LabRow; slow: boolean }
  /** The save the switch was waiting on failed. Stay, retry, or discard. */
  | { kind: "save-failed"; target: LabRow }
  /** Nothing committed. You are still where you were. */
  | { kind: "failed"; target: LabRow };

export type LabSession = Readonly<{
  state: LabState;
  scenario: FixtureScenarioId;
  catalog: LabCatalog;
  /** The verified Project. Null while resolving, or once access is lost. */
  committed: LabRow | null;
  status: SwitchStatus;
  resolving: boolean;
  offline: boolean;
  accessLost: boolean;
  /** The Project opened; its Timeline did not. */
  destinationFailed: boolean;
  /** A Notes draft, frozen to the Project it was filed to at first input. */
  draftFiledTo: LabRow | null;
  /** True while any project-scoped write must be refused. */
  writesDisabled: boolean;
  /** True while the trigger must read aria-busy and refuse selections. */
  busy: boolean;
  announcement: string;
  /** Returns false when the guard refused the selection. */
  select: (row: LabRow) => boolean;
  /**
   * ADR §5: an archived Project opens only through its own read-only route.
   * It never travels through the guarded switch and never becomes the
   * remembered default.
   */
  openArchived: (row: LabRow) => void;
  retry: () => void;
  stay: () => void;
  discardAndSwitch: () => void;
  dismissFailure: () => void;
}>;

const SLOW_AFTER_MS = 300;
const SAVE_MS = 900;

function startingProjectFor(
  stateId: LabStateId,
  scenario: FixtureScenarioId,
): FixtureProjectId | null {
  if (scenario === "zero-projects") return null;
  if (stateId === "archived") return PROJECT_TRUTH_IDS.cliffWalk;
  return PROJECT_TRUTH_IDS.harbourHouse;
}

export function useLabSession(
  stateId: LabStateId,
  requestedScenario: FixtureScenarioId,
): LabSession {
  const state = labState(stateId);
  const scenario = state.forceScenario ?? requestedScenario;

  const accessLost = stateId === "access-lost";
  const offline = stateId === "offline";
  const resolving = stateId === "resolving";

  const catalog = useMemo(
    () =>
      buildCatalog(scenario, {
        // Access loss is an absence, not a disabled row. The Project is simply
        // not in the catalog any more, and nothing takes its place (ADR §4).
        omit: accessLost ? [PROJECT_TRUTH_IDS.harbourHouse] : [],
        downgradeToMember:
          stateId === "permission-downgrade" ? PROJECT_TRUTH_IDS.harbourHouse : null,
      }),
    [scenario, accessLost, stateId],
  );

  const initialId = accessLost ? null : startingProjectFor(stateId, scenario);
  const [committedId, setCommittedId] = useState<FixtureProjectId | null>(initialId);
  const [status, setStatus] = useState<SwitchStatus>({ kind: "idle" });
  const [destinationFailed, setDestinationFailed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [saveRetried, setSaveRetried] = useState(false);

  // Changing lab state is changing worlds. The shell remounts this surface on
  // a key of state + scenario rather than resetting it here, so there is no
  // reset effect to get wrong and no timer from the previous world to leak
  // into the next one.
  const timers = useRef<number[]>([]);
  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);
  const after = useCallback((ms: number, run: () => void) => {
    const id = window.setTimeout(run, ms);
    timers.current.push(id);
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const committed = rowFor(catalog, committedId);
  const draftFiledTo = stateId === "notes-draft" ? rowFor(catalog, initialId) : null;

  const runSwitch = useCallback(
    (target: LabRow, currentName: string) => {
      setStatus({ kind: "pending", target, slow: false });
      setAnnouncement(`Opening ${target.name}…`);

      after(SLOW_AFTER_MS, () => {
        setStatus((current) =>
          current.kind === "pending" && current.target.id === target.id
            ? { ...current, slow: true }
            : current,
        );
      });

      after(state.holdMs, () => {
        if (stateId === "precommit-failure") {
          // Nothing committed: no URL, no cookie, no relabelled canvas.
          setStatus({ kind: "failed", target });
          setAnnouncement(
            `Couldn't open ${target.name}. You're still in ${currentName}.`,
          );
          return;
        }
        setCommittedId(target.id);
        setStatus({ kind: "idle" });
        if (stateId === "destination-failure") {
          setDestinationFailed(true);
          setAnnouncement(`${target.name} is selected. Timeline is unavailable.`);
          return;
        }
        setDestinationFailed(false);
        setAnnouncement(`${target.name} is open.`);
      });
    },
    [after, state.holdMs, stateId],
  );

  const select = useCallback(
    (row: LabRow) => {
      // The guard. One selection at a time, and none at all while the surface
      // is refusing writes.
      if (status.kind === "pending" || status.kind === "queued") return false;
      if (status.kind === "save-failed") return false;
      if (offline || resolving) return false;
      if (row.archived) return false;
      if (row.id === committedId) return false;

      if (stateId === "unsaved-work" && !saveRetried) {
        setStatus({ kind: "queued", target: row });
        setAnnouncement("Saving your changes before the project opens.");
        after(SAVE_MS, () => {
          setStatus({ kind: "save-failed", target: row });
          setAnnouncement("Your changes did not save. The project has not opened.");
        });
        return true;
      }

      runSwitch(row, committed?.name ?? "this project");
      return true;
    },
    [
      status.kind,
      offline,
      resolving,
      committedId,
      committed?.name,
      stateId,
      saveRetried,
      after,
      runSwitch,
    ],
  );

  const openArchived = useCallback(
    (row: LabRow) => {
      if (!row.archived) return;
      if (status.kind === "pending" || status.kind === "queued") return;
      clearTimers();
      setCommittedId(row.id);
      setStatus({ kind: "idle" });
      setDestinationFailed(false);
      setAnnouncement(`${row.name} is open, read-only.`);
    },
    [status.kind, clearTimers],
  );

  const retry = useCallback(() => {
    clearTimers();
    if (status.kind === "save-failed") {
      // Deliberate: the second save succeeds, so both branches of the failed
      // save are reachable in one sitting.
      setSaveRetried(true);
      const target = status.target;
      setStatus({ kind: "queued", target });
      setAnnouncement("Trying the save again.");
      after(SAVE_MS, () => runSwitch(target, committed?.name ?? "this project"));
      return;
    }
    if (status.kind === "failed") {
      const target = status.target;
      setSaveRetried(true);
      runSwitch(target, committed?.name ?? "this project");
      return;
    }
    if (destinationFailed) {
      setDestinationFailed(false);
      setAnnouncement("Timeline loaded.");
    }
  }, [status, destinationFailed, committed?.name, after, clearTimers, runSwitch]);

  const stay = useCallback(() => {
    clearTimers();
    setStatus({ kind: "idle" });
    setAnnouncement("Staying put. Your changes are still unsaved.");
  }, [clearTimers]);

  const discardAndSwitch = useCallback(() => {
    clearTimers();
    if (status.kind !== "save-failed") return;
    const target = status.target;
    setSaveRetried(true);
    setAnnouncement("Changes discarded.");
    runSwitch(target, committed?.name ?? "this project");
  }, [status, committed?.name, clearTimers, runSwitch]);

  const dismissFailure = useCallback(() => {
    setStatus({ kind: "idle" });
    setAnnouncement("");
  }, []);

  const busy =
    status.kind === "pending" ||
    status.kind === "queued" ||
    status.kind === "save-failed";

  return {
    state,
    scenario,
    catalog,
    committed,
    status,
    resolving,
    offline,
    accessLost,
    destinationFailed,
    draftFiledTo,
    writesDisabled: offline || resolving || Boolean(committed?.archived),
    busy,
    announcement,
    select,
    openArchived,
    retry,
    stay,
    discardAndSwitch,
    dismissFailure,
  };
}
