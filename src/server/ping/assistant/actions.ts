import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { AssistantAction, AssistantActionResult, AssistantProjectRef, AssistantResultItem, AssistantTaskFields, AssistantTaskSelector } from "@/lib/ping/assistant/contract";
import type { AssistantReversal } from "@/lib/ping/assistant/release2";
import type {BoundAssistantTaskTarget} from './plan-targets';
import { isAssistantInternalHref, resolveAssistantDate } from "@/lib/ping/assistant/contract";
import { activities, pendingInvites, tasks, workspaceEvents } from "@/server/db/schema";
import { prepareCanonicalTaskCreate } from "@/server/tasks/create-task-core";
import { insertOwnedProjectInTransaction, nextOwnedProjectPositionInTransaction } from "@/server/projects/create-project-core";
import { readWorkspaceColumnConfig } from "@/server/db/board-config-read";
import { isDoneColumnKey } from "@/lib/board-columns";
import { privateTaskDbWrite } from "@/server/actions/private-task-db-write";
import { createTaskDiscussionService } from "@/server/conversations/task-discussion";
import { createConversationService } from "@/server/conversations/service";
import { parseProjectId } from "@/lib/projects/project-ref";
import { assistantConversationAdapter } from "./conversation-transaction";
import { insertAssistantTaskBatch } from "./task-batch";
import { updateAssistantTaskBatch } from "./task-update-batch";
import { assistantLocalDayTime, instantFromAssistantDayTime } from "./calendar-time";
import { prepareAssistantInvitations, prepareAssistantNudges, revalidateAssistantDelivery,
  type AssistantDeliveryIntent, type AssistantDeliveryPort, type AssistantDispatcher } from "./delivery";
import type { ActivityPayload } from "@/lib/data";
import { AssistantActionRefusal, assertAssistantActor, assistantTaskCatalog, assistantTasksByIds,
  authorizeAssistantProject, resolveAssistantMember, resolveAssistantProjectName, type AssistantActionTransaction } from "./context";

export type AssistantActionInput = Readonly<{
  actorId: string; runId: string; step: AssistantAction; stepId: string; fence: number;
  commitStep: (stepId: string, fence: number, callback: (tx: AssistantActionTransaction) => Promise<AssistantActionResult>) => Promise<AssistantActionResult>;
  /** Only completed results returned by the store for this actor and run, keyed by plan action ID. */
  results: Readonly<Record<string, AssistantActionResult>>;
  currentProjectId?: string | null; selectedTaskIds?: readonly string[]; referenceDate: string; timeZone?:string; directMessagesEnabled?:boolean;
  /** Server-bound canonical targets keyed by contract action ID. Missing existing targets fail closed in production. */
  boundTaskTargets?:Readonly<Record<string,BoundAssistantTaskTarget>>;
  now?: () => number;
  delivery?: AssistantDeliveryPort;
  dispatch?: AssistantDispatcher;
  /** Short fresh transaction, also used to record accepted invitation evidence. */
  deliveryTransaction?: <T>(operation: (tx: AssistantActionTransaction) => Promise<T>) => Promise<T>;
  prepareTimeline?: (input: { actorId: string; runId: string; stepId: string; projectId: string;
    kind: "preview_timeline" | "read_timeline" }) => Promise<{ href: string; items?: readonly AssistantResultItem[]; summary?: string }>;
  settleTimelineResult?: (actorId: string, runId: string, stepId: string, result: AssistantActionResult) => Promise<unknown>;
}>;
const stableId = (prefix: string, parts: readonly unknown[]) => `${prefix}-${createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32)}`;
const ordinary = (row: typeof tasks.$inferSelect) => row.parentTaskId === null && row.recurrence === null;
const taskEffectKinds = new Set(["create_tasks", "create_checklist_items", "set_checklist_item", "update_tasks", "archive_tasks", "add_comment", "nudge_tasks"]);
function remainingEffects(input: AssistantActionInput) {
  return 500 - Object.entries(input.results).filter(([key, result]) => key !== "__previous" && result.status === "completed" && taskEffectKinds.has(result.kind))
    .reduce((sum, [, result]) => sum + result.affectedCount, 0);
}
function admitEffects(input: AssistantActionInput, count: number) {
  if (!Number.isSafeInteger(count) || count < 0 || count > remainingEffects(input)) throw new AssistantActionRefusal("unsupported");
}

async function projectFor(tx: AssistantActionTransaction, input: AssistantActionInput, ref: AssistantProjectRef, writing: boolean) {
  const capability = writing ? "createOrEditTasks" : "open";
  if (ref.kind === "name") return resolveAssistantProjectName(tx, input.actorId, ref.name, capability);
  const id = ref.kind === "current" ? input.currentProjectId : input.results[ref.stepId]?.createdProjectId;
  if (!id || (ref.kind === "created" && input.results[ref.stepId]?.status !== "completed")) throw new AssistantActionRefusal("unavailable");
  return authorizeAssistantProject(tx, input.actorId, id, capability);
}

async function targetsFor(tx: AssistantActionTransaction, input: AssistantActionInput, projectId: string,
  selector: AssistantTaskSelector, includeArchived = false, ordinaryOnly = true) {
  const binding=input.boundTaskTargets?.[input.step.id];
  let ids: readonly string[];
  if(binding){
    if(binding.projectId!==projectId)throw new AssistantActionRefusal('unavailable');
    ids=binding.taskIds;
  }else if(input.boundTaskTargets!==undefined&&selector.kind!=='created')throw new AssistantActionRefusal('stale');
  else if (selector.kind === "selected") ids = input.selectedTaskIds ?? [];
  else if (selector.kind === "created" || selector.kind === "previous") {
    const result = selector.kind === "created" ? input.results[selector.stepId] : input.results.__previous;
    if (!result || result.status !== "completed" || result.projectId !== projectId) throw new AssistantActionRefusal("unavailable");
    ids = (result.createdTaskIds ?? []).slice(0, selector.limit ?? 500);
  } else {
    const catalog = await assistantTaskCatalog(tx, input.actorId, projectId, includeArchived);
    if (catalog.length > 1000) throw new AssistantActionRefusal("unsupported");
    if (selector.kind === "titles") {
      ids = selector.titles.map(title => {
        const matches = catalog.filter(task => task.title.normalize("NFKC") === title.normalize("NFKC"));
        if (matches.length !== 1) throw new AssistantActionRefusal(matches.length > 1 ? "ambiguous" : "unavailable");
        return matches[0].id;
      });
    } else {
      const matching = catalog.filter(row => !selector.status || (row.boardColumnKey ?? row.lane) === selector.status);
      if (selector.limit === undefined && matching.length > 500) throw new AssistantActionRefusal("unsupported");
      ids = matching.slice(0, selector.limit ?? 500).map(row => row.id);
    }
  }
  const rows = await assistantTasksByIds(tx, input.actorId, projectId, ids);
  if (rows.some(row => (ordinaryOnly && !ordinary(row)) || (!includeArchived && row.archivedAt !== null))) throw new AssistantActionRefusal("unsupported");
  return rows;
}

async function fieldsFor(tx: AssistantActionTransaction, input: AssistantActionInput, projectId: string, fields: AssistantTaskFields,
  members = new Map<string, Promise<string>>()) {
  const assignees = fields.assignees === undefined ? undefined : [...new Set(await Promise.all(fields.assignees.map(ref =>
    { const key = JSON.stringify(ref); if (!members.has(key)) members.set(key, resolveAssistantMember(tx, input.actorId, projectId, ref)); return members.get(key)!; })))];
  const due = fields.dueDate === undefined ? undefined : resolveAssistantDate(fields.dueDate, input.referenceDate);
  if (fields.dueTime !== undefined && fields.dueTime !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(fields.dueTime)) {
    throw new AssistantActionRefusal("unsupported");
  }
  return { assignees, due, dueTime: fields.dueTime, dueAt: due === undefined ? undefined : due === null ? null : new Date(`${due}T${fields.dueTime ?? "09:00"}:00Z`) };
}

/** All mutable task state is retained server-side so Undo can refuse after any intervening edit. */
function taskSnapshot(row: typeof tasks.$inferSelect): Record<string, unknown> {
  return { id: row.id, workspaceId: row.workspaceId, seq: row.seq, title: row.title, description: row.description,
    lane: row.lane, priority: row.priority, assignees: row.assignees, due: row.due, dueAt: row.dueAt?.toISOString() ?? null,
    estimate: row.estimate, tags: row.tags, idleDays: row.idleDays, blockedBy: row.blockedBy, recurrence: row.recurrence,
    startDay: row.startDay, durationDays: row.durationDays, position: row.position, parentTaskId: row.parentTaskId,
    externalContactName: row.externalContactName, externalContactEmail: row.externalContactEmail, cents: row.cents,
    sourceNoteId: row.sourceNoteId, sourceNoteExtractBody: row.sourceNoteExtractBody, sourceNoteExtractSha256: row.sourceNoteExtractSha256,
    boardColumnKey: row.boardColumnKey, completedAt: row.completedAt?.toISOString() ?? null, isMilestone: row.isMilestone,
    archivedAt: row.archivedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
async function taskReversal(tx: AssistantActionTransaction, projectId: string, ids: readonly string[], before: readonly (typeof tasks.$inferSelect | null)[]): Promise<AssistantReversal> {
  const after = ids.length ? await tx.select().from(tasks).where(and(eq(tasks.workspaceId, projectId), inArray(tasks.id, ids))) : [];
  if (after.length !== ids.length) throw new AssistantActionRefusal("stale");
  const byId = new Map(after.map(row => [row.id, row]));
  return { kind: "tasks", projectId, rows: ids.map((id, index) => {
    const row = byId.get(id); if (!row) throw new AssistantActionRefusal("stale");
    return { id, before: before[index] ? taskSnapshot(before[index]!) : null, after: taskSnapshot(row) };
  }) };
}

function activityRow(input: AssistantActionInput, projectId: string, taskId: string,
  payload: ActivityPayload, now: Date, suffix: string): typeof activities.$inferInsert {
  return { id: stableId("assistant-a", [input.actorId, input.runId, input.stepId, taskId, suffix]),
    workspaceId: projectId, taskId, userId: input.actorId, kind: payload.kind, payload, createdAt: now };
}
function scheduleAt(input:AssistantActionInput,day:string,time:string):Date{
  try{return instantFromAssistantDayTime(day,time,input.timeZone??"UTC");}
  catch{throw new AssistantActionRefusal("ambiguous");}
}
const dateOnlyAtNineUtc=(day:string)=>new Date(`${day}T09:00:00.000Z`);
function taskDay(row:typeof tasks.$inferSelect,input:AssistantActionInput):string|null{
  const stored=row.due?.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(?:[01]\d|2[0-3]):[0-5]\d)?$/)?.[1];
  return stored??(row.dueAt?assistantLocalDayTime(row.dueAt,input.timeZone??"UTC").day:null);
}

/** Effects and the completed step result share the store's fenced immediate transaction. */
export async function executeAssistantAction(input: AssistantActionInput): Promise<AssistantActionResult> {
  let outbound: AssistantDeliveryIntent[] = [];
  const result = await input.commitStep(input.stepId, input.fence, async tx => {
    const step = input.step;
    const now = new Date(input.now?.() ?? Date.now());
    const base = { stepId: input.stepId, kind: step.kind, status: "completed" as const };
    await assertAssistantActor(tx, input.actorId);
    if (step.kind === "create_project") {
      const name = step.name.trim();
      if (!name || name.length > 80) throw new AssistantActionRefusal("unsupported");
      const id = stableId("ws", [input.actorId, input.runId, input.stepId]);
      await insertOwnedProjectInTransaction(tx, { id, slug: id, name, ownerUserId: input.actorId,
        planningPeriodId: null, contextType: "project", position: await nextOwnedProjectPositionInTransaction(tx,
          { actorUserId: input.actorId, planningPeriodId: null }), activeDomain: "marketing", primaryUseCase: "other", now,
        description: step.description });
      return { ...base, summary: `Created ${name}.`, affectedCount: 1, projectId: id, createdProjectId: id, createdProjectName: name,
        href: `/app/tasks?workspaceId=${encodeURIComponent(id)}` };
    }
    const writing = ["create_tasks", "update_tasks", "archive_tasks", "add_comment", "nudge_tasks", "invite_members", "send_message"].includes(step.kind);
    const project = await projectFor(tx, input, step.project, writing);
    const projectId = project.id;
    if (step.kind === "create_tasks") {
      const drafts = step.tasks ?? Array.from({ length: step.template.count }, (_, index) => {
        const { titlePrefix, distribution, milestoneCount, ...fields } = step.template;
        const assignees = distribution === "round_robin" && fields.assignees?.length
          ? [fields.assignees[index % fields.assignees.length]] : fields.assignees;
        return { ...fields, assignees, title: `${titlePrefix} ${index + 1}`,
          milestone: milestoneCount === undefined ? fields.milestone : index < milestoneCount };
      });
      if (!drafts.length || drafts.length > 100) throw new AssistantActionRefusal("unsupported");
      admitEffects(input, drafts.length);
      // Resolve every member/date before any mutation. Failure rolls the complete batch back.
      const members = new Map<string, Promise<string>>();
      const resolved = await Promise.all(drafts.map(draft => fieldsFor(tx, input, projectId, draft, members)));
      if (resolved.some((fields, index) => fields.dueTime && fields.due === undefined && !drafts[index].dueDate)) throw new AssistantActionRefusal("unsupported");
      const config = await readWorkspaceColumnConfig(projectId, tx);
      const values: ReturnType<typeof prepareCanonicalTaskCreate>[] = [];
      for (let index = 0; index < drafts.length; index++) {
        const draft = drafts[index], fields = resolved[index];
        const id = stableId("assistant-t", [input.actorId, input.runId, input.stepId, index]);
        const dueAt=fields.due===undefined||fields.due===null?fields.dueAt:
          fields.dueTime? scheduleAt(input,fields.due,fields.dueTime):dateOnlyAtNineUtc(fields.due);
        const dueLabel=fields.due===undefined||fields.due===null?fields.due:
          fields.dueTime?`${fields.due} ${fields.dueTime}`:fields.due;
        const value = prepareCanonicalTaskCreate({ id, workspaceId: projectId, title: draft.title, description: draft.description,
          lane: draft.status ?? "todo", assignees: fields.assignees, due: dueLabel, dueAt,
          isMilestone: draft.milestone, createdAt: now, completedAt: isDoneColumnKey(draft.status ?? "todo", config) ? now : null });
        values.push(value);
      }
      const createdTaskIds = await insertAssistantTaskBatch(tx, { actorId: input.actorId, projectId, values,
        activityId: id => stableId("assistant-a", [input.actorId, input.runId, input.stepId, id, "create"]) });
      const reversal = await taskReversal(tx, projectId, createdTaskIds, createdTaskIds.map(() => null));
      return { ...base, projectId, summary: `Created ${createdTaskIds.length} tasks.`, affectedCount: createdTaskIds.length, createdTaskIds, reversal };
    }
    if (step.kind === "create_checklist_items") {
      const parents = await targetsFor(tx, input, projectId, step.parent);
      if (parents.length !== 1 || !step.items.length || step.items.length > 100) throw new AssistantActionRefusal(parents.length > 1 ? "ambiguous" : "unsupported");
      admitEffects(input, step.items.length);
      const parent = parents[0];
      const values = step.items.map((title, index) => prepareCanonicalTaskCreate({
        id: stableId("assistant-subtask", [input.actorId, input.runId, input.stepId, index]), workspaceId: projectId,
        title: title.trim(), parentTaskId: parent.id, lane: "todo", createdAt: now,
      }));
      const createdTaskIds = await insertAssistantTaskBatch(tx, { actorId: input.actorId, projectId, values,
        activityId: id => stableId("assistant-a", [input.actorId, input.runId, input.stepId, id, "checklist-create"]) });
      const reversal = await taskReversal(tx, projectId, createdTaskIds, createdTaskIds.map(() => null));
      return { ...base, projectId, taskIds: createdTaskIds, createdTaskIds, summary: `Added ${createdTaskIds.length} checklist items.`, affectedCount: createdTaskIds.length, reversal };
    }
    if (step.kind === "set_checklist_item") {
      const parents = await targetsFor(tx, input, projectId, step.parent);
      if (parents.length !== 1) throw new AssistantActionRefusal(parents.length > 1 ? "ambiguous" : "unavailable");
      const parent = parents[0];
      const binding=input.boundTaskTargets?.[step.id];
      if(input.boundTaskTargets!==undefined&&binding&&!binding.checklistItemId)throw new AssistantActionRefusal('stale');
      const children = binding?.checklistItemId
        ? await assistantTasksByIds(tx,input.actorId,projectId,[binding.checklistItemId])
        : await tx.select().from(tasks).where(and(eq(tasks.workspaceId, projectId), eq(tasks.parentTaskId, parent.id)));
      const normalized = step.itemTitle.normalize("NFKC").trim().toLocaleLowerCase("en-US");
      const matches = children.filter(row => row.parentTaskId===parent.id&&row.archivedAt === null && row.title.normalize("NFKC").trim().toLocaleLowerCase("en-US") === normalized);
      if (matches.length !== 1) throw new AssistantActionRefusal(matches.length > 1 ? "ambiguous" : "unavailable");
      const item = matches[0];
      const before = [item];
      const config = await readWorkspaceColumnConfig(projectId, tx);
      const wasDone = isDoneColumnKey(item.boardColumnKey ?? item.lane, config);
      const patch = step.completed ? (wasDone ? {} : { lane: "done" as const, boardColumnKey: null, idleDays: null, completedAt: now, updatedAt: now })
        : (wasDone ? { lane: "todo" as const, boardColumnKey: null, idleDays: null, completedAt: null, updatedAt: now } : {});
      if (Object.keys(patch).length) await updateAssistantTaskBatch(tx, { projectId, patches: [{ id: item.id, patch }],
        activityRows: [activityRow(input,projectId,item.id,{kind:"toggleComplete",to:step.completed?"done":"open"},now,"checklist-toggle")] });
      const reversal = await taskReversal(tx, projectId, [item.id], before);
      return { ...base, projectId, taskIds: [item.id], summary: `${step.completed ? "Completed" : "Reopened"} checklist item: ${item.title}.`, affectedCount: 1, reversal };
    }
    if (step.kind === "archive_tasks") {
      const roots = await targetsFor(tx, input, projectId, step.targets, !step.archived, false);
      // Archive includes children. Restore uses the exact changed IDs so Undo never restores a child archived before this action.
      const children = step.archived ? await tx.select().from(tasks).where(and(eq(tasks.workspaceId, projectId), inArray(tasks.parentTaskId, roots.map(row => row.id)))) : [];
      const rows = [...new Map([...roots, ...children].map(row => [row.id, row])).values()];
      if (rows.length > 500) throw new AssistantActionRefusal("unsupported");
      const changed = rows.filter(row => step.archived ? row.archivedAt === null : row.archivedAt !== null);
      admitEffects(input, changed.length);
      if (changed.length) {
        const updated = await privateTaskDbWrite(() => tx.update(tasks).set({ archivedAt: step.archived ? now : null, updatedAt: now })
          .where(and(inArray(tasks.id, changed.map(row => row.id)), eq(tasks.workspaceId, projectId))).returning({ id: tasks.id }));
        if (updated.length !== changed.length) throw new AssistantActionRefusal("stale");
        for (let offset = 0; offset < changed.length; offset += 100) await tx.insert(activities).values(changed.slice(offset, offset + 100).map(row => ({
          id: stableId("assistant-a", [input.actorId, input.runId, input.stepId, row.id, "archive"]), workspaceId: projectId,
          taskId: row.id, userId: input.actorId, kind: step.archived ? "archived" as const : "restored" as const,
          payload: { kind: step.archived ? "archived" as const : "restored" as const }, createdAt: now,
        })));
      }
      const taskIds = changed.map(row => row.id);
      const reversal = await taskReversal(tx, projectId, taskIds, changed);
      return { ...base, projectId, taskIds, summary: `${step.archived ? "Archived" : "Restored"} ${taskIds.length} tasks.`,
        affectedCount: taskIds.length, undo: { projectId, taskIds, archived: !step.archived }, reversal };
    }
    if (step.kind === "update_tasks") {
      const rows = await targetsFor(tx, input, projectId, step.targets);
      admitEffects(input, rows.length);
      const resolved = await fieldsFor(tx, input, projectId, step.changes);
      const config = await readWorkspaceColumnConfig(projectId, tx);
      const patches: {id:string;patch:Partial<typeof tasks.$inferInsert>}[]=[];
      const activityRows: (typeof activities.$inferInsert)[]=[];
      for (const row of rows) {
        const changes = step.changes;
        const patch: Partial<typeof tasks.$inferInsert> = { updatedAt: now };
        if (changes.title !== undefined) patch.title = changes.title;
        if (changes.description !== undefined) patch.description = changes.description;
        if (resolved.assignees !== undefined) patch.assignees = resolved.assignees;
        if (resolved.due !== undefined || resolved.dueTime !== undefined) {
          if (resolved.due === null) { patch.due = null; patch.dueAt = null; }
          else if (resolved.dueTime !== undefined) {
            const day=resolved.due??taskDay(row,input);
            if(!day)throw new AssistantActionRefusal("unavailable");
            patch.due=resolved.dueTime===null?day:`${day} ${resolved.dueTime}`;
            patch.dueAt=resolved.dueTime===null?dateOnlyAtNineUtc(day):scheduleAt(input,day,resolved.dueTime);
          } else if (resolved.due !== undefined) {
            const existingTime=row.due?.match(/^\d{4}-\d{2}-\d{2} ((?:[01]\d|2[0-3]):[0-5]\d)$/)?.[1];
            patch.due=existingTime?`${resolved.due} ${existingTime}`:resolved.due;
            patch.dueAt=existingTime?scheduleAt(input,resolved.due,existingTime):dateOnlyAtNineUtc(resolved.due);
          }
        }
        if (changes.milestone !== undefined) patch.isMilestone = changes.milestone;
        if (changes.status !== undefined) {
          patch.lane = changes.status; patch.boardColumnKey = null; patch.idleDays = 0;
          patch.completedAt = isDoneColumnKey(changes.status, config) ? row.completedAt ?? now : null;
        }
        patches.push({id:row.id,patch});
        if (changes.status !== undefined) activityRows.push(activityRow(input, projectId, row.id,
          { kind: "move", from: row.lane, to: changes.status }, now, "status"));
        for (const field of ["title", "description", "assignees"] as const) {
          if (changes[field] !== undefined) activityRows.push(activityRow(input, projectId, row.id, { kind: "update", field }, now, field));
        }
        if (changes.dueDate !== undefined || changes.dueTime !== undefined) activityRows.push(activityRow(input, projectId, row.id, { kind: "update", field: "due" }, now, "due"));
      }
      await updateAssistantTaskBatch(tx,{projectId,patches,activityRows});
      const reversal = await taskReversal(tx, projectId, rows.map(row => row.id), rows);
      return { ...base, projectId, taskIds: rows.map(row => row.id), summary: `Updated ${rows.length} tasks.`, affectedCount: rows.length, reversal };
    }
    if (step.kind === "list_tasks") {
      const catalog = await assistantTaskCatalog(tx, input.actorId, projectId);
      const rows = catalog.filter(row => !step.status || (row.boardColumnKey ?? row.lane) === step.status).slice(0, step.limit ?? 50);
      return { ...base, projectId, summary: `${rows.length} tasks.`, affectedCount: 0,
        items: rows.map(row => ({ id: row.id, title: row.title })) };
    }
    if (step.kind === "invite_members" || step.kind === "nudge_tasks") {
      if (!input.delivery) return { ...base, projectId, status: "blocked", code: "delivery_unavailable",
        summary: "Communication delivery is not available.", affectedCount: 0 };
      const prepared = step.kind === "invite_members"
        ? await prepareAssistantInvitations(tx, input.actorId, projectId, step.emails, now)
        : await prepareAssistantNudges(tx, input.actorId, projectId, await targetsFor(tx, input, projectId, step.targets), input.stepId, now, remainingEffects(input));
      outbound = prepared.intents;
      await input.delivery.queueDeliveries(tx, input.stepId, outbound.map(intent => intent.key));
      const affectedCount = "notified" in prepared && typeof prepared.notified === "number" ? prepared.notified : outbound.length;
      return { ...base, projectId, affectedCount,
        summary: step.kind === "invite_members" ? `Saved ${outbound.length} invitations; email delivery is queued.`
          : `Saved ${affectedCount} in-app nudges.`,
        delivery: { queued: outbound.length, accepted: 0, unknown: 0, suppressed: prepared.suppressed } };
    }
    if (step.kind === "add_comment") {
      const rows = await targetsFor(tx, input, projectId, step.targets);
      admitEffects(input, rows.length);
      const service = createTaskDiscussionService(assistantConversationAdapter(tx));
      const items: Extract<AssistantReversal,{kind:"messages"}>["items"][number][] = [];
      for (const row of rows) {
        const clientRequestId = stableId("assistant-comment", [input.actorId, input.runId, input.stepId, row.id]);
        // Consult the original canonical receipt before considering a send.
        const original = await service.getReceipt({ actorId: input.actorId, taskId: row.id, clientRequestId });
        if (original.ok && original.value.state === "committed") {
          const opened = await service.openTaskDiscussion({ actorId: input.actorId, taskId: row.id, limit: 1 });
          if (!opened.ok) throw new AssistantActionRefusal("unavailable");
          items.push({ kind:"task_discussion",scopeId:row.id,itemId:original.value.receipt.commentId,revision:original.value.receipt.revision,audienceEpoch:opened.value.audienceEpoch });
          continue;
        }
        // A discussion may not exist yet. Canonical open holds its own audience/fence proof.
        const opened = await service.openTaskDiscussion({ actorId: input.actorId, taskId: row.id, limit: 1 });
        if (!opened.ok) throw new AssistantActionRefusal("unavailable");
        const result = await service.sendComment({ actorId: input.actorId, input: { taskId: row.id, clientRequestId,
          expectedAudienceEpoch: opened.value.audienceEpoch, body: step.body, rootCommentId: null, mentionUserIds: [] } });
        if (!result.ok) throw new AssistantActionRefusal("unavailable");
        items.push({ kind:"task_discussion",scopeId:row.id,itemId:result.value.commentId,revision:result.value.revision,audienceEpoch:opened.value.audienceEpoch });
      }
      return { ...base, projectId, taskIds: rows.map(row => row.id), summary: `Added comments to ${rows.length} tasks.`, affectedCount: rows.length,
        reversal: { kind:"messages",projectId,items } };
    }
    if (step.kind === "send_message" || step.kind === "read_chat") {
      const service = createConversationService(assistantConversationAdapter(tx), { directMessagesEnabled: input.directMessagesEnabled??false });
      const id = parseProjectId(projectId)!;
      let conversationId:string, audienceEpoch:number, recipientId:string|null=null;
      if(step.kind==="send_message"&&step.recipient){
        if(!input.directMessagesEnabled||step.mentions?.length)throw new AssistantActionRefusal("unavailable");
        recipientId=await resolveAssistantMember(tx,input.actorId,projectId,step.recipient);
        const directory=await service.listDirectMessages({actorId:input.actorId,projectId:id});
        if(!directory.ok)throw new AssistantActionRefusal("unavailable");
        const existing=directory.value.find(scope=>scope.canWrite&&scope.other.id===recipientId);
        if(!existing)throw new AssistantActionRefusal("unavailable");
        // Re-read the exact consented scope immediately before sending. Never request or create a new pair here.
        const authorized=await service.getDirectMessage({actorId:input.actorId,projectId:id,conversationId:existing.conversationId});
        if(!authorized.ok||!authorized.value.canWrite||authorized.value.other.id!==recipientId)throw new AssistantActionRefusal("unavailable");
        conversationId=authorized.value.conversationId;audienceEpoch=authorized.value.audienceEpoch;
      }else{
        const conversation = step.kind === "send_message"
          ? await service.ensureProjectConversation({ actorId: input.actorId, projectId: id })
          : await service.getProjectConversation({ actorId: input.actorId, projectId: id });
        if (!conversation.ok) throw new AssistantActionRefusal("unavailable");
        if (!conversation.value) return { ...base, projectId, affectedCount: 0, summary: "No Project chat messages yet.", items: [] };
        conversationId=conversation.value.conversationId;audienceEpoch=conversation.value.audienceEpoch;
      }
      if (step.kind === "read_chat") {
        const page = await service.getMessagePage({ actorId: input.actorId, projectId: id, conversationId, limit: step.limit ?? 20 });
        if (!page.ok) throw new AssistantActionRefusal("unavailable");
        return { ...base, projectId, affectedCount: 0, summary: `${page.value.messages.length} chat messages.`,
          items: page.value.messages.map(message => ({ id: message.id, title: message.body ?? "Deleted message" })) };
      }
      const clientRequestId = stableId("assistant-message", [input.actorId, input.runId, input.stepId]);
      const prior = await service.getReceipt({ actorId: input.actorId, projectId: id, conversationId, clientRequestId });
      if (!prior.ok) throw new AssistantActionRefusal("unavailable");
      let itemId:string, revision:number;
      if (prior.value.state !== "committed") {
        const mentionUserIds = await Promise.all((step.mentions ?? []).map(ref => resolveAssistantMember(tx, input.actorId, projectId, ref)));
        const result = await service.sendMessage({ actorId: input.actorId, input: { projectId: id, conversationId,
          clientRequestId, expectedAudienceEpoch: audienceEpoch, body: step.body, rootId: null, mentionUserIds } });
        if (!result.ok) throw new AssistantActionRefusal("unavailable");
        itemId=result.value.messageId;revision=result.value.revision;
      } else {
        itemId=prior.value.receipt.messageId;revision=prior.value.receipt.revision;
      }
      return { ...base, projectId, affectedCount: 1, summary: recipientId?"Sent a private message.":"Saved the message to Project chat.",
        href: `/app/messages?projectId=${encodeURIComponent(projectId)}${recipientId?`&conversationId=${encodeURIComponent(conversationId)}`:''}`,
        reversal:{kind:"messages",projectId,items:[{kind:"conversation",scopeId:conversationId,itemId,revision,audienceEpoch}]} };
    }
    if (step.kind === "preview_timeline" || step.kind === "read_timeline") {
      return { ...base, projectId, summary: "Current Timeline preparation is pending.", code: "timeline_pending", affectedCount: 0 };
    }
    if (step.kind === "open_project" || step.kind === "open_chat") {
      const query = `workspaceId=${encodeURIComponent(projectId)}`;
      const href = step.kind === "open_chat" ? `/app/messages?projectId=${encodeURIComponent(projectId)}` : `/app/tasks?${query}`;
      return { ...base, projectId, href, summary: `Open ${project.name}.`, affectedCount: 0 };
    }
    // No success claim until the original communication service and its receipt are wired.
    return { ...base, projectId, status: "blocked", code: "communication_unavailable", summary: "This communication action is not available yet.", affectedCount: 0 };
  });
  if (result.code === "timeline_pending" && result.projectId &&
    (input.step.kind === "preview_timeline" || input.step.kind === "read_timeline")) {
    if (!input.prepareTimeline || !input.settleTimelineResult) return { ...result, status: "blocked", code: "timeline_unavailable",
      summary: "Current Timeline preparation is unavailable. Your saved tasks are unchanged." };
    try {
      const prepared = await input.prepareTimeline({ actorId: input.actorId, runId: input.runId, stepId: input.stepId,
        projectId: result.projectId, kind: input.step.kind });
      if (!isAssistantInternalHref(prepared.href)) throw new AssistantActionRefusal("unsupported");
      const target = new URL(prepared.href, "https://app.signalstudio.ie");
      if (target.searchParams.get("workspaceId") !== result.projectId ||
        !(input.step.kind === "preview_timeline" ? /^\/app\/timeline\/[^/]+\/current-preview$/ : /^\/app\/timeline\/[^/]+(?:\/current-preview)?\/?$/).test(target.pathname)) {
        throw new AssistantActionRefusal("unsupported");
      }
      const settled: AssistantActionResult = { ...result, code: "timeline_ready", href: prepared.href, items: prepared.items,
        summary: prepared.summary ?? "The current unpublished Timeline is ready." };
      await input.settleTimelineResult(input.actorId, input.runId, input.stepId, settled);
      return settled;
    } catch { return { ...result, status: "blocked", code: "timeline_unavailable",
      summary: "Current Timeline preparation could not finish. Your saved tasks are unchanged." }; }
  }
  // Dispatch is deliberately outside commitStep. A receipt replay never re-creates outbound work.
  if (input.delivery && input.dispatch && input.deliveryTransaction) {
    for (const intent of outbound) {
      const claim = await input.delivery.claimDelivery({ actorId: input.actorId, runId: input.runId, stepId: input.stepId, key: intent.key, leaseMs: 10_000 });
      if (!claim) continue;
      let outcome: "accepted" | "unknown" | "suppressed" = "unknown";
      let dispatchedStarted = false;
      let providerId: string | undefined;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const permitted = await input.deliveryTransaction(tx => revalidateAssistantDelivery(tx, input.actorId, intent, new Date(input.now?.() ?? Date.now())));
        if (!permitted) outcome = "suppressed";
        else {
          dispatchedStarted = true;
          const dispatched = await Promise.race([input.dispatch(intent, { idempotencyKey: claim.idempotencyKey, signal: controller.signal }),
            new Promise<{ outcome: "unknown" }>(resolve => { timer = setTimeout(() => { controller.abort(); resolve({ outcome: "unknown" }); }, 5000); })]);
          outcome = ["accepted", "unknown", "suppressed"].includes(dispatched.outcome) ? dispatched.outcome : "unknown";
          providerId = "providerId" in dispatched ? dispatched.providerId : undefined;
          if (outcome === "accepted" && intent.kind === "invite") await input.deliveryTransaction(async tx => {
            const at = new Date(input.now?.() ?? Date.now());
            if (!await revalidateAssistantDelivery(tx, input.actorId, intent, at)) throw new AssistantActionRefusal("unavailable");
            await tx.update(pendingInvites).set({ lastSentAt: at.getTime() }).where(eq(pendingInvites.token, intent.inviteToken!));
            await tx.insert(workspaceEvents).values({ id: stableId("assistant-invite", [input.stepId, intent.key]), workspaceId: intent.projectId,
              userId: input.actorId, kind: "inviteSent", payload: JSON.stringify({ role: "member" }), createdAt: Math.floor(at.getTime() / 1000) });
          });
        }
      } catch { outcome = dispatchedStarted ? "unknown" : "suppressed"; }
      finally { if (timer) clearTimeout(timer); controller.abort(); }
      await input.delivery.settleDelivery({ actorId: input.actorId, runId: input.runId, stepId: input.stepId, key: intent.key,
        fence: claim.fence, outcome, providerId });
    }
  }
  if (input.delivery && result.delivery) {
    const delivery = await input.delivery.deliverySummary(input.actorId, input.runId, input.stepId);
    return { ...result, delivery: { ...delivery, suppressed: delivery.suppressed + result.delivery.suppressed } };
  }
  return result;
}
