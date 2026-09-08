import assert from "node:assert/strict";
import { coreAuthorization, freshProjectDriveCoreDb, seedProjectDriveCore, seedStorageGenerations } from "../../src/server/connections/project-drive-core.test.helpers";
import { readProjectDriveUiStatus } from "../../src/server/connections/project-drive-ui-status";
import type { LiveDrivePermission } from "../../src/server/connections/drive-grants";

/** Synthetic receipt states. No provider, identity service or default store. */
export const removalCases = [
  { name: "none", current: 0, previous: 0 },
  { name: "current", current: 1, previous: 0 },
  { name: "previous", current: 0, previous: 1 },
  { name: "both", current: 2, previous: 1 },
  { name: "unavailable-current", current: 1, previous: 0 },
  { name: "unavailable-both", current: 2, previous: 1 },
  { name: "stale-email", current: 1, previous: 0 },
  { name: "removed-member", current: 1, previous: 0 },
  { name: "other-project", current: 0, previous: 0 },
  { name: "non-pending", current: 0, previous: 0 },
  { name: "invalid-generation", current: 0, previous: 0 },
  { name: "orphan-generation", current: 0, previous: 0 },
  { name: "previous-no-current", current: 0, previous: 2 },
  { name: "appears-during-failed-live-read", current: 1, previous: 0 },
  { name: "cleared-during-live-read", current: 0, previous: 0 },
  { name: "retired-during-live-read", current: 0, previous: 1 },
] as const;

export async function removalScenario(name: string) {
  const f = await freshProjectDriveCoreDb();
  try {
    await seedProjectDriveCore(f.client);
    await seedStorageGenerations(f.client);
    await f.client.execute("UPDATE users SET name='Orla Synthetic Owner' WHERE id='owner'");
    const corrupt = name === "invalid-generation" || name === "orphan-generation";
    if (!corrupt) await f.client.execute("PRAGMA foreign_keys=ON");
    const grant = (generation: string, workspace = "ws-a", member = "member-a", pending = 1) => f.client.execute({
      sql: "INSERT INTO drive_folder_grants (workspace_id,storage_generation_id,user_id,permission_id,granted_email,role,revoke_pending,granted_at) VALUES (?,?,?,?,?,'writer',?,100)",
      args: [workspace, generation, member, "private-permission-" + generation + member, "stale-private@example.test", pending],
    });
    if (["current", "both", "unavailable-current", "unavailable-both", "stale-email", "removed-member", "cleared-during-live-read", "retired-during-live-read", "previous-no-current"].includes(name)) await grant("gen-current");
    if (["previous", "both", "unavailable-both", "previous-no-current"].includes(name)) await grant("gen-old");
    if (name === "both" || name === "unavailable-both") await grant("gen-current", "ws-a", "member-b");
    if (name === "other-project") await grant("gen-other", "ws-b", "outsider");
    if (name === "non-pending") await grant("gen-current", "ws-a", "member-a", 0);
    if (name === "invalid-generation") await grant("gen-other");
    if (name === "orphan-generation") await grant("generation-not-in-storage");
    if (name === "stale-email") await f.client.execute("UPDATE users SET email='new-address@example.test' WHERE id='member-a'");
    if (name === "removed-member") await f.client.execute("DELETE FROM workspace_members WHERE workspace_id='ws-a' AND user_id='member-a'");
    if (name === "previous-no-current") await f.client.execute("UPDATE workspace_storage SET is_current=0 WHERE id='gen-current'");
    let transitioned = false;
    const permissions = async (): Promise<readonly LiveDrivePermission[]> => {
      if (!transitioned) {
        transitioned = true;
        if (name === "appears-during-failed-live-read") await grant("gen-current");
        if (name === "cleared-during-live-read") await f.client.execute("DELETE FROM drive_folder_grants WHERE workspace_id='ws-a'");
        if (name === "retired-during-live-read") await f.client.execute("UPDATE workspace_storage SET is_current=0 WHERE id='gen-current'");
      }
      if (name.startsWith("unavailable") || name === "appears-during-failed-live-read") throw Error("Synthetic live-read failure");
      return [{ permissionId: "live-private-id", type: "user", role: "writer", emailAddress: "Member.A@Example.com", displayName: "Private provider name", deleted: false, source: "external", signalUserId: null }];
    };
    const deps = {
      database: f.db,
      connection: async () => ({ connected: true, accountEmail: "owner@example.com", status: "active" as const, connectedAt: "private-connected-time", rootFolderUrl: "private-root", projectUsesThisAccount: true, affectedProjectCount: 1 }),
      permissions,
      now: () => new Date("2026-09-05T11:00:00.000Z"),
    };
    const read = () => readProjectDriveUiStatus(coreAuthorization("owner", "ws-a"), deps);
    const status = await read();
    assert.equal((await f.client.execute("PRAGMA integrity_check")).rows[0].integrity_check, "ok");
    if (!corrupt) assert.equal((await f.client.execute("PRAGMA foreign_key_check")).rows.length, 0);
    return { ...f, status, read, deps, foreignKeys: !corrupt };
  } catch (error) { f.cleanup(); throw error; }
}
