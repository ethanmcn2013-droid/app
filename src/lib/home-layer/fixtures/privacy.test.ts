/**
 * The private-Notes sentinel, and the metadata that must not survive a
 * revocation.
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/fixtures/privacy.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertBodySentinelAbsent,
  HOME_FIXTURE_APPROVED_EXTRACTS,
  HOME_FIXTURE_NOTE_BODIES,
  HOME_FIXTURE_NOTES,
  NOTE_BODY_SENTINEL_PREFIX,
  NOTE_EXTRACT_SENTINEL_PREFIX,
  scanForSentinels,
} from "./notes";
import { assertNoContentOnRows, HOME_INBOX_EVENTS, HOME_INBOX_SCALE_EVENTS } from "./inbox";
import { homeFixtureWorld, SCENARIO_IDS } from "./scenarios";
import { REVOKED_LEAK_FIELDS } from "./projects";

describe("the sentinels are well formed", () => {
  it("every note body carries the sentinel at its START and its END", () => {
    for (const note of HOME_FIXTURE_NOTES) {
      assert.ok(
        note.body.startsWith(NOTE_BODY_SENTINEL_PREFIX),
        `${note.id}: a head clip would hide a leak`,
      );
      assert.ok(
        note.body.trimEnd().endsWith(scanForSentinels(note.body).bodyHits[0]),
        `${note.id}: a tail clip would hide a leak`,
      );
    }
  });

  it("body and extract sentinels are distinct, so a correct promotion is not a leak", () => {
    assert.notEqual(NOTE_BODY_SENTINEL_PREFIX, NOTE_EXTRACT_SENTINEL_PREFIX);
    for (const extract of HOME_FIXTURE_APPROVED_EXTRACTS) {
      assert.equal(scanForSentinels(extract).bodyHits.length, 0);
      assert.equal(scanForSentinels(extract).extractHits.length, 1);
    }
  });

  it("matches on the prefix, so a truncated body still trips it", () => {
    const clipped = HOME_FIXTURE_NOTES[0].body.slice(0, 40);
    assert.ok(scanForSentinels(clipped).bodyHits.length > 0);
  });

  it("every body sentinel in the universe is unique", () => {
    const hits = HOME_FIXTURE_NOTE_BODIES.flatMap(
      (body) => scanForSentinels(body).bodyHits,
    );
    assert.equal(new Set(hits).size, HOME_FIXTURE_NOTES.length);
  });
});

describe("the empty-population refusal", () => {
  it("FAILS on an empty population rather than reporting clean", () => {
    const result = assertBodySentinelAbsent([], "an artifact with nothing in it");
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "empty-population");
    assert.match(result.detail, /looked at nothing/);
  });

  it("passes only when the population is real and the artifact is clean", () => {
    const result = assertBodySentinelAbsent(
      HOME_FIXTURE_NOTE_BODIES,
      "Confirm final numbers with the Orchard kitchen",
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.sentinelsSeen, HOME_FIXTURE_NOTES.length);
  });

  it("catches a planted leak", () => {
    const leaked = `A summary that swallowed ${HOME_FIXTURE_NOTES[0].body.slice(0, 30)}`;
    const result = assertBodySentinelAbsent(HOME_FIXTURE_NOTE_BODIES, leaked);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "body-sentinel-present");
  });
});

describe("no Home artifact carries a private note body", () => {
  for (const id of SCENARIO_IDS) {
    it(`${id}: the whole serialised world is free of the body sentinel`, () => {
      const artifact = JSON.stringify(homeFixtureWorld(id));
      const result = assertBodySentinelAbsent(HOME_FIXTURE_NOTE_BODIES, artifact);
      assert.equal(
        result.ok,
        true,
        result.ok ? "" : `${id}: ${result.detail}`,
      );
    });
  }
});

describe("Inbox rows store identifiers and state, never content", () => {
  it("no signature event carries a field outside the contract's list", () => {
    assertNoContentOnRows(HOME_INBOX_EVENTS);
  });

  it("no scale event carries one either", () => {
    assertNoContentOnRows(HOME_INBOX_SCALE_EVENTS);
  });

  it("a planted title on a row is refused by name", () => {
    assert.throws(
      () =>
        assertNoContentOnRows([
          { ...HOME_INBOX_EVENTS[0], taskTitle: "Confirm final numbers" } as never,
        ]),
      /non-contract field "taskTitle"/,
    );
  });

  it("no event row contains any word from the display projection", () => {
    const serialised = JSON.stringify(HOME_INBOX_EVENTS);
    for (const word of ["Orchard", "Ballyhoura", "Adare", "Éabha", "Niamh"]) {
      assert.equal(
        serialised.includes(word),
        false,
        `an Inbox row stored the display word "${word}"`,
      );
    }
  });
});

describe("a revoked Project leaks nothing to the client", () => {
  it("carries no name, no count, no last-read time and no reason", () => {
    const { ledger } = homeFixtureWorld("permission_changed");
    const revoked = ledger.filter((entry) => entry.state === "unresolved");
    assert.ok(revoked.length > 0);
    const serialised = JSON.stringify(revoked);
    for (const field of REVOKED_LEAK_FIELDS) {
      if (field === "name") continue; // `projectName` is asserted null below
      assert.equal(
        serialised.includes(`"${field}"`),
        false,
        `the client payload for a revoked Project carries "${field}"`,
      );
    }
    for (const entry of revoked) assert.equal(entry.projectName, null);
  });

  it("never distinguishes forbidden from deleted from missing", () => {
    const { ledger } = homeFixtureWorld("permission_changed");
    const serialised = JSON.stringify(ledger).toLowerCase();
    for (const reason of ["forbidden", "deleted", "revoked", "permission"]) {
      assert.equal(
        serialised.includes(reason),
        false,
        `the ledger told the client "${reason}", which is an existence leak`,
      );
    }
  });
});
