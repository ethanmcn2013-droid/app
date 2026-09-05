import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { freshMemoryDb } from "./memory-test-db";
import { workspaces } from "./schema";
import {
  compRedemptionExpiresAtMs,
  isVenueEditionCompNotes,
  weddingDateMsForWorkspace,
  type CoupleAccessDb,
} from "./couple-access-term";
import { VENUE_EDITION_COUPLE_ACCESS_DAYS } from "@/lib/venue-access-term";

/**
 * R-015 · D-022 — the redemption path, against a real database.
 *
 * `venue-access-term.test.ts` proves the arithmetic. This file proves the
 * redemption decision uses the canonical Project date. The actual creation
 * caller regressions live in actions/planning-wedding-date.test.ts; existing
 * Project update behavior is covered in sponsored-wedding-date.test.ts.
 *
 * Run: node --import tsx --test src/server/db/couple-access-term.test.ts
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const days = (n: number) => n * DAY_MS;
const at = (iso: string) => Date.parse(iso);

const SPONSOR_NOTES = JSON.stringify({
  sponsor_slug: "lambs-hill",
  sponsor_name: "Lamb's Hill",
  source_type: "venue_edition",
});

describe("isVenueEditionCompNotes", () => {
  it("recognises the sponsor JSON issue-codes.ts writes", () => {
    assert.equal(isVenueEditionCompNotes(SPONSOR_NOTES), true);
  });

  it("refuses anything else, so a student code never takes the couple term", () => {
    for (const notes of [
      null,
      "",
      "student:tcd.ie",
      "{",
      JSON.stringify({ sponsor_slug: "x", sponsor_name: "X" }),
      JSON.stringify({ source_type: "venue_edition" }),
      JSON.stringify({ sponsor_slug: "x", sponsor_name: "X", source_type: "gift" }),
    ]) {
      assert.equal(isVenueEditionCompNotes(notes), false, String(notes));
    }
  });
});

describe("compRedemptionExpiresAtMs · the decision the redeem path makes", () => {
  const redeemedAtMs = at("2027-03-01T00:00:00.000Z");

  it("gives a Venue Edition couple the ratified term, not the flat duration", () => {
    const weddingDateMs = at("2028-09-15T00:00:00.000Z");
    const ratified = compRedemptionExpiresAtMs({
      venueEdition: true,
      durationDays: VENUE_EDITION_COUPLE_ACCESS_DAYS,
      redeemedAtMs,
      weddingDateMs,
    });
    const flat = redeemedAtMs + days(VENUE_EDITION_COUPLE_ACCESS_DAYS);
    assert.equal(ratified, weddingDateMs + days(90));
    assert.ok(ratified > weddingDateMs, "the term must outlast the wedding day");
    assert.ok(flat < weddingDateMs, "the flat term genuinely expired first");
  });

  it("falls back to 548 days when the wedding date is unknown, never shorter", () => {
    assert.equal(
      compRedemptionExpiresAtMs({
        venueEdition: true,
        durationDays: VENUE_EDITION_COUPLE_ACCESS_DAYS,
        redeemedAtMs,
        weddingDateMs: null,
      }),
      redeemedAtMs + days(VENUE_EDITION_COUPLE_ACCESS_DAYS),
    );
  });

  it("refuses to shorten even if a code was minted with a short duration", () => {
    assert.equal(
      compRedemptionExpiresAtMs({
        venueEdition: true,
        durationDays: 30,
        redeemedAtMs,
        weddingDateMs: null,
      }),
      redeemedAtMs + days(VENUE_EDITION_COUPLE_ACCESS_DAYS),
    );
  });

  it("leaves every other comp code on the flat duration it always had", () => {
    // The .edu student code is 365 days and nothing about it changes.
    assert.equal(
      compRedemptionExpiresAtMs({
        venueEdition: false,
        durationDays: 365,
        redeemedAtMs,
        weddingDateMs: at("2028-09-15T00:00:00.000Z"),
      }),
      redeemedAtMs + days(365),
    );
  });
});

describe("weddingDateMsForWorkspace", () => {
  it("reads primary_date on a wedding workspace", async () => {
    const { db } = await freshMemoryDb();
    await db.insert(workspaces).values({
      id: "ws-w",
      slug: "ours",
      name: "Ours",
      contextType: "wedding",
      primaryDate: "2028-09-15",
    });
    assert.equal(
      await weddingDateMsForWorkspace(db as CoupleAccessDb, "ws-w"),
      at("2028-09-15T00:00:00.000Z"),
    );
  });

  it("ignores primary_date on a workspace that is not a wedding", async () => {
    // On a student workspace primary_date is an exam. Reading it as a wedding
    // would extend a term against an unrelated date.
    const { db } = await freshMemoryDb();
    await db.insert(workspaces).values({
      id: "ws-s",
      slug: "geography",
      name: "Geography",
      contextType: "class",
      primaryDate: "2028-06-01",
    });
    assert.equal(await weddingDateMsForWorkspace(db as CoupleAccessDb, "ws-s"), null);
  });

  it("returns null for a missing workspace, an empty id and an absent date", async () => {
    const { db } = await freshMemoryDb();
    await db.insert(workspaces).values({
      id: "ws-none",
      slug: "none",
      name: "None",
      contextType: "wedding",
    });
    assert.equal(await weddingDateMsForWorkspace(db as CoupleAccessDb, ""), null);
    assert.equal(await weddingDateMsForWorkspace(db as CoupleAccessDb, "nope"), null);
    assert.equal(await weddingDateMsForWorkspace(db as CoupleAccessDb, "ws-none"), null);
  });
});

/* ── Source contract on the shipped redemption path ───────────────────────
 *
 * The behaviour above is only worth anything if `redeemCompCodeImpl` is the
 * caller. The flat multiply it replaces was one line, and one line is exactly
 * what comes back in a hurried merge. This block fails if it does.
 * ----------------------------------------------------------------------- */

describe("source contract: src/server/actions/comp.ts", () => {
  const comp = readFileSync(
    new URL("../actions/comp.ts", import.meta.url),
    "utf8",
  );

  it("computes redemption expiry through the shared decision, not inline", () => {
    assert.match(comp, /await claimCompEntitlement\(db/);
    const claim = readFileSync(new URL("./comp-redemption.ts", import.meta.url), "utf8");
    assert.match(claim, /compRedemptionExpiresAtMs\(/);
    assert.match(claim, /weddingDateMsForWorkspace\(/);
    assert.match(claim, /from "\.\/couple-access-term"/);
  });

  it("has no flat duration multiply left on the redeem path", () => {
    const raw = comp.slice(
      comp.indexOf("async function redeemCompCodeImpl"),
      comp.indexOf("export type StudentVerifyResult"),
    );
    assert.ok(raw.length > 0, "redeemCompCodeImpl not found");
    // Comments are stripped first. The header comment in comp.ts quotes the
    // defect verbatim on purpose, and a reader who deletes that explanation to
    // make a grep pass has removed the wrong thing.
    const claim = readFileSync(new URL("./comp-redemption.ts", import.meta.url), "utf8");
    const impl = (raw + claim).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    // The exact shape that shipped, and the general shape of any revival.
    assert.doesNotMatch(
      impl,
      /Date\.now\(\)\s*\+\s*row\.durationDays\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/,
    );
    assert.doesNotMatch(impl, /durationDays\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
    assert.doesNotMatch(impl, /durationDays\s*\*\s*DAY_MS/);
  });

  it("keeps the code-lifetime multiply, which is a different number", () => {
    // `expiresInDays` bounds how long an UNREDEEMED code stays redeemable.
    // That is not the couple's access term and is deliberately untouched.
    assert.match(comp, /input\.expiresInDays \* 24 \* 60 \* 60 \* 1000/);
  });
});

describe("source contract: creation cannot extend actor-wide grants", () => {
  it("has no obsolete extension helper or caller wiring", () => {
    const planning = readFileSync(new URL("../actions/planning.ts", import.meta.url), "utf8");
    const term = readFileSync(new URL("./couple-access-term.ts", import.meta.url), "utf8");
    assert.doesNotMatch(planning + term, /extendCoupleAccessForWeddingDate|applyWeddingDateToCoupleAccess|WeddingDateExtension/);
  });
});
