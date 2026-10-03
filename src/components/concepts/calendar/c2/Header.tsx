"use client";

import type { ReactNode } from "react";
import { personById, VIEWER, type TeamPersonId } from "../../demo/store";
import { TasksPageHeader } from "../../tasks/page-header";
import { CAPACITY, TODAY, plannedOn, weekName, type Task } from "./data";

/** Days from today on that are planned past the hours there are for tasks. */
export function overDays(tasks: Task[]) {
  return [0, 1, 2, 3, 4, 5, 6].filter((d) => d >= TODAY && plannedOn(tasks, d) > CAPACITY[d]);
}

/** "Your week" for the signed-in person, "Aoife's week" for anyone else. */
const weekOf = (id: TeamPersonId) => (id === VIEWER ? "Your week" : `${personById(id)?.first ?? id}'s week`);

/**
 * The one Tasks header, saying whose week this is: "Your week" by default,
 * and the chosen person's as a chip ("Aoife's week") that goes back to yours.
 */
export function PlannerHeader({
  lateOnly,
  onLate,
  stuckOnly,
  onStuck,
  onNewTask,
  signature,
  onSay,
}: {
  lateOnly: boolean;
  onLate: () => void;
  stuckOnly: boolean;
  onStuck: (on: boolean) => void;
  onNewTask: () => void;
  signature?: ReactNode;
  onSay: (msg: string) => void;
}) {
  return (
    <TasksPageHeader
      context={weekName()}
      ownerChip={weekOf}
      lateOnly={lateOnly}
      onLate={onLate}
      stuckOnly={stuckOnly}
      onStuck={onStuck}
      onNewTask={onNewTask}
      signature={signature}
      onSay={onSay}
    />
  );
}
