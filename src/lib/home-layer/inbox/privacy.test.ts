/**
 * InboxEvent · storage privacy, hydration, and the tenancy boundary.
 *
 * Assertions I17–I19 of
 * `docs/projects/home-operating-layer/contracts/INBOX_EVENT.md` §11, §18.
 *
 * THIS FILE IS EXPECTED TO FAIL AT `78021c5` for two different reasons, and
 * both are the deliverable:
 *
 *   1. `./privacy` and `./contract` do not exist, so the import throws.
 *   2. The source-scan test at the bottom has no Inbox source modules to scan.
 *
 * The rule this file encodes is a change from what ships. Today's mention
 * notification payload stores `snippet` AND `taskTitle`
 * (`src/lib/data.ts:686-695`), written from the comment body and the task row
 * at `src/server/actions/comments.ts:142-149`. That copy is never
 * re-authorized, never invalidated when the comment is edited or the task
 * renamed, and never removed when the reader loses access to the Project.
 * The correct precedent is one kind further down the same file: the `nudge`
 * payload is "deliberately id-only — no names or email addresses are stored in
 * the notification row (D-008 privacy rule)" (`src/lib/data.ts:706-711`).
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/inbox/privacy.test.ts
 */

import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  FORBIDDEN_CONTENT_FIELDS,
  STORED_EVENT_FIELDS,
  assertStorable,
  rowDisplay,
} from "./privacy";

const HERE = dirname(fileURLToPath(import.meta.url));

const STORABLE_EVENT = {
  id: "ie-1",
  sourceProduct: "tasks",
  sourceEventId: "tasks:comment-mention:c-0001",
  kind: "mention",
  workspaceId: "ws-orchard",
  actorUserId: "u-ava",
  sourceObjectType: "comment",
  sourceObjectId: "c-0001",
  sourceRevisionAtEmit: "rev-1",
  threadKey: "task:t-42",
  episodeKey: "comment:c-0001",
  occurredAt: 1_786_000_000_000,
  recordedAt: 1_786_000_000_000,
  withdrawnAt: null,
  emitterVersion: 1,
};

// ── I17 · the record cannot hold source content ─────────────────────────────

test("I17 · the stored field list is identifiers, state and time only", () => {
  assert.deepEqual([...STORED_EVENT_FIELDS].sort(), Object.keys(STORABLE_EVENT).sort());
});

test("I17 · a clean record is storable", () => {
  const result = assertStorable(STORABLE_EVENT);
  assert.equal(result.ok, true);
});

test("I17 · every field name that could carry content is forbidden by name", () => {
  for (const field of [
    "snippet",
    "body",
    "extractBody",
    "taskTitle",
    "title",
    "commentBody",
    "preview",
    "excerpt",
    "actorName",
    "actorEmail",
    "email",
    "displayName",
    "avatarUrl",
  ]) {
    assert.ok(
      (FORBIDDEN_CONTENT_FIELDS as readonly string[]).includes(field),
      `${field} must be named in the forbidden list`,
    );
  }
});

test("I17 · the exact shape today's notifications table stores is rejected", () => {
  // `src/lib/data.ts:686-695` — the live mention payload.
  const result = assertStorable({
    ...STORABLE_EVENT,
    snippet: "hey @ben can you look at this",
    taskTitle: "Confirm the florist",
    from: "u-ava",
  });

  assert.equal(result.ok, false);
  const violations = (result as { ok: false; violations: string[] }).violations;
  assert.ok(violations.includes("snippet"));
  assert.ok(violations.includes("taskTitle"));
});

test("I17 · an unknown extra field is rejected, not tolerated", () => {
  // An allowlist, so the next well-meaning denormalisation fails here rather
  // than in production.
  const result = assertStorable({ ...STORABLE_EVENT, cachedSummary: "3 things" });
  assert.equal(result.ok, false);
});

// ── I18 · unavailable renders neutral, with no stale content ────────────────

test("I18 · an available source hydrates its display from this request only", () => {
  const display = rowDisplay({
    event: STORABLE_EVENT,
    sourceVisibility: "available",
    hydrated: { title: "Confirm the florist", actorLabel: "Ava" },
  });

  assert.equal(display.state, "available");
  assert.equal(display.title, "Confirm the florist");
});

test("I18 · an unavailable source shows the neutral state and NO previous content", () => {
  // §11.4, and `PROJECT_SCOPE.md` §8.1: missing and forbidden are collapsed, so
  // the rendering names the state and does not guess why.
  const display = rowDisplay({
    event: STORABLE_EVENT,
    sourceVisibility: "unavailable",
    hydrated: { title: "Confirm the florist", actorLabel: "Ava" },
  });

  assert.equal(display.state, "unavailable");
  assert.equal(display.title, null);
  assert.equal(display.actorLabel, null);
  assert.equal(
    JSON.stringify(display).includes("florist"),
    false,
    "a stale hydration must not leak through an unavailable row",
  );
  assert.equal(display.reason, null, "an existence leak is a privacy defect");
});

test("I18 · unavailable is not empty, zero, healthy, complete or all clear", () => {
  const display = rowDisplay({
    event: STORABLE_EVENT,
    sourceVisibility: "unavailable",
    hydrated: null,
  });
  assert.notEqual(display.state, "empty");
  assert.notEqual(display.state, "resolved");
  assert.equal(display.countsTowardBadge, false);
});

test("I18 · undetermined is distinct from unavailable in both directions", () => {
  const display = rowDisplay({
    event: STORABLE_EVENT,
    sourceVisibility: "undetermined",
    hydrated: null,
  });
  assert.equal(display.state, "undetermined");
  assert.equal(display.title, null);
  assert.equal(
    display.countsTowardBadge,
    true,
    "we do not know it is gone, so removing it would be a claim we cannot support",
  );
});

test("I18 · two recipients of one event may hydrate differently", () => {
  const mine = rowDisplay({
    event: STORABLE_EVENT,
    sourceVisibility: "available",
    hydrated: { title: "Confirm the florist", actorLabel: "Ava" },
  });
  const theirs = rowDisplay({
    event: STORABLE_EVENT,
    sourceVisibility: "unavailable",
    hydrated: null,
  });

  assert.equal(mine.state, "available");
  assert.equal(theirs.state, "unavailable");
  assert.equal(theirs.title, null);
});

// ── I19 · no Inbox path resolves a tenant ambiently ─────────────────────────

test("I19 · no Inbox source module calls getActiveWorkspace or reads the cookie", () => {
  // §6 rule 3. This is the rule that stops the Inbox inheriting the silent
  // no-op documented at `PROJECT_SCOPE.md` §9 and `R-H11`: 101
  // `getActiveWorkspace(` occurrences across 43 non-test files, of which 36 are
  // sites where the cookie IS the write destination
  // (`RECONCILIATION.md` §3 row 3). The recipient is the authenticated actor;
  // the Project comes from the event row; the cookie is not an input.
  const sources = readdirSync(HERE).filter(
    (name) => /\.tsx?$/.test(name) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx"),
  );

  assert.ok(
    sources.length > 0,
    "no Inbox source modules exist yet — this is the Wave 1 failure, not a passing scan",
  );

  for (const name of sources) {
    const text = readFileSync(join(HERE, name), "utf8");
    for (const forbidden of [
      "getActiveWorkspace",
      "tasks_active_ws",
      "ACTIVE_WORKSPACE_COOKIE_NAME",
      "cookies(",
    ]) {
      assert.equal(
        text.includes(forbidden),
        false,
        `${name} must not reach for ${forbidden}`,
      );
    }
  }
});

test("I19 · no Inbox source module reaches a membership query directly", () => {
  // `PROJECT_SCOPE.md` §3 rule 1: Home authorizes through seam 1 and reaches it
  // only through the `src/lib/projects/**` facade. No sixth seam, no cache.
  const sources = readdirSync(HERE).filter(
    (name) => /\.tsx?$/.test(name) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx"),
  );

  assert.ok(sources.length > 0, "no Inbox source modules exist yet");

  for (const name of sources) {
    const text = readFileSync(join(HERE, name), "utf8");
    for (const forbidden of [
      "workspaceMembers",
      "workspace_members",
      "LEGACY_WORKSPACE_ID",
      "@libsql/client",
    ]) {
      assert.equal(
        text.includes(forbidden),
        false,
        `${name} must not reach for ${forbidden}`,
      );
    }
  }
});
