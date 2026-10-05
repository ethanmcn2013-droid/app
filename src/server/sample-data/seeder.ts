import "server-only";

/**
 * Operator sample data: add and remove three invented sets of Projects in the
 * calling operator's own account.
 *
 * ── What this is, and is not ───────────────────────────────────────────────
 *
 * A product feature the operator triggers while signed in. It is not a script
 * and it does not write around the product: every row goes through the same
 * seams hand-made data uses.
 *
 *  - Projects: `insertOwnedProjectInTransaction`, the creation core
 *    `createProject` writes through (Project row plus owner membership).
 *  - Tasks, big dates and steps: `prepareCanonicalTaskCreate` and
 *    `createTaskInTransaction`, the task write seam `addTaskAction` uses,
 *    with one `taskAdd` activity per row authored by the operator.
 *  - Before any task is written the operator's capability on the new Project
 *    is proved inside the same transaction (`authorizeStoredProject`,
 *    `createOrEditTasks`), and the deletion and account-erasure fences are
 *    checked, exactly as the template path does.
 *  - Removal: the injected `deleteProject`, which in production is the one
 *    Project deletion service (`deleteOrTransferOwnership`, primary owner).
 *
 * ── Marking ────────────────────────────────────────────────────────────────
 *
 * A sample Project is recognised by three facts that must all hold:
 *
 *  1. its id is the deterministic id for (operator, set, project key);
 *  2. the operator is its stored owner;
 *  3. it carries the mark row `board:{id}:sample-set` naming that set and key.
 *
 * The mark lives in the Project's own `board:` meta namespace, which Project
 * deletion and account erasure already remove. No schema change. Removal acts
 * on Projects that pass all three and on nothing else; a Project that merely
 * shares an id or a name is refused, never deleted.
 *
 * ── Idempotent, bounded, fail closed ───────────────────────────────────────
 *
 * Each Project is one immediate transaction: the Project, its tasks, their
 * activities and the mark commit together or not at all. A second run finds
 * the mark and writes nothing. A run that fails part way leaves whole
 * Projects only, reports which ones exist, and can be run again. One run per
 * set at a time: a short lease in the first Project's namespace refuses a
 * second concurrent run and a removal during a run.
 *
 * ── Never sends anything ───────────────────────────────────────────────────
 *
 * This module imports no email sender, no notification writer, no invite,
 * share or publish path, no outbox and no analytics emitter. Assignees are
 * the operator or nobody. Invented people exist only as text.
 */

import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { db } from "@/server/db";
import { activities, meta, resources, tasks, users, workspaces } from "@/server/db/schema";
import { nextTaskSeq } from "@/server/db/task-seq";
import { readWorkspaceColumnConfig } from "@/server/db/board-config-read";
import { withTemplateWriteRetry } from "@/server/db/apply-template";
import { authorizeStoredProject } from "@/server/actions/project-authz";
import { privateTaskDbWrite } from "@/server/actions/private-task-db-write";
import { hasAccountDeletionStartedWith } from "@/server/account-deletion-lifecycle";
import { assertProjectNotDeleting } from "@/server/projects/project-deletion-fence";
import {
  insertOwnedProjectInTransaction,
  nextOwnedProjectPositionInTransaction,
} from "@/server/projects/create-project-core";
import {
  createTaskInTransaction,
  prepareCanonicalTaskCreate,
  type CanonicalTaskCreate,
} from "@/server/tasks/create-task-core";
import { isDoneColumnKey, WAITING_COLUMN_KEY } from "@/lib/board-columns";
import type { LaneId } from "@/lib/data";
import type { TagDef } from "@/lib/tags";
import { resolveTemplateDueAt } from "@/lib/template-anchor";
import {
  assertSampleSetWithinLimits,
  isSampleSetId,
  SAMPLE_SET_IDS,
  sampleCalendarDate,
  sampleDueLabel,
  sampleProjectDescription,
  sampleProjectName,
  sampleRunDay,
  sampleWeekday,
  summariseSampleSet,
  type RemoveSampleResult,
  type SampleProject,
  type SampleSet,
  type SampleSetId,
  type SampleSetStatus,
  type SampleStatus,
  type SeedSampleResult,
} from "@/lib/sample-data/model";
import { SAMPLE_SETS } from "@/lib/sample-data/sets";

export type { RemoveSampleResult, SampleSetStatus, SeedSampleResult } from "@/lib/sample-data/model";

type SampleDatabase = typeof db;
type SampleTransaction = Parameters<Parameters<SampleDatabase["transaction"]>[0]>[0];

export type SampleDataDependencies = Readonly<{
  database: SampleDatabase;
  /** Already proved to be an operator by the action. Never client input. */
  actorUserId: string;
  /** The product's Project deletion path. Only ever called on marked Projects. */
  deleteProject: (input: { actorUserId: string; projectId: string }) => Promise<unknown>;
  now?: () => Date;
}>;

const MARK_VERSION = 1;
const LEASE_MS = 3 * 60_000;
const UNAVAILABLE = "Sample data isn’t available for this account.";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Deterministic Project id for one operator, set and project key. */
export function sampleProjectId(actorUserId: string, setId: SampleSetId, projectKey: string): string {
  return `ws-sample-${digest(["sample-data:v1", actorUserId, setId, projectKey]).slice(0, 40)}`;
}

function markKey(projectId: string): string {
  return `board:${projectId}:sample-set`;
}

function leaseKey(projectId: string): string {
  return `board:${projectId}:sample-run`;
}

type SampleMark = Readonly<{
  v: number;
  set: SampleSetId;
  project: string;
  by: string;
  runDay: string;
  tasks: number;
  steps: number;
  links: number;
}>;

function parseMark(raw: string | undefined): SampleMark | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SampleMark> | null;
    if (!value || typeof value !== "object") return null;
    if (value.v !== MARK_VERSION || !isSampleSetId(value.set)) return null;
    if (typeof value.project !== "string" || typeof value.by !== "string") return null;
    return value as SampleMark;
  } catch {
    return null;
  }
}

function markMatches(mark: SampleMark | null, actorUserId: string, setId: SampleSetId, projectKey: string): boolean {
  return mark !== null && mark.set === setId && mark.project === projectKey && mark.by === actorUserId;
}

const LANE_FOR_STATUS: Readonly<Record<SampleStatus, LaneId>> = {
  todo: "todo",
  doing: "doing",
  review: "review",
  // The default Waiting column claims a task while its lane stays "doing",
  // the same persistence a drag into Waiting writes.
  waiting: "doing",
  done: "done",
};

// ── Status ───────────────────────────────────────────────────────────

type MarkedProject = Readonly<{ id: string; name: string; key: string }>;

/** Every Project of one set that passes all three marks, in set order. */
async function markedProjects(
  deps: Pick<SampleDataDependencies, "database" | "actorUserId">,
  set: SampleSet,
): Promise<MarkedProject[]> {
  const expected = set.projects.map((project) => ({
    key: project.key,
    id: sampleProjectId(deps.actorUserId, set.id, project.key),
  }));
  const ids = expected.map((entry) => entry.id);
  // isolation-ok: deterministic ids derived from the operator's own user id,
  // further bound to stored ownership here and to the mark row below.
  const rows = await deps.database
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .where(and(inArray(workspaces.id, ids), eq(workspaces.ownerUserId, deps.actorUserId)));
  if (rows.length === 0) return [];
  const marks = await deps.database
    .select({ key: meta.key, value: meta.value })
    .from(meta)
    .where(inArray(meta.key, ids.map(markKey)));
  const markByKey = new Map(marks.map((row) => [row.key, parseMark(row.value)]));
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const out: MarkedProject[] = [];
  for (const entry of expected) {
    const row = rowById.get(entry.id);
    if (!row) continue;
    if (!markMatches(markByKey.get(markKey(entry.id)) ?? null, deps.actorUserId, set.id, entry.key)) continue;
    out.push({ id: row.id, name: row.name, key: entry.key });
  }
  return out;
}

export async function listSampleData(
  deps: Pick<SampleDataDependencies, "database" | "actorUserId">,
): Promise<SampleSetStatus[]> {
  const out: SampleSetStatus[] = [];
  for (const setId of SAMPLE_SET_IDS) {
    const set = SAMPLE_SETS[setId];
    const present = await markedProjects(deps, set);
    out.push({
      summary: summariseSampleSet(set),
      present: present.map((project) => ({ id: project.id, name: project.name })),
    });
  }
  return out;
}

// ── Lease: one run per set at a time ─────────────────────────────────

function leaseActive(raw: string | undefined, nowMs: number): boolean {
  if (!raw) return false;
  try {
    const value = JSON.parse(raw) as { expiresAt?: unknown };
    return typeof value.expiresAt === "number" && value.expiresAt > nowMs;
  } catch {
    return false;
  }
}

/** Take the set's lease, or report that a run already holds it. */
async function acquireLease(database: SampleDatabase, anchorProjectId: string, now: Date): Promise<boolean> {
  const key = leaseKey(anchorProjectId);
  return withTemplateWriteRetry(() =>
    database.transaction(
      async (tx) => {
        const [row] = await tx.select({ value: meta.value }).from(meta).where(eq(meta.key, key));
        if (leaseActive(row?.value, now.getTime())) return false;
        const value = JSON.stringify({ expiresAt: now.getTime() + LEASE_MS });
        await tx
          .insert(meta)
          .values({ key, value, updatedAt: now })
          .onConflictDoUpdate({ target: meta.key, set: { value, updatedAt: now } });
        return true;
      },
      { behavior: "immediate" },
    ),
  );
}

async function releaseLease(database: SampleDatabase, anchorProjectId: string): Promise<void> {
  await database.delete(meta).where(eq(meta.key, leaseKey(anchorProjectId)));
}

// ── Seed ─────────────────────────────────────────────────────────────

type ProjectCounts = { tasks: number; steps: number; links: number };

/**
 * The stored domain a Project of each set carries: the values the Project
 * service writes for a teacher's, a student's and a couple's Project.
 */
const SAMPLE_ACTIVE_DOMAIN: Readonly<Record<SampleSetId, string>> = {
  teacher: "student",
  student: "student",
  wedding: "wedding",
};

const SAMPLE_PRIMARY_USE_CASE: Readonly<Record<SampleSetId, string>> = {
  teacher: "teacher",
  student: "student",
  wedding: "wedding",
};

/**
 * One Project, whole, in the caller's transaction. Returns null when the
 * marked Project already exists (nothing is written).
 */
async function seedProjectInTransaction(
  tx: SampleTransaction,
  input: Readonly<{ actorUserId: string; set: SampleSet; project: SampleProject; now: Date }>,
): Promise<ProjectCounts | null> {
  const { actorUserId, set, project, now } = input;
  const projectId = sampleProjectId(actorUserId, set.id, project.key);

  const [actor] = await tx
    .select({ id: users.id, clerkId: users.clerkId })
    .from(users)
    .where(eq(users.id, actorUserId))
    .limit(1);
  if (!actor || (await hasAccountDeletionStartedWith(tx, actor.clerkId ?? actorUserId))) {
    throw new Error(UNAVAILABLE);
  }

  // isolation-ok: deterministic id for this operator; stored ownership and
  // the mark are both checked before the row is treated as ours.
  const [existing] = await tx
    .select({ id: workspaces.id, ownerUserId: workspaces.ownerUserId })
    .from(workspaces)
    .where(eq(workspaces.id, projectId));
  const [markRow] = await tx.select({ value: meta.value }).from(meta).where(eq(meta.key, markKey(projectId)));
  if (existing) {
    // An id we would use that is not provably our sample Project is left
    // exactly as it is. Refuse rather than add to, or later remove, it.
    if (existing.ownerUserId !== actorUserId || !markMatches(parseMark(markRow?.value), actorUserId, set.id, project.key)) {
      throw new Error(UNAVAILABLE);
    }
    return null;
  }

  const runDay = sampleRunDay(now);
  const position = await nextOwnedProjectPositionInTransaction(tx, { actorUserId, planningPeriodId: null });
  await insertOwnedProjectInTransaction(tx, {
    id: projectId,
    slug: `${project.key}-sample-${projectId.slice(-10)}`,
    name: sampleProjectName(project),
    ownerUserId: actorUserId,
    planningPeriodId: null,
    contextType: "project",
    position,
    activeDomain: SAMPLE_ACTIVE_DOMAIN[set.id],
    primaryUseCase: SAMPLE_PRIMARY_USE_CASE[set.id],
    now,
    description: sampleProjectDescription(set, project),
    primaryDate: project.mainDate ? sampleCalendarDate(runDay, project.mainDate.due) : null,
    primaryDateLabel: project.mainDate?.label ?? null,
    currency: project.budgetEuros ? "EUR" : null,
    budgetCents: project.budgetEuros ? project.budgetEuros * 100 : null,
  });

  // The same proof the task and template paths take inside their writer
  // transaction: the operator may create tasks here, the Project is live.
  const grant = await authorizeStoredProject({
    storedProjectId: projectId,
    actorUserId,
    capability: "createOrEditTasks",
    archivePolicy: "enforce",
    executor: tx,
  });
  if (!grant.ok) throw new Error(UNAVAILABLE);
  await assertProjectNotDeleting(tx, projectId);

  // Label colours: the tag registry shape `addTagAction` stores.
  const tagDefs: TagDef[] = project.labels.map((label) => ({ name: label.name, color: label.color }));
  const tagValue = JSON.stringify(tagDefs);
  await tx
    .insert(meta)
    .values({ key: `board:${projectId}:tags`, value: tagValue, updatedAt: now })
    .onConflictDoUpdate({ target: meta.key, set: { value: tagValue, updatedAt: now } });

  const columnConfig = await readWorkspaceColumnConfig(projectId, tx);
  const positions = new Map<LaneId, number>();
  const boardColumnFor = new Map<string, string>();
  let ordinal = 0;

  const operations = {
    async nextPosition(value: CanonicalTaskCreate) {
      // A Project created in this transaction has no other writer, so the
      // end-of-lane position is a running count per lane.
      const next = (positions.get(value.lane) ?? 0) + 1;
      positions.set(value.lane, next);
      return next;
    },
    async insertTask(value: CanonicalTaskCreate & { position: number }) {
      const [row] = await privateTaskDbWrite(() =>
        tx
          .insert(tasks)
          .values({
            id: value.id,
            workspaceId: value.workspaceId,
            seq: nextTaskSeq(value.workspaceId),
            title: value.title,
            description: value.description,
            lane: value.lane,
            priority: value.priority,
            assignees: [...value.assignees],
            estimate: value.estimate,
            due: value.due,
            dueAt: value.dueAtSeconds == null ? null : new Date(value.dueAtSeconds * 1000),
            tags: value.tags == null ? null : [...value.tags],
            recurrence: value.recurrence,
            externalContactName: value.externalContactName,
            externalContactEmail: value.externalContactEmail,
            cents: value.cents,
            parentTaskId: value.parentTaskId,
            position: value.position,
            boardColumnKey: boardColumnFor.get(value.id) ?? null,
            completedAt: value.completedAtSeconds == null ? null : new Date(value.completedAtSeconds * 1000),
            isMilestone: value.isMilestone,
            updatedAt: new Date(value.createdAtSeconds * 1000),
          })
          .returning({ seq: tasks.seq }),
      );
      return { seq: row?.seq ?? 0 };
    },
    async insertActivity(value: CanonicalTaskCreate) {
      await tx.insert(activities).values({
        id: `a-${digest([value.id, "taskAdd"]).slice(0, 32)}`,
        workspaceId: value.workspaceId,
        taskId: value.id,
        userId: actorUserId,
        kind: "taskAdd",
        payload: { kind: "taskAdd", lane: value.lane },
        createdAt: new Date(value.createdAtSeconds * 1000),
      });
    },
  };

  const counts: ProjectCounts = { tasks: 0, steps: 0, links: 0 };
  for (const task of project.tasks) {
    const taskId = `t-${digest([projectId, "task", ordinal++]).slice(0, 32)}`;
    const lane = LANE_FOR_STATUS[task.status];
    if (task.status === "waiting") boardColumnFor.set(taskId, WAITING_COLUMN_KEY);
    const dueAt =
      task.due == null ? null : resolveTemplateDueAt({ anchorDate: runDay, dueOffsetDays: task.due });
    // Done is created done now. Completion time is the moment of creation,
    // the only honest value: no path backdates history.
    const createdDone = isDoneColumnKey(lane, columnConfig);
    await createTaskInTransaction(
      operations,
      prepareCanonicalTaskCreate({
        id: taskId,
        workspaceId: projectId,
        title: task.title,
        description: task.notes ?? null,
        lane,
        priority: task.priority ?? "p2",
        assignees: task.mine ? [actorUserId] : [],
        estimate: task.hours ?? null,
        due: task.due == null ? null : sampleDueLabel(runDay, task.due),
        dueAt,
        tags: task.labels?.length ? [...task.labels] : null,
        recurrence:
          task.weekly && task.due != null ? { kind: "weekly", weekday: sampleWeekday(runDay, task.due) } : null,
        cents: task.euros ? task.euros * 100 : null,
        isMilestone: task.bigDate === true,
        completedAt: createdDone ? now : null,
        createdAt: now,
      }),
    );
    counts.tasks += 1;

    for (const [stepIndex, step] of (task.steps ?? []).entries()) {
      await createTaskInTransaction(
        operations,
        prepareCanonicalTaskCreate({
          id: `t-${digest([taskId, "step", stepIndex]).slice(0, 32)}`,
          workspaceId: projectId,
          title: step.title,
          lane: step.done ? "done" : "todo",
          priority: "p2",
          assignees: [],
          parentTaskId: taskId,
          completedAt: step.done ? now : null,
          createdAt: now,
        }),
      );
      counts.steps += 1;
    }

    if (task.link) {
      // The link resource shape `addLinkResourceAction` writes, with its
      // activity. A reserved example.com address: nothing is fetched.
      const resourceId = `res-${digest([taskId, "link"]).slice(0, 24)}`;
      await tx.insert(resources).values({
        id: resourceId,
        workspaceId: projectId,
        taskId,
        kind: "link",
        provider: "url",
        title: task.link.title,
        url: `https://example.com/sample/${task.link.path}`,
        addedByUserId: actorUserId,
        addedAt: Math.floor(now.getTime() / 1000),
        accessState: "ok",
        countsAgainstStorage: 0,
      });
      await tx.insert(activities).values({
        id: `a-${digest([taskId, "resourceAdd"]).slice(0, 32)}`,
        workspaceId: projectId,
        taskId,
        userId: actorUserId,
        kind: "resourceAdd",
        payload: { kind: "resourceAdd", resourceId, provider: "url", title: task.link.title },
        createdAt: now,
      });
      counts.links += 1;
    }
  }

  const mark: SampleMark = {
    v: MARK_VERSION,
    set: set.id,
    project: project.key,
    by: actorUserId,
    runDay,
    tasks: counts.tasks,
    steps: counts.steps,
    links: counts.links,
  };
  const markValue = JSON.stringify(mark);
  await tx
    .insert(meta)
    .values({ key: markKey(projectId), value: markValue, updatedAt: now })
    .onConflictDoUpdate({ target: meta.key, set: { value: markValue, updatedAt: now } });
  return counts;
}

export async function seedSampleSet(deps: SampleDataDependencies, setId: SampleSetId): Promise<SeedSampleResult> {
  if (!isSampleSetId(setId)) throw new Error(UNAVAILABLE);
  const set = SAMPLE_SETS[setId];
  assertSampleSetWithinLimits(set);
  const now = () => (deps.now ?? (() => new Date()))();
  const created: string[] = [];
  const alreadyPresent: string[] = [];
  const totals: ProjectCounts = { tasks: 0, steps: 0, links: 0 };

  const seedOne = async (project: SampleProject) => {
    const stamp = new Date(Math.floor(now().getTime() / 1000) * 1000);
    const counts = await withTemplateWriteRetry(() =>
      deps.database.transaction(
        (tx) => seedProjectInTransaction(tx, { actorUserId: deps.actorUserId, set, project, now: stamp }),
        { behavior: "immediate" },
      ),
    );
    if (counts === null) {
      alreadyPresent.push(sampleProjectName(project));
      return;
    }
    created.push(sampleProjectName(project));
    totals.tasks += counts.tasks;
    totals.steps += counts.steps;
    totals.links += counts.links;
  };

  // The first Project is the set's anchor: it is made (or found) first so the
  // lease lives in a namespace a real, marked Project owns.
  const [anchor, ...rest] = set.projects;
  const anchorId = sampleProjectId(deps.actorUserId, set.id, anchor.key);
  let current = anchor;
  let leased = false;
  try {
    await seedOne(anchor);
    leased = await acquireLease(deps.database, anchorId, now());
    if (!leased) return { ok: false, set: set.id, reason: "busy", created, alreadyPresent };
    for (const project of rest) {
      current = project;
      await seedOne(project);
    }
  } catch {
    // Fail closed. The failed Project's transaction rolled back whole; the
    // error text may carry bound values, so only a fixed category is reported.
    return {
      ok: false,
      set: set.id,
      reason: "failed",
      created,
      alreadyPresent,
      failedAt: sampleProjectName(current),
    };
  } finally {
    if (leased) await releaseLease(deps.database, anchorId).catch(() => undefined);
  }
  return { ok: true, set: set.id, created, alreadyPresent, ...totals };
}

// ── Remove ───────────────────────────────────────────────────────────

/**
 * Delete the marked sample Projects of one set, and nothing else, through the
 * product's Project deletion path. The anchor goes last so the lease it holds
 * guards the whole removal.
 */
export async function removeSampleSet(deps: SampleDataDependencies, setId: SampleSetId): Promise<RemoveSampleResult> {
  if (!isSampleSetId(setId)) throw new Error(UNAVAILABLE);
  const set = SAMPLE_SETS[setId];
  const now = (deps.now ?? (() => new Date()))();
  const targets = await markedProjects(deps, set);
  if (targets.length === 0) return { ok: true, set: set.id, removed: [] };

  const anchorId = sampleProjectId(deps.actorUserId, set.id, set.projects[0].key);
  const anchorPresent = targets.some((target) => target.id === anchorId);
  if (anchorPresent && !(await acquireLease(deps.database, anchorId, now))) {
    return { ok: false, set: set.id, reason: "busy", removed: [] };
  }

  const ordered = [...targets.filter((target) => target.id !== anchorId), ...targets.filter((target) => target.id === anchorId)];
  const removed: string[] = [];
  for (const target of ordered) {
    try {
      // Re-prove the three marks at the moment of deletion: the listing above
      // is a read, and a delete must never act on a stale answer.
      const [still] = (await markedProjects(deps, set)).filter((project) => project.id === target.id);
      if (!still) continue;
      await deps.deleteProject({ actorUserId: deps.actorUserId, projectId: target.id });
      removed.push(target.name);
    } catch {
      if (anchorPresent) await releaseLease(deps.database, anchorId).catch(() => undefined);
      return { ok: false, set: set.id, reason: "failed", removed, failedAt: target.name };
    }
  }
  // Deleting the anchor removes the lease with it. If the anchor was skipped,
  // let the lease go now rather than at its expiry.
  if (anchorPresent) await releaseLease(deps.database, anchorId).catch(() => undefined);
  return { ok: true, set: set.id, removed };
}

export async function removeAllSampleData(deps: SampleDataDependencies): Promise<RemoveSampleResult[]> {
  const out: RemoveSampleResult[] = [];
  for (const setId of SAMPLE_SET_IDS) out.push(await removeSampleSet(deps, setId));
  return out;
}
