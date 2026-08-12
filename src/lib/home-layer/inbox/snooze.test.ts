/**
 * InboxEvent · snooze, resurface, and the two days a year that break it.
 *
 * Assertions I11–I13 of
 * `docs/projects/home-operating-layer/contracts/INBOX_EVENT.md` §10, §18.
 *
 * THIS FILE IS EXPECTED TO FAIL AT `78021c5`. There is no snooze anywhere in
 * the product: the only deferral affordance is nudge dismissal in localStorage
 * (`src/components/app/inbox/inbox-app.tsx:229-240`), which is permanent, not
 * timed, and not cross-device.
 *
 * Every instant below was verified against `Intl.DateTimeFormat` with
 * `timeZone: "Europe/London"` at authoring time. Britain and Ireland move on
 * the last Sunday of March (01:00 GMT -> 02:00 BST) and the last Sunday of
 * October (02:00 BST -> 01:00 GMT): in 2026 those are Sunday 29 March and
 * Sunday 25 October.
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/inbox/snooze.test.ts
 */

import { strict as assert } from "node:assert";
import test from "node:test";

import {
  effectiveDisposition,
  resolveLocalWallClock,
  resolveSnoozeTarget,
} from "./snooze";

const LONDON = "Europe/London";

/** Local wall-clock reading of an instant, for assertions that must be legible. */
function localReading(instant: number, timeZone = LONDON): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    dateStyle: "short",
    timeStyle: "short",
    hourCycle: "h23",
  }).format(new Date(instant));
}

// ── I12 · "tomorrow morning" is a calendar operation, not +24h ──────────────

test("I12 · tomorrow morning across the spring-forward boundary is 23 hours in UTC", () => {
  // Snoozed on Friday 27 March -> Saturday 28 March 09:00 GMT  = 09:00Z
  // Snoozed on Saturday 28 March -> Sunday 29 March 09:00 BST  = 08:00Z
  // A naive +86_400_000 from the first would land at 10:00 local. It does not.
  const friday = resolveSnoozeTarget("tomorrow-morning", {
    now: Date.parse("2026-03-27T12:00:00.000Z"),
    timeZone: LONDON,
  });
  const saturday = resolveSnoozeTarget("tomorrow-morning", {
    now: Date.parse("2026-03-28T12:00:00.000Z"),
    timeZone: LONDON,
  });

  assert.equal(friday.resurfaceAt, Date.parse("2026-03-28T09:00:00.000Z"));
  assert.equal(saturday.resurfaceAt, Date.parse("2026-03-29T08:00:00.000Z"));

  assert.equal(
    saturday.resurfaceAt - friday.resurfaceAt,
    23 * 3_600_000,
    "the short day must shorten the UTC gap, not move the local time",
  );
  assert.equal(localReading(friday.resurfaceAt), "28/03/2026, 09:00");
  assert.equal(localReading(saturday.resurfaceAt), "29/03/2026, 09:00");
});

test("I12 · tomorrow morning across the fall-back boundary is 25 hours in UTC", () => {
  const friday = resolveSnoozeTarget("tomorrow-morning", {
    now: Date.parse("2026-10-23T12:00:00.000Z"),
    timeZone: LONDON,
  });
  const saturday = resolveSnoozeTarget("tomorrow-morning", {
    now: Date.parse("2026-10-24T12:00:00.000Z"),
    timeZone: LONDON,
  });

  assert.equal(friday.resurfaceAt, Date.parse("2026-10-24T08:00:00.000Z"));
  assert.equal(saturday.resurfaceAt, Date.parse("2026-10-25T09:00:00.000Z"));
  assert.equal(saturday.resurfaceAt - friday.resurfaceAt, 25 * 3_600_000);

  assert.equal(localReading(friday.resurfaceAt), "24/10/2026, 09:00");
  assert.equal(localReading(saturday.resurfaceAt), "25/10/2026, 09:00");
});

test("I12 · next week is the next Monday 09:00 local, in the zone", () => {
  // 2026-08-12 is a Wednesday; 2026-08-17 is the following Monday.
  const result = resolveSnoozeTarget("next-week", {
    now: Date.parse("2026-08-12T10:00:00.000Z"),
    timeZone: LONDON,
  });
  assert.equal(localReading(result.resurfaceAt), "17/08/2026, 09:00");
});

// ── I13 · gaps resolve forward, ambiguity resolves earlier ──────────────────

test("I13 · a non-existent local time resolves FORWARD to the first real instant", () => {
  // 01:30 on 29 March 2026 does not exist in Europe/London.
  const result = resolveLocalWallClock(
    { year: 2026, month: 3, day: 29, hour: 1, minute: 30 },
    LONDON,
  );

  assert.equal(result.instant, Date.parse("2026-03-29T01:00:00.000Z"));
  assert.equal(localReading(result.instant), "29/03/2026, 02:00");
  assert.equal(result.adjustment, "forward-from-gap");

  assert.notEqual(
    result.instant,
    Date.parse("2026-03-29T00:30:00.000Z"),
    "resolving backwards would surface the item before the person asked for it",
  );
});

test("I13 · an ambiguous local time resolves to the EARLIER occurrence", () => {
  // 01:30 on 25 October 2026 happens twice: 00:30Z (BST) and 01:30Z (GMT).
  const result = resolveLocalWallClock(
    { year: 2026, month: 10, day: 25, hour: 1, minute: 30 },
    LONDON,
  );

  assert.equal(result.instant, Date.parse("2026-10-25T00:30:00.000Z"));
  assert.equal(localReading(result.instant), "25/10/2026, 01:30");
  assert.equal(result.adjustment, "earlier-of-ambiguous");
});

test("I13 · an ordinary local time is exact and carries no adjustment", () => {
  const result = resolveLocalWallClock(
    { year: 2026, month: 8, day: 12, hour: 9, minute: 0 },
    LONDON,
  );
  assert.equal(result.instant, Date.parse("2026-08-12T08:00:00.000Z"));
  assert.equal(result.adjustment, "none");
});

// ── the zone is an explicit argument, never ambient ─────────────────────────

test("the resolver takes a zone and reads no environment", () => {
  // §10.2 / D-INBOX-12. `user_preferences.time_zone` is nullable and
  // documented to fall back to UTC (`src/server/db/schema.ts:716-718`). It must
  // never silently become Europe/London because a settings page defaults its
  // display formatter there (`src/app/settings/notifications/page.tsx:20`) or
  // because the analytics fixtures pin it
  // (`src/modules/signal/lib/analytics/fixtures.ts:20`).
  const utc = resolveSnoozeTarget("tomorrow-morning", {
    now: Date.parse("2026-03-28T12:00:00.000Z"),
    timeZone: "UTC",
  });
  assert.equal(utc.resurfaceAt, Date.parse("2026-03-29T09:00:00.000Z"));
  assert.equal(utc.snoozeZone, "UTC");
});

test("the resolved instant is stored with the zone that produced it", () => {
  const result = resolveSnoozeTarget("tomorrow-morning", {
    now: Date.parse("2026-08-12T10:00:00.000Z"),
    timeZone: LONDON,
  });
  assert.equal(result.snoozeZone, LONDON);
  assert.equal(
    typeof result.resurfaceAt,
    "number",
    "stored as a UTC instant; the local intention stays recoverable from the pair",
  );
});

test("an unknown zone is refused, not silently coerced", () => {
  assert.throws(() =>
    resolveSnoozeTarget("tomorrow-morning", {
      now: Date.parse("2026-08-12T10:00:00.000Z"),
      timeZone: "Not/AZone",
    }),
  );
});

// ── I11 · resurface is derived, never a job ─────────────────────────────────

test("I11 · effective disposition derives open from a passed resurfaceAt", () => {
  // D-INBOX-13. No job has run; the stored disposition is still "snoozed".
  const now = Date.parse("2026-08-12T10:00:00.000Z");
  const snoozed = {
    disposition: "snoozed" as const,
    snoozedUntil: now - 1,
    snoozeZone: LONDON,
  };

  assert.equal(effectiveDisposition(snoozed, now), "open");
  assert.equal(
    effectiveDisposition({ ...snoozed, snoozedUntil: now + 1 }, now),
    "snoozed",
  );
  assert.equal(
    snoozed.disposition,
    "snoozed",
    "the stored value must not be mutated by reading it",
  );
});

test("I11 · a snooze with no instant is not a snooze", () => {
  const now = Date.parse("2026-08-12T10:00:00.000Z");
  assert.throws(() =>
    effectiveDisposition(
      { disposition: "snoozed", snoozedUntil: null, snoozeZone: null },
      now,
    ),
  );
});
