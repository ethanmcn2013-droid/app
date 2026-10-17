import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { AssistantAction, AssistantActionResult, AssistantProjectRef, AssistantResultItem, AssistantTaskFields, AssistantTaskSelector } from "@/lib/ping/assistant/contract";
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
  currentProjectId?: string | null; selectedTaskIds?: readonly string[]; referenceDate: string;
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
const taskEffectKinds = new Set(["create_tasks", "update_tasks", "archive_tasks", "add_comment", "nudge_tasks"]);
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
  let ids: readonly string[];
  if (selector.kind === "selected") ids = input.selectedTaskIds ?? [];
  else if (selector.kind === "created" || selector.kind === "previous") {
    const result = selector.kind === "created" ? input.results[selector.stepId]
      : Object.values(input.results).filter(result => result.status === "completed" && result.createdTaskIds?.length).at(-1);
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
  return { assignees, due, dueAt: due === undefined ? undefined : due === null ? null : new Date(`${due}T09:00:00Z`) };
}

async function activity(tx: AssistantActionTransaction, input: AssistantActionInput, projectId: string, taskId: string,
  payload: ActivityPayload, now: Date, suffix: string) {
  await tx.insert(activities).values({ id: stableId("assistant-a", [input.actorId, input.runId, input.stepId, taskId, suffix]),
    workspaceId: projectId, taskId, userId: input.actorId, kind: payload.kind, payload, createdAt: now });
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
      return { ...base, summary: `Created ${name}.`, affectedCount: 1, projectId: id, createdProjectId: id,
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
      const config = await readWorkspaceColumnConfig(projectId, tx);
      const values: ReturnType<typeof prepareCanonicalTaskCreate>[] = [];
      for (let index = 0; index < drafts.length; index++) {
        const draft = drafts[index], fields = resolved[index];
        const id = stableId("assistant-t", [input.actorId, input.runId, input.stepId, index]);
        const value = prepareCanonicalTaskCreate({ id, workspaceId: projectId, title: draft.title, description: draft.description,
          lane: draft.status ?? "todo", assignees: fields.assignees, due: fields.due, dueAt: fields.dueAt,
          isMilestone: draft.milestone, createdAt: now, completedAt: isDoneColumnKey(draft.status ?? "todo", config) ? now : null });
        values.push(value);
      }
      const createdTaskIds = await insertAssistantTaskBatch(tx, { actorId: input.actorId, projectId, values,
        activityId: id => stableId("assistant-a", [input.actorId, input.runId, input.stepId, id, "create"]) });
      return { ...base, projectId, summary: `Created ${createdTaskIds.length} tasks.`, affectedCount: createdTaskIds.length, createdTaskIds };
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
      return { ...base, projectId, taskIds, summary: `${step.archived ? "Archived" : "Restored"} ${taskIds.length} tasks.`,
        affectedCount: taskIds.length, undo: { projectId, taskIds, archived: !step.archived } };
    }
    if (step.kind === "update_tasks") {
      const rows = await targetsFor(tx, input, projectId, step.targets);
      admitEffects(input, rows.length);
      const resolved = await fieldsFor(tx, input, projectId, step.changes);
      const config = await readWorkspaceColumnConfig(projectId, tx);
      for (const row of rows) {
        const changes = step.changes;
        const patch: Partial<typeof tasks.$inferInsert> = { updatedAt: now };
        if (changes.title !== undefined) patch.title = changes.title;
        if (changes.description !== undefined) patch.description = changes.description;
        if (resolved.assignees !== undefined) patch.assignees = resolved.assignees;
        if (resolved.due !== undefined) { patch.due = resolved.due; patch.dueAt = resolved.dueAt; }
        if (changes.milestone !== undefined) patch.isMilestone = changes.milestone;
        if (changes.status !== undefined) {
          patch.lane = changes.status; patch.boardColumnKey = null; patch.idleDays = 0;
          patch.completedAt = isDoneColumnKey(changes.status, config) ? row.completedAt ?? now : null;
        }
        const changed = await privateTaskDbWrite(() => tx.update(tasks).set(patch).where(and(eq(tasks.id, row.id), eq(tasks.workspaceId, projectId)))
          .returning({ id: tasks.id }));
        if (changed.length !== 1) throw new AssistantActionRefusal("stale");
        if (changes.status !== undefined) await activity(tx, input, projectId, row.id,
          { kind: "move", from: row.lane, to: changes.status }, now, "status");
        for (const field of ["title", "description", "assignees"] as const) {
          if (changes[field] !== undefined) await activity(tx, input, projectId, row.id, { kind: "update", field }, now, field);
        }
        if (changes.dueDate !== undefined) await activity(tx, input, projectId, row.id, { kind: "update", field: "due" }, now, "due");
      }
      return { ...base, projectId, taskIds: rows.map(row => row.id), summary: `Updated ${rows.length} tasks.`, affectedCount: rows.length };
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
      const affectedCount = "notified" in prepared ? prepared.notified : outbound.length;
      return { ...base, projectId, affectedCount,
        summary: step.kind === "invite_members" ? `Saved ${outbound.length} invitations; email delivery is queued.`
          : `Saved ${affectedCount} in-app nudges.`,
        delivery: { queued: outbound.length, accepted: 0, unknown: 0, suppressed: prepared.suppressed } };
    }
    if (step.kind === "add_comment") {
      const rows = await targetsFor(tx, input, projectId, step.targets);
      admitEffects(input, rows.length);
      const service = createTaskDiscussionService(assistantConversationAdapter(tx));
      for (const row of rows) {
        const clientRequestId = stableId("assistant-comment", [input.actorId, input.runId, input.stepId, row.id]);
        // Consult the original canonical receipt before considering a send.
        const original = await service.getReceipt({ actorId: input.actorId, taskId: row.id, clientRequestId });
        if (original.ok && original.value.state === "committed") continue;
        // A discussion may not exist yet. Canonical open holds its own audience/fence proof.
        const opened = await service.openTaskDiscussion({ actorId: input.actorId, taskId: row.id, limit: 1 });
        if (!opened.ok) throw new AssistantActionRefusal("unavailable");
        const result = await service.sendComment({ actorId: input.actorId, input: { taskId: row.id, clientRequestId,
          expectedAudienceEpoch: opened.value.audienceEpoch, body: step.body, rootCommentId: null, mentionUserIds: [] } });
        if (!result.ok) throw new AssistantActionRefusal("unavailable");
      }
      return { ...base, projectId, taskIds: rows.map(row => row.id), summary: `Added comments to ${rows.length} tasks.`, affectedCount: rows.length };
    }
    if (step.kind === "send_message" || step.kind === "read_chat") {
      const service = createConversationService(assistantConversationAdapter(tx), { directMessagesEnabled: false });
      const id = parseProjectId(projectId)!;
      const conversation = step.kind === "send_message"
        ? await service.ensureProjectConversation({ actorId: input.actorId, projectId: id })
        : await service.getProjectConversation({ actorId: input.actorId, projectId: id });
      if (!conversation.ok) throw new AssistantActionRefusal("unavailable");
      if (!conversation.value) return { ...base, projectId, affectedCount: 0, summary: "No Project chat messages yet.", items: [] };
      const conversationId = conversation.value.conversationId;
      if (step.kind === "read_chat") {
        const page = await service.getMessagePage({ actorId: input.actorId, projectId: id, conversationId, limit: step.limit ?? 20 });
        if (!page.ok) throw new AssistantActionRefusal("unavailable");
        return { ...base, projectId, affectedCount: 0, summary: `${page.value.messages.length} chat messages.`,
          items: page.value.messages.map(message => ({ id: message.id, title: message.body ?? "Deleted message" })) };
      }
      const clientRequestId = stableId("assistant-message", [input.actorId, input.runId, input.stepId]);
      const prior = await service.getReceipt({ actorId: input.actorId, projectId: id, conversationId, clientRequestId });
      if (!prior.ok) throw new AssistantActionRefusal("unavailable");
      if (prior.value.state !== "committed") {
        const mentionUserIds = await Promise.all((step.mentions ?? []).map(ref => resolveAssistantMember(tx, input.actorId, projectId, ref)));
        const result = await service.sendMessage({ actorId: input.actorId, input: { projectId: id, conversationId,
          clientRequestId, expectedAudienceEpoch: conversation.value.audienceEpoch, body: step.body, rootId: null, mentionUserIds } });
        if (!result.ok) throw new AssistantActionRefusal("unavailable");
      }
      return { ...base, projectId, affectedCount: 1, summary: "Saved the message to Project chat.", href: `/app/messages?workspaceId=${encodeURIComponent(projectId)}` };
    }
    if (step.kind === "preview_timeline" || step.kind === "read_timeline") {
      return { ...base, projectId, summary: "Current Timeline preparation is pending.", code: "timeline_pending", affectedCount: 0 };
    }
    if (step.kind === "open_project" || step.kind === "open_chat") {
      const query = `workspaceId=${encodeURIComponent(projectId)}`;
      const href = step.kind === "open_chat" ? `/app/messages?${query}` : `/app/tasks?${query}`;
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
