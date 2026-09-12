import assert from "node:assert/strict";
import test from "node:test";
import { conversationPolicy, type AuthorizationSnapshot } from "./authorization-contract";
import { normalizeMessageBody, pairIdentity, validMessageBody, validRequestId } from "../../lib/conversations/contracts";
import { parseProjectId } from "../../lib/projects/project-ref";

const member: AuthorizationSnapshot = {
  actorId: "alice", requestedProjectId: "project-a", storedProjectId: "project-a",
  projectExists: true, actorActive: true, currentProjectMember: true, archived: false,
  kind: "project", audienceEpoch: 4, expectedAudienceEpoch: 4, pairUserIds: [], pairState: null, actorRetainsHistory: true, bothPairMembersCurrent: true,
};
const dm: AuthorizationSnapshot = { ...member, kind: "dm", pairUserIds: ["alice", "bob"], pairState: "active" };

test("fresh member may read and write; empty history does not encode refusal", () => {
  assert.deepEqual(conversationPolicy(member, "read"), { allowed: true });
  assert.deepEqual(conversationPolicy(member, "write"), { allowed: true });
});

for (const [label, change] of Object.entries({
  "direct SQL removal / stale session": { currentProjectMember: false },
  "account erasure or suspension": { actorActive: false },
  "foreign resource / forged route": { storedProjectId: "project-b" },
  "legacy task without tenant": { storedProjectId: null },
  "deleted project": { projectExists: false },
  "missing authenticated identity": { actorId: "" },
})) {
  test(`${label} refuses read and write without existence disclosure`, () => {
    for (const op of ["read", "write"] as const) assert.deepEqual(conversationPolicy({ ...member, ...change }, op), { allowed: false, reason: "unavailable" });
  });
}

test("archive allows history but forbids send; changing audience invalidates drafts", () => {
  assert.deepEqual(conversationPolicy({ ...member, archived: true }, "read"), { allowed: true });
  assert.deepEqual(conversationPolicy({ ...member, archived: true }, "write"), { allowed: false, reason: "archived" });
  for (const expectedAudienceEpoch of [undefined, 3, 5, NaN]) {
    assert.deepEqual(conversationPolicy({ ...member, expectedAudienceEpoch }, "write"), { allowed: false, reason: "audience_changed" });
  }
});

test("DM consent, third party and departed-history restrictions are independent", () => {
  assert.deepEqual(conversationPolicy(dm, "write"), { allowed: true });
  assert.equal(conversationPolicy({ ...dm, bothPairMembersCurrent: false }, "write").allowed, false);
  for (const pairState of ["pending", "declined"] as const) {
    assert.equal(conversationPolicy({ ...dm, pairState }, "read").allowed, false);
  }
  for (const pairState of ["blocked", "left", "membership_lost", "rejoin_pending"] as const) {
    assert.deepEqual(conversationPolicy({ ...dm, pairState }, "read"), { allowed: true });
    assert.deepEqual(conversationPolicy({ ...dm, pairState }, "write"), { allowed: false, reason: "read_only" });
    assert.equal(conversationPolicy({ ...dm, pairState, actorRetainsHistory: false }, "read").allowed, false);
  }
  for (const pairUserIds of [["bob", "charlie"], ["alice", "bob", "charlie"], ["alice", "alice"]]) {
    assert.deepEqual(conversationPolicy({ ...dm, pairUserIds }, "read"), { allowed: false, reason: "unavailable" });
  }
});

test("immutable DM identity is scoped and collision-free; payload limits cover Unicode", () => {
  const a = parseProjectId("project-a");
  assert.equal(pairIdentity(a, "alice", "bob"), pairIdentity(a, "bob", "alice"));
  assert.notEqual(pairIdentity(a, "alice", "bob"), pairIdentity(parseProjectId("project-b"), "alice", "bob"));
  assert.throws(() => pairIdentity(a, "alice", "alice"));
  assert.ok(validMessageBody("😀".repeat(8_000)));
  assert.equal(normalizeMessageBody(" one\r\ntwo\rthree "), " one\ntwo\nthree ");
  assert.equal(validMessageBody("x".repeat(8_001)), false);
  for (const body of [" ", "\u0000", null, 42]) assert.equal(validMessageBody(body), false);
  assert.ok(validRequestId("request_123456789"));
  assert.equal(validRequestId("new"), false);
});
