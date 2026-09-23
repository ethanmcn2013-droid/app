"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { nextTaskSeq } from "@/server/db/task-seq";
import {
  comments,
  tasks,
  workspaces,
} from "@/server/db/schema";
import { getTasks } from "@/server/db/queries";
import { emitTasksChanged } from "@/server/events";
import { assertProjectNotDeleting } from "@/server/projects/project-deletion-fence";
import { replaceWorkspaceTaskGraphInTransaction } from "@/server/projects/project-task-graph";
import { deleteNativeByteCleanupTargetConfirmed } from "@/server/attachments/native-byte-cleanup";
import { repairExactNativeByteCleanupReceipts } from "@/server/attachments/native-upload-cleanup";
import { getActiveWorkspaceOrNull, getCurrentUser } from "@/server/auth";
import {
  authorizeProjectCandidate,
  authorizeStoredProject,
  type ProjectCapabilityKey,
} from "@/server/actions/project-authz";
import {
  SEED_COMMENT_BODIES,
  USERS,
  type Task,
  type UserId,
} from "@/lib/data";
import {
  DOMAINS,
  type DomainId,
} from "@/lib/domains";
import { materializeWorkspaceDomainSeed } from "./seed-materialization";

const DOMAIN_IDS = new Set<DomainId>([
  "marketing",
  "student",
  "freelance",
  "wedding",
  "trades",
]);

function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

/**
 * Resolve and prove the Project a seed operation will act on.
 *
 * ── Why this file gets the strictest treatment in WP3 ──────────────────────
 *
 * Two of the three writes below were `db.delete(tasks).where(eq(
 * tasks.workspaceId, ws))` with `ws` coming straight from the unguarded
 * ambient accessor. A destructive bulk delete keyed solely by a cookie, with
 * two silent fallbacks behind it — first membership, then
 * `LEGACY_WORKSPACE_ID`, a real workspace holding real tasks that the caller
 * has proved no membership of (DECISIONS D-005). A caller with no membership
 * at all could empty `ws-legacy`.
 *
 * Three changes close that:
 *
 *  1. `getActiveWorkspaceOrNull()` — the cookie can no longer decay into
 *     `LEGACY_WORKSPACE_ID`. No Project means no Project, and the action
 *     refuses instead of finding one;
 *  2. an optional explicit `projectId`, so a caller that knows its Project
 *     says so rather than hoping the cookie agrees;
 *  3. an explicit capability proof before the delete, never a widened `WHERE`.
 *
 * The capability is deliberately `manageProject` for the two destructive
 * paths, not bare membership. The shipped Danger Zone already tells the user
 * "Only the owner can do this" and disables the controls
 * (`settings/sections/danger.tsx:99-113`) — but that gate lives entirely in
 * the client, and ADR 0001 §9 is explicit that authorizing in the UI and
 * trusting the action is not authorization. This moves the gate the product
 * already claims to have onto the server. It also bounds the blast radius of
 * the ambient accessor's remaining weakness: its first-membership fallback is
 * an unordered `.limit(1)`, so a cookieless caller in several Projects
 * resolves to an arbitrary one, and an arbitrary Project the caller merely
 * belongs to can no longer be wiped.
 */
async function resolveSeedProject(
  projectId: string | undefined,
  capability: ProjectCapabilityKey,
): Promise<Readonly<{ projectId: string; actorUserId: string }>> {
  const [me, ambient] = await Promise.all([
    getCurrentUser(),
    getActiveWorkspaceOrNull(),
  ]);
  const grant = await authorizeProjectCandidate({
    candidateProjectId: projectId ?? ambient,
    capability,
    actorUserId: me,
  });
  if (!grant.ok) {
    // One neutral message for every refusal. "No such Project", "not a
    // member" and "not the owner" must not be tellable apart by a caller
    // probing this action — an existence leak is a privacy defect
    // (ADR 0001 §4).
    throw new Error("That project isn’t available.");
  }
  return Object.freeze({ projectId: grant.projectId, actorUserId: me });
}

/** Delete the workspace task graph with durable attachment-byte custody.
 *  Resets `workspaces.activeDomain` to null but leaves the workspace row
 *  itself + members + entitlements intact. */
export async function clearAllTasksAction(projectId?: string): Promise<Task[]> {
  const { projectId: ws, actorUserId } = await resolveSeedProject(
    projectId,
    "manageProject",
  );
  const reset = await db.transaction(
    async (transaction) => {
      const grant = await authorizeStoredProject({
        storedProjectId: ws,
        capability: "manageProject",
        actorUserId,
        executor: transaction,
      });
      if (!grant.ok) throw new Error("That project isn’t available.");
      return replaceWorkspaceTaskGraphInTransaction(transaction, {
        workspaceId: ws,
        replace: async (replacementTransaction) => {
          await replacementTransaction
            .update(workspaces)
            .set({ activeDomain: null })
            .where(eq(workspaces.id, ws));
        },
      });
    },
    { behavior: "immediate" },
  );
  await repairExactNativeByteCleanupReceipts(
    { database: db, deleteTarget: deleteNativeByteCleanupTargetConfirmed },
    reset.cleanupReceiptKeys,
  );
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "seed" });
  return getTasks(ws);
}

/** Mark onboarding as seen, used by the "skip and start blank" path
 *  on /welcome when the user wants the empty state instead of a pack.
 *  Sets the workspace's activeDomain to a sentinel so isFirstRun()
 *  returns false. */
export async function markFirstRunCompleteAction(
  projectId?: string,
): Promise<void> {
  // Writes a sentinel and destroys nothing, so ordinary edit rights are the
  // honest requirement here — not the owner gate the two destructive paths get.
  const { projectId: ws, actorUserId } = await resolveSeedProject(
    projectId,
    "createOrEditTasks",
  );
  // Sentinel "marketing", a chosen-but-empty domain. Welcome page
  // stops intercepting; the next render shows an empty board.
  await db.transaction(
    async (tx) => {
      const grant = await authorizeStoredProject({
        storedProjectId: ws,
        capability: "createOrEditTasks",
        actorUserId,
        executor: tx,
      });
      if (!grant.ok) throw new Error("That project isn’t available.");
      await assertProjectNotDeleting(tx, ws);
      await tx
        .update(workspaces)
        .set({ activeDomain: "marketing" })
        .where(
          and(eq(workspaces.id, ws), sql`${workspaces.activeDomain} IS NULL`),
        );
    },
    { behavior: "immediate" },
  );
  revalidatePath("/app", "layout");
}

/** Wipe the current workspace's tasks and re-seed with a domain-
 *  flavored starter pack. Workspace-scoped so a re-seed in one
 *  workspace doesn't touch siblings. */
export async function seedDomainAction(
  domain: DomainId,
  projectId?: string,
): Promise<Task[]> {
  if (!DOMAIN_IDS.has(domain)) {
    throw new Error(`Unknown domain: ${domain}`);
  }
  const pack = DOMAINS[domain];
  const { projectId: ws, actorUserId } = await resolveSeedProject(
    projectId,
    "manageProject",
  );
  const materializedSeed = materializeWorkspaceDomainSeed(ws, domain);
  const replacementTasks = materializedSeed.map((entry) => entry.task);
  const userIds: UserId[] = Object.keys(USERS) as UserId[];
  const bodies =
    pack.commentBodies.length > 0 ? pack.commentBodies : SEED_COMMENT_BODIES;
  const now = Math.floor(Date.now() / 1000);
  const reset = await db.transaction(
    async (transaction) => {
      const grant = await authorizeStoredProject({
        storedProjectId: ws,
        capability: "manageProject",
        actorUserId,
        executor: transaction,
      });
      if (!grant.ok) throw new Error("That project isn’t available.");
      return replaceWorkspaceTaskGraphInTransaction(transaction, {
        workspaceId: ws,
        replace: async (replacementTransaction) => {
          // Identities, replacement tasks/comments and active-domain state
          // share the reset commit. Any failure restores the old graph and
          // every native attachment claim/row in full.
          await replacementTransaction.run(sql`
            INSERT OR IGNORE INTO users (id, name, color, initials)
            VALUES
              ('chloe',  'Chloe',  'var(--user-chloe)',  'CL'),
              ('david',  'David',  'var(--user-david)',  'DV'),
              ('alex',   'Alex',   'var(--user-alex)',   'AX'),
              ('ada',    'Ada',    '#f59e0b',            'AD'),
              ('marcus', 'Marcus', '#10b981',             'MR')
          `);
          for (const task of replacementTasks) {
            await replacementTransaction.insert(tasks).values({
              ...task,
              workspaceId: ws,
              seq: nextTaskSeq(ws),
            });
          }

          for (let index = 0; index < replacementTasks.length; index += 1) {
            const canonicalTaskId =
              materializedSeed[index]!.canonicalTaskId;
            const task = replacementTasks[index]!;
            const baseHash = strHash(canonicalTaskId);
            for (let offset = 0; offset < 3; offset++) {
              const seed = baseHash + offset * 31;
              const userId = pick(userIds, seed);
              const body = pick(bodies, seed * 7 + offset);
              const createdAt = new Date(
                (now - (3 - offset) * 3600) * 1000,
              );
              await replacementTransaction.insert(comments).values({
                id: `c-${task.id}-${offset}`,
                workspaceId: ws,
                taskId: task.id,
                userId,
                body,
                createdAt,
              });
            }
          }

          await replacementTransaction
            .update(workspaces)
            .set({ activeDomain: domain })
            .where(eq(workspaces.id, ws));
        },
      });
    },
    { behavior: "immediate" },
  );
  await repairExactNativeByteCleanupReceipts(
    { database: db, deleteTarget: deleteNativeByteCleanupTargetConfirmed },
    reset.cleanupReceiptKeys,
  );

  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "seed" });
  return getTasks(ws);
}
