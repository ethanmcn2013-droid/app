import type { Person, Stage, Task, TeamSet } from "./data";

export type Lens = "person" | "project";
export const NO_OWNER = "__none";

export type Lane =
  | { id: string; kind: "unassigned" }
  | { id: string; kind: "person"; person: Person }
  | { id: string; kind: "project"; project: TeamSet["projects"][number] };

export function lanesFor(set: TeamSet, lens: Lens): Lane[] {
  if (lens === "project") return set.projects.map((project) => ({ id: project.id, kind: "project", project }));
  return [
    { id: NO_OWNER, kind: "unassigned" },
    ...set.people.map((person) => ({ id: person.id, kind: "person" as const, person })),
  ];
}

export function laneIdOf(task: Task, lens: Lens): string {
  if (lens === "project") return task.project;
  return task.owner ?? NO_OWNER;
}

export function isOpen(task: Task): boolean {
  return task.stage !== "done";
}

export function openLoad(tasks: readonly Task[], personId: string): number {
  return tasks.filter((t) => t.owner === personId && isOpen(t)).length;
}

export function lateCount(tasks: readonly Task[], laneId: string, lens: Lens): number {
  return tasks.filter((t) => laneIdOf(t, lens) === laneId && isOpen(t) && t.due?.tone === "late").length;
}

export function moveTask(tasks: readonly Task[], id: string, lens: Lens, laneId: string, stage: Stage): Task[] {
  return tasks.map((t) => {
    if (t.id !== id) return t;
    if (lens === "project") return { ...t, project: laneId, stage };
    return { ...t, owner: laneId === NO_OWNER ? null : laneId, stage };
  });
}

export type Suggestion = {
  from: Person;
  to: Person;
  over: number;
  room: number;
  taskIds: string[];
};

/**
 * The calmest fair move: take the person furthest over their usual week, find
 * who has the most room, and offer the cards that are easiest to hand across
 * (not started, not late, so nothing half-done changes hands).
 */
export function findSuggestion(set: TeamSet, tasks: readonly Task[]): Suggestion | null {
  const present = set.people.filter((p) => !p.away);
  const withLoad = present.map((p) => ({ p, load: openLoad(tasks, p.id) }));
  const over = withLoad
    .filter((x) => x.load > x.p.capacity)
    .sort((a, b) => b.load - b.p.capacity - (a.load - a.p.capacity))[0];
  if (!over) return null;
  const roomy = withLoad
    .filter((x) => x.p.id !== over.p.id && x.load < x.p.capacity)
    .sort((a, b) => b.p.capacity - b.load - (a.p.capacity - a.load))[0];
  if (!roomy) return null;
  const overBy = over.load - over.p.capacity;
  const room = roomy.p.capacity - roomy.load;
  const movable = tasks
    .filter((t) => t.owner === over.p.id && t.stage === "todo" && t.due?.tone !== "late")
    .reverse();
  const take = Math.min(overBy, room, movable.length);
  if (take <= 0) return null;
  return { from: over.p, to: roomy.p, over: overBy, room, taskIds: movable.slice(0, take).map((t) => t.id) };
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
