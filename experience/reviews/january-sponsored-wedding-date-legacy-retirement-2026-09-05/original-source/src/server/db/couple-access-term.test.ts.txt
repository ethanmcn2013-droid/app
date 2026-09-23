import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { freshMemoryDb } from "./memory-test-db";
import { compCodes, entitlements, workspaces } from "./schema";
import {
  compRedemptionExpiresAtMs,
  extendCoupleAccessForWeddingDate,
  isVenueEditionCompNotes,
  weddingDateMsForWorkspace,
  type CoupleAccessDb,
} from "./couple-access-term";
import { VENUE_EDITION_COUPLE_ACCESS_DAYS } from "@/lib/venue-access-term";

/**
 * R-015 · D-022 — the redemption path, against a real database.
 *
 * `venue-access-term.test.ts` proves the arithmetic. This file proves the
 * arithmetic is the thing the product writes to `entitlements.expires_at`, and
 * that a wedding date arriving after redemption moves the term later and never
 * earlier.
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

async function seed(options: {
  redeemedAtMs: number;
  expiresAtMs: number | null;
  durationDays?: number;
  compNotes?: string | null;
  code?: string;
}): Promise<{ db: CoupleAccessDb; entitlementId: string }> {
  const { db } = await freshMemoryDb();
  const code = options.code ?? "LAMBSHIL-ABCDE-FGHJK";
  await db.insert(compCodes).values({
    code,
    tier: "wedding",
    durationDays: options.durationDays ?? VENUE_EDITION_COUPLE_ACCESS_DAYS,
    quantity: 1,
    redeemed: 1,
    notes: options.compNotes === undefined ? SPONSOR_NOTES : options.compNotes,
  });
  await db.insert(entitlements).values({
    id: "e-couple",
    workspaceId: "ws-couple",
    userId: "user_couple",
    tier: "wedding",
    source: "comp",
    startedAt: new Date(options.redeemedAtMs),
    expiresAt: options.expiresAtMs == null ? null : new Date(options.expiresAtMs),
    notes: `comp:${code}`,
  });
  return { db: db as CoupleAccessDb, entitlementId: "e-couple" };
}

async function expiryOf(db: CoupleAccessDb, id: string): Promise<number | null> {
  const [row] = await db
    .select({ expiresAt: entitlements.expiresAt })
    .from(entitlements)
    .where(eq(entitlements.id, id));
  return row?.expiresAt ? row.expiresAt.getTime() : null;
}

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

describe("extendCoupleAccessForWeddingDate · only ever later", () => {
  const redeemedAtMs = at("2027-03-01T00:00:00.000Z");
  const floor = redeemedAtMs + days(VENUE_EDITION_COUPLE_ACCESS_DAYS);

  it("A WEDDING DATE ARRIVING AFTER REDEMPTION extends the stored term", async () => {
    const { db, entitlementId } = await seed({ redeemedAtMs, expiresAtMs: floor });
    const result = await extendCoupleAccessForWeddingDate(db, {
      userId: "user_couple",
      weddingDate: "2028-09-15",
    });
    assert.deepEqual(result, { extended: 1, unchanged: 0 });
    assert.equal(
      await expiryOf(db, entitlementId),
      at("2028-09-15T00:00:00.000Z") + days(90),
    );
  });

  it("a postponement extends it again", async () => {
    const { db, entitlementId } = await seed({ redeemedAtMs, expiresAtMs: floor });
    await extendCoupleAccessForWeddingDate(db, {
      userId: "user_couple",
      weddingDate: "2028-09-15",
    });
    const first = await expiryOf(db, entitlementId);
    await extendCoupleAccessForWeddingDate(db, {
      userId: "user_couple",
      weddingDate: "2029-05-02",
    });
    const second = await expiryOf(db, entitlementId);
    assert.ok((second as number) > (first as number));
    assert.equal(second, at("2029-05-02T00:00:00.000Z") + days(90));
  });

  it("an earlier date, a cleared date and a nonsense date all leave it alone", async () => {
    const { db, entitlementId } = await seed({ redeemedAtMs, expiresAtMs: floor });
    await extendCoupleAccessForWeddingDate(db, {
      userId: "user_couple",
      weddingDate: "2030-05-01",
    });
    const long = await expiryOf(db, entitlementId);
    for (const later of ["2028-01-01", null, "", "next June", "2026-02-31"]) {
      const result = await extendCoupleAccessForWeddingDate(db, {
        userId: "user_couple",
        weddingDate: later,
      });
      assert.equal(result.extended, 0, String(later));
      assert.equal(await expiryOf(db, entitlementId), long, String(later));
    }
  });

  it("is idempotent: running it twice with the same date writes once", async () => {
    const { db, entitlementId } = await seed({ redeemedAtMs, expiresAtMs: floor });
    const first = await extendCoupleAccessForWeddingDate(db, {
      userId: "user_couple",
      weddingDate: "2028-09-15",
    });
    const second = await extendCoupleAccessForWeddingDate(db, {
      userId: "user_couple",
      weddingDate: "2028-09-15",
    });
    assert.deepEqual(first, { extended: 1, unchanged: 0 });
    assert.deepEqual(second, { extended: 0, unchanged: 1 });
    assert.equal(
      await expiryOf(db, entitlementId),
      at("2028-09-15T00:00:00.000Z") + days(90),
    );
  });

  it("never introduces an end date on an entitlement that has none", async () => {
    const { db, entitlementId } = await seed({ redeemedAtMs, expiresAtMs: null });
    const result = await extendCoupleAccessForWeddingDate(db, {
      userId: "user_couple",
      weddingDate: "2028-09-15",
    });
    assert.equal(result.extended, 0);
    assert.equal(await expiryOf(db, entitlementId), null);
  });

  it("leaves a non-Venue-Edition comp entitlement untouched", async () => {
    const { db, entitlementId } = await seed({
      redeemedAtMs,
      expiresAtMs: floor,
      compNotes: "student:tcd.ie",
    });
    const result = await extendCoupleAccessForWeddingDate(db, {
      userId: "user_couple",
      weddingDate: "2030-09-15",
    });
    assert.equal(result.extended, 0);
    assert.equal(await expiryOf(db, entitlementId), floor);
  });

  it("does not touch another couple's entitlement", async () => {
    const { db } = await seed({ redeemedAtMs, expiresAtMs: floor });
    await db.insert(entitlements).values({
      id: "e-other",
      workspaceId: "ws-other",
      userId: "user_other",
      tier: "wedding",
      source: "comp",
      startedAt: new Date(redeemedAtMs),
      expiresAt: new Date(floor),
      notes: "comp:LAMBSHIL-ABCDE-FGHJK",
    });
    await extendCoupleAccessForWeddingDate(db, {
      userId: "user_couple",
      weddingDate: "2029-09-15",
    });
    assert.equal(await expiryOf(db, "e-other"), floor);
  });

  it("does nothing without a user id", async () => {
    const { db, entitlementId } = await seed({ redeemedAtMs, expiresAtMs: floor });
    const result = await extendCoupleAccessForWeddingDate(db, {
      userId: "",
      weddingDate: "2029-09-15",
    });
    assert.deepEqual(result, { extended: 0, unchanged: 0 });
    assert.equal(await expiryOf(db, entitlementId), floor);
  });

  it("respects a long minted duration as the floor", async () => {
    // The venue minted 900 days because it knew the date. A near wedding must
    // not claw that back to 548 + 90.
    const { db, entitlementId } = await seed({
      redeemedAtMs,
      expiresAtMs: redeemedAtMs + days(900),
      durationDays: 900,
    });
    const result = await extendCoupleAccessForWeddingDate(db, {
      userId: "user_couple",
      weddingDate: "2027-06-01",
    });
    assert.equal(result.extended, 0);
    assert.equal(await expiryOf(db, entitlementId), redeemedAtMs + days(900));
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

describe("source contract: the wedding date reaches the term", () => {
  const planning = readFileSync(
    new URL("../actions/planning.ts", import.meta.url),
    "utf8",
  );

  it("recomputes the couple's term wherever a wedding date is written", () => {
    assert.match(planning, /extendCoupleAccessForWeddingDate/);
    const calls = planning.match(/applyWeddingDateToCoupleAccess\(/g) ?? [];
    // One definition plus both wedding_season write paths.
    assert.ok(calls.length >= 3, `only ${calls.length} references found`);
  });
});
