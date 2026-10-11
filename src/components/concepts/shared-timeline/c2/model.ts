import type { Milestone, Moment, World } from "./data";
import { daysBetween } from "./time";

export type MilestoneState = "done" | "next" | "upcoming";

export type DialNode = Milestone & {
  n: number;
  state: MilestoneState;
  angle: number;
  ghostAngle?: number;
};

export type Model = {
  hasDate: boolean;
  /** Angle of the last known mark when the date is still open. */
  openFrom?: number;
  start: number;
  end: number;
  spanDays: number;
  now: number;
  todayAngle: number;
  nodes: DialNode[];
  next?: DialNode;
  after?: DialNode;
  doneCount: number;
  stepCount: number;
  angleOf: (t: number) => number;
  timeAt: (angle: number) => number;
};

/**
 * One revolution of the dial is the whole project: from the first
 * milestone (or today, if today comes first) to the event. Angles are a
 * straight linear map of time, so every mark is true to its date.
 */
export function buildModel(world: World, moment: Moment, now: number): Model {
  const hasDate = moment !== "noDate";
  const list = world.milestones.filter((m) => hasDate || !m.isEvent);
  const first = list[0].at;
  const last = list[list.length - 1].at;
  const start = Math.min(first, now);
  // With no date yet, the known part of the project fills most of the turn
  // and the last stretch stays open, drawn as a dashed "still to be set".
  const end = hasDate ? Math.max(world.target, now) : Math.max(last, now) + (Math.max(last, now) - start) * 0.12;
  const span = end - start;
  const angleOf = (t: number) => Math.min(1, Math.max(0, (t - start) / span)) * 360;
  const timeAt = (angle: number) => start + (angle / 360) * span;

  let nextFound = false;
  const nodes: DialNode[] = list.map((m, i) => {
    let state: MilestoneState = m.at <= now ? "done" : "upcoming";
    if (state === "upcoming" && !nextFound) {
      state = "next";
      nextFound = true;
    }
    return {
      ...m,
      n: i + 1,
      state,
      angle: angleOf(m.at),
      ghostAngle: m.movedFrom !== undefined ? angleOf(m.movedFrom) : undefined,
    };
  });
  const nextIdx = nodes.findIndex((n) => n.state === "next");
  const steps = nodes.filter((n) => !n.isEvent);
  return {
    hasDate,
    openFrom: hasDate ? undefined : angleOf(Math.max(last, now)),
    start,
    end,
    spanDays: daysBetween(start, end),
    now,
    todayAngle: angleOf(now),
    nodes,
    next: nextIdx >= 0 ? nodes[nextIdx] : undefined,
    after: nextIdx >= 0 ? nodes[nextIdx + 1] : undefined,
    doneCount: steps.filter((n) => n.state === "done").length,
    stepCount: steps.length,
    angleOf,
    timeAt,
  };
}
