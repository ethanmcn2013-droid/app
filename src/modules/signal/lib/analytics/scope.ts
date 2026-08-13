import type {
  AnalyticsQuery,
  AnalyticsScope,
  AnalyticsSnapshot,
  LabelRecord,
  MilestoneRecord,
  NoteRecord,
  TaskRecord,
  TimelineDependencyRecord,
} from "./contracts";

export class ScopeBoundaryError extends Error {
  constructor() {
    super("Analytics snapshot and query cross a workspace boundary");
    this.name = "ScopeBoundaryError";
  }
}

function hasOwner(ownerIds: string[], scope: AnalyticsScope): boolean {
  return scope.type !== "user" || ownerIds.includes(scope.id);
}

export function taskInScope(task: TaskRecord, scope: AnalyticsScope): boolean {
  if (task.workspaceId !== scope.workspaceId) return false;
  return hasOwner(task.ownerIds, scope);
}

export function noteInScope(note: NoteRecord, scope: AnalyticsScope): boolean {
  if (note.workspaceId !== scope.workspaceId) return false;
  return hasOwner(note.ownerIds, scope);
}

export function milestoneInScope(
  milestone: MilestoneRecord,
  scope: AnalyticsScope,
): boolean {
  if (milestone.workspaceId !== scope.workspaceId) return false;
  return hasOwner(milestone.ownerIds, scope);
}

export function labelInScope(label: LabelRecord, scope: AnalyticsScope): boolean {
  if (label.workspaceId !== scope.workspaceId) return false;
  return hasOwner(label.ownerIds, scope);
}

export function timelineDependencyInScope(
  dependency: TimelineDependencyRecord,
  scope: AnalyticsScope,
): boolean {
  if (dependency.workspaceId !== scope.workspaceId) return false;
  return hasOwner(dependency.ownerIds, scope);
}

/**
 * Defense-in-depth filtering. Authorization still belongs in the server policy;
 * this prevents an adapter returning extra records from widening a calculation.
 */
export function scopeSnapshot(
  snapshot: AnalyticsSnapshot,
  query: AnalyticsQuery,
): AnalyticsSnapshot {
  if (
    snapshot.scope.workspaceId !== query.scope.workspaceId ||
    snapshot.scope.workspaceId !== snapshot.scope.id &&
      snapshot.scope.type === "workspace"
  ) {
    throw new ScopeBoundaryError();
  }

  const ownerFilter = new Set(query.filters?.ownerIds ?? []);
  const statusFilter = new Set(query.filters?.statuses ?? []);
  const labelFilter = new Set<string>(query.filters?.labelIds ?? []);
  const matchesOwnerFilter = (ids: string[]) =>
    ownerFilter.size === 0 || ids.some((id) => ownerFilter.has(id));
  const matchesLabelFilter = (ids: string[]) =>
    labelFilter.size === 0 || ids.some((id) => labelFilter.has(id));

  const tasks = snapshot.tasks.filter(
    (task) =>
      taskInScope(task, query.scope) &&
      matchesOwnerFilter(task.ownerIds) &&
      matchesLabelFilter(task.labelIds) &&
      (statusFilter.size === 0 || statusFilter.has(task.status)),
  );
  const taskIds = new Set(tasks.map((task) => task.id));
  const matchesLinkedTaskStatus = (linkedTaskIds: string[]) =>
    statusFilter.size === 0 || linkedTaskIds.some((id) => taskIds.has(id));
  const notes = snapshot.notes.filter(
    (note) =>
      noteInScope(note, query.scope) &&
      matchesOwnerFilter(note.ownerIds) &&
      matchesLabelFilter(note.labelIds) &&
      matchesLinkedTaskStatus(note.linkedTaskIds),
  );
  // Milestones and Timeline dependencies carry no tag, so a Label filter
  // cannot include or exclude them. They stay in scope and the caller
  // discloses the partial overlap rather than dropping them silently.
  const milestones = snapshot.milestones.filter(
    (milestone) =>
      milestoneInScope(milestone, query.scope) &&
      matchesOwnerFilter(milestone.ownerIds) &&
      matchesLinkedTaskStatus(milestone.linkedTaskIds),
  );
  const timelineDependencies = (snapshot.timelineDependencies ?? []).filter(
    (dependency) =>
      timelineDependencyInScope(dependency, query.scope) &&
      matchesOwnerFilter(dependency.ownerIds) &&
      (statusFilter.size === 0 || statusFilter.has(dependency.state)),
  );
  // Only records that actually carry a Label contribute to the Label set.
  // The old union added Timeline `project_slug` values here as if they were
  // tag slugs, which silently widened the surviving Label rows.
  const filteredLabelIds = new Set<string>([
    ...tasks.flatMap((task) => task.labelIds),
    ...notes.flatMap((note) => note.labelIds),
  ]);
  const hasRecordFilter =
    ownerFilter.size > 0 || statusFilter.size > 0 || labelFilter.size > 0;
  const labels = snapshot.labels.filter(
    (label) =>
      labelInScope(label, query.scope) &&
      (!hasRecordFilter || filteredLabelIds.has(label.id)),
  );

  const entityKeys = new Set([
    ...tasks.map((record) => `task:${record.id}`),
    ...notes.map((record) => `note:${record.id}`),
    ...milestones.map((record) => `milestone:${record.id}`),
    ...labels.map((record) => `label:${record.id}`),
  ]);

  return {
    ...snapshot,
    scope: query.scope,
    labels,
    tasks,
    notes,
    milestones,
    timelineDependencies,
    // An event survives exactly when its entity did. Filtering events on their
    // own `labelIds` as well would drop every milestone event under any Label
    // filter, because a milestone carries no tag — an exclusion the reader
    // would have no way to see.
    events: snapshot.events.filter(
      (event) =>
        event.workspaceId === query.scope.workspaceId &&
        entityKeys.has(`${event.entityType}:${event.entityId}`),
    ),
  };
}
