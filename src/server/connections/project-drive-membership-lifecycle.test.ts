import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import {
  driveFolderGrants,
  meta,
  projectDriveOperations,
  users,
  workspaceMembers,
} from "@/server/db/schema";
import {
  freshProjectDriveCoreDb,
  seedProjectDriveCore,
  seedStorageGenerations,
} from "./project-drive-core.test.helpers";
import {
  prepareExistingMemberDriveGrantIntents,
  prepareCurrentMemberDriveGrantIntent,
  ProjectDriveMembershipLifecycleError,
} from "./project-drive-membership-lifecycle";
import { googleDriveAccountErasureFenceKey } from "./project-drive-operation-lifecycle";
import { createProjectDriveOperationJournal } from "./project-drive-operation-journal";

async function seededInvitee() {
  const fixture = await freshProjectDriveCoreDb();
  await seedProjectDriveCore(fixture.client);
  await seedStorageGenerations(fixture.client);
  await fixture.db.insert(users).values({
    id: "invitee",
    clerkId: "clerk-invitee",
    email: "invitee@example.com",
    color: "#555",
    initials: "IN",
  });
  return fixture;
}

describe("Project Drive membership lifecycle", () => {
  it("prepares existing-member intents and reports missing current emails without removing members", async () => {
    const { db, cleanup } = await seededInvitee();
    try {
      await db
        .update(users)
        .set({ email: null })
        .where(eq(users.id, "member-b"));
      const first = await db.transaction(
        (tx) =>
          prepareExistingMemberDriveGrantIntents(
            tx,
            {
              workspaceId: "ws-a",
              storageGenerationId: "gen-current",
            },
            { randomOperationId: () => "op-existing-member" },
          ),
        { behavior: "immediate" },
      );
      assert.deepEqual(first, {
        memberCount: 2,
        grantIntentCount: 1,
        createdIntentCount: 1,
        coverageGapCount: 1,
      });
      const second = await db.transaction(
        (tx) =>
          prepareExistingMemberDriveGrantIntents(tx, {
            workspaceId: "ws-a",
            storageGenerationId: "gen-current",
          }),
        { behavior: "immediate" },
      );
      assert.deepEqual(second, {
        memberCount: 2,
        grantIntentCount: 1,
        createdIntentCount: 0,
        coverageGapCount: 1,
      });
      assert.equal(
        (
          await db
            .select()
            .from(workspaceMembers)
            .where(eq(workspaceMembers.workspaceId, "ws-a"))
        ).length,
        3,
      );
      const [operation] = await db
        .select()
        .from(projectDriveOperations)
        .where(eq(projectDriveOperations.id, "op-existing-member"));
      assert.equal(operation.subjectUserId, "member-a");
      assert.equal(operation.granteeEmail, "member.a@example.com");
      assert.equal(operation.grantRole, "writer");
    } finally {
      cleanup();
    }
  });

  it("commits a membership and its exact current-generation grant intent atomically", async () => {
    const { db, cleanup } = await seededInvitee();
    try {
      const result = await db.transaction(
        async (tx) => {
          await tx.insert(workspaceMembers).values({
            workspaceId: "ws-a",
            userId: "invitee",
            role: "member",
          });
          return prepareCurrentMemberDriveGrantIntent(
            tx,
            {
              workspaceId: "ws-a",
              memberUserId: "invitee",
              verifiedEmail: "Invitee@Example.com",
            },
            { randomOperationId: () => "op-invitee" },
          );
        },
        { behavior: "immediate" },
      );
      assert.equal(result.kind, "grant-intent");
      if (result.kind !== "grant-intent") throw new Error("unreachable");
      assert.equal(result.created, true);

      const [operation] = await db
        .select()
        .from(projectDriveOperations)
        .where(eq(projectDriveOperations.id, "op-invitee"));
      assert.equal(operation?.workspaceId, "ws-a");
      assert.equal(operation?.storageGenerationId, "gen-current");
      assert.equal(operation?.subjectUserId, "invitee");
      assert.equal(operation?.granteeEmail, "invitee@example.com");
      assert.equal(operation?.grantRole, "writer");
      assert.equal(operation?.status, "pending");
    } finally {
      cleanup();
    }
  });

  it("rolls the membership back when its Drive intent cannot be made exact", async () => {
    const { db, cleanup } = await seededInvitee();
    try {
      await assert.rejects(
        db.transaction(
          async (tx) => {
            await tx.insert(workspaceMembers).values({
              workspaceId: "ws-a",
              userId: "invitee",
              role: "member",
            });
            await prepareCurrentMemberDriveGrantIntent(tx, {
              workspaceId: "ws-a",
              memberUserId: "invitee",
              verifiedEmail: "different@example.com",
            });
          },
          { behavior: "immediate" },
        ),
        (error: unknown) =>
          error instanceof ProjectDriveMembershipLifecycleError &&
          error.code === "member-email-mismatch",
      );
      assert.equal(
        (
          await db
            .select()
            .from(workspaceMembers)
            .where(eq(workspaceMembers.userId, "invitee"))
        ).length,
        0,
      );
      assert.equal((await db.select().from(projectDriveOperations)).length, 0);
    } finally {
      cleanup();
    }
  });

  it("does not create a named-user grant for the storage owner", async () => {
    const { db, cleanup } = await seededInvitee();
    try {
      const result = await db.transaction(
        (tx) =>
          prepareCurrentMemberDriveGrantIntent(tx, {
            workspaceId: "ws-a",
            memberUserId: "owner",
            verifiedEmail: "owner@example.com",
          }),
        { behavior: "immediate" },
      );
      assert.deepEqual(result, { kind: "storage-owner" });
      assert.equal((await db.select().from(projectDriveOperations)).length, 0);
    } finally {
      cleanup();
    }
  });

  it("is idempotent for the same member, generation, email and role", async () => {
    const { db, cleanup } = await seededInvitee();
    try {
      await db.insert(workspaceMembers).values({
        workspaceId: "ws-a",
        userId: "invitee",
        role: "member",
      });
      const run = (operationId: string) =>
        db.transaction(
          (tx) =>
            prepareCurrentMemberDriveGrantIntent(
              tx,
              {
                workspaceId: "ws-a",
                memberUserId: "invitee",
                verifiedEmail: "invitee@example.com",
              },
              { randomOperationId: () => operationId },
            ),
          { behavior: "immediate" },
        );
      const first = await run("op-first");
      const second = await run("op-never-inserted");
      assert.equal(first.kind === "grant-intent" && first.created, true);
      assert.equal(second.kind === "grant-intent" && second.created, false);
      assert.equal((await db.select().from(projectDriveOperations)).length, 1);
    } finally {
      cleanup();
    }
  });

  it("restarts an untouched grant intent when a removed member is added again", async () => {
    const { db, cleanup } = await seededInvitee();
    try {
      await db.insert(workspaceMembers).values({
        workspaceId: "ws-a",
        userId: "invitee",
        role: "member",
      });
      const first = await db.transaction(
        (tx) =>
          prepareCurrentMemberDriveGrantIntent(
            tx,
            {
              workspaceId: "ws-a",
              memberUserId: "invitee",
              verifiedEmail: "invitee@example.com",
            },
            { randomOperationId: () => "op-first-cycle" },
          ),
        { behavior: "immediate" },
      );
      assert.equal(first.kind, "grant-intent");
      if (first.kind !== "grant-intent") throw new Error("unreachable");
      const journal = createProjectDriveOperationJournal({ database: db });
      await journal.cancelUnstarted({
        workspaceId: "ws-a",
        operationId: first.operation.operationId,
      });
      await db
        .delete(workspaceMembers)
        .where(eq(workspaceMembers.userId, "invitee"));

      const second = await db.transaction(
        async (tx) => {
          await tx.insert(workspaceMembers).values({
            workspaceId: "ws-a",
            userId: "invitee",
            role: "member",
          });
          return prepareCurrentMemberDriveGrantIntent(
            tx,
            {
              workspaceId: "ws-a",
              memberUserId: "invitee",
              verifiedEmail: "invitee@example.com",
            },
            { randomOperationId: () => "op-second-cycle" },
          );
        },
        { behavior: "immediate" },
      );
      assert.equal(second.kind, "grant-intent");
      if (second.kind !== "grant-intent") throw new Error("unreachable");
      assert.equal(second.created, true);
      assert.equal(second.operation.operationId, "op-second-cycle");
      assert.equal(second.operation.status, "pending");
      assert.equal(
        (
          await db
            .select()
            .from(projectDriveOperations)
            .where(eq(projectDriveOperations.id, "op-first-cycle"))
        ).length,
        0,
      );
    } finally {
      cleanup();
    }
  });

  it("rearms a succeeded grant only after its exact local receipt was removed", async () => {
    const { db, cleanup } = await seededInvitee();
    try {
      await db.insert(workspaceMembers).values({
        workspaceId: "ws-a",
        userId: "invitee",
        role: "member",
      });
      const first = await db.transaction(
        (tx) =>
          prepareCurrentMemberDriveGrantIntent(
            tx,
            {
              workspaceId: "ws-a",
              memberUserId: "invitee",
              verifiedEmail: "invitee@example.com",
            },
            { randomOperationId: () => "op-succeeded-cycle" },
          ),
        { behavior: "immediate" },
      );
      assert.equal(first.kind, "grant-intent");
      if (first.kind !== "grant-intent") throw new Error("unreachable");
      const journal = createProjectDriveOperationJournal({ database: db });
      const claim = await journal.claim({
        workspaceId: "ws-a",
        operationId: first.operation.operationId,
      });
      assert.equal(claim.outcome, "claimed");
      if (claim.outcome !== "claimed") throw new Error("unreachable");
      await db.transaction(async (tx) => {
        const transactionalJournal = createProjectDriveOperationJournal({
          database: tx,
        });
        await transactionalJournal.complete({
          workspaceId: "ws-a",
          operationId: first.operation.operationId,
          attemptFence: claim.claim.attemptFence,
          operationKind: "grant_create",
          receipt: { providerPermissionId: "permission-invitee" },
        });
        await tx.insert(driveFolderGrants).values({
          storageGenerationId: "gen-current",
          workspaceId: "ws-a",
          userId: "invitee",
          permissionId: "permission-invitee",
          grantedEmail: "invitee@example.com",
          role: "writer",
          grantedAt: new Date(),
          revokePending: false,
        });
      });

      const activeReplay = await db.transaction(
        (tx) =>
          prepareCurrentMemberDriveGrantIntent(tx, {
            workspaceId: "ws-a",
            memberUserId: "invitee",
            verifiedEmail: "invitee@example.com",
          }),
        { behavior: "immediate" },
      );
      assert.equal(
        activeReplay.kind === "grant-intent" && activeReplay.created,
        false,
      );

      await db.transaction(async (tx) => {
        await tx
          .delete(driveFolderGrants)
          .where(eq(driveFolderGrants.userId, "invitee"));
        await tx
          .delete(workspaceMembers)
          .where(eq(workspaceMembers.userId, "invitee"));
      });
      const nextCycle = await db.transaction(
        async (tx) => {
          await tx.insert(workspaceMembers).values({
            workspaceId: "ws-a",
            userId: "invitee",
            role: "member",
          });
          return prepareCurrentMemberDriveGrantIntent(
            tx,
            {
              workspaceId: "ws-a",
              memberUserId: "invitee",
              verifiedEmail: "invitee@example.com",
            },
            { randomOperationId: () => "op-rearmed-cycle" },
          );
        },
        { behavior: "immediate" },
      );
      assert.equal(nextCycle.kind, "grant-intent");
      if (nextCycle.kind !== "grant-intent") throw new Error("unreachable");
      assert.equal(nextCycle.created, true);
      assert.equal(nextCycle.operation.operationId, "op-rearmed-cycle");
      assert.equal(nextCycle.operation.status, "pending");
      assert.equal(nextCycle.operation.receipt, null);
    } finally {
      cleanup();
    }
  });

  it("rolls back re-entry while an old exact grant still awaits revocation", async () => {
    const { db, cleanup } = await seededInvitee();
    try {
      await db.insert(workspaceMembers).values({
        workspaceId: "ws-a",
        userId: "invitee",
        role: "member",
      });
      const intent = await db.transaction(
        (tx) =>
          prepareCurrentMemberDriveGrantIntent(
            tx,
            {
              workspaceId: "ws-a",
              memberUserId: "invitee",
              verifiedEmail: "invitee@example.com",
            },
            { randomOperationId: () => "op-revoke-pending" },
          ),
        { behavior: "immediate" },
      );
      assert.equal(intent.kind, "grant-intent");
      if (intent.kind !== "grant-intent") throw new Error("unreachable");
      const journal = createProjectDriveOperationJournal({ database: db });
      const claim = await journal.claim({
        workspaceId: "ws-a",
        operationId: intent.operation.operationId,
      });
      assert.equal(claim.outcome, "claimed");
      if (claim.outcome !== "claimed") throw new Error("unreachable");
      await journal.complete({
        workspaceId: "ws-a",
        operationId: intent.operation.operationId,
        attemptFence: claim.claim.attemptFence,
        operationKind: "grant_create",
        receipt: { providerPermissionId: "permission-revoke-pending" },
      });
      await db.insert(driveFolderGrants).values({
        storageGenerationId: "gen-current",
        workspaceId: "ws-a",
        userId: "invitee",
        permissionId: "permission-revoke-pending",
        grantedEmail: "invitee@example.com",
        role: "writer",
        grantedAt: new Date(),
        revokePending: true,
      });
      await db
        .delete(workspaceMembers)
        .where(eq(workspaceMembers.userId, "invitee"));

      await assert.rejects(
        db.transaction(
          async (tx) => {
            await tx.insert(workspaceMembers).values({
              workspaceId: "ws-a",
              userId: "invitee",
              role: "member",
            });
            await prepareCurrentMemberDriveGrantIntent(tx, {
              workspaceId: "ws-a",
              memberUserId: "invitee",
              verifiedEmail: "invitee@example.com",
            });
          },
          { behavior: "immediate" },
        ),
        (error: unknown) =>
          error instanceof ProjectDriveMembershipLifecycleError &&
          error.code === "operation-conflict",
      );
      assert.equal(
        (
          await db
            .select()
            .from(workspaceMembers)
            .where(eq(workspaceMembers.userId, "invitee"))
        ).length,
        0,
      );
    } finally {
      cleanup();
    }
  });

  for (const fencedUserId of ["invitee", "owner"] as const) {
    it(`refuses atomically while the ${fencedUserId} account is being erased`, async () => {
      const { db, cleanup } = await seededInvitee();
      try {
        await db.insert(meta).values({
          key: googleDriveAccountErasureFenceKey(fencedUserId),
          value: "active:v1",
        });
        await assert.rejects(
          db.transaction(
            async (tx) => {
              await tx.insert(workspaceMembers).values({
                workspaceId: "ws-a",
                userId: "invitee",
                role: "member",
              });
              await prepareCurrentMemberDriveGrantIntent(tx, {
                workspaceId: "ws-a",
                memberUserId: "invitee",
                verifiedEmail: "invitee@example.com",
              });
            },
            { behavior: "immediate" },
          ),
          (error: unknown) =>
            error instanceof ProjectDriveMembershipLifecycleError &&
            error.code === "account-erasure-in-progress",
        );
        assert.equal(
          (
            await db
              .select()
              .from(workspaceMembers)
              .where(eq(workspaceMembers.userId, "invitee"))
          ).length,
          0,
        );
        assert.equal((await db.select().from(projectDriveOperations)).length, 0);
      } finally {
        cleanup();
      }
    });
  }
});
