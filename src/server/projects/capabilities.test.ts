import { test } from "node:test";
import assert from "node:assert/strict";
import {
  projectCapabilities,
  resolveProjectRole,
} from "@/server/projects/capabilities";

test("role is derived from membership and workspace ownership, never inferred", () => {
  assert.equal(
    resolveProjectRole({
      membershipRole: "owner",
      workspaceOwnerUserId: "me",
      actorUserId: "me",
    }),
    "primary-owner",
  );
  assert.equal(
    resolveProjectRole({
      membershipRole: "owner",
      workspaceOwnerUserId: "other",
      actorUserId: "me",
    }),
    "owner",
  );
  assert.equal(
    resolveProjectRole({
      membershipRole: "member",
      workspaceOwnerUserId: "me",
      actorUserId: "me",
    }),
    "member",
    "a member row is a member, even on a workspace whose owner column names you",
  );
  assert.equal(
    resolveProjectRole({
      membershipRole: "owner",
      workspaceOwnerUserId: null,
      actorUserId: "me",
    }),
    "owner",
    "a null owner column proves nothing and must not promote anybody",
  );
});

test("the capability table matches plan §5", () => {
  const primary = projectCapabilities({
    role: "primary-owner",
    archived: false,
    ownsPlanningPeriod: true,
  });
  const coOwner = projectCapabilities({
    role: "owner",
    archived: false,
    ownsPlanningPeriod: false,
  });
  const member = projectCapabilities({
    role: "member",
    archived: false,
    ownsPlanningPeriod: false,
  });

  for (const capabilities of [primary, coOwner, member]) {
    assert.equal(capabilities.open, true);
    assert.equal(capabilities.viewPrivateTimeline, true);
    assert.equal(capabilities.createOrEditTasks, true);
  }

  assert.equal(primary.manageProject, true);
  assert.equal(coOwner.manageProject, true);
  assert.equal(member.manageProject, false);

  assert.equal(primary.curatePrimaryTimeline, true);
  assert.equal(coOwner.curatePrimaryTimeline, true);
  assert.equal(member.curatePrimaryTimeline, false);

  // Permanent delete and ownership transfer stay primary-owner only.
  assert.equal(primary.deleteOrTransferOwnership, true);
  assert.equal(coOwner.deleteOrTransferOwnership, false);
  assert.equal(member.deleteOrTransferOwnership, false);
});

test("a co-owner may only move a Project into a Planning Period they own", () => {
  assert.equal(
    projectCapabilities({ role: "owner", archived: false, ownsPlanningPeriod: false })
      .moveIntoPlanningPeriod,
    false,
  );
  assert.equal(
    projectCapabilities({ role: "owner", archived: false, ownsPlanningPeriod: true })
      .moveIntoPlanningPeriod,
    true,
  );
});

test("archiving narrows capabilities and never widens them", () => {
  const roles = ["primary-owner", "owner", "member"] as const;
  for (const role of roles) {
    const live = projectCapabilities({ role, archived: false, ownsPlanningPeriod: true });
    const archived = projectCapabilities({ role, archived: true, ownsPlanningPeriod: true });
    for (const key of Object.keys(live) as Array<keyof typeof live>) {
      if (archived[key]) {
        assert.equal(live[key], true, `${role}.${key} was granted only when archived`);
      }
    }
    // Archive prohibits new association and outward publishing.
    assert.equal(archived.createOrEditTasks, false);
    assert.equal(archived.publishOrRevokeTimeline, false);
    assert.equal(archived.moveIntoPlanningPeriod, false);
    // It stays openable and readable.
    assert.equal(archived.open, true);
    assert.equal(archived.viewPrivateTimeline, true);
  }
});
