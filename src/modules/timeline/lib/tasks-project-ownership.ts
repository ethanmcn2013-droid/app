/**
 * A value that means "the Tasks Project's owner asked for this write".
 *
 * ── WHY THIS EXISTS (DECISIONS.md D-018) ───────────────────────────────────
 * Three functions write the two columns that bind a Tasks Project to a
 * Timeline: `createWorkspace` (with a `suiteWorkspaceId`), `connectSuiteWorkspace`
 * and `bindProjectToTasksWorkspace`. None of them proved anything. Every gate
 * lived in a caller.
 *
 * That is exactly why the same defect had to be found three times, one caller
 * at a time: the resolver's provision path, the resolver's adopt path, and
 * `connectSuiteWorkspaceAction`. Each was a caller that forgot, and each time
 * the fix protected one door while the others stayed open. A fourth caller
 * would have inherited nothing. D-018 states the rule this module implements:
 * *a shield that lives in the caller breaks the moment a second caller
 * appears.* The same reasoning already forced the milestone source to prove
 * membership in its own statement rather than trusting `syncMilestonesAction`.
 *
 * ── WHAT IT IS ─────────────────────────────────────────────────────────────
 * An opaque, branded token. `proveTasksProjectOwnership` is the only function
 * that can produce one, and it produces one only from a membership read that
 * names the actor as the Project's owner. A caller cannot construct it, cannot
 * fake it with an object literal, and cannot borrow one issued for a different
 * Project — the write functions re-check the ids it carries against the ids
 * they are about to write, so the token is evidence rather than a permission
 * flag.
 *
 * It is deliberately pure and lives in `lib/`: the write functions in the
 * database layer need to accept it, and a database module must not import the
 * server module that performs the Tasks read. The membership argument is
 * accepted structurally so `TasksWorkspaceContextResult` can be passed
 * straight in without inverting that dependency.
 */

declare const ownershipProof: unique symbol;

export type TasksProjectOwnership = Readonly<{
  readonly [ownershipProof]: true;
  /** The exact Tasks Project this proof is about. */
  tasksWorkspaceId: string;
  /** The Clerk subject proved to own it. */
  ownerUserId: string;
}>;

/** The shape of a membership read, accepted structurally. */
type MembershipLike = Readonly<{
  kind: "member" | "not-a-member" | "unavailable";
  context?: Readonly<{
    workspaceId: string;
    ownerClerkId: string | null;
  }>;
}>;

/**
 * Mint a proof, or refuse.
 *
 * Every condition here is a refusal that has already been a live defect:
 *
 * - the read must have PROVED membership — "could not reach Tasks" is not a
 *   licence to write, and neither is "not a member";
 * - the proof must be about the Project being asked for, not another one the
 *   caller happens to hold a context for;
 * - the Project must HAVE an owner (`workspaces.owner_user_id` is nullable
 *   from the legacy backfill); missing identity is missing, not permission;
 * - and the actor must BE that owner. A `workspace_members.role` of "owner"
 *   is a capability several people can hold — `setMemberRoleAction` hands it
 *   out — and it is not ownership.
 */
export function proveTasksProjectOwnership(
  actorUserId: string,
  requestedTasksWorkspaceId: string,
  membership: MembershipLike,
): TasksProjectOwnership | null {
  if (membership.kind !== "member") return null;
  const context = membership.context;
  if (!context) return null;

  const requested = requestedTasksWorkspaceId.trim();
  if (!requested || context.workspaceId !== requested) return null;

  if (!actorUserId.trim()) return null;
  if (context.ownerClerkId === null) return null;
  if (context.ownerClerkId !== actorUserId) return null;

  return {
    tasksWorkspaceId: requested,
    ownerUserId: actorUserId,
  } as TasksProjectOwnership;
}

/**
 * Re-check a proof against the exact write it is being used to authorize.
 *
 * The token carries what it proved; the write knows what it is about to do.
 * Comparing them is what stops a proof for Project A authorizing a write to
 * Project B, and it runs inside the write function, so it holds for every
 * caller including ones not written yet.
 */
export function assertOwnershipCovers(
  ownership: TasksProjectOwnership,
  expected: Readonly<{ tasksWorkspaceId: string; ownerUserId?: string }>,
  what: string,
): void {
  if (ownership.tasksWorkspaceId !== expected.tasksWorkspaceId) {
    throw new TypeError(
      `${what}: ownership was proved for a different Signal Tasks project.`,
    );
  }
  if (
    expected.ownerUserId !== undefined &&
    ownership.ownerUserId !== expected.ownerUserId
  ) {
    throw new TypeError(
      `${what}: ownership was proved for a different owner.`,
    );
  }
}
