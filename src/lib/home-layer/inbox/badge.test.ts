/**
 * InboxEvent · exact badge membership.
 *
 * Assertions I9–I11 and I20 of
 * `docs/projects/home-operating-layer/contracts/INBOX_EVENT.md` §17, §18.
 *
 * THIS FILE IS EXPECTED TO FAIL AT `78021c5`. There is no badge function.
 * What ships today is `inboxCount = openTaskCount(tasks)`
 * (`src/components/app/sidebar.tsx:169`), rendered with the accessible name
 * `${inboxCount} open tasks` (`:308-314`), where `openTaskCount` counts client
 * tasks whose `lane !== "done"` in the one cookie-selected Project
 * (`src/lib/tasks/selectors.ts:61-71`). Three separate ways of not being an
 * inbox count: wrong population, wrong scope, wrong done predicate.
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/inbox/badge.test.ts
 */

import { strict as assert } from "node:assert";
import test from "node:test";

import { badgeCount, badgeDisplay, isBadgeEligible } from "./badge";

const NOW = Date.parse("2026-08-12T10:00:00.000Z");
const HOUR = 3_600_000;

type Row = Parameters<typeof isBadgeEligible>[0];

function row(overrides: Partial<Row> = {}): Row {
  return {
    state: {
      eventId: "ie-1",
      recipientUserId: "u-ben",
      visibility: "new",
      disposition: "open",
      readAt: null,
      readReason: null,
      dispositionAt: NOW - HOUR,
      dispositionReason: "arrival",
      snoozedUntil: null,
      snoozeZone: null,
      resolvingAttemptId: null,
    },
    kind: "mention",
    withdrawnAt: null,
    projectMembership: "member",
    projectArchived: false,
    sourceVisibility: "available",
    ...overrides,
  } as Row;
}

function state(overrides: Record<string, unknown>) {
  return { ...row().state, ...overrides };
}

// ── I9 · the badge counts open, never unread ────────────────────────────────

test("I9 · visibility is not an input to badge membership", () => {
  // D-INBOX-16. If the badge counted unread items, reading would empty it —
  // which is exactly "reading resolves", the thing §8.1 forbids.
  const unread = row({ state: state({ visibility: "new" }) });
  const read = row({
    state: state({ visibility: "read", readAt: NOW, readReason: "detail-open" }),
  });

  assert.equal(isBadgeEligible(unread, NOW), true);
  assert.equal(isBadgeEligible(read, NOW), true);
  assert.equal(badgeCount([unread, read], NOW).count, 2);
});

test("I9 · acknowledged, cleared and withdrawn leave the badge", () => {
  assert.equal(
    isBadgeEligible(row({ state: state({ disposition: "acknowledged" }) }), NOW),
    false,
  );
  assert.equal(
    isBadgeEligible(row({ state: state({ disposition: "cleared" }) }), NOW),
    false,
  );
  assert.equal(isBadgeEligible(row({ withdrawnAt: NOW - HOUR }), NOW), false);
});

test("I9 · a kind outside the six never counts", () => {
  for (const kind of ["nudge", "milestone", "dueToday", "invitation", "digest"]) {
    assert.equal(isBadgeEligible(row({ kind }), NOW), false, `${kind} must not count`);
  }
});

test("I9 · revoked membership and archived Projects leave the badge", () => {
  // §17 rule 5. `PROJECT_SCOPE.md` §8.3 excludes archived Projects from
  // all-projects by default; their events leave the badge by the same rule.
  assert.equal(isBadgeEligible(row({ projectMembership: "revoked" }), NOW), false);
  assert.equal(isBadgeEligible(row({ projectArchived: true }), NOW), false);
});

// ── I10 · source visibility, three states, not interchangeable ──────────────

test("I10 · an unavailable source leaves the badge", () => {
  // A badge that counts things you cannot open is a lie about actionable work.
  assert.equal(isBadgeEligible(row({ sourceVisibility: "unavailable" }), NOW), false);
});

test("I10 · an undetermined source STAYS in the badge and is disclosed", () => {
  // §11.4. We do not know it is gone, so removing it would be a claim we
  // cannot support — Charter rule 11.
  const undetermined = row({ sourceVisibility: "undetermined" });
  assert.equal(isBadgeEligible(undetermined, NOW), true);

  const count = badgeCount([row(), undetermined], NOW);
  assert.equal(count.count, 2);
  assert.equal(count.undeterminedCount, 1);
  assert.equal(count.coverage, "partial");
});

test("I10 · unavailable is never rendered as zero, empty or all clear", () => {
  const count = badgeCount([row({ sourceVisibility: "unavailable" })], NOW);
  assert.equal(count.count, 0);
  // A definitive negative on the only item is a real zero of open work, but it
  // is NOT a claim that everything resolved: coverage must say so.
  assert.notEqual(count.coverage, "complete");
});

// ── I11 · resurface is a read-time predicate, not a job ─────────────────────

test("I11 · a snoozed item whose resurfaceAt has passed is badge-eligible", () => {
  // D-INBOX-13. No job has run. The stored disposition is still "snoozed".
  const due = row({
    state: state({
      disposition: "snoozed",
      snoozedUntil: NOW - 60_000,
      snoozeZone: "Europe/London",
    }),
  });
  assert.equal(isBadgeEligible(due, NOW), true);
});

test("I11 · a snoozed item still in the future is not badge-eligible", () => {
  const later = row({
    state: state({
      disposition: "snoozed",
      snoozedUntil: NOW + HOUR,
      snoozeZone: "Europe/London",
    }),
  });
  assert.equal(isBadgeEligible(later, NOW), false);
});

test("I11 · a resurfaced item whose source went unavailable stays out of the badge", () => {
  // §10.5. It resurfaces — it is not silently dropped — but into the
  // unavailable rendering, and out of the count.
  const due = row({
    sourceVisibility: "unavailable",
    state: state({
      disposition: "snoozed",
      snoozedUntil: NOW - 60_000,
      snoozeZone: "Europe/London",
    }),
  });
  assert.equal(isBadgeEligible(due, NOW), false);
});

// ── I20 · the count is never a bare integer ─────────────────────────────────

test("I20 · badgeCount returns coverage alongside the number", () => {
  const complete = badgeCount([row(), row({ state: state({ eventId: "ie-2" }) })], NOW);
  assert.equal(complete.count, 2);
  assert.equal(complete.coverage, "complete");
  assert.equal(complete.undeterminedCount, 0);
  assert.equal(complete.unreadableProjectCount, 0);
});

test("I20 · unavailable coverage yields NO count, not zero", () => {
  // §17.2. Zero is a claim. When nothing could be resolved, the badge renders
  // no number at all.
  const count = badgeCount([], NOW, { unreadableProjectCount: 3, allProjectsUnreadable: true });
  assert.equal(count.coverage, "unavailable");

  const display = badgeDisplay(count);
  assert.equal(display.glyph, null, "no glyph, and certainly not a 0");
  assert.doesNotMatch(display.accessibleName, /\b0\b/);
});

test("I20 · one unresolvable Project makes the badge partial, never zero", () => {
  // `PROJECT_SCOPE.md` §5 rule 4: partial authorization is disclosed, never
  // silently trimmed.
  const count = badgeCount([row()], NOW, { unreadableProjectCount: 1 });
  assert.equal(count.count, 1);
  assert.equal(count.coverage, "partial");
  assert.equal(count.unreadableProjectCount, 1);
  assert.match(badgeDisplay(count).accessibleName, /could not|unavailable|not verified/i);
});

test("I20 · above 99 the glyph truncates and the accessible name does not", () => {
  const rows = Array.from({ length: 137 }, (_, i) =>
    row({ state: state({ eventId: `ie-${i}` }) }),
  );
  const count = badgeCount(rows, NOW);
  assert.equal(count.count, 137);

  const display = badgeDisplay(count);
  assert.equal(display.glyph, "99+");
  assert.match(display.accessibleName, /137/);
});

test("I20 · the badge is not scoped by Active Project", () => {
  // §17.1. A badge that changed when you switched Projects would hide work and
  // answer a different question every time it was read.
  const a = row({ state: state({ eventId: "ie-a" }) });
  const b = row({ state: state({ eventId: "ie-b" }) });
  const across = badgeCount([a, b], NOW);
  assert.equal(across.count, 2);

  assert.equal(
    (badgeCount as unknown as { length: number }).length <= 3,
    true,
    "badgeCount takes rows, an instant and options — never an active Project id",
  );
});
