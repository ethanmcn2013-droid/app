import "server-only";
import type { AssistantPlannerContext, AssistantRequest } from "@/lib/ping/assistant/contract";
import type { AssistantSource } from "@/lib/ping/assistant/release2";
import { floorViewHref } from "@/lib/projects/floor-view-href";
import { workspaces, tasks } from "@/server/db/schema";
import { createMessageAttentionService } from "@/server/conversations/attention";
import { assistantLocalDayTime } from "./calendar-time";
import { assistantConversationAdapter } from "./conversation-transaction";
import { assistantMemberRoster, assistantTaskCatalog, authorizeAssistantProject, getAssistantContext,
  AssistantActionRefusal, type AssistantActionTransaction } from "./context";

type AssistantTaskContext = NonNullable<AssistantPlannerContext["tasks"]>[number];

const MAX_PROJECTS = 3;
const MAX_TASKS = 100;
const MAX_TASK_BODY = 1_000;
// Conversation sources can already use 24k characters, so leave the other half to task context.
const MAX_TASK_CHARACTERS = 24_000;

function projectNameKey(value: string): string { return value.normalize("NFKC").trim().toLocaleLowerCase("en"); }
function dueTime(row: typeof tasks.$inferSelect, timeZone: string): string | null {
  // Date-only values keep the anchor-due 09:00Z sentinel and never become a displayed clock time.
  if (!row.dueAt || !row.due || !/^\d{4}-\d{2}-\d{2}\s+(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.due)) return null;
  return assistantLocalDayTime(row.dueAt, timeZone).time;
}
function dueDate(row: typeof tasks.$inferSelect, timeZone: string): string | null {
  if (!row.dueAt) return row.due&&/^\d{4}-\d{2}-\d{2}$/.test(row.due)?row.due:null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(row.due ?? "") && row.dueAt.getTime() === Date.parse(`${row.due}T09:00:00.000Z`)) return row.due!;
  return assistantLocalDayTime(row.dueAt, timeZone).day;
}
function taskDetail(row: typeof tasks.$inferSelect, projectName: string, memberNames: ReadonlyMap<string, string>, parentTitle: string | null,
  timeZone: string): AssistantTaskContext {
  return { title: row.title, projectName, ...(row.description?{description:row.description.slice(0,500)}:{}),assignees: row.assignees.map(id => memberNames.get(id)??'Assigned person unavailable'),
    dueDate: dueDate(row, timeZone), dueTime: dueTime(row, timeZone), status: row.boardColumnKey ?? row.lane, parentTitle };
}
function taskBody(detail: AssistantTaskContext): string {
  return [
    `Task: ${detail.title}`,
    `Project: ${detail.projectName}`,
    `Status: ${detail.status}`,
    `Assigned to: ${detail.assignees.length ? detail.assignees.join(", ") : "No one"}`,
    `Due date: ${detail.dueDate ?? "Not set"}${detail.dueTime ? ` at ${detail.dueTime}` : ""}`,
    ...(detail.parentTitle ? [`Checklist under: ${detail.parentTitle}`] : []),
    ...(detail.description?[`Description: ${detail.description}`]:[]),
  ].join("\n").slice(0, MAX_TASK_BODY);
}
function taskHref(projectId: string, taskId: string): string {
  return floorViewHref("board", projectId as Parameters<typeof floorViewHref>[1], taskId);
}
function taskSource(source: Omit<AssistantSource, "ref">, index: number): AssistantSource {
  return { ...source, ref: `task_source_${index + 1}` };
}

async function activeProjectCandidates(tx: AssistantActionTransaction, actorId: string, exactProjectId?: string) {
  const context = await getAssistantContext(tx, actorId, exactProjectId ?? null);
  if (exactProjectId && !context.projects.some(project => project.id === exactProjectId && project.archivedAt === null)) {
    throw new AssistantActionRefusal("unavailable");
  }
  // This bounded membership catalog (201 rows) selects three candidates. Fresh project authorization
  // happens only for those candidates below, avoiding one permission query per account Project.
  return context.projects.filter(project => project.archivedAt === null);
}

function orderedAccountProjects<T extends {id:string;name:string;archivedAt:Date|null}>(projects: readonly T[], requestText: string,
  needsYouProjectIds: readonly string[]): typeof projects[number][] {
  const text = projectNameKey(requestText);
  const mentions = projects.flatMap((project, index) => {
    const name = projectNameKey(project.name);
    if (name.length < 2) return [];
    const offset = text.indexOf(name);
    return offset < 0 ? [] : [{ project, offset, index }];
  }).sort((a,b) => a.offset - b.offset || a.index - b.index).map(item => item.project);
  const byId = new Map(projects.map(project => [project.id, project]));
  const ordered: typeof projects[number][] = [];
  const seen = new Set<string>();
  for (const project of [...mentions, ...needsYouProjectIds.map(id => byId.get(id)).filter((p): p is typeof projects[number] => !!p), ...projects]) {
    if (!seen.has(project.id)) { seen.add(project.id); ordered.push(project); }
    if (ordered.length >= MAX_PROJECTS) break;
  }
  return ordered;
}

export async function loadAssistantTaskContext(tx: AssistantActionTransaction, actorId: string, request: AssistantRequest, timeZone: string): Promise<{
  tasks: NonNullable<AssistantPlannerContext["tasks"]>;
  sources: readonly AssistantSource[];
  members: readonly Readonly<{name:string}>[];
  coverage: string;
}> {
  const projects = await activeProjectCandidates(tx, actorId, request.scope.kind === "project" ? request.scope.projectId : undefined);
  let chosen: typeof projects;
  let needsYouProjectIds: string[] = [];
  if (request.scope.kind === "project") {
    const projectId = request.scope.projectId;
    chosen = projects.filter(project => project.id === projectId).slice(0,1);
  } else {
    const attention = await createMessageAttentionService(assistantConversationAdapter(tx)).listDirected({ actorId, limit: 100 });
    if (attention.ok) needsYouProjectIds = [...new Set(attention.value.map(item => item.projectId))];
    chosen = orderedAccountProjects(projects, request.text, needsYouProjectIds);
  }
  const authorizedChosen: typeof projects[number][] = [];
  for (const project of chosen) {
    try { await authorizeAssistantProject(tx, actorId, project.id, "open"); authorizedChosen.push(project); }
    catch (error) {
      if (request.scope.kind === "project") throw error;
      // Stale, deleting or capability-revoked Project candidates are omitted from account context.
    }
  }
  chosen = authorizedChosen;

  const outputTasks: NonNullable<AssistantPlannerContext["tasks"]>[number][] = [];
  const sources: AssistantSource[] = [];
  const memberNamesAll = new Set<string>();
  let charCount = 0, truncated = false;
  for (const project of chosen) {
    if (outputTasks.length >= MAX_TASKS) { truncated = true; break; }
    const [roster, catalog] = await Promise.all([
      assistantMemberRoster(tx, actorId, project.id),
      assistantTaskCatalog(tx, actorId, project.id),
    ]);
    const members = new Map(roster.flatMap(member => member.name ? [[member.userId, member.name] as const] : []));
    for (const name of members.values()) memberNamesAll.add(name);
    const local = catalog.slice(0, MAX_TASKS - outputTasks.length);
    if (catalog.length > local.length || catalog.length >= 1001) truncated = true;
    const byTask = new Map(catalog.map(row => [row.id, row]));
    for (const row of local) {
      const parent = row.parentTaskId ? byTask.get(row.parentTaskId) : undefined;
      const detail = taskDetail(row, project.name, members, parent?.title ?? (row.parentTaskId?'Unavailable parent':null), timeZone);
      const body = taskBody(detail);
      if (sources.length >= MAX_TASKS || charCount + body.length > MAX_TASK_CHARACTERS) { truncated = true; break; }
      outputTasks.push(detail);
      sources.push(taskSource({ kind: "task", projectId: project.id, scopeId: row.id, itemId: row.id,
        revision: Math.max(0, row.updatedAt.getTime()), audienceEpoch: 1, body, authorName: "Signal task record",
        createdAt: row.createdAt.toISOString(), href: taskHref(project.id, row.id), timeZone }, sources.length));
      charCount += body.length;
    }
  }
  const scopeCoverage = request.scope.kind === "project" ? "the selected Project" : `up to ${chosen.length} matching or Needs-you Projects`;
  const projectSample = request.scope.kind === "account" && projects.length > chosen.length
    ? ` Only ${chosen.length} of ${projects.length} active Project candidates are included.` : "";
  const coverage = `Showing ${outputTasks.length} tasks across ${scopeCoverage}${truncated ? "; more authorized tasks are not shown" : "; the included task lists were fully read"}.${projectSample}`;
  const members = [...memberNamesAll].map(name => ({ name }));
  return { tasks: outputTasks, sources, members, coverage };
}

/** Rechecks task sources against current membership and the exact current task summary before citation. */
export async function validateAssistantTaskSources(tx: AssistantActionTransaction, actorId: string, sources: readonly AssistantSource[], timeZone: string): Promise<boolean> {
  if (!Array.isArray(sources) || sources.length > MAX_TASKS || sources.some(source => source.kind !== "task")) return false;
  const refs = new Set<string>();
  const projectRows = new Map<string, {project: typeof workspaces.$inferSelect; members: Map<string,string>; catalog: typeof tasks.$inferSelect[]} >();
  for (const source of sources) {
    if (!source || typeof source.projectId !== "string" || typeof source.scopeId !== "string" || source.itemId !== source.scopeId ||
        typeof source.ref !== "string" || !/^task_source_[1-9][0-9]{0,2}$/.test(source.ref) || refs.has(source.ref) ||
        !Number.isSafeInteger(source.revision) || source.revision < 0 || source.audienceEpoch !== 1 || typeof source.body !== "string" ||
        source.body.length > MAX_TASK_BODY || source.timeZone !== timeZone || !source.projectId || !source.itemId) return false;
    refs.add(source.ref);
    let pack = projectRows.get(source.projectId);
    if (!pack) {
      let project: typeof workspaces.$inferSelect;
      try { project = await authorizeAssistantProject(tx, actorId, source.projectId, "open"); }
      catch { return false; }
      if (project.archivedAt !== null) return false;
      const [roster, catalog] = await Promise.all([assistantMemberRoster(tx, actorId, source.projectId), assistantTaskCatalog(tx, actorId, source.projectId)]);
      pack = { project, members: new Map(roster.flatMap(member => member.name ? [[member.userId,member.name] as const] : [])), catalog };
      projectRows.set(source.projectId, pack);
    }
    const row = pack.catalog.find(task => task.id === source.itemId && task.workspaceId === source.projectId && task.archivedAt === null);
    if (!row || Math.max(0, row.updatedAt.getTime()) !== source.revision) return false;
    const parent = row.parentTaskId ? pack.catalog.find(task => task.id === row.parentTaskId) : undefined;
    const detail = taskDetail(row, pack.project.name, pack.members, parent?.title ?? (row.parentTaskId?'Unavailable parent':null), timeZone);
    if (taskBody(detail) !== source.body || row.createdAt.toISOString() !== source.createdAt || source.authorName !== "Signal task record") return false;
    if (source.href !== taskHref(source.projectId, source.itemId)) return false;
  }
  return true;
}
