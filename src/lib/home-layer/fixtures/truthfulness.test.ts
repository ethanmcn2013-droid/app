/**
 * Unknown stays unknown.
 *
 * The governing rule, made executable. No fixture may cause missing, partial,
 * stale, unsupported, failed, permission-limited or insufficient-history data
 * to render as zero, healthy, complete, empty or all clear — and a quiet day
 * and a broken provider must be visibly different.
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/fixtures/truthfulness.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deriveTrend,
  MAX_EXCEPTIONS,
  NO_BASELINE_COPY,
  PROHIBITED_ANALYTICS_LANGUAGE,
  TREND_MINIMUM_SNAPSHOTS,
  WITHHELD_CLAIMS,
  receiptFor,
  replayOpenWork,
} from "./analytics";
import { accountingBalances, SECTION_LIMITS } from "./derive";
import { badgeDisplay } from "./inbox";
import { homeFixtureWorld, SCENARIO_IDS, scenario } from "./scenarios";
import { HOME_FIXTURE_ORCHARD_PROJECT_IDS } from "./projects";

describe("the read accounting balances, or it is withheld whole", () => {
  for (const id of SCENARIO_IDS) {
    it(`${id}: read = shown + cappedOut + dismissed + cleared, or accounting is null`, () => {
      const { today } = homeFixtureWorld(id);
      if (today.accounting === null) {
        // Withheld. §6: never partially rendered, and never guessed.
        assert.ok(
          today.quiet.blockedBy.includes("Q2"),
          `${id} withheld the accounting without naming Q2 as the reason`,
        );
        return;
      }
      assert.ok(
        accountingBalances(today.accounting),
        `${id} accounting does not balance: ${JSON.stringify(today.accounting)}`,
      );
      assert.ok(today.accounting.cappedOut >= 0, `${id} has a negative cappedOut`);
    });
  }
});

describe("Today shows at most three ranked items, and can explain each", () => {
  for (const id of SCENARIO_IDS) {
    it(`${id}: Today's signal is capped at three`, () => {
      const { today } = homeFixtureWorld(id);
      assert.ok(
        today.sections.todaysSignal.length <= SECTION_LIMITS.todaysSignal.cap,
        `${id} rendered ${today.sections.todaysSignal.length} ranked items`,
      );
    });

    it(`${id}: every rendered row carries a reason, and no reason is a score`, () => {
      const { today } = homeFixtureWorld(id);
      for (const row of Object.values(today.sections).flat()) {
        assert.ok(row.reason.length > 0, `${id}: a row rendered with no reason`);
        assert.equal(
          /\b(score|weight|priority \d|rank \d)\b/i.test(row.reason),
          false,
          `${id}: "${row.reason}" asks the reader to trust arithmetic they cannot see`,
        );
      }
    });

    it(`${id}: every section declares it does not imply completeness`, () => {
      for (const limit of Object.values(SECTION_LIMITS)) {
        assert.equal(limit.impliesCompleteness, false);
      }
    });
  }
});

describe("quiet language is refused whenever anything is unknown", () => {
  it("owner_quiet is a quiet day, not a complete read", () => {
    const { today } = homeFixtureWorld("owner_quiet");
    assert.equal(today.sections.todaysSignal.length, 0);
    // Nothing crossed a rule (Q3 absent), and yet quiet is still refused,
    // because no calendar is connected and no history exists.
    assert.equal(today.quiet.blockedBy.includes("Q3"), false);
    assert.equal(today.quiet.allowed, false);
    assert.deepEqual([...today.quiet.blockedBy], ["Q7", "Q8"]);
  });

  it("a quiet day and a broken provider are visibly different", () => {
    const quiet = homeFixtureWorld("owner_quiet");
    const broken = homeFixtureWorld("provider_failure");
    assert.notDeepEqual(
      [...quiet.today.quiet.blockedBy],
      [...broken.today.quiet.blockedBy],
    );
    // The broken world cannot even compute its accounting; the quiet one can.
    assert.notEqual(quiet.today.accounting, null);
    assert.equal(broken.today.accounting, null);
  });

  it("every degraded world names at least one Q condition", () => {
    for (const id of SCENARIO_IDS) {
      const { today } = homeFixtureWorld(id);
      assert.ok(
        today.quiet.blockedBy.length > 0,
        `${id} allowed quiet language. No V1 world may, because no calendar producer exists.`,
      );
    }
  });
});

describe("no false zero anywhere", () => {
  it("a claim with no population renders null, never 0", () => {
    const { claims } = homeFixtureWorld("new_user");
    for (const claim of claims) {
      assert.equal(claim.value, null, `${claim.metric} rendered a number`);
      assert.equal(claim.status, "unsupported");
      assert.ok(claim.limitation.text.length > 0);
    }
  });

  it("an unresolved Project carries no count and no name", () => {
    const { ledger } = homeFixtureWorld("permission_changed");
    const unresolved = ledger.filter((rowEntry) => rowEntry.state === "unresolved");
    assert.ok(unresolved.length > 0, "permission_changed resolved everything");
    for (const rowEntry of unresolved) {
      assert.equal(rowEntry.openWork, null);
      assert.equal(rowEntry.overdue, null);
      assert.equal(rowEntry.projectName, null);
    }
  });

  it("a badge that could not be read renders no glyph, not a zero", () => {
    const display = badgeDisplay({
      count: 0,
      coverage: "unavailable",
      undeterminedCount: 0,
      unreadableProjectCount: 2,
    });
    assert.equal(display.glyph, null);
    assert.equal(display.accessibleName.includes("0"), false);
  });

  it("a partial badge always carries its disclosure", () => {
    for (const id of SCENARIO_IDS) {
      const { badge, badgeRendered } = homeFixtureWorld(id);
      if (!badgeRendered || badge.coverage !== "partial") continue;
      const display = badgeDisplay(badge);
      assert.ok(
        display.accessibleName.includes("could not"),
        `${id}: a partial badge rendered as a clean number`,
      );
    }
  });

  it("the new user's badge is not rendered at all", () => {
    // There is no Project, so there is nothing for a count to be a count OF.
    assert.equal(homeFixtureWorld("new_user").badgeRendered, false);
  });
});

describe("the trend is earned or it is not drawn", () => {
  it("below the minimum there is no chart, and the gap is exact", () => {
    const trend = deriveTrend(6);
    assert.equal(trend.kind, "insufficient-history");
    if (trend.kind !== "insufficient-history") return;
    assert.equal(trend.renderChart, false);
    assert.equal(trend.comparableSnapshots, 6);
    assert.equal(trend.required, TREND_MINIMUM_SNAPSHOTS);
    assert.match(trend.copy, /6 of 14 comparable daily readings/);
    assert.match(trend.copy, /The earliest this can show a trend is/);
  });

  it("at the minimum exactly one trend renders, and it is open_work", () => {
    const trend = deriveTrend(TREND_MINIMUM_SNAPSHOTS);
    assert.equal(trend.kind, "trend");
    if (trend.kind !== "trend") return;
    assert.equal(trend.metric, "open_work");
    assert.equal(trend.points.length, TREND_MINIMUM_SNAPSHOTS);
  });

  it("insufficient_history draws nothing", () => {
    const { trend } = homeFixtureWorld("insufficient_history");
    assert.equal(trend.kind, "insufficient-history");
    if (trend.kind !== "insufficient-history") return;
    assert.equal(trend.renderChart, false);
  });
});

describe("analytics declares everything a claim must declare", () => {
  it("every claim carries all seven required parts", () => {
    for (const claim of homeFixtureWorld("owner_signature").claims) {
      assert.ok(claim.definition.length > 0, `${claim.metric} has no definition`);
      assert.ok(["reported", "observed", "inferred"].includes(claim.truthClass));
      assert.ok(claim.scope.projects.length > 0);
      assert.ok(claim.window.timezone.length > 0);
      assert.ok(claim.coverage.status.length > 0);
      assert.ok(claim.limitation.text.length > 0);
      assert.ok(claim.correction.instruction.length > 0);
      assert.ok(claim.provenance.evidenceHref.length > 0);
      assert.equal(claim.baseline.kind, "none");
    }
  });

  it("an inferred claim states its rule version; a reported one does not", () => {
    for (const claim of homeFixtureWorld("owner_signature").claims) {
      if (claim.truthClass === "inferred") {
        assert.notEqual(claim.provenance.ruleVersion, null, claim.metric);
      } else {
        assert.equal(claim.provenance.ruleVersion, null, claim.metric);
      }
    }
  });

  it("a claim with no denominator renders no percentage", () => {
    const a1 = homeFixtureWorld("owner_signature").claims[0];
    assert.ok("kind" in a1.population.denominator);
    assert.match(
      (a1.population.denominator as { why: string }).why,
      /not a share/,
    );
  });

  it("the baseline is the literal words, never a dash", () => {
    assert.equal(NO_BASELINE_COPY, "No accepted baseline");
  });

  it("six claims are withheld, each with the defect that withholds it", () => {
    assert.equal(WITHHELD_CLAIMS.length, 6);
    for (const entry of WITHHELD_CLAIMS) {
      assert.equal(entry.rendered, false);
      assert.ok(entry.defect.length > 0);
      assert.ok(entry.because.length > 0);
      assert.ok(entry.shipsWhen.length > 0);
      assert.ok(entry.prohibitedRenderings.includes("0"));
    }
  });

  it("at most three exceptions, and the fourth does not exist", () => {
    for (const id of SCENARIO_IDS) {
      const { exceptions } = homeFixtureWorld(id);
      assert.ok(
        exceptions.length <= MAX_EXCEPTIONS,
        `${id} produced ${exceptions.length} exceptions`,
      );
    }
  });

  it("no suggestion tells the reader what they should do", () => {
    for (const id of SCENARIO_IDS) {
      for (const exception of homeFixtureWorld(id).exceptions) {
        const text = `${exception.headline} ${exception.suggestion}`.toLowerCase();
        for (const phrase of PROHIBITED_ANALYTICS_LANGUAGE) {
          assert.equal(
            text.includes(phrase),
            false,
            `${id}: "${text}" contains prohibited language "${phrase}"`,
          );
        }
      }
    }
  });

  it("the Project ledger is complete: every authorized Project appears once", () => {
    for (const id of SCENARIO_IDS) {
      const world = homeFixtureWorld(id);
      assert.equal(
        world.ledger.length,
        world.scenario.projects.length,
        `${id}: the ledger is not complete`,
      );
      assert.equal(
        new Set(world.ledger.map((entry) => entry.workspaceId)).size,
        world.ledger.length,
      );
    }
  });

  it("scale renders eighteen Projects in the ledger", () => {
    assert.equal(homeFixtureWorld("scale").ledger.length, 18);
  });

  it("a claim replays byte-identically from its own receipt", () => {
    const world = homeFixtureWorld("owner_signature");
    const a1 = world.claims[0];
    const receipt = receiptFor(a1, {
      readScope: "planning-period",
      projects: HOME_FIXTURE_ORCHARD_PROJECT_IDS,
    });
    assert.equal(replayOpenWork(receipt), a1.value);
    assert.ok(receipt.included.length > 0);
    assert.ok(receipt.excluded.length > 0, "the receipt names no exclusions");
  });

  it("permission limitation separates unauthorized from unresolved", () => {
    const { claims } = homeFixtureWorld("permission_changed");
    for (const claim of claims) {
      if (claim.permission.kind !== "limited") continue;
      assert.notEqual(
        claim.permission.unresolved,
        claim.permission.unauthorized,
        "membership held but read refused is not the same as the source not answering",
      );
    }
  });
});

describe("each scenario refuses the sentence that would make it a lie", () => {
  for (const id of SCENARIO_IDS) {
    it(`${id} declares what it must never render`, () => {
      const world = scenario(id);
      assert.ok(
        world.mustNeverRender.length > 0,
        `${id} names nothing it is forbidden to say`,
      );
      // The declared prohibitions must not appear in the fixture's own copy.
      const rendered = JSON.stringify(homeFixtureWorld(id).today);
      for (const phrase of world.mustNeverRender) {
        assert.equal(
          rendered.toLowerCase().includes(phrase.toLowerCase()),
          false,
          `${id}: Today's own copy contains the forbidden phrase "${phrase}"`,
        );
      }
    });
  }
});
