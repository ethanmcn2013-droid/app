import test from "node:test";
import assert from "node:assert/strict";
import { projectDriveAccessPeople, readProjectDriveUiStatus } from "./project-drive-ui-status";
import { coreAuthorization, freshProjectDriveCoreDb, seedProjectDriveCore, seedStorageGenerations } from "./project-drive-core.test.helpers";
import type { LiveDrivePermission } from "./drive-grants";

function permission(overrides: Partial<LiveDrivePermission> = {}): LiveDrivePermission {
  return { permissionId: "secret-permission-id", type: "user", role: "writer", emailAddress: "member.a@example.com", displayName: "Google name", deleted: false, source: "signal-grant", signalUserId: "member-a", ...overrides };
}
test("only Google's current named-user email and role prove access", () => {
  const members = [{ name: "A", email: " Member.A@Example.com " }, { name: "B", email: "member.b@example.com" }, { name: "Unknown", email: null }];
  const result = projectDriveAccessPeople(members, [permission(), permission({ type: "domain", emailAddress: "member.b@example.com" }), permission({ deleted: true, emailAddress: "member.b@example.com" })]);
  assert.deepEqual(result.people.map(p => p.access), ["writer", "unconfirmed", "unconfirmed"]);
  assert.equal(result.otherPermissionCount, 1);
  assert.doesNotMatch(JSON.stringify(result), /secret-permission|signalUserId|Google name/);
  const changedEmail = projectDriveAccessPeople([{ name: "A", email: "new@example.com" }], [permission()]);
  assert.equal(changedEmail.people[0].access, "unconfirmed");
});
test("an empty live list never becomes complete membership coverage", () => {
  assert.equal(projectDriveAccessPeople([{ name: "Owner", email: "owner@example.com" }], []).people[0].access, "unconfirmed");
});
test("status is project scoped, sanitized, race aware and fails closed on provider errors", async () => {
  const fixture = await freshProjectDriveCoreDb();
  try {
    await seedProjectDriveCore(fixture.client); await seedStorageGenerations(fixture.client);
    const auth = coreAuthorization("owner", "ws-a");
    const deps = {
      database: fixture.db,
      connection: async () => ({ connected: true, accountEmail: "owner@example.com", status: "active" as const, connectedAt: "private-time", rootFolderUrl: "secret-root", projectUsesThisAccount: true, affectedProjectCount: 1 }),
      permissions: async () => [permission()], now: () => new Date("2026-09-04T12:00:00.000Z"),
    };
    const result = await readProjectDriveUiStatus(auth, deps);
    assert.equal(result.access.state, "checked");
    assert.equal(result.access.checkedAt, "2026-09-04T12:00:00.000Z");
    assert.equal(result.access.people.length, 3);
    assert.doesNotMatch(JSON.stringify(result), /outsider|outside@example|secret-root|secret-permission|private-time|conn-old|refresh|cipher/i);
    assert.equal(result.folderUrl, null, "untrusted fixture URL is omitted");
    const failed = await readProjectDriveUiStatus(auth, { ...deps, permissions: async () => { throw Error("raw token secret"); } });
    assert.equal(failed.access.state, "unavailable"); assert.equal(failed.access.checkedAt, null); assert.deepEqual(failed.access.people, []);
    assert.doesNotMatch(JSON.stringify(failed), /raw token/);
    const raced = await readProjectDriveUiStatus(auth, { ...deps, permissions: async () => {
      await fixture.client.execute("UPDATE users SET email = 'changed@example.com' WHERE id = 'member-a'");
      return [permission()];
    } });
    assert.equal(raced.access.state, "unavailable");
    let calls = 0;
    await assert.rejects(readProjectDriveUiStatus(coreAuthorization("member-a", "ws-a", false), { ...deps, permissions: async () => { calls++; return []; } }));
    assert.equal(calls, 0);
  } finally { fixture.cleanup(); }
});
