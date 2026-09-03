import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import {
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
  prepareCurrentMemberDriveGrantIntent,
  ProjectDriveMembershipLifecycleError,
} from "./project-drive-membership-lifecycle";
import { googleDriveAccountErasureFenceKey } from "./project-drive-operation-lifecycle";

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
