import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, it } from "node:test";
import {
  COUPLE_ACCESS_TERM_SENTENCE,
  VENUE_EDITION_COUPLE_ACCESS_DAYS,
  VENUE_EDITION_WEDDING_GRACE_DAYS,
  coupleAccessDurationDays,
  coupleAccessExpiryMs,
  extendedCoupleAccessExpiryMs,
  normaliseWeddingDateMs,
  weddingDateLabel,
} from "./venue-access-term";

/**
 * R-015 · D-022 — the couple access term.
 *
 * The failure this guards against is the worst outcome the product can
 * produce: a sponsored couple losing Signal Studio before their wedding day,
 * in public, at the venue that gifted it. Irish venues book twelve to
 * twenty-four months out, so a flat 548-day term reaches that failure on
 * ordinary bookings, not edge cases.
 *
 * Run: node --import tsx --test src/lib/venue-access-term.test.ts
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const days = (n: number) => n * DAY_MS;
const at = (iso: string) => Date.parse(iso);

describe("normaliseWeddingDateMs", () => {
  it("reads a calendar day as UTC midnight", () => {
    assert.equal(normaliseWeddingDateMs("2028-09-15"), at("2028-09-15T00:00:00.000Z"));
  });

  it("floors an epoch to its UTC day", () => {
    const noon = at("2028-09-15T12:34:56.000Z");
    assert.equal(normaliseWeddingDateMs(noon), at("2028-09-15T00:00:00.000Z"));
  });

  it("refuses anything it cannot parse rather than defaulting to today", () => {
    // A silent default to "now" is the one value that SHORTENS the term, so
    // every unparseable input has to come back null.
    for (const bad of [
      null,
      undefined,
      "",
      "   ",
      "next June",
      "15/09/2028",
      "2028-9-15",
      "2028-09-15T00:00:00Z",
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      assert.equal(normaliseWeddingDateMs(bad as never), null, String(bad));
    }
  });

  it("rejects a rolled-over date instead of accepting the roll", () => {
    // Date.parse("2026-02-31") silently becomes 3 March. Accepting that would
    // put a couple's term on a day they never entered.
    assert.equal(normaliseWeddingDateMs("2026-02-31"), null);
    assert.equal(normaliseWeddingDateMs("2026-13-01"), null);
    assert.equal(normaliseWeddingDateMs("2028-02-29"), at("2028-02-29T00:00:00.000Z"));
  });

  it("round-trips through the label helper", () => {
    assert.equal(weddingDateLabel(normaliseWeddingDateMs("2028-09-15")), "2028-09-15");
    assert.equal(weddingDateLabel(null), null);
    assert.equal(weddingDateLabel(Number.NaN), null);
  });
});

describe("coupleAccessExpiryMs · the floor", () => {
  const redeemedAtMs = at("2027-03-01T09:00:00.000Z");

  it("with no wedding date, runs exactly 548 days from redemption", () => {
    assert.equal(
      coupleAccessExpiryMs({ redeemedAtMs }),
      redeemedAtMs + days(VENUE_EDITION_COUPLE_ACCESS_DAYS),
    );
  });

  it("treats an unparseable wedding date as no wedding date, never as shorter", () => {
    const floor = redeemedAtMs + days(VENUE_EDITION_COUPLE_ACCESS_DAYS);
    assert.equal(coupleAccessExpiryMs({ redeemedAtMs, weddingDateMs: null }), floor);
    assert.equal(
      coupleAccessExpiryMs({ redeemedAtMs, weddingDateMs: Number.NaN }),
      floor,
    );
  });

  it("never returns less than 548 days, whatever the wedding date says", () => {
    // A wedding already in the past, a wedding tomorrow, a wedding a week out:
    // all of them still leave the couple the full ratified term.
    for (const wedding of ["2020-01-01", "2027-03-02", "2027-03-08", "2028-06-01"]) {
      const expiry = coupleAccessExpiryMs({
        redeemedAtMs,
        weddingDateMs: normaliseWeddingDateMs(wedding),
      });
      assert.ok(
        expiry - redeemedAtMs >= days(VENUE_EDITION_COUPLE_ACCESS_DAYS),
        `${wedding} produced ${(expiry - redeemedAtMs) / DAY_MS} days`,
      );
    }
  });

  it("honours a minted duration LONGER than the floor", () => {
    // A venue that already knew a long-lead date at mint time chose that term
    // deliberately. A couple who then declines to enter a date keeps it.
    assert.equal(
      coupleAccessExpiryMs({ redeemedAtMs, mintedDurationDays: 900 }),
      redeemedAtMs + days(900),
    );
  });

  it("ignores a minted duration SHORTER than the floor", () => {
    assert.equal(
      coupleAccessExpiryMs({ redeemedAtMs, mintedDurationDays: 30 }),
      redeemedAtMs + days(VENUE_EDITION_COUPLE_ACCESS_DAYS),
    );
    assert.equal(
      coupleAccessExpiryMs({ redeemedAtMs, mintedDurationDays: null }),
      redeemedAtMs + days(VENUE_EDITION_COUPLE_ACCESS_DAYS),
    );
  });
});

describe("coupleAccessExpiryMs · the grace rule", () => {
  it("gives three months past the wedding when that is later", () => {
    const redeemedAtMs = at("2027-03-01T09:00:00.000Z");
    const wedding = normaliseWeddingDateMs("2028-09-15");
    assert.equal(
      coupleAccessExpiryMs({ redeemedAtMs, weddingDateMs: wedding }),
      (wedding as number) + days(VENUE_EDITION_WEDDING_GRACE_DAYS),
    );
  });

  it("THE R-015 SCENARIO: signs March 2027, marries September 2028, redeems on the day", () => {
    // This is the case the register describes, and the case a flat term gets
    // wrong. 548 days from 2027-03-01 is 2028-08-30 — sixteen days BEFORE the
    // wedding. The couple would lose the product they were planning it in.
    const redeemedAtMs = at("2027-03-01T00:00:00.000Z");
    const weddingDateMs = normaliseWeddingDateMs("2028-09-15") as number;

    const flatMultiply = redeemedAtMs + days(VENUE_EDITION_COUPLE_ACCESS_DAYS);
    assert.ok(
      flatMultiply < weddingDateMs,
      "the flat term must genuinely expire before the wedding, or this test proves nothing",
    );

    const expiry = coupleAccessExpiryMs({
      redeemedAtMs,
      weddingDateMs,
      mintedDurationDays: VENUE_EDITION_COUPLE_ACCESS_DAYS,
    });
    assert.ok(expiry > weddingDateMs, "access must outlast the wedding day");
    assert.equal(expiry, weddingDateMs + days(90));
    assert.notEqual(expiry, flatMultiply);
  });

  it("has no upper cap: a three-year lead gets three years plus the grace", () => {
    const redeemedAtMs = at("2026-09-01T00:00:00.000Z");
    const weddingDateMs = normaliseWeddingDateMs("2029-09-01") as number;
    const expiry = coupleAccessExpiryMs({ redeemedAtMs, weddingDateMs });
    assert.equal(expiry, weddingDateMs + days(90));
    assert.ok((expiry - redeemedAtMs) / DAY_MS > 1000);
  });

  it("expressed as a mint-time duration, never dips below the floor", () => {
    const issuedAtMs = at("2027-03-01T00:00:00.000Z");
    assert.equal(
      coupleAccessDurationDays({ issuedAtMs }),
      VENUE_EDITION_COUPLE_ACCESS_DAYS,
    );
    assert.equal(
      coupleAccessDurationDays({ issuedAtMs, weddingDateMs: normaliseWeddingDateMs("2027-04-01") }),
      VENUE_EDITION_COUPLE_ACCESS_DAYS,
    );
    assert.ok(
      coupleAccessDurationDays({
        issuedAtMs,
        weddingDateMs: normaliseWeddingDateMs("2029-01-01"),
      }) > VENUE_EDITION_COUPLE_ACCESS_DAYS,
    );
  });
});

describe("extendedCoupleAccessExpiryMs · the term only ever moves later", () => {
  const redeemedAtMs = at("2027-03-01T00:00:00.000Z");
  const floor = redeemedAtMs + days(VENUE_EDITION_COUPLE_ACCESS_DAYS);

  it("A WEDDING DATE ARRIVING AFTER REDEMPTION extends the term", () => {
    // The product cannot reliably supply the date at redemption, so this is
    // the path that actually carries D-022 for most couples.
    const weddingDateMs = normaliseWeddingDateMs("2028-11-20") as number;
    const next = extendedCoupleAccessExpiryMs({
      currentExpiresAtMs: floor,
      redeemedAtMs,
      weddingDateMs,
      mintedDurationDays: VENUE_EDITION_COUPLE_ACCESS_DAYS,
    });
    assert.equal(next, weddingDateMs + days(90));
    assert.ok((next as number) > floor);
  });

  it("a postponement extends it again", () => {
    const first = extendedCoupleAccessExpiryMs({
      currentExpiresAtMs: floor,
      redeemedAtMs,
      weddingDateMs: normaliseWeddingDateMs("2028-06-10"),
    }) as number;
    const postponed = extendedCoupleAccessExpiryMs({
      currentExpiresAtMs: first,
      redeemedAtMs,
      weddingDateMs: normaliseWeddingDateMs("2029-06-10"),
    }) as number;
    assert.ok(postponed > first);
    assert.equal(postponed, (normaliseWeddingDateMs("2029-06-10") as number) + days(90));
  });

  it("a correction that would pull the date EARLIER changes nothing", () => {
    const long = extendedCoupleAccessExpiryMs({
      currentExpiresAtMs: floor,
      redeemedAtMs,
      weddingDateMs: normaliseWeddingDateMs("2030-05-01"),
    }) as number;
    const corrected = extendedCoupleAccessExpiryMs({
      currentExpiresAtMs: long,
      redeemedAtMs,
      weddingDateMs: normaliseWeddingDateMs("2028-05-01"),
    });
    assert.equal(corrected, long, "a typo fix must never take access away");
  });

  it("clearing the date entirely changes nothing", () => {
    const long = extendedCoupleAccessExpiryMs({
      currentExpiresAtMs: floor,
      redeemedAtMs,
      weddingDateMs: normaliseWeddingDateMs("2030-05-01"),
    }) as number;
    assert.equal(
      extendedCoupleAccessExpiryMs({
        currentExpiresAtMs: long,
        redeemedAtMs,
        weddingDateMs: null,
      }),
      long,
    );
  });

  it("never introduces an end date on a row that has none", () => {
    assert.equal(
      extendedCoupleAccessExpiryMs({
        currentExpiresAtMs: null,
        redeemedAtMs,
        weddingDateMs: normaliseWeddingDateMs("2028-09-15"),
      }),
      null,
    );
  });

  it("is monotonic across a randomised sequence of date edits", () => {
    // Property check rather than a chosen example: whatever order the couple
    // edits their date in, the expiry the product holds is non-decreasing.
    let current: number | null = floor;
    let previous = floor;
    for (let i = 0; i < 400; i++) {
      const offsetDays = Math.floor(Math.random() * 2000) - 400;
      const candidate = new Date(redeemedAtMs + days(offsetDays))
        .toISOString()
        .slice(0, 10);
      current = extendedCoupleAccessExpiryMs({
        currentExpiresAtMs: current,
        redeemedAtMs,
        weddingDateMs: normaliseWeddingDateMs(candidate),
      });
      assert.ok(
        (current as number) >= previous,
        `edit ${i} (${candidate}) shortened the term`,
      );
      previous = current as number;
    }
  });
});

describe("the flat multiply this replaces", () => {
  it("is provably a different answer, not a refactor", () => {
    // `src/server/actions/comp.ts` shipped
    //   new Date(Date.now() + row.durationDays * 24 * 60 * 60 * 1000)
    // for every code, Venue Edition included. Reconstructed here so the
    // difference is a value in the diff, not a claim in a comment.
    const redeemedAtMs = at("2027-03-01T00:00:00.000Z");
    const durationDays = VENUE_EDITION_COUPLE_ACCESS_DAYS;
    const shipped = redeemedAtMs + durationDays * 24 * 60 * 60 * 1000;
    const ratified = coupleAccessExpiryMs({
      redeemedAtMs,
      weddingDateMs: normaliseWeddingDateMs("2028-09-15"),
      mintedDurationDays: durationDays,
    });
    assert.notEqual(ratified, shipped);
    // 548 days from 2027-03-01 lands on 2028-08-30. The wedding is 2028-09-15
    // and the term now runs to 2028-12-14: 106 days of difference, sixteen of
    // which fall before the wedding day itself.
    assert.equal((ratified - shipped) / DAY_MS, 106);
  });
});

describe("couple-facing wording", () => {
  it("states the ratified term and carries no banned register", () => {
    assert.match(COUPLE_ACCESS_TERM_SENTENCE, /Eighteen months/);
    assert.match(COUPLE_ACCESS_TERM_SENTENCE, /three months past your wedding/);
    assert.match(COUPLE_ACCESS_TERM_SENTENCE, /whichever is later/);
    assert.doesNotMatch(COUPLE_ACCESS_TERM_SENTENCE, /[—–!]/);
    assert.doesNotMatch(COUPLE_ACCESS_TERM_SENTENCE, /for life|forever|perpetuit/i);
  });
});

/* ── The couple-facing surfaces ────────────────────────────────────────────
 *
 * Three shipped strings described the term as a flat year: the sign-up bridge
 * said the venue "is covering your year", and the plan view said "A year of
 * Signal Studio" and "When the year is up". A fourth said the term ran "for
 * life" whenever no end date was present. All four were wrong about the
 * ratified rule, and a flat-year sentence is the kind of copy that comes back.
 * ------------------------------------------------------------------------ */

const surface = (relative: string) =>
  readFileSync(new URL(relative, import.meta.url), "utf8");

describe("couple-facing copy states the ratified term", () => {
  const signUp = surface("../app/sign-up/[[...sign-up]]/page.tsx");
  const planView = surface("../components/settings/plan/plan-view.tsx");
  const redeemCard = surface("../components/redeem/redeem-result-card.tsx");
  const all = [
    ["sign-up bridge", signUp],
    ["settings plan view", planView],
    ["redeem result card", redeemCard],
  ] as const;

  it("carries no flat-year description of the term anywhere", () => {
    for (const [name, source] of all) {
      for (const banned of [
        /covering your year/i,
        /a year of signal studio/i,
        /when the year is up/i,
        /until\s+in a year/i,
      ]) {
        assert.doesNotMatch(source, banned, `${name} · ${banned}`);
      }
    }
  });

  it("promises nothing unconditional", () => {
    for (const [name, source] of all) {
      // Comments are stripped: the redeem card's comment names the banned
      // wording on purpose so the next reader knows why the branch exists.
      const prose = source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      assert.doesNotMatch(prose, /for life|forever|in perpetuity/i, name);
    }
  });

  it("states the whole rule where it states the rule at all", () => {
    for (const [name, source] of [
      ["sign-up bridge", signUp],
      ["settings plan view", planView],
    ] as const) {
      assert.match(source, /Eighteen\s+months/, name);
      assert.match(source, /three\s+months past your wedding/, name);
      assert.match(source, /whichever is later/, name);
    }
  });
});

/* ── Cross-repository parity ───────────────────────────────────────────────
 *
 * `src/lib/venue-access-term.ts` is a port of `studio/src/lib/venue-edition.ts`
 * because the two repositories build separately and cannot import from each
 * other. A port invites drift, so when a studio checkout sits beside this one
 * both implementations are executed over the same matrix and asserted equal.
 *
 * In CI, where studio is absent, this block reports plainly that it did not
 * run. It is not the only defence: every rule above is pinned by explicit
 * vectors that hold with no studio checkout at all.
 * ------------------------------------------------------------------------ */

const here = dirname(fileURLToPath(import.meta.url));
const studioRoot =
  process.env.STUDIO_REPO_PATH ?? resolve(here, "..", "..", "..", "studio");
const studioModule = join(studioRoot, "src", "lib", "venue-edition.ts");

describe("parity with studio/src/lib/venue-edition.ts", () => {
  it("answers identically on every case, or says why it could not check", async (t) => {
    if (!existsSync(studioModule)) {
      // A drift check that skips itself in CI protects a workstation and nothing
      // else, which is the defect class that produced R-015 in the first place:
      // a control that exists and never runs where it matters. In CI the absent
      // studio checkout is a hard failure, so the parity guarantee is either
      // enforced or visibly broken — never quietly absent.
      if (process.env.CI) {
        throw new Error(
          `No studio checkout at ${studioModule}. This differential test is the only thing stopping ` +
            `app and studio from silently diverging on the D-022 access term, so it must not be skipped in CI. ` +
            `Set STUDIO_REPO_PATH to the studio repository in the workflow, or check studio out beside app.`,
        );
      }
      t.diagnostic(
        `SKIPPED: no studio checkout at ${studioModule}. Set STUDIO_REPO_PATH to run the differential check. The explicit vectors above still ran. This skip is refused when CI is set.`,
      );
      return;
    }
    const studio = (await import(pathToFileURL(studioModule).href)) as {
      VENUE_EDITION_COUPLE_ACCESS_DAYS: number;
      VENUE_EDITION_WEDDING_GRACE_DAYS: number;
      normaliseWeddingDateMs: typeof normaliseWeddingDateMs;
      coupleAccessExpiryMs: typeof coupleAccessExpiryMs;
      coupleAccessDurationDays: typeof coupleAccessDurationDays;
      extendedCoupleAccessExpiryMs: typeof extendedCoupleAccessExpiryMs;
    };

    assert.equal(
      studio.VENUE_EDITION_COUPLE_ACCESS_DAYS,
      VENUE_EDITION_COUPLE_ACCESS_DAYS,
    );
    assert.equal(
      studio.VENUE_EDITION_WEDDING_GRACE_DAYS,
      VENUE_EDITION_WEDDING_GRACE_DAYS,
    );

    const dateInputs = [
      null,
      undefined,
      "",
      "not a date",
      "2026-02-31",
      "2020-01-01",
      "2027-03-01",
      "2028-09-15",
      "2031-12-31",
      at("2028-09-15T18:00:00.000Z"),
      Number.NaN,
    ];
    for (const input of dateInputs) {
      assert.equal(
        studio.normaliseWeddingDateMs(input as never),
        normaliseWeddingDateMs(input as never),
        `normaliseWeddingDateMs(${String(input)})`,
      );
    }

    const redemptions = [
      at("2026-09-01T00:00:00.000Z"),
      at("2027-03-01T09:30:00.000Z"),
      at("2028-01-15T23:59:59.000Z"),
    ];
    const durations = [null, 0, 100, 548, 900, 1500];
    let cases = 0;
    for (const redeemedAtMs of redemptions) {
      for (const raw of dateInputs) {
        const weddingDateMs = normaliseWeddingDateMs(raw as never);
        for (const mintedDurationDays of durations) {
          assert.equal(
            studio.coupleAccessExpiryMs({ redeemedAtMs, weddingDateMs, mintedDurationDays }),
            coupleAccessExpiryMs({ redeemedAtMs, weddingDateMs, mintedDurationDays }),
            `coupleAccessExpiryMs(${redeemedAtMs}, ${String(raw)}, ${mintedDurationDays})`,
          );
          for (const current of [null, redeemedAtMs, redeemedAtMs + days(548), redeemedAtMs + days(4000)]) {
            assert.equal(
              studio.extendedCoupleAccessExpiryMs({
                currentExpiresAtMs: current,
                redeemedAtMs,
                weddingDateMs,
                mintedDurationDays,
              }),
              extendedCoupleAccessExpiryMs({
                currentExpiresAtMs: current,
                redeemedAtMs,
                weddingDateMs,
                mintedDurationDays,
              }),
              `extendedCoupleAccessExpiryMs(${current}, ${redeemedAtMs}, ${String(raw)}, ${mintedDurationDays})`,
            );
            cases += 1;
          }
        }
        assert.equal(
          studio.coupleAccessDurationDays({ issuedAtMs: redeemedAtMs, weddingDateMs }),
          coupleAccessDurationDays({ issuedAtMs: redeemedAtMs, weddingDateMs }),
        );
      }
    }
    assert.ok(cases > 700, `only ${cases} differential cases ran`);
    t.diagnostic(`differential parity checked over ${cases} cases`);
  });
});
