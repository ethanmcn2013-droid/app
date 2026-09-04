import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { coupleVisibleCompNotes } from "./comp-notes";

/**
 * R-015 — the redemption card must not read internal metadata to the couple.
 *
 * Run: node --import tsx --test src/lib/comp-notes.test.ts
 */

const VENUE_EDITION_NOTES = JSON.stringify({
  sponsor_slug: "lambs-hill",
  sponsor_name: "Lamb's Hill",
  source_type: "venue_edition",
  studio_tier: "wedding_venue",
  studio_duration_days: 548,
});

describe("coupleVisibleCompNotes", () => {
  it("drops the sponsor JSON issue-codes.ts writes", () => {
    // This exact string was rendered as a paragraph on the sponsored couple's
    // first screen after redeeming.
    assert.equal(coupleVisibleCompNotes(VENUE_EDITION_NOTES), null);
  });

  it("drops the internal notes the product writes for itself", () => {
    for (const note of [
      "comp:LAMBSHIL-ABCDE-FGHJK",
      "student:tcd.ie",
      "COMP:LAMBSHIL-ABCDE-FGHJK",
      "license:abc",
      "[1,2,3]",
      '"just a quoted string"',
      "42",
      "null",
    ]) {
      assert.equal(coupleVisibleCompNotes(note), null, note);
    }
  });

  it("drops empty and absent notes", () => {
    for (const note of [null, undefined, "", "   ", "\n\t"]) {
      assert.equal(coupleVisibleCompNotes(note), null, JSON.stringify(note));
    }
  });

  it("keeps a line an operator actually wrote for a couple", () => {
    assert.equal(
      coupleVisibleCompNotes("  Congratulations from everyone here.  "),
      "Congratulations from everyone here.",
    );
    assert.equal(
      coupleVisibleCompNotes("Review fixture only. No entitlement was changed."),
      "Review fixture only. No entitlement was changed.",
    );
  });
});

describe("source contract: the redeem card filters before it renders", () => {
  it("comp.ts filters the common first-claim and replay projection", () => {
    const comp = readFileSync(
      new URL("../server/actions/comp.ts", import.meta.url),
      "utf8",
    );
    assert.match(comp, /coupleVisibleCompNotes/);
    // Both results now converge after the transactional claim helper.
    const implementation = comp.slice(comp.indexOf("async function redeemCompCodeImpl"), comp.indexOf("export type StudentVerifyResult"));
    assert.match(implementation, /await claimCompEntitlement\(db/);
    assert.match(implementation, /notes: coupleVisibleCompNotes\(claim.codeNotes\)/);
    // No raw column reaching the result any more.
    assert.doesNotMatch(comp, /notes: row\.notes,/);
    assert.doesNotMatch(comp, /notes: existing\.notes,/);
    assert.doesNotMatch(comp, /notes: claim\.codeNotes,/);
  });
});
