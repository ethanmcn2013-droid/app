import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatLastRefreshed,
  freshnessTone,
  truncationNotice,
} from "@/modules/timeline/lib/freshness";

const NOW = Date.UTC(2026, 7, 13, 12, 0, 0);

test("never refreshed says so, rather than showing an empty date", () => {
  // "Last refreshed —" would blur two different facts: a Timeline that has
  // never been refreshed, and one that refreshed and found nothing.
  assert.equal(formatLastRefreshed(null, NOW), "Not refreshed from Tasks yet");
});

test("the refresh time reads in the units a person thinks in", () => {
  assert.equal(formatLastRefreshed(NOW - 5_000, NOW), "Last refreshed just now");
  assert.equal(formatLastRefreshed(NOW - 60_000, NOW), "Last refreshed 1 minute ago");
  assert.equal(formatLastRefreshed(NOW - 12 * 60_000, NOW), "Last refreshed 12 minutes ago");
  assert.equal(formatLastRefreshed(NOW - 3_600_000, NOW), "Last refreshed 1 hour ago");
  assert.equal(formatLastRefreshed(NOW - 5 * 3_600_000, NOW), "Last refreshed 5 hours ago");
  assert.equal(
    formatLastRefreshed(Date.UTC(2026, 7, 11, 9, 0, 0), NOW),
    "Last refreshed on 11 August",
  );
});

test("a clock that has gone backwards never reads as the future", () => {
  // Server clock and client clock disagree by a second all the time. "in -1
  // minutes" is the kind of thing that ships.
  assert.equal(formatLastRefreshed(NOW + 30_000, NOW), "Last refreshed just now");
});

test("`now` is a parameter, so the server and the first client render agree", () => {
  // A hydration mismatch on a timestamp is invisible in review and loud in
  // production, which is why this function never reads the clock itself.
  assert.equal(
    formatLastRefreshed(NOW - 120_000, NOW),
    formatLastRefreshed(NOW - 120_000, NOW),
  );
});

test("a truncated snapshot names both numbers and says nothing was deleted", () => {
  // F7. `syncMilestonesAction` has returned `complete: false` and `totalCount`
  // since WP1 and no surface read either, so a Project past the row cap showed
  // the first 201 milestones and said nothing at all.
  assert.equal(
    truncationNotice({ truncated: true, importedCount: 201, sourceCount: 250 }),
    "Showing the first 201 of 250 milestones. Tasks has more than one refresh can read, and nothing here was deleted.",
  );
});

test("a whole snapshot says nothing, because there is nothing to say", () => {
  assert.equal(
    truncationNotice({ truncated: false, importedCount: 12, sourceCount: 12 }),
    null,
  );
});

test("a truncated snapshot with unusable counts still admits it is truncated", () => {
  // Losing the numbers must never turn a truncated read into a silent one.
  for (const counts of [
    { importedCount: null, sourceCount: null },
    { importedCount: 5, sourceCount: null },
    { importedCount: 5, sourceCount: 5 },
  ]) {
    const notice = truncationNotice({ truncated: true, ...counts });
    assert.ok(notice, `${JSON.stringify(counts)} must still produce a notice`);
    assert.match(notice, /some are missing here/);
  }
});

test("only the states that mean 'what you see may be behind' read as stale", () => {
  assert.equal(freshnessTone("complete"), "ok");
  assert.equal(freshnessTone("empty"), "ok");
  assert.equal(freshnessTone("never"), "ok");
  assert.equal(freshnessTone("syncing"), "working");
  assert.equal(freshnessTone("partial"), "stale");
  assert.equal(freshnessTone("error"), "stale");
  assert.equal(freshnessTone("unauthorized"), "stale");
});
