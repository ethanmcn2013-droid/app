import "server-only";

import { and, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import {
  providerConnections,
  workspaceMembers,
  workspaceStorage,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";

type MemberRoleDb = LibSQLDatabase<typeof schema>;

export class ProjectDriveMemberRoleError extends Error {
  readonly code: "last-owner" | "storage-handover-required";

  constructor(code: ProjectDriveMemberRoleError["code"]) {
    super(
      code === "last-owner"
        ? "Demote a different owner first, one must remain."
        : "Hand over this board’s Drive storage before changing this member’s role.",
    );
    this.name = "ProjectDriveMemberRoleError";
    this.code = code;
  }
}

function canonicalId(value: string, field: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new TypeError(`${field} must be a canonical id`);
  }
  return value;
}

/**
 * Change a Project role while preserving both ownership invariants.
 *
 * The live Drive storage owner must remain an owner until an explicit storage
 * handover succeeds. The storage-owner proof, final-owner count, and role
 * mutation share one immediate writer transaction so concurrent demotions
 * cannot each authorize against stale state.
 */
export async function setProjectDriveMemberRole(
  database: MemberRoleDb,
  input: Readonly<{
    workspaceId: string;
    memberUserId: string;
    role: "owner" | "member";
  }>,
): Promise<Readonly<{ changed: boolean }>> {
  const workspaceId = canonicalId(input.workspaceId, "workspaceId");
  const memberUserId = canonicalId(input.memberUserId, "memberUserId");
  if (input.role !== "owner" && input.role !== "member") {
    throw new TypeError("role must be owner or member");
  }

  return database.transaction(
    async (transaction) => {
      if (input.role === "member") {
        const currentStorageOwnedByTarget = await transaction
          .select({ id: workspaceStorage.id })
          .from(workspaceStorage)
          .innerJoin(
            providerConnections,
            eq(providerConnections.id, workspaceStorage.connectionId),
          )
          .where(
            and(
              eq(workspaceStorage.workspaceId, workspaceId),
              eq(workspaceStorage.isCurrent, true),
              eq(providerConnections.userId, memberUserId),
            ),
          )
          .limit(1);
        if (currentStorageOwnedByTarget.length > 0) {
          throw new ProjectDriveMemberRoleError(
            "storage-handover-required",
          );
        }

        const owners = await transaction
          .select({ userId: workspaceMembers.userId })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspaceId),
              eq(workspaceMembers.role, "owner"),
            ),
          )
          .limit(2);
        if (owners.length === 1 && owners[0]?.userId === memberUserId) {
          throw new ProjectDriveMemberRoleError("last-owner");
        }
      }

      const changed = await transaction
        .update(workspaceMembers)
        .set({ role: input.role })
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.userId, memberUserId),
          ),
        )
        .returning({ userId: workspaceMembers.userId });
      return Object.freeze({ changed: changed.length === 1 });
    },
    { behavior: "immediate" },
  );
}
