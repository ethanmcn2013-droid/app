import type {
  AnalyticsQuery,
  AnalyticsScope,
  AnalyticsSnapshot,
  MilestoneRecord,
  NoteRecord,
  ProjectRecord,
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
  if (scope.type === "project" && !task.projectIds.includes(scope.id)) return false;
  return hasOwner(task.ownerIds, scope);
}

export function noteInScope(note: NoteRecord, scope: AnalyticsScope): boolean {
  if (note.workspaceId !== scope.workspaceId) return false;
  if (scope.type === "project" && !note.projectIds.includes(scope.id)) return false;
  return hasOwner(note.ownerIds, scope);
}

export function milestoneInScope(
  milestone: MilestoneRecord,
  scope: AnalyticsScope,
): boolean {
  if (milestone.workspaceId !== scope.workspaceId) return false;
  if (scope.type === "project" && milestone.projectId !== scope.id) return false;
  return hasOwner(milestone.ownerIds, scope);
}

export function projectInScope(project: ProjectRecord, scope: AnalyticsScope): boolean {
  if (project.workspaceId !== scope.workspaceId) return false;
  if (scope.type === "project" && project.id !== scope.id) return false;
  return hasOwner(project.ownerIds, scope);
}

export function timelineDependencyInScope(
  dependency: TimelineDependencyRecord,
  scope: AnalyticsScope,
): boolean {
  if (dependency.workspaceId !== scope.workspaceId) return false;
  if (scope.type === "project" && dependency.projectId !== scope.id) return false;
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
  const matchesOwnerFilter = (ids: string[]) =>
    ownerFilter.size === 0 || ids.some((id) => ownerFilter.has(id));

  const tasks = snapshot.tasks.filter(
    (task) =>
      taskInScope(task, query.scope) &&
      matchesOwnerFilter(task.ownerIds) &&
      (statusFilter.size === 0 || statusFilter.has(task.status)),
  );
  const taskIds = new Set(tasks.map((task) => task.id));
  const matchesLinkedTaskStatus = (linkedTaskIds: string[]) =>
    statusFilter.size === 0 || linkedTaskIds.some((id) => taskIds.has(id));
  const notes = snapshot.notes.filter(
    (note) =>
      noteInScope(note, query.scope) &&
      matchesOwnerFilter(note.ownerIds) &&
      matchesLinkedTaskStatus(note.linkedTaskIds),
  );
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
  const filteredProjectIds = new Set([
    ...tasks.flatMap((task) => task.projectIds),
    ...notes.flatMap((note) => note.projectIds),
    ...milestones.map((milestone) => milestone.projectId),
    ...timelineDependencies.map((dependency) => dependency.projectId),
  ]);
  const hasRecordFilter = ownerFilter.size > 0 || statusFilter.size > 0;
  const projects = snapshot.projects.filter(
    (project) =>
      projectInScope(project, query.scope) &&
      (!hasRecordFilter || filteredProjectIds.has(project.id)),
  );

  const entityKeys = new Set([
    ...tasks.map((record) => `task:${record.id}`),
    ...notes.map((record) => `note:${record.id}`),
    ...milestones.map((record) => `milestone:${record.id}`),
    ...projects.map((record) => `project:${record.id}`),
  ]);

  return {
    ...snapshot,
    scope: query.scope,
    projects,
    tasks,
    notes,
    milestones,
    timelineDependencies,
    events: snapshot.events.filter(
      (event) =>
        event.workspaceId === query.scope.workspaceId &&
        entityKeys.has(`${event.entityType}:${event.entityId}`) &&
        (query.scope.type !== "project" || event.projectIds.includes(query.scope.id)),
    ),
  };
}
