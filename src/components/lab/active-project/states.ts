/**
 * WP5 lab · the plan's §7.4 state table, expressed as data.
 *
 * Every row of that table has to be reachable by a reviewer without contriving
 * data, so each one is a selectable lab state. Two kinds:
 *
 *   pinned  — the surface is held in that state so it can be studied.
 *   armed   — the surface stays live and the NEXT switch behaves that way, so
 *             the reviewer performs the switch and watches the state happen.
 *
 * Armed states are the honest ones: a screenshot of "Opening B…" proves
 * nothing about whether A stayed A and stayed inert while it happened.
 */

import type { FixtureScenarioId } from "@/lib/project-truth-fixture";

export type LabStateId =
  | "live"
  | "resolving"
  | "switching"
  | "slow"
  | "precommit-failure"
  | "destination-failure"
  | "no-projects"
  | "archived"
  | "access-lost"
  | "offline"
  | "permission-downgrade"
  | "unsaved-work"
  | "notes-draft";

export type LabStateGroup = "Everyday" | "Slow and failing" | "Edges";

export type LabState = Readonly<{
  id: LabStateId;
  label: string;
  group: LabStateGroup;
  /** What a reviewer should look at. Shown in the rail, in plain English. */
  watch: string;
  kind: "pinned" | "armed";
  /** Milliseconds the guarded transition holds before it settles. */
  holdMs: number;
  /** Forces a scenario where the state only makes sense in one. */
  forceScenario?: FixtureScenarioId;
}>;

/** The everyday switch. Warm, well under the sub-800ms budget of plan §3.5. */
const LIVE_HOLD_MS = 360;

export const LAB_STATES: readonly LabState[] = Object.freeze([
  {
    id: "live",
    label: "Live",
    group: "Everyday",
    watch:
      "Open the control and switch. The name, the heading, the tasks and the " +
      "footer all commit together.",
    kind: "armed",
    holdMs: LIVE_HOLD_MS,
  },
  {
    id: "resolving",
    label: "Resolving",
    group: "Everyday",
    watch:
      "The catalog has not arrived. The trigger holds its width and shows no " +
      "name at all, so no remembered name can flash before it is verified.",
    kind: "pinned",
    holdMs: LIVE_HOLD_MS,
  },
  {
    id: "switching",
    label: "Switching",
    group: "Everyday",
    watch:
      "Pick a project and watch the canvas. It keeps the old project's name " +
      "and data, dimmed and not clickable, until the new one is verified.",
    kind: "armed",
    holdMs: 1100,
  },
  {
    id: "slow",
    label: "Slow switch",
    group: "Slow and failing",
    watch:
      "Past 300ms a quiet progress line appears under the trigger. It is a " +
      "line that finishes, not a spinner that never does.",
    kind: "armed",
    holdMs: 3200,
  },
  {
    id: "precommit-failure",
    label: "Fails before opening",
    group: "Slow and failing",
    watch:
      "The switch fails before anything commits. You stay where you were, " +
      "the message names both projects, and Retry is right there.",
    kind: "armed",
    holdMs: 900,
  },
  {
    id: "destination-failure",
    label: "Opens, then Timeline fails",
    group: "Slow and failing",
    watch:
      "The project did change. Timeline did not load. The new project stays " +
      "selected and no old data reappears underneath it.",
    kind: "armed",
    holdMs: 700,
  },
  {
    id: "offline",
    label: "Offline",
    group: "Slow and failing",
    watch:
      "Project content is covered rather than cached. Switching and every " +
      "project-scoped change are turned off until the connection is back.",
    kind: "pinned",
    holdMs: LIVE_HOLD_MS,
  },
  {
    id: "no-projects",
    label: "No projects",
    group: "Edges",
    watch:
      "Nothing to switch to and nothing pretending otherwise. Tasks offers " +
      "the first project; Notes keeps capturing privately.",
    kind: "pinned",
    holdMs: LIVE_HOLD_MS,
    forceScenario: "zero-projects",
  },
  {
    id: "archived",
    label: "Archived project",
    group: "Edges",
    watch:
      "Opened by an explicit link and read-only. The state is written out, " +
      "not left to a colour, and Restore is offered to the owner.",
    kind: "pinned",
    holdMs: LIVE_HOLD_MS,
  },
  {
    id: "access-lost",
    label: "Access lost",
    group: "Edges",
    watch:
      "Membership was checked again and is gone. The content is removed, the " +
      "state is neutral about why, and nothing is opened in its place.",
    kind: "pinned",
    holdMs: LIVE_HOLD_MS,
  },
  {
    id: "permission-downgrade",
    label: "Permission drops",
    group: "Edges",
    watch:
      "Owner becomes member while the page is open. The project stays; the " +
      "controls it no longer permits go at the same moment.",
    kind: "pinned",
    holdMs: LIVE_HOLD_MS,
  },
  {
    id: "unsaved-work",
    label: "Unsaved changes",
    group: "Edges",
    watch:
      "A save is still going. The switch waits for it. If the save fails you " +
      "are asked to stay, try again, or discard and go.",
    kind: "armed",
    holdMs: LIVE_HOLD_MS,
  },
  {
    id: "notes-draft",
    label: "Notes draft open",
    group: "Edges",
    watch:
      "The draft was filed the moment you typed. Switching the project does " +
      "not quietly move where it is going to land.",
    kind: "armed",
    holdMs: LIVE_HOLD_MS,
  },
]);

export const LAB_STATE_GROUPS: readonly LabStateGroup[] = Object.freeze([
  "Everyday",
  "Slow and failing",
  "Edges",
]);

export function labState(id: LabStateId): LabState {
  const found = LAB_STATES.find((state) => state.id === id);
  if (!found) throw new Error(`lab: unknown state ${id}`);
  return found;
}
