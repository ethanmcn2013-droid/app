/**
 * InboxEvent · identity, deduplication and episodes.
 *
 * Assertions I1–I5 of `docs/projects/home-operating-layer/contracts/INBOX_EVENT.md` §18.
 *
 * THIS FILE IS EXPECTED TO FAIL AT `78021c5`. It fails on the import below,
 * because `./contract` and `./identity` do not exist: there is no event store
 * anywhere in this repository. Inbox read state is client-only localStorage
 * (`src/components/app/inbox/inbox-app.tsx:207-217`), `notify()` refuses any
 * payload without a taskId (`src/server/db/notifications.ts:40-42`), and
 * `notifications` carries no uniqueness constraint at all
 * (`src/server/db/schema.ts:569-592`). The failure IS the Wave 1 deliverable.
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/inbox/identity.test.ts
 */

import { strict as assert } from "node:assert";
import test from "node:test";

import { INBOX_KINDS } from "./contract";
import {
  addRecipient,
  applyEmission,
  emissionDedupeKey,
  isInboxKind,
  mentionSourceEventId,
} from "./identity";

const NOW = Date.parse("2026-08-12T10:00:00.000Z");
const PROJECT = "ws-orchard";

function emission(overrides: Record<string, unknown> = {}) {
  return {
    sourceProduct: "tasks",
    sourceEventId: mentionSourceEventId("c-0001"),
    kind: "mention",
    workspaceId: PROJECT,
    actorUserId: "u-ava",
    sourceObjectType: "comment",
    sourceObjectId: "c-0001",
    sourceRevisionAtEmit: "rev-1",
    threadKey: "task:t-42",
    episodeKey: "comment:c-0001",
    occurredAt: NOW,
    recordedAt: NOW,
    ...overrides,
  };
}

// ── I1 · the kinds union is exactly six ─────────────────────────────────────

test("I1 · V1 carries exactly the six kinds, in contract order", () => {
  assert.deepEqual(INBOX_KINDS, [
    "mention",
    "reply",
    "review-requested",
    "approval-requested",
    "handoff",
    "explicit-block",
  ]);
});

test("I1 · the excluded classes are not kinds", () => {
  // §3.2. Each of these exists somewhere in the estate today and each is
  // deliberately not an Inbox ask: `dueToday` and `blocked` are declared
  // notification kinds with zero writers (`src/lib/data.ts:696-706`);
  // `milestone` has a live writer (`src/server/milestones.ts:74-83`) and is a
  // celebration; `commentAdd`, `move` and `update` are ActivityKinds
  // (`src/lib/data.ts:613-629`).
  for (const excluded of [
    "dueToday",
    "digest",
    "milestone",
    "commentAdd",
    "move",
    "update",
    "archived",
    "blocked",
  ]) {
    assert.equal(
      isInboxKind(excluded),
      false,
      `${excluded} must not be an Inbox kind`,
    );
  }
});

// ── I2 · invitation is excluded pending InviteEventContract ─────────────────

test("I2 · invitation is not an Inbox kind", () => {
  // §3.3. Its recipient is an email address, not a user id
  // (`src/server/db/schema.ts:951-976`), so it cannot key a state row at all.
  assert.equal(isInboxKind("invitation"), false);
  assert.equal(isInboxKind("invite"), false);
  assert.equal(isInboxKind("inviteSent"), false);
  assert.equal(isInboxKind("inviteAccepted"), false);
});

test("I2 · nudge is not mapped onto mention", () => {
  // §3.4 / D-INBOX-04. `nudge` has a live writer
  // (`src/server/actions/nudge.ts:190-192`) and a preference toggle
  // (`src/server/db/schema.ts:686-691`). Folding it into `mention` would make
  // the mention count a lie. It awaits a founder decision.
  assert.equal(isInboxKind("nudge"), false);
});

// ── I3 · exact deduplication ────────────────────────────────────────────────

test("I3 · the dedupe key is (sourceProduct, sourceEventId) and nothing else", () => {
  const base = emission();
  const key = emissionDedupeKey(base);

  // Everything except the two identity fields may differ without changing the
  // key: an event is the same event no matter when it was re-delivered, who
  // re-delivered it, or what revision the source had reached.
  for (const drift of [
    { occurredAt: NOW + 60_000 },
    { recordedAt: NOW + 3_600_000 },
    { sourceRevisionAtEmit: "rev-9" },
    { actorUserId: "u-somebody-else" },
    { threadKey: "task:t-99" },
  ]) {
    assert.equal(emissionDedupeKey(emission(drift)), key);
  }

  assert.notEqual(
    emissionDedupeKey(emission({ sourceEventId: mentionSourceEventId("c-0002") })),
    key,
  );
  assert.notEqual(emissionDedupeKey(emission({ sourceProduct: "notes" })), key);
});

test("I3 · re-emitting the same source event produces one event, not two", () => {
  const first = applyEmission([], emission());
  assert.equal(first.outcome, "created");
  assert.equal(first.events.length, 1);

  // A retried outbox delivery. `suite_outbox` models exactly this with
  // `attempts` and `last_error` (`src/server/db/schema.ts:193-210`).
  const second = applyEmission(first.events, emission({ recordedAt: NOW + 5_000 }));
  assert.equal(second.outcome, "duplicate");
  assert.equal(second.events.length, 1);

  // The stored row keeps the ORIGINAL source time, never the retry's time.
  // §7: `occurred_at` is the source event time, never the insert time.
  assert.equal(second.events[0].occurredAt, NOW);
});

test("I3 · one comment mentioning two people is ONE event with two recipients", () => {
  const { events } = applyEmission([], emission());
  assert.equal(events.length, 1);

  const eventId = events[0].id;
  const a = addRecipient([], eventId, "u-ben", NOW);
  assert.equal(a.outcome, "created");
  const b = addRecipient(a.states, eventId, "u-cara", NOW);
  assert.equal(b.outcome, "created");

  assert.equal(b.states.length, 2);
  assert.equal(new Set(b.states.map((s) => s.eventId)).size, 1);
});

// ── I4 · fuzzy time-window deduplication is forbidden ───────────────────────

test("I4 · two different asks seconds apart produce TWO events", () => {
  // D-INBOX-05. This is the case a time window destroys: a fast-moving thread
  // where two people ask two different things a minute apart. There is no
  // window, no similarity test, and no comparison of timestamps anywhere in
  // the write path — dedup is a UNIQUE constraint.
  let events = applyEmission([], emission()).events;

  const near = emission({
    sourceEventId: mentionSourceEventId("c-0002"),
    sourceObjectId: "c-0002",
    episodeKey: "comment:c-0002",
    actorUserId: "u-dee",
    occurredAt: NOW + 1_000, // one second later, same thread, same recipient
  });
  const second = applyEmission(events, near);
  assert.equal(second.outcome, "created");
  events = second.events;

  assert.equal(events.length, 2, "a near-in-time distinct ask must survive");
});

test("I4 · identical content at different times is still two events", () => {
  // Content is not an input to identity, so identical wording cannot collapse
  // two asks — and identity carries no content at all (§4.2, §11.1).
  const one = applyEmission([], emission({ sourceEventId: "tasks:comment-mention:c-1" }));
  const two = applyEmission(one.events, emission({
    sourceEventId: "tasks:comment-mention:c-2",
    occurredAt: NOW + 200,
  }));
  assert.equal(two.events.length, 2);
});

// ── I5 · a new episode never resurrects a cleared event ─────────────────────

test("I5 · an edit is not a new episode and cannot reappear", () => {
  // Editing a comment to re-mention someone who cleared it produces the same
  // sourceEventId, so the insert conflicts and nothing reappears.
  const { events } = applyEmission([], emission());
  const cleared = [
    {
      eventId: events[0].id,
      recipientUserId: "u-ben",
      visibility: "read" as const,
      disposition: "cleared" as const,
      readAt: NOW,
      readReason: "detail-open" as const,
      dispositionAt: NOW,
      dispositionReason: "user" as const,
      snoozedUntil: null,
      snoozeZone: null,
      resolvingAttemptId: null,
    },
  ];

  const again = applyEmission(events, emission({ sourceRevisionAtEmit: "rev-2" }));
  assert.equal(again.outcome, "duplicate");
  assert.equal(again.events.length, 1);

  const recipient = addRecipient(cleared, events[0].id, "u-ben", NOW + 60_000);
  assert.equal(recipient.outcome, "exists");
  assert.equal(
    recipient.states[0].disposition,
    "cleared",
    "a duplicate emission must not touch a state the person already set",
  );
});

test("I5 · a new episode creates a NEW event and leaves the cleared one alone", () => {
  const { events } = applyEmission([], emission());
  const firstId = events[0].id;

  // A genuinely new ask: a new comment, therefore a new episode.
  const next = applyEmission(
    events,
    emission({
      sourceEventId: mentionSourceEventId("c-0007"),
      sourceObjectId: "c-0007",
      episodeKey: "comment:c-0007",
      occurredAt: NOW + 86_400_000,
    }),
  );

  assert.equal(next.outcome, "created");
  assert.equal(next.events.length, 2);
  assert.notEqual(next.events[1].id, firstId);
  assert.equal(next.events[1].threadKey, "task:t-42", "same thread, new ask");

  const states = addRecipient([], next.events[1].id, "u-ben", NOW + 86_400_000);
  assert.equal(states.states[0].visibility, "new");
  assert.equal(states.states[0].disposition, "open");
});

test("I5 · a third recipient added to an existing event is a state row, not an event", () => {
  const { events } = applyEmission([], emission());
  const a = addRecipient([], events[0].id, "u-ben", NOW);
  const b = addRecipient(a.states, events[0].id, "u-cara", NOW + 30_000);

  const after = applyEmission(events, emission());
  assert.equal(after.events.length, 1);
  assert.equal(b.states.length, 2);
});
