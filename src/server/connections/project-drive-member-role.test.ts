import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { workspaceMembers, workspaceStorage } from "@/server/db/schema";
import {
  freshProjectDriveCoreDb,
  seedProjectDriveCore,
  seedStorageGenerations,
} from "./project-drive-core.test.helpers";
import {
  ProjectDriveMemberRoleError,
  setProjectDriveMemberRole,
} from "./project-drive-member-role";

async function fixture() {
  const seeded = await freshProjectDriveCoreDb();
  await seedProjectDriveCore(seeded.client);
  await seedStorageGenerations(seeded.client);
  return seeded;
}

async function roleOf(
  seeded: Awaited<ReturnType<typeof fixture>>,
  userId: string,
) {
  const [membership] = await seeded.db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, "ws-a"),
        eq(workspaceMembers.userId, userId),
      ),
    );
  return membership?.role;
}

function expectRoleError(code: ProjectDriveMemberRoleError["code"]) {
  return (error: unknown) =>
    error instanceof ProjectDriveMemberRoleError && error.code === code;
}

describe("Project Drive member roles", () => {
  it("blocks demoting the current storage owner until handover", async () => {
    const seeded = await fixture();
    try {
      await seeded.db
        .update(workspaceMembers)
        .set({ role: "owner" })
        .where(eq(workspaceMembers.userId, "member-b"));
      await assert.rejects(
        setProjectDriveMemberRole(seeded.db, {
          workspaceId: "ws-a",
          memberUserId: "owner",
          role: "member",
        }),
        expectRoleError("storage-handover-required"),
      );
      assert.equal(await roleOf(seeded, "owner"), "owner");
    } finally {
      seeded.cleanup();
    }
  });

  it("blocks demoting the last owner inside the writer transaction", async () => {
    const seeded = await fixture();
    try {
      await seeded.db
        .delete(workspaceStorage)
        .where(eq(workspaceStorage.workspaceId, "ws-a"));
      await assert.rejects(
        setProjectDriveMemberRole(seeded.db, {
          workspaceId: "ws-a",
          memberUserId: "owner",
          role: "member",
        }),
        expectRoleError("last-owner"),
      );
      assert.equal(await roleOf(seeded, "owner"), "owner");
    } finally {
      seeded.cleanup();
    }
  });

  it("demotes a non-storage co-owner while another owner remains", async () => {
    const seeded = await fixture();
    try {
      await seeded.db
        .update(workspaceMembers)
        .set({ role: "owner" })
        .where(eq(workspaceMembers.userId, "member-a"));
      assert.deepEqual(
        await setProjectDriveMemberRole(seeded.db, {
          workspaceId: "ws-a",
          memberUserId: "member-a",
          role: "member",
        }),
        { changed: true },
      );
      assert.equal(await roleOf(seeded, "member-a"), "member");
      assert.equal(await roleOf(seeded, "owner"), "owner");
    } finally {
      seeded.cleanup();
    }
  });

  it("promotes an existing member without changing storage ownership", async () => {
    const seeded = await fixture();
    try {
      assert.deepEqual(
        await setProjectDriveMemberRole(seeded.db, {
          workspaceId: "ws-a",
          memberUserId: "member-a",
          role: "owner",
        }),
        { changed: true },
      );
      assert.equal(await roleOf(seeded, "member-a"), "owner");
    } finally {
      seeded.cleanup();
    }
  });

  it("rejects a forged role before opening a writer transaction", async () => {
    const seeded = await fixture();
    try {
      await assert.rejects(
        setProjectDriveMemberRole(seeded.db, {
          workspaceId: "ws-a",
          memberUserId: "member-a",
          role: "administrator",
        } as never),
        /role must be owner or member/,
      );
      assert.equal(await roleOf(seeded, "member-a"), "member");
    } finally {
      seeded.cleanup();
    }
  });
});
