import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { activities, meta, tasks, users, workspaceMembers, workspaces } from "./schema";
import { nextTaskSeq } from "./task-seq";
import { getCurrentUser } from "@/server/auth";
import { authorizeStoredProject } from "@/server/actions/project-authz";
import { hasAccountDeletionStartedWith } from "@/server/account-deletion-lifecycle";
import { assertProjectNotDeleting } from "@/server/projects/project-deletion-fence";
import { type LaneId } from "@/lib/data";
import { getTemplate, TEMPLATES } from "@/lib/templates";
import { resolveTemplateDueAt } from "@/lib/template-anchor";

type TemplateDatabase = typeof db;
type TemplateTransaction = Parameters<Parameters<TemplateDatabase["transaction"]>[0]>[0];
type TemplateDependencies = { database?: TemplateDatabase; actorUserId?: string };
export type TemplateApplicationOptions = {
  /** Omitted reads the Project's primary date; explicit null leaves tasks undated. */
  anchorDate?: string | null;
  /** Reuse for retries only; a fresh id intentionally appends another copy. */
  requestId?: string;
};

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function requireTemplateRequestId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(value)) {
    throw new Error("A template request id is required.");
  }
  return value;
}

function checkedTemplate(templateId: string) {
  if (!TEMPLATES.some(template => template.id === templateId)) throw new Error("Unknown template.");
  return getTemplate(templateId);
}

/**
 * DB-only entry point for onboarding/redemption and the explicit apply action.
 * Tasks, their initial activities and the retry receipt commit together.
 * Legacy callers with no request identity remain additive: neither template id,
 * current task count nor matching titles can distinguish a retry from reapply.
 */
export async function applyTemplateToWorkspace(
  templateId: string,
  workspaceId: string,
  options: TemplateApplicationOptions = {},
  dependencies: TemplateDependencies = {},
): Promise<void> {
  checkedTemplate(templateId);
  const requestId = options.requestId === undefined ? randomUUID() : requireTemplateRequestId(options.requestId);
  const actorUserId = dependencies.actorUserId ?? await getCurrentUser();
  const database = dependencies.database ?? db;
  await withTemplateWriteRetry(() => database.transaction(
    transaction => applyInTransaction(transaction, templateId, workspaceId, actorUserId, { ...options, requestId }),
    { behavior: "immediate" },
  ));
}

async function applyInTransaction(
  transaction: TemplateTransaction,
  templateId: string,
  workspaceId: string,
  actorUserId: string,
  options: TemplateApplicationOptions & { requestId: string },
): Promise<void> {
  const grant = await authorizeStoredProject({
    storedProjectId: workspaceId, actorUserId, capability: "createOrEditTasks",
    archivePolicy: "enforce", executor: transaction,
  });
  if (!grant.ok || await hasAccountDeletionStartedWith(transaction, actorUserId)) {
    throw new Error("That project isn’t available.");
  }
  await assertProjectNotDeleting(transaction, workspaceId);

  // The board namespace already participates in Project/account erasure.
  // Keep the receipt independent of tasks so replay never recreates user-deleted
  // rows or overwrites later edits. It lives for the lifetime of the Project.
  const applicationId = digest(["template-application:v1", workspaceId, actorUserId, options.requestId]);
  const key = `board:${workspaceId}:template-application:${applicationId}`;
  const fingerprint = digest([templateId, options.anchorDate === undefined ? ["project-date"] : ["explicit-date", options.anchorDate]]);
  const [receipt] = await transaction.select({ value: meta.value }).from(meta).where(eq(meta.key, key));
  if (receipt) {
    const stored = JSON.parse(receipt.value) as { fingerprint?: unknown };
    if (stored.fingerprint !== fingerprint) throw new Error("This template request was already used with different inputs.");
    return;
  }

  const template = checkedTemplate(templateId);
  const [workspace] = await transaction.select({ primaryDate: workspaces.primaryDate }).from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  if (!workspace) throw new Error("That project isn’t available.");
  const anchorDate = options.anchorDate === undefined ? workspace.primaryDate : options.anchorDate;
  const lanePositions = new Map<LaneId, number>();
  for (const lane of new Set(template.tasks.map(task => task.lane))) {
    const [row] = await transaction.select({ max: sql<number | null>`MAX(${tasks.position})` }).from(tasks)
      .where(and(eq(tasks.lane, lane), eq(tasks.workspaceId, workspaceId)));
    lanePositions.set(lane, (row?.max ?? 0) + 1);
  }

  const now = new Date(Math.floor(Date.now() / 1000) * 1000);
  for (const [index, task] of template.tasks.entries()) {
    const id = `t-${digest([applicationId, index])}`;
    const position = lanePositions.get(task.lane)!;
    lanePositions.set(task.lane, position + 1);
    await transaction.insert(tasks).values({
      id, workspaceId, seq: nextTaskSeq(workspaceId),
      title: task.title, lane: task.lane, priority: task.priority,
      assignees: [], due: task.due,
      dueAt: resolveTemplateDueAt({ anchorDate, dueOffsetDays: task.dueOffsetDays }),
      isMilestone: task.milestone === true, tags: task.tags, position, updatedAt: now,
    });
    await transaction.insert(activities).values({
      id: `a-${digest([applicationId, index])}`,
      workspaceId, taskId: id, userId: actorUserId, kind: "taskAdd",
      payload: { kind: "taskAdd", lane: task.lane }, createdAt: now,
    });
  }
  await transaction.insert(meta).values({
    key, value: JSON.stringify({ fingerprint, anchorDate, taskCount: template.tasks.length }), updatedAt: now,
  });
}

/** A remix is one atomic creation, not a partly provisioned empty Project. */
export async function remixTemplateIntoWorkspace(
  templateId: string,
  requestIdInput: string,
  dependencies: TemplateDependencies = {},
): Promise<{ workspaceId: string; slug: string }> {
  const template = checkedTemplate(templateId);
  const requestId = requireTemplateRequestId(requestIdInput);
  const actorUserId = dependencies.actorUserId ?? await getCurrentUser();
  const database = dependencies.database ?? db;
  const workspaceId = `ws-${digest(["template-remix:v1", actorUserId, requestId])}`;
  const baseSlug = template.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return withTemplateWriteRetry(() => database.transaction(async transaction => {
    if (await hasAccountDeletionStartedWith(transaction, actorUserId)) throw new Error("That project isn’t available.");
    const [actor] = await transaction.select({ id: users.id }).from(users).where(eq(users.id, actorUserId));
    if (!actor) throw new Error("That project isn’t available.");
    // isolation-ok: deterministic actor/request identity; ownership is checked
    // before returning any existing Project or applying its receipt.
    let [workspace] = await transaction.select().from(workspaces).where(eq(workspaces.id, workspaceId));
    if (workspace && workspace.ownerUserId !== actorUserId) throw new Error("That project isn’t available.");
    if (!workspace) {
      [workspace] = await transaction.insert(workspaces).values({
        id: workspaceId, slug: `${baseSlug}-my-remix-${workspaceId.slice(3)}`,
        name: `${template.name} · my remix`, ownerUserId: actorUserId,
        activeDomain: template.domain, templateId: template.id,
      }).returning();
      await transaction.insert(workspaceMembers).values({ workspaceId, userId: actorUserId, role: "owner" });
    }
    await applyInTransaction(transaction, templateId, workspaceId, actorUserId, { requestId, anchorDate: null });
    return { workspaceId, slug: workspace.slug };
  }, { behavior: "immediate" }));
}

/** Retry only lock contention, with the same identity and a fresh transaction.
 * Network/commit-ack failures surface to the caller, who can replay its id. */
async function withTemplateWriteRetry<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await work(); }
    catch (error) {
      const cause = error as { code?: string; cause?: { code?: string } };
      if (attempt >= 5 || (cause.code !== "SQLITE_BUSY" && cause.cause?.code !== "SQLITE_BUSY")) throw error;
      await new Promise(resolve => setTimeout(resolve, 25 * 2 ** attempt));
    }
  }
}
