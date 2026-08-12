import "server-only";

/**
 * WP3 · the mutation-safety seam for Project-scoped server actions.
 *
 * ADR 0001 §9 permits exactly two shapes, and this module is the proof
 * behind both:
 *
 *  - **create/list** — `authorizeProjectScope()`. The action accepts a branded
 *    `ProjectId` and this freshly validates the required capability. When no
 *    explicit Project is supplied the ambient value is resolved through the
 *    fail-closed accessor and then put through the *same* proof, so the cookie
 *    is a hint about *which* Project, never evidence that the caller may write
 *    to it;
 *  - **object operation** — `authorizeStoredProject()`. The action reads its
 *    target by primary key, derives the Project stored *on the object*, and
 *    verifies capability against that. The ambient cookie is not an input to
 *    the decision at all.
 *
 * ── Why the proof is a separate query, not another `AND workspace_id = ?` ──
 *
 * Authorization expressed as a row filter is not authorization. Once the
 * permission check lives inside `WHERE`/`EXISTS`/a JOIN, "you may not read
 * this" and "there is nothing here" collapse into the same empty result — and
 * an empty result that gates a delete is how WP1 turned an unauthorized read
 * into an authorized zero and destroyed a user's data.
 *
 * So `proveProjectCapability()` is its own statement whose only output is an
 * authorization decision. Its answers are distinguishable by construction:
 *
 *     not-a-member   the caller has no membership row for this Project
 *     forbidden      membership proved, capability withheld (role or archive)
 *     ok             membership and capability both proved
 *
 * None of those is reachable by "the object did not exist", which the caller
 * establishes separately, before it ever asks this module anything.
 *
 * ── What this module deliberately does NOT consult ─────────────────────────
 *
 * The Project **catalog** (`src/server/projects/catalog.ts`). Its bounded read
 * is `.limit(2000)` with no `ORDER BY`, so catalog presence is a truncation
 * artefact, not a fact about membership. Authorization asks the membership
 * table directly, every time, for the one Project in question. Under ADR 0001
 * §9 that is required anyway — "every server action reauthorizes against a
 * fresh membership query regardless of what the catalog said".
 *
 * ── Ambient resolution, and the sharp edge on it ───────────────────────────
 *
 * `getActiveWorkspaceOrNull()` is the Wave 2 fail-closed drop-in: same cookie,
 * same first-membership fallback, and where `getActiveWorkspace()` hands back
 * `LEGACY_WORKSPACE_ID` — a real workspace holding real tasks that the caller
 * has proved no membership of (DECISIONS D-005) — it returns `null`.
 * Migrating to it closes D-005 at every call site in this lane.
 *
 * Its second fallback is still a guess: an unordered `.limit(1)` over the
 * caller's memberships, so a cookieless caller in several Projects resolves to
 * an arbitrary one. That is tolerable for a scoped read and NOT tolerable as
 * the sole input to a destructive bulk operation, which is why the two bulk
 * deletes in `seed.ts` require `manageProject` rather than mere membership.
 * The ordering itself must be fixed in `auth.ts`, which this lane does not
 * own; it is recorded in the WP3a report rather than worked around here.
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { planningPeriods, workspaceMembers, workspaces } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth";
import {
  projectCapabilities,
  resolveProjectRole,
} from "@/server/projects/capabilities";
import {
  isProjectId,
  parseProjectId,
  type ProjectCapabilities,
  type ProjectId,
  type ProjectRole,
} from "@/lib/projects/project-ref";

/** The capability a call site needs. Named, so the requirement is readable. */
export type ProjectCapabilityKey = keyof ProjectCapabilities;

/**
 * What to do when the proved Project is archived.
 *
 * ADR 0001 §5 says an archived Project is read-only for Project-scoped
 * operations, and `projectCapabilities()` already encodes that by withholding
 * `createOrEditTasks`. WP3a nevertheless defaults to **`"defer"`**, and the
 * reason is a product fact rather than a preference:
 * `archiveProjectAction()` (`planning.ts:225-240`) does not clear the
 * active-Project cookie — only `deleteProjectAction` does. A user can archive
 * the Project they are standing in and keep the board on screen. Turning §5 on
 * here would leave that board rendered and quietly refusing every gesture,
 * which is the same "looks fine, changes nothing" failure this work exists to
 * remove — just with a different cause.
 *
 * So archive enforcement is one switch, not fifty call sites: when the chrome
 * can move a caller off an archived Project and say so, flip these to
 * `"enforce"`. Until then WP3a changes *which* Project a write lands in and
 * *whether membership was proved*, and changes nothing about archived
 * Projects. `ProjectGrant.archived` is reported truthfully throughout, so
 * nothing downstream has to guess.
 */
export type ArchivePolicy = "enforce" | "defer";

export type ProjectGrant = Readonly<{
  ok: true;
  /** Proved. Safe to use as a write destination and as a scope filter. */
  projectId: ProjectId;
  role: ProjectRole;
  capabilities: ProjectCapabilities;
  archived: boolean;
}>;

/**
 * Denials. Server-only, like `resolve.ts`'s `reason`: `not-a-member` versus
 * `no-active-project` is an existence signal and must never be serialized to a
 * client component. Call sites collapse every one of these into whatever
 * neutral no-op their own return type already expresses.
 */
export type ProjectDenial = Readonly<{
  ok: false;
  reason:
    | "malformed-project"
    | "no-active-project"
    | "not-a-member"
    | "forbidden";
}>;

export type ProjectAuthorization = ProjectGrant | ProjectDenial;

/**
 * The proof. One membership row for one Project and one actor, joined only to
 * what the capability model needs, and evaluated as an authorization decision
 * rather than used as a filter on someone else's query.
 *
 * Membership is the join root, so a Project that does not exist and a Project
 * the caller is not in are the same *server-side* answer — deliberately, since
 * distinguishing them to a caller is an existence leak (ADR 0001 §4). What is
 * NOT collapsed is the difference between that and "capability withheld",
 * because a call site must be able to tell an archived Project from a foreign
 * one when it decides whether to log.
 */
export async function proveProjectCapability(
  actorUserId: string,
  projectId: ProjectId,
  capability: ProjectCapabilityKey,
  archivePolicy: ArchivePolicy = "defer",
): Promise<ProjectAuthorization> {
  const [row] = await db
    .select({
      membershipRole: workspaceMembers.role,
      workspaceOwnerUserId: workspaces.ownerUserId,
      planningPeriodOwnerUserId: planningPeriods.ownerUserId,
      archivedAt: sql<number | null>`${workspaces.archivedAt}`,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .leftJoin(planningPeriods, eq(planningPeriods.id, workspaces.planningPeriodId))
    .where(
      and(
        eq(workspaceMembers.userId, actorUserId),
        eq(workspaceMembers.workspaceId, projectId),
      ),
    )
    .limit(1);

  if (!row) return { ok: false, reason: "not-a-member" };

  const role = resolveProjectRole({
    membershipRole: row.membershipRole === "owner" ? "owner" : "member",
    workspaceOwnerUserId: row.workspaceOwnerUserId ?? null,
    actorUserId,
  });
  const archived = row.archivedAt !== null;
  const ownsPlanningPeriod = row.planningPeriodOwnerUserId === actorUserId;

  // Reported truthfully, always: downstream should see the real capability set.
  const capabilities = projectCapabilities({
    role,
    archived,
    ownsPlanningPeriod,
  });
  // Gated on, per policy. See ArchivePolicy for why the default defers.
  const gate =
    archivePolicy === "enforce"
      ? capabilities
      : projectCapabilities({ role, archived: false, ownsPlanningPeriod });

  if (!gate[capability]) return { ok: false, reason: "forbidden" };

  return { ok: true, projectId, role, capabilities, archived };
}

/**
 * ADR 0001 §9, **create/list**: authorize the Project a new object will be
 * written into.
 *
 * `candidateProjectId` is the call site's preferred destination — an explicit
 * branded `ProjectId` when it has one, otherwise whatever
 * `getActiveWorkspaceOrNull()` returned. Either way it is untrusted here:
 * shape-gated, then put through the same membership proof. Supplying an
 * explicit id is not a privilege, since an id the caller is not a member of is
 * refused exactly as a forged one would be.
 *
 * The ambient resolution deliberately stays *at the call site* rather than
 * hiding inside this function. Two reasons: every remaining dependence on the
 * cookie is then visible in the action body where a reviewer reads it, and the
 * shipped demo/review ordering contracts in
 * `src/server/tasks-security-regression.test.mjs` assert that `isDemoMode()`
 * precedes tenant resolution in exactly that body. Burying the resolver would
 * make those assertions vacuous without anyone editing them.
 */
export async function authorizeProjectCandidate(input: {
  candidateProjectId: string | null | undefined;
  capability: ProjectCapabilityKey;
  /** Pass a resolved actor to avoid a second identity round-trip. */
  actorUserId?: string;
  archivePolicy?: ArchivePolicy;
}): Promise<ProjectAuthorization> {
  // A missing candidate is a refusal, never a prompt to go looking for one.
  // This is the D-005 site: `getActiveWorkspace()` answers `LEGACY_WORKSPACE_ID`
  // where the fail-closed accessor answers `null`, and `null` must stay a "no".
  if (input.candidateProjectId === null || input.candidateProjectId === undefined) {
    return { ok: false, reason: "no-active-project" };
  }
  const candidate = parseProjectId(input.candidateProjectId);
  if (candidate === null) return { ok: false, reason: "malformed-project" };

  const actorUserId = input.actorUserId ?? (await getCurrentUser());
  return proveProjectCapability(
    actorUserId,
    candidate,
    input.capability,
    input.archivePolicy,
  );
}

/**
 * ADR 0001 §9, **object operation**: authorize the Project the target object
 * already lives in.
 *
 * The caller has read its object by primary key and pulled `workspace_id` off
 * the row. That value is not user input and needs no shape gate for trust —
 * but it is still put through the full membership and capability proof, since
 * "the row exists" says nothing about who may change it.
 *
 * **No expected-Project comparison is enforced here, on purpose.** ADR 0001 §9
 * allows one "to detect stale UI", and the obvious candidate — the ambient
 * cookie — is precisely the stale value WP3 is removing from the decision.
 * Re-admitting it as a veto would reinstate the silent wrong-Project refusal
 * this work exists to delete. When a route can supply an expected Project from
 * the URL, that is the value worth comparing, and it belongs to the routes
 * lane.
 */
export async function authorizeStoredProject(input: {
  storedProjectId: string;
  capability: ProjectCapabilityKey;
  actorUserId?: string;
  archivePolicy?: ArchivePolicy;
}): Promise<ProjectAuthorization> {
  const actorUserId = input.actorUserId ?? (await getCurrentUser());
  if (!isProjectId(input.storedProjectId)) {
    return { ok: false, reason: "malformed-project" };
  }
  return proveProjectCapability(
    actorUserId,
    input.storedProjectId,
    input.capability,
    input.archivePolicy,
  );
}

/**
 * Scoped-read convenience: prove `open` on a candidate Project and hand back
 * the proved id, or `null`.
 *
 * The `null` matters. A read that cannot prove its Project must return its own
 * empty value *because it was refused*, and never by running a query whose
 * `WHERE` happens to match nothing — those two are indistinguishable to
 * everything downstream, and the second is how an unauthorized read becomes an
 * authorized zero.
 */
export async function readableProjectOrNull(
  candidateProjectId: string | null | undefined,
  actorUserId?: string,
): Promise<ProjectId | null> {
  const grant = await authorizeProjectCandidate({
    candidateProjectId,
    capability: "open",
    actorUserId,
  });
  return grant.ok ? grant.projectId : null;
}
