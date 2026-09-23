import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  VENUE_EDITION_COUPLE_ACCESS_DAYS,
  VENUE_EDITION_WEDDING_GRACE_DAYS,
  coupleAccessExpiryMs,
  extendedCoupleAccessExpiryMs,
  normaliseWeddingDateMs,
  weddingDateLabel,
} from "./venue-access-term";

/**
 * The access-term rule is implemented twice — here and in
 * `app/src/lib/venue-access-term.ts` — because the production redemption
 * write lives in the app repo while the shared entitlements store lives here.
 *
 * These vectors are the contract between the two copies. The same file exists
 * in both repos, each runs its own implementation against it, and
 * `scripts/check-venue-term-parity.mjs` fails if the two copies of the file
 * ever differ. That turns a silent divergence into a red build.
 */

type Vectors = {
  constants: {
    coupleAccessMonths: number;
    coupleAccessDays: number;
    weddingGraceDays: number;
  };
  normalise: Array<{ input: string; expectedIso: string | null }>;
  expiry: Array<{
    name: string;
    redeemedAt: string;
    weddingDate: string | null;
    mintedDurationDays: number | null;
    expectedExpiry: string;
  }>;
  extend: Array<{
    name: string;
    currentExpiry: string | null;
    redeemedAt: string;
    weddingDate: string | null;
    mintedDurationDays: number | null;
    expectedExpiry: string | null;
  }>;
};

const vectors = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("./venue-edition-term.vectors.json", import.meta.url)),
    "utf8",
  ),
) as Vectors;

test("the shared constants match the vectors", () => {
  assert.equal(VENUE_EDITION_COUPLE_ACCESS_DAYS, vectors.constants.coupleAccessDays);
  assert.equal(VENUE_EDITION_WEDDING_GRACE_DAYS, vectors.constants.weddingGraceDays);
});

test("wedding-date parsing matches the vectors", () => {
  for (const v of vectors.normalise) {
    assert.equal(
      weddingDateLabel(normaliseWeddingDateMs(v.input)),
      v.expectedIso,
      `normalise(${JSON.stringify(v.input)})`,
    );
  }
});

test("expiry computation matches the vectors", () => {
  for (const v of vectors.expiry) {
    assert.equal(
      new Date(
        coupleAccessExpiryMs({
          redeemedAtMs: Date.parse(v.redeemedAt),
          weddingDateMs: v.weddingDate == null ? null : normaliseWeddingDateMs(v.weddingDate),
          mintedDurationDays: v.mintedDurationDays,
        }),
      ).toISOString(),
      v.expectedExpiry,
      v.name,
    );
  }
});

test("recompute matches the vectors", () => {
  for (const v of vectors.extend) {
    const result = extendedCoupleAccessExpiryMs({
      currentExpiresAtMs: v.currentExpiry == null ? null : Date.parse(v.currentExpiry),
      redeemedAtMs: Date.parse(v.redeemedAt),
      weddingDateMs: v.weddingDate == null ? null : normaliseWeddingDateMs(v.weddingDate),
      mintedDurationDays: v.mintedDurationDays,
    });
    assert.equal(
      result == null ? null : new Date(result).toISOString(),
      v.expectedExpiry,
      v.name,
    );
  }
});
