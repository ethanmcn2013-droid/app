/**
 * Golden oracles · the executable suite.
 *
 * THE COMPARISON LAYER, and the only file in this directory allowed to hold
 * both an oracle and the fixture derivation it certifies. Everything else
 * under `oracles/` is written from the contracts and is forbidden by
 * `independence.ts` from importing a derivation — that guard is itself the
 * first test below, because an oracle suite whose independence is only a
 * convention is one refactor away from being a tautology.
 *
 * Each test does one of three jobs:
 *   1. INTERNAL CONSISTENCY — the fixture's own records support the claims
 *      made about them, whether or not any production code exists yet.
 *   2. AGREEMENT — the oracle's independently derived answer equals the
 *      fixture's published answer, term by term.
 *   3. PINNED DIVERGENCE — where the two genuinely disagree, or where the
 *      contract does not decide, the exact measurement is asserted so it
 *      cannot drift silently. Those live in `findings.ts`.
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/oracles/oracles.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ANALYTICS_SIGNATURE_CONTEXT,
  PROHIBITED_ANALYTICS_LANGUAGE,
  WITHHELD_CLAIMS,
  receiptFor,
  type ClaimContext,
} from "../fixtures/analytics";
import {
  HOME_FIXTURE_DST,
  HOME_FIXTURE_NOW_ISO,
  HOME_FIXTURE_TODAY,
} from "../fixtures/clock";
import { HOME_INBOX_SNOOZE_CASES } from "../fixtures/inbox";
import {
  MY_WORK_COLUMN_CONFIGS,
  MY_WORK_DST_ROWS,
  MY_WORK_QUIET_ROWS,
  MY_WORK_SCALE_ROWS,
  MY_WORK_SIGNATURE_ROWS,
} from "../fixtures/my-work";
import { TODAY_CANDIDATE_SETS } from "../fixtures/today";
import {
  HOME_FIXTURE_ALL_PROJECTS,
  HOME_FIXTURE_ORCHARD_PROJECT_IDS,
  HOME_FIXTURE_PERIOD_ORCHARD,
  HOME_FIXTURE_PROJECTS,
  HOME_FIXTURE_PROJECT_IDS,
  HOME_FIXTURE_PROJECT_WORDS,
} from "../fixtures/projects";
import { homeFixtureWorld } from "../fixtures/scenarios";
import {
  oracleMissingClaimFields,
  oracleProhibitedLanguageHits,
  oracleReplayOpenWork,
  oracleShareIsComputable,
  oracleTotals,
  oracleTrendRendersChart,
  oracleUnownedContradictions,
  oracleUntraceableIds,
  oracleValueIsHonest,
  ORACLE_CLAIM_IDS,
  ORACLE_TREND_MINIMUM_SNAPSHOTS,
} from "./analytics.oracle";
import { ORACLE_FINDINGS, findingById } from "./findings";
import { checkOracleIndependence, GUARDED_FILES } from "./independence";
import {
  oracleBadge,
  oracleBadgeIgnoresVisibility,
  oracleEffectiveDisposition,
  oracleIllegalDispositionRows,
  oracleIllegalReadRows,
  oracleOccupiedCells,
  ORACLE_EIGHT_CELLS,
} from "./inbox.oracle";
import {
  oracleGroup,
  oracleIsDone,
  oracleIsDoneNaive,
  oracleProjectMyWork,
  oracleWaiting,
  ORACLE_GROUP_REASONS,
  ORACLE_NEXT_WINDOW_DAYS,
} from "./my-work.oracle";
import {
  addDays,
  daysBetween,
  instantAtLocalWallTime,
  zonedCalendarDate,
  ORACLE_ZONE,
} from "./oracle-clock";
import {
  oracleProjectsInPeriod,
  oracleReadableProjects,
  oracleRevoke,
  oracleScanForStrings,
  oracleIsContextId,
  ORACLE_REVOKED_CLIENT_PAYLOAD,
} from "./scope.oracle";
import {
  oracleVisibilityResolver,
  oracleWorldInputs,
  SCENARIO_IDS,
  type ScenarioId,
} from "./scenario-inputs";
import {
  oracleRankToday,
  ORACLE_SECTION_PRECEDENCE,
  type OracleTodayResult,
} from "./today.oracle";

// ── Shared helpers ──────────────────────────────────────────────────────────

function runToday(id: ScenarioId): OracleTodayResult {
  const inputs = oracleWorldInputs(id);
  return oracleRankToday({
    candidates: inputs.scenario.todayCandidates,
    today: inputs.today,
    asOfIso: inputs.asOfIso,
    coverage: inputs.coverage,
  });
}

function runBadge(id: ScenarioId) {
  const inputs = oracleWorldInputs(id);
  return oracleBadge({
    events: inputs.inboxEvents,
    states: inputs.inboxStates,
    recipientUserId: inputs.recipientUserId,
    nowMs: inputs.nowMs,
    liveProjectIds: inputs.readable,
    unreadableProjectCount: inputs.unresolved.length,
    sourceVisibilityOf: oracleVisibilityResolver(inputs.inboxDisplay),
  });
}

function runMyWork(id: ScenarioId) {
  const inputs = oracleWorldInputs(id);
  return oracleProjectMyWork({
    rows: inputs.myWorkRows,
    frame: inputs.myWorkFrame,
    configs: MY_WORK_COLUMN_CONFIGS,
    projectsAuthorized: inputs.scenario.projects,
    projectsUnresolved: inputs.unresolved,
    pageSize: inputs.myWorkPageSize,
  });
}

function runTotals(id: ScenarioId) {
  const inputs = oracleWorldInputs(id);
  return oracleTotals({
    // The world's OWN population, rejoined from its own source records by
    // `oracleAnalyticsRows`. Reading a module-level constant here would let a
    // second Analytics population back in through the oracle's own door.
    rows: inputs.analyticsRows,
    projects: inputs.readable,
    today: inputs.today,
    windowStartIso: instantAtLocalWallTime(
      addDays(inputs.today, -28),
      0,
      0,
      ORACLE_ZONE,
    ).iso,
    windowEndIso: inputs.asOfIso,
  });
}

/**
 * Every source id this universe holds: the records Today ranks and the
 * records My work lists, across every world. Rebuilt from the raw record
 * modules rather than from any derivation, because it is the set an Analytics
 * id has to land in for a reviewer to be able to reach the row.
 */
function sharedSourceIds(): readonly string[] {
  return [
    ...Object.values(TODAY_CANDIDATE_SETS)
      .flat()
      .map((signal) => signal.ref.id),
    ...[
      ...MY_WORK_SIGNATURE_ROWS,
      ...MY_WORK_QUIET_ROWS,
      ...MY_WORK_DST_ROWS,
      ...MY_WORK_SCALE_ROWS,
    ].map((row) => row.taskId),
  ];
}

const sectionSizes = (sections: Record<string, readonly unknown[]>) => ({
  todaysSignal: sections.todaysSignal.length,
  comingUp: sections.comingUp.length,
  needsReview: sections.needsReview.length,
  movingWell: sections.movingWell.length,
});

// ── 0 · the guard that makes the rest of the suite mean something ───────────

describe("Oracle independence", () => {
  it("no oracle imports a module or binding that computes the answer it checks", () => {
    const violations = checkOracleIndependence();
    assert.deepEqual(
      violations,
      [],
      `an oracle imported a derivation it exists to certify:\n${violations
        .map((v) => `  ${v.file}: ${v.reason}`)
        .join("\n")}`,
    );
  });

  it("the guard actually covers every oracle module", () => {
    assert.equal(GUARDED_FILES.length, 7);
    for (const file of GUARDED_FILES) {
      assert.ok(!file.endsWith(".test.ts"), `${file} is the comparison layer`);
    }
  });
});

// ── 1 · the independent clock, checked against the pinned constants ─────────

describe("Oracle clock", () => {
  it("derives the fixture's pinned today from its pinned instant", () => {
    assert.equal(
      zonedCalendarDate(HOME_FIXTURE_NOW_ISO, ORACLE_ZONE),
      HOME_FIXTURE_TODAY,
      "the universe's `today` is not the day its `asOf` falls on in Europe/London",
    );
  });

  it("counts calendar days across the October clock change without an offset", () => {
    // 12:00 BST Saturday to 12:00 GMT Sunday is 25 hours and exactly one day.
    const saturday = "2026-10-24T11:00:00.000Z";
    const sunday = "2026-10-25T12:00:00.000Z";
    assert.equal(
      (Date.parse(sunday) - Date.parse(saturday)) / 3_600_000,
      25,
      "the two instants chosen are not 25 hours apart, so this proves nothing",
    );
    assert.equal(
      daysBetween(
        zonedCalendarDate(saturday, ORACLE_ZONE),
        zonedCalendarDate(sunday, ORACLE_ZONE),
      ),
      1,
      "a 25-hour local day was counted as something other than one calendar day",
    );
  });

  it("resolves both irregular local times by INBOX_EVENT §10.3, measured", () => {
    const ambiguous = instantAtLocalWallTime(
      HOME_FIXTURE_DST.autumn.calendarDate,
      HOME_FIXTURE_DST.autumn.ambiguousLocal.hour,
      HOME_FIXTURE_DST.autumn.ambiguousLocal.minute,
      ORACLE_ZONE,
    );
    assert.equal(ambiguous.adjustment, "earlier-of-ambiguous");
    assert.equal(ambiguous.iso, HOME_FIXTURE_DST.autumn.earlierInstantIso);
    assert.notEqual(ambiguous.iso, HOME_FIXTURE_DST.autumn.laterInstantIso);

    const gap = instantAtLocalWallTime(
      HOME_FIXTURE_DST.spring.calendarDate,
      HOME_FIXTURE_DST.spring.gapLocal.hour,
      HOME_FIXTURE_DST.spring.gapLocal.minute,
      ORACLE_ZONE,
    );
    assert.equal(gap.adjustment, "forward-from-gap");
    assert.equal(gap.iso, HOME_FIXTURE_DST.spring.forwardInstantIso);
  });

  it("agrees with every declared snooze case, resolved independently", () => {
    const resolve = (id: string) => {
      if (id === "snooze-later-today") {
        return instantAtLocalWallTime("2026-07-16", 18, 0, ORACLE_ZONE);
      }
      if (id === "snooze-ambiguous-autumn") {
        return instantAtLocalWallTime(
          HOME_FIXTURE_DST.autumn.calendarDate,
          HOME_FIXTURE_DST.autumn.ambiguousLocal.hour,
          HOME_FIXTURE_DST.autumn.ambiguousLocal.minute,
          ORACLE_ZONE,
        );
      }
      return instantAtLocalWallTime(
        HOME_FIXTURE_DST.spring.calendarDate,
        HOME_FIXTURE_DST.spring.gapLocal.hour,
        HOME_FIXTURE_DST.spring.gapLocal.minute,
        ORACLE_ZONE,
      );
    };
    assert.equal(HOME_INBOX_SNOOZE_CASES.length, 3);
    for (const snoozeCase of HOME_INBOX_SNOOZE_CASES) {
      const resolved = resolve(snoozeCase.id);
      assert.equal(
        resolved.iso,
        snoozeCase.expectedResurfaceIso,
        `${snoozeCase.id} resolved to a different instant than the fixture declares`,
      );
      assert.equal(resolved.adjustment, snoozeCase.adjustment, snoozeCase.id);
    }
  });
});

// ── 2 · Today: ranking order, sections, accounting, quiet ───────────────────

describe("Today oracle · internal consistency of the fixture", () => {
  it("the signature world puts exactly three items in Today's signal, and names what it held back", () => {
    const result = runToday("owner_signature");
    assert.equal(
      result.sections.todaysSignal.length,
      3,
      "Today's signal is capped at 3 across the whole section (§5)",
    );
    assert.deepEqual(
      result.sections.todaysSignal.map((row) => row.trigger),
      ["due-soon", "due-soon", "crowded-week"],
      "the three eligible items are not the three the ranking rules select",
    );
    assert.deepEqual(
      result.sections.todaysSignal.map((row) => row.key),
      [
        "tasks:task:home-task-mf-kitchen-numbers",
        "tasks:task:home-task-mf-seating-plan",
        null,
      ],
      "the third row is a synthetic reading, which carries no object id (§4.4)",
    );
    assert.equal(result.accounting.flagged, 9);
    assert.equal(result.accounting.cappedOut, 2, "held back is not clear (§6)");
    assert.ok(
      result.accounting.cappedOut > 0,
      "a world that caps nothing cannot demonstrate the cappedOut rendering",
    );
  });

  it("the §6 identity balances exactly in all thirteen worlds", () => {
    for (const id of SCENARIO_IDS) {
      const { accounting, balances } = runToday(id);
      assert.ok(
        balances,
        `${id}: read ${accounting.read} != shown ${accounting.shown} + cappedOut ${accounting.cappedOut} + dismissed ${accounting.dismissed} + cleared ${accounting.cleared}`,
      );
      assert.equal(
        accounting.shown + accounting.cappedOut,
        accounting.flagged,
        `${id}: shown + cappedOut must be exactly the flagged set`,
      );
      assert.ok(accounting.cappedOut >= 0, `${id}: cappedOut went negative`);
      assert.ok(accounting.cleared >= 0, `${id}: cleared went negative`);
    }
  });

  it("dismissed is counted separately and never folded into cleared", () => {
    const signature = runToday("owner_signature");
    assert.equal(
      signature.accounting.dismissed,
      1,
      "the signature world silences exactly one item that crossed a rule (Q5)",
    );
    const quiet = runToday("owner_quiet");
    assert.equal(
      quiet.accounting.dismissed,
      0,
      "the quiet day dismisses nothing — that is what makes it the quiet day",
    );
  });

  it("only the quiet day could ever say nothing crossed a rule, and it still may not", () => {
    const quiet = runToday("owner_quiet");
    assert.equal(quiet.accounting.flagged, 0, "nothing crosses a rule");
    assert.equal(quiet.accounting.cleared, 4, "and all four items are genuinely clear");
    assert.deepEqual(
      [...quiet.quietBlockedBy],
      ["Q7", "Q8"],
      "Q7 (calendar has no producer) and Q8 (no snapshots) still forbid all-clear language",
    );
    // Q9, the new-user condition, is a different refusal from a quiet day.
    const newUser = runToday("new_user");
    assert.ok(
      newUser.quietBlockedBy.includes("Q9"),
      "an empty authorized set is not a quiet day",
    );
    assert.equal(newUser.accounting.read, 0);
  });

  it("no world in this universe is permitted quiet language", () => {
    for (const id of SCENARIO_IDS) {
      const result = runToday(id);
      assert.ok(
        result.quietBlockedBy.length > 0,
        `${id} would be allowed to say "all clear", which no V1 world may`,
      );
    }
  });

  it("ranking is a pure function of its inputs — two calls are identical", () => {
    for (const id of SCENARIO_IDS) {
      assert.deepEqual(runToday(id), runToday(id), `${id} is not deterministic`);
    }
  });

  it("the comparator is a total order over the signature world", () => {
    const result = runToday("owner_signature");
    const keys = Object.values(result.sections)
      .flat()
      .map((row) => row.key)
      .filter((key): key is string => key !== null);
    assert.equal(
      new Set(keys).size,
      keys.length,
      "a sourceKey rendered in two sections — §5 disjointness is broken",
    );
  });
});

describe("Today oracle · agreement with the fixture derivation", () => {
  it("section shapes agree in all thirteen worlds", () => {
    for (const id of SCENARIO_IDS) {
      const oracle = runToday(id);
      const fixture = homeFixtureWorld(id).today;
      assert.deepEqual(
        sectionSizes(oracle.sections as never),
        sectionSizes(fixture.sections as never),
        `${id}: section sizes disagree`,
      );
      for (const section of [
        "todaysSignal",
        "comingUp",
        "needsReview",
        "movingWell",
      ] as const) {
        assert.deepEqual(
          oracle.sections[section].map((row) => row.key),
          fixture.sections[section].map((row) =>
            row.ref ? `${row.ref.product}:${row.ref.kind}:${row.ref.id}` : null,
          ),
          `${id}/${section}: the rendered order disagrees`,
        );
      }
    }
  });

  it("the accounting is withheld in exactly the worlds §6 withholds it in", () => {
    const withheld = SCENARIO_IDS.filter(
      (id) => homeFixtureWorld(id).today.accounting === null,
    );
    assert.deepEqual(
      [...withheld],
      // §6: a provider that is `unavailable`, `partial` or `unsupported`
      // withholds the whole accounting. `stale` does not, so stale_data still
      // renders its identity and states its age instead.
      ["new_user", "partial_coverage", "permission_changed", "provider_failure"],
      "the set of worlds that withhold the accounting changed",
    );
    for (const id of withheld) {
      const statuses = oracleWorldInputs(id).coverage.providerStatuses;
      assert.ok(
        statuses.some(
          (status) =>
            status === "unavailable" ||
            status === "partial" ||
            status === "unsupported",
        ),
        `${id} withholds the accounting with every provider ready or stale`,
      );
      assert.ok(
        homeFixtureWorld(id).today.quiet.blockedBy.includes("Q2"),
        `${id} withheld the accounting without naming Q2`,
      );
    }
    for (const id of SCENARIO_IDS) {
      if (withheld.includes(id)) continue;
      const statuses = oracleWorldInputs(id).coverage.providerStatuses;
      assert.deepEqual(
        statuses.filter(
          (status) => status !== "ready" && status !== "stale",
        ),
        [],
        `${id} renders an accounting over a provider that could not answer for its scope`,
      );
    }
    assert.ok(
      runToday("partial_coverage").quietBlockedBy.includes("Q1"),
      "and no world claims all clear either way",
    );
  });

  it("every accounting term the fixture publishes agrees, term by term", () => {
    for (const id of SCENARIO_IDS) {
      const oracle = runToday(id);
      const fixture = homeFixtureWorld(id).today;
      // Withheld whole, never partially rendered (§6).
      if (fixture.accounting === null) continue;
      assert.equal(fixture.accounting.read, oracle.accounting.read, `${id}: read`);
      assert.equal(fixture.accounting.shown, oracle.accounting.shown, `${id}: shown`);
      assert.equal(
        fixture.accounting.cappedOut,
        oracle.accounting.cappedOut,
        `${id}: cappedOut`,
      );
      assert.equal(
        fixture.accounting.dismissed,
        oracle.accounting.dismissed,
        `${id}: dismissed`,
      );
      assert.equal(
        fixture.accounting.cleared,
        oracle.accounting.cleared,
        `${id}: cleared`,
      );
    }
  });

  it("a contested key goes to the most urgent section, and the others count it", () => {
    // §5 precedence: Today's signal, Needs review, Coming up, Moving well.
    assert.deepEqual(
      [...ORACLE_SECTION_PRECEDENCE],
      ["todaysSignal", "needsReview", "comingUp", "movingWell"],
    );
    const contested = runToday("owner_signature").sectionOrderAmbiguity;
    assert.deepEqual(
      [...contested],
      [
        "tasks:task:home-task-mf-final-invoice → needsReview + todaysSignal → todaysSignal",
        "tasks:task:home-task-nc-marquee-lighting → needsReview + todaysSignal → todaysSignal",
        "tasks:task:home-task-nc-supplier-contract → needsReview + todaysSignal → todaysSignal",
      ],
      "the contested set or its resolution changed",
    );
    for (const id of SCENARIO_IDS) {
      const oracle = runToday(id);
      const fixture = homeFixtureWorld(id).today;
      for (const section of ORACLE_SECTION_PRECEDENCE) {
        assert.deepEqual(
          fixture.sectionAccounting[section],
          oracle.sectionAccounting[section],
          `${id}/${section}: what the section held back disagrees`,
        );
        const held = oracle.sectionAccounting[section];
        assert.equal(
          held.suppressed,
          held.claimedAbove + held.cappedOut,
          `${id}/${section}: a suppressed object has no stated cause`,
        );
        assert.equal(
          held.eligible,
          held.shown + held.suppressed,
          `${id}/${section}: an eligible object was silently dropped`,
        );
      }
    }
    // The world that shows it: a collaborator whose two review-lane rows are
    // both already on screen above. Needs review shows none of them and says
    // so, instead of dropping them without a number.
    const collaborator = runToday("collaborator_project");
    assert.equal(collaborator.sectionAccounting.needsReview.eligible, 2);
    assert.equal(collaborator.sectionAccounting.needsReview.shown, 0);
    assert.equal(collaborator.sectionAccounting.needsReview.claimedAbove, 2);
    assert.equal(collaborator.sectionAccounting.needsReview.cappedOut, 0);
  });

  it("quiet is refused in the same worlds, whatever the reason given", () => {
    for (const id of SCENARIO_IDS) {
      const oracle = runToday(id);
      const fixture = homeFixtureWorld(id).today;
      assert.equal(
        fixture.quiet.allowed,
        false,
        `${id}: the fixture would permit all-clear language`,
      );
      assert.equal(oracle.quietBlockedBy.length > 0, !fixture.quiet.allowed, id);
    }
  });
});

// ── 3 · Inbox: badge membership and the two axes ────────────────────────────

describe("Inbox oracle · the two axes", () => {
  it("all eight cells of the two-by-four matrix are occupied by the owner's rows", () => {
    const inputs = oracleWorldInputs("owner_signature");
    assert.deepEqual(
      [...oracleOccupiedCells(inputs.inboxStates)],
      [...ORACLE_EIGHT_CELLS],
    );
    assert.equal(ORACLE_EIGHT_CELLS.length, 8);
  });

  it("visibility is not an input to the badge — flipping every row moves nothing", () => {
    for (const id of SCENARIO_IDS) {
      const inputs = oracleWorldInputs(id);
      assert.ok(
        oracleBadgeIgnoresVisibility({
          events: inputs.inboxEvents,
          states: inputs.inboxStates,
          recipientUserId: inputs.recipientUserId,
          nowMs: inputs.nowMs,
          liveProjectIds: inputs.readable,
          unreadableProjectCount: inputs.unresolved.length,
          sourceVisibilityOf: oracleVisibilityResolver(inputs.inboxDisplay),
        }),
        `${id}: reading changed the badge, which is "reading resolves" (§8.1)`,
      );
    }
  });

  it("every read row carries an allowlisted reason, and no new row claims one", () => {
    for (const id of SCENARIO_IDS) {
      const inputs = oracleWorldInputs(id);
      assert.deepEqual(oracleIllegalReadRows(inputs.inboxStates), [], id);
    }
  });

  it("every disposition names a cause §8.5 allows for it — except the scale set", () => {
    for (const id of SCENARIO_IDS) {
      if (id === "scale") continue; // pinned as OR-5 below
      assert.deepEqual(
        oracleIllegalDispositionRows(oracleWorldInputs(id).inboxStates),
        [],
        id,
      );
    }
  });

  it("a snoozed row whose resurface instant has passed reads open, with the stored value untouched", () => {
    const inputs = oracleWorldInputs("owner_signature");
    const resurfaced = inputs.inboxStates.find(
      (state) => state.eventId === "home-evt-04",
    );
    assert.ok(resurfaced, "home-evt-04 is the resurfaced snooze");
    assert.equal(resurfaced.disposition, "snoozed", "the STORED value never changes");
    assert.equal(
      oracleEffectiveDisposition(resurfaced, inputs.nowMs),
      "open",
      "resurface is a read-time predicate, not a job (§10.5)",
    );
    const stillSnoozed = inputs.inboxStates.find(
      (state) => state.eventId === "home-evt-03",
    );
    assert.ok(stillSnoozed);
    assert.equal(oracleEffectiveDisposition(stillSnoozed, inputs.nowMs), "snoozed");
  });
});

describe("Inbox oracle · badge membership, hand-derived", () => {
  it("the signature badge is exactly the five events the six conditions admit", () => {
    const badge = runBadge("owner_signature");
    assert.deepEqual(
      [...badge.memberEventIds],
      ["home-evt-01", "home-evt-02", "home-evt-04", "home-evt-09", "home-evt-12"],
    );
    assert.equal(badge.count, 5);
    // And each exclusion is excluded for the clause it actually fails.
    assert.equal(badge.excludedBy["home-evt-03"], "2:effective-disposition-not-open");
    assert.equal(badge.excludedBy["home-evt-07"], "2:effective-disposition-not-open");
    assert.equal(badge.excludedBy["home-evt-11"], "3:withdrawn");
    assert.equal(badge.excludedBy["home-evt-10"], "5:no-live-membership");
    assert.equal(
      badge.undeterminedCount,
      1,
      "home-evt-09's source could not be reached, and undetermined still counts (§17 clause 6)",
    );
    assert.equal(badge.coverage, "partial", "a count with an undetermined source is partial");
  });

  it("the scale badge is derivable from the generator, not from a written-down number", () => {
    const inputs = oracleWorldInputs("scale");
    const badge = runBadge("scale");
    // 50 generated events; every 7th index is cleared; the last two carry no
    // display projection, and only the open one of those is undetermined.
    const cleared = inputs.inboxStates.filter(
      (state) => state.disposition === "cleared",
    ).length;
    assert.equal(inputs.inboxEvents.length, 50);
    assert.equal(cleared, 8);
    assert.equal(badge.count, 50 - cleared);
    assert.equal(badge.count, 42);
    assert.equal(badge.undeterminedCount, 1);
  });

  it("an unavailable source is dropped and an undetermined one is kept", () => {
    const guest = runBadge("guest_limited");
    const owner = runBadge("permission_changed");
    // The same event, two recipients, two legitimately different answers.
    assert.ok(
      guest.memberEventIds.includes("home-evt-10"),
      "the guest is still a member, so the Dromoland mention is live for them",
    );
    assert.ok(
      !owner.memberEventIds.includes("home-evt-10"),
      "the owner's membership was revoked, so the same event is unavailable to them",
    );
  });

  it("no badge in this universe is ever a bare zero standing in for a broken read", () => {
    for (const id of SCENARIO_IDS) {
      const inputs = oracleWorldInputs(id);
      const badge = runBadge(id);
      if (badge.count === 0) {
        assert.ok(
          !inputs.badgeRendered || inputs.inboxEvents.length === 0,
          `${id}: a zero badge is rendered over a non-empty inbox`,
        );
      }
      if (badge.coverage === "unavailable") {
        assert.equal(inputs.readable.length, 0, `${id}`);
      }
    }
  });

  it("badge counts agree with the fixture in all thirteen worlds", () => {
    for (const id of SCENARIO_IDS) {
      const oracle = runBadge(id);
      const fixture = homeFixtureWorld(id).badge;
      assert.equal(fixture.count, oracle.count, `${id}: count`);
      assert.equal(fixture.coverage, oracle.coverage, `${id}: coverage`);
      assert.equal(
        fixture.undeterminedCount,
        oracle.undeterminedCount,
        `${id}: undeterminedCount`,
      );
      assert.equal(
        fixture.unreadableProjectCount,
        oracle.unreadableProjectCount,
        `${id}: unreadableProjectCount`,
      );
    }
  });
});

// ── 4 · My work: grouping precedence and the seven-day window ───────────────

describe("My work oracle · grouping precedence", () => {
  it("no responsibility appears in two groups, in any world", () => {
    for (const id of SCENARIO_IDS) {
      assert.deepEqual(runMyWork(id).duplicated, [], `${id}: a row was grouped twice`);
    }
  });

  it("waiting beats a date — an overdue row in the Waiting column is Waiting", () => {
    const inputs = oracleWorldInputs("owner_signature");
    const overdueButWaiting = inputs.myWorkRows.find(
      (row) => row.taskId === "home-task-nc-venue-confirmation",
    );
    assert.ok(overdueButWaiting);
    const grouped = oracleGroup(overdueButWaiting, inputs.myWorkFrame, MY_WORK_COLUMN_CONFIGS);
    assert.equal(
      daysBetween(
        inputs.myWorkFrame.today,
        zonedCalendarDate(overdueButWaiting.dueAtIso as string, ORACLE_ZONE),
      ),
      -4,
      "the row must genuinely be overdue or this proves nothing",
    );
    assert.equal(grouped.group, "waiting");
    assert.equal(grouped.reason, "in-waiting-column");
  });

  it("the Next window is exactly T+1 to T+7 inclusive, and T+8 is Later", () => {
    const inputs = oracleWorldInputs("owner_signature");
    const byId = (taskId: string) => {
      const row = inputs.myWorkRows.find((entry) => entry.taskId === taskId);
      assert.ok(row, `${taskId} is missing from the signature ledger`);
      return oracleGroup(row, inputs.myWorkFrame, MY_WORK_COLUMN_CONFIGS);
    };
    const edge = byId("home-task-mf-cars");
    assert.equal(edge.deltaDays, ORACLE_NEXT_WINDOW_DAYS);
    assert.equal(edge.group, "next", "T+7 is inside the window");
    const past = byId("home-task-at-running-order");
    assert.equal(past.deltaDays, ORACLE_NEXT_WINDOW_DAYS + 1);
    assert.equal(past.group, "later", "T+8 is the first Later day");
  });

  it("undated work is Later and says so, never Now", () => {
    const inputs = oracleWorldInputs("owner_signature");
    const undated = inputs.myWorkRows.filter((row) => row.dueAtIso === null);
    assert.ok(undated.length >= 2, "the ledger carries undated work to group");
    for (const row of undated) {
      const grouped = oracleGroup(row, inputs.myWorkFrame, MY_WORK_COLUMN_CONFIGS);
      if (grouped.group === "waiting") continue; // waiting outranks the date rule
      assert.equal(grouped.group, "later", row.taskId);
      assert.equal(grouped.reason, "no-date", row.taskId);
    }
  });

  it("every one of the seven group reasons is produced by the signature ledger", () => {
    const inputs = oracleWorldInputs("owner_signature");
    const produced = new Set(
      inputs.myWorkRows.map(
        (row) => oracleGroup(row, inputs.myWorkFrame, MY_WORK_COLUMN_CONFIGS).reason,
      ),
    );
    for (const reason of ORACLE_GROUP_REASONS) {
      assert.ok(produced.has(reason), `no row produces the reason "${reason}"`);
    }
  });

  it("the clock change does not move a row between Next and Later", () => {
    const inputs = oracleWorldInputs("dst_boundary");
    const groups = runMyWork("dst_boundary").groups;
    assert.equal(inputs.myWorkFrame.today, "2026-10-24");
    const tomorrow = groups.next.find((row) => row.key === "tasks:home-task-dst-morning");
    assert.ok(tomorrow, "the row due on the 25-hour Sunday is missing from Next");
    assert.equal(tomorrow.groupedOnDate, "2026-10-25");
    assert.equal(tomorrow.deltaDays, 1, "a 25-hour day is still one calendar day");
    const edge = groups.next.find((row) => row.key === "tasks:home-task-dst-week");
    assert.ok(edge);
    assert.equal(edge.deltaDays, 7);
    const beyond = groups.later.find((row) => row.key === "tasks:home-task-dst-late");
    assert.ok(beyond);
    assert.equal(beyond.deltaDays, 8);
  });
});

describe("My work oracle · what the row records must not be trusted about", () => {
  it("the stored waiting signal equals the one recomputed from structure", () => {
    for (const id of SCENARIO_IDS) {
      for (const row of oracleWorldInputs(id).myWorkRows) {
        assert.equal(
          row.waiting,
          oracleWaiting(row, MY_WORK_COLUMN_CONFIGS),
          `${id}/${row.taskId}: the stored waiting value is not what structure produces (§7.3)`,
        );
      }
    }
  });

  it("a Project with no Waiting column produces unknown, never no", () => {
    const inputs = oracleWorldInputs("owner_signature");
    const inAislingTom = inputs.myWorkRows.filter(
      (row) =>
        row.workspaceId === HOME_FIXTURE_PROJECT_IDS.aislingTom &&
        row.blockedByIds.length === 0,
    );
    assert.ok(inAislingTom.length > 0);
    for (const row of inAislingTom) {
      assert.equal(
        oracleWaiting(row, MY_WORK_COLUMN_CONFIGS),
        "unknown",
        `${row.taskId}: "no waiting signal" was rendered as "not waiting"`,
      );
    }
    assert.equal(runMyWork("owner_signature").projectsWithoutWaitingSignal, 1);
  });

  it("done is the Project's own doneKeys, and the lane === done literal is wrong here", () => {
    const inputs = oracleWorldInputs("owner_signature");
    const disagreements = inputs.myWorkRows.filter(
      (row) => oracleIsDone(row, MY_WORK_COLUMN_CONFIGS) !== oracleIsDoneNaive(row),
    );
    assert.equal(
      disagreements.length,
      1,
      "the fixture must carry at least one Project that renamed Done, or PROJECT_SCOPE §5 rule 5 is untested",
    );
    assert.equal(disagreements[0].taskId, "home-task-nc-favours");
    assert.equal(disagreements[0].columnKey, "signed-off");
    assert.equal(oracleIsDone(disagreements[0], MY_WORK_COLUMN_CONFIGS), true);
    assert.equal(oracleIsDoneNaive(disagreements[0]), false);
    for (const row of inputs.myWorkRows) {
      assert.equal(
        row.isDone,
        oracleIsDone(row, MY_WORK_COLUMN_CONFIGS),
        `${row.taskId}: the stored isDone is not the per-Project answer`,
      );
    }
  });

  it("the stored dueDate is the due instant read in the estate's zone", () => {
    for (const id of SCENARIO_IDS) {
      for (const row of oracleWorldInputs(id).myWorkRows) {
        assert.equal(
          row.dueDate,
          row.dueAtIso === null ? null : zonedCalendarDate(row.dueAtIso, ORACLE_ZONE),
          `${id}/${row.taskId}: dueDate and dueAtIso disagree`,
        );
      }
    }
  });

  it("grouping agrees with the fixture in every world that produces groups", () => {
    for (const id of SCENARIO_IDS) {
      const oracle = runMyWork(id);
      const fixture = homeFixtureWorld(id).myWork;
      if (fixture.kind !== "ready") {
        assert.equal(
          oracle.groups.waiting.length +
            oracle.groups.now.length +
            oracle.groups.next.length +
            oracle.groups.later.length,
          0,
          `${id}: the fixture refuses to project, so the oracle must find nothing to group`,
        );
        continue;
      }
      for (const group of ["waiting", "now", "next", "later"] as const) {
        assert.deepEqual(
          oracle.groups[group].map((row) => row.key),
          fixture.groups[group].map((row) => row.row.key),
          `${id}/${group}: membership or order disagrees`,
        );
      }
      assert.equal(oracle.doneExcluded, fixture.doneExcluded, `${id}: doneExcluded`);
    }
  });
});

// ── 5 · Analytics: totals, claims and evidence ──────────────────────────────

describe("Analytics oracle · totals", () => {
  it("the six countable claims agree with the fixture in all thirteen worlds", () => {
    for (const id of SCENARIO_IDS) {
      const inputs = oracleWorldInputs(id);
      const totals = runTotals(id);
      const claims = homeFixtureWorld(id).claims;
      const valueOf = (claimId: string) =>
        claims.find((claim) => claim.id === claimId)?.value ?? null;
      if (inputs.readable.length === 0) {
        // A zero population renders the reason, never a zero (§1).
        for (const claim of claims) {
          assert.equal(claim.value, null, `${id}/${claim.id} rendered a number`);
          assert.equal(claim.status, "unsupported", `${id}/${claim.id}`);
        }
        assert.equal(totals.openWork, 0, "and the oracle's own arithmetic is 0");
        continue;
      }
      assert.equal(valueOf("claim-a1-open-work"), totals.openWork, `${id}: A1`);
      assert.equal(valueOf("claim-a2-open-overdue"), totals.openOverdue, `${id}: A2`);
      assert.equal(valueOf("claim-a3-unowned-work"), totals.unowned, `${id}: A3`);
      assert.equal(
        valueOf("claim-b1-work-completed"),
        totals.completedInWindow,
        `${id}: B1`,
      );
      assert.equal(
        valueOf("claim-c1-open-work-age"),
        totals.medianOpenAgeDays,
        `${id}: C1`,
      );
      assert.equal(valueOf("claim-c2-stalled-work"), totals.stalled, `${id}: C2`);
    }
  });

  it("every Analytics row resolves to a record the other two modes carry", () => {
    for (const id of SCENARIO_IDS) {
      const world = homeFixtureWorld(id);
      assert.deepEqual(
        oracleUntraceableIds({
          analyticsIds: world.analyticsRows.map((row) => row.taskId),
          sourceIds: sharedSourceIds(),
        }),
        [],
        `${id}: Analytics counts a population Today and My work never touch`,
      );
      // And every exception's evidence route lands on one of those records,
      // which is the whole promise: open a claim, reach the exact row.
      assert.deepEqual(
        oracleUntraceableIds({
          analyticsIds: world.exceptions.map((entry) => entry.sourceTaskId),
          sourceIds: sharedSourceIds(),
        }),
        [],
        `${id}: an exception's evidence resolves to nothing`,
      );
      for (const exception of world.exceptions) {
        assert.ok(
          exception.evidenceHref.includes(exception.sourceTaskId),
          `${id}/${exception.id}: the evidence route does not carry the source id`,
        );
      }
    }
    // The join is not a coincidence of one world: the signature world's
    // Analytics population and its Today candidates genuinely overlap.
    const signature = homeFixtureWorld("owner_signature");
    const todayIds = new Set(
      signature.scenario.todayCandidates.map((signal) => signal.ref.id),
    );
    const shared = signature.analyticsRows.filter((row) => todayIds.has(row.taskId));
    assert.equal(shared.length, 20, "every Today candidate is an Analytics row");
    assert.equal(signature.exceptions.length, 3);
    assert.deepEqual(
      signature.exceptions.map((entry) => entry.sourceTaskId),
      [
        "home-task-mf-corkage",
        "home-task-mf-kitchen-numbers",
        "home-task-nc-marquee-lighting",
      ],
      "the three exceptions are three rows a reviewer can open in Today",
    );
  });

  it("the population the oracle rejoins is the population the fixture publishes", () => {
    for (const id of SCENARIO_IDS) {
      assert.deepEqual(
        [...homeFixtureWorld(id).analyticsRows],
        [...oracleWorldInputs(id).analyticsRows],
        `${id}: the fixture's Analytics population is not the one the join produces`,
      );
    }
  });

  it("an unowned row is never a row the reader is assigned to", () => {
    for (const id of SCENARIO_IDS) {
      const inputs = oracleWorldInputs(id);
      const assignedToActor = new Set(
        inputs.scenario.todayCandidates
          .filter((signal) => signal.assignedToActor)
          .map((signal) => signal.ref.id),
      );
      assert.deepEqual(
        oracleUnownedContradictions(inputs.analyticsRows, assignedToActor),
        [],
        `${id}: Analytics says nobody is assigned to a row Today says is yours`,
      );
    }
    // A3 is exercised rather than trivially zero.
    assert.equal(runTotals("owner_signature").unowned, 3);
  });

  it("every world publishes the window and the times of its OWN clock", () => {
    for (const id of SCENARIO_IDS) {
      const world = homeFixtureWorld(id);
      const asOf = world.scenario.asOfIso;
      for (const claim of world.claims) {
        const window = claim.window as { asOf?: string; end?: string };
        if (claim.window.kind === "as_of") {
          assert.equal(window.asOf, asOf, `${id}/${claim.id}: window.asOf`);
        } else {
          assert.equal(window.end, asOf, `${id}/${claim.id}: window.end`);
          assert.ok(
            Date.parse(claim.window.start as string) < Date.parse(asOf),
            `${id}/${claim.id}: the window starts after it ends`,
          );
        }
        assert.equal(claim.times.renderedAt, asOf, `${id}/${claim.id}: renderedAt`);
        assert.ok(
          Date.parse(claim.times.ingestionAt) <= Date.parse(asOf),
          `${id}/${claim.id}: the source was read after the view composed`,
        );
      }
      assert.equal(world.today.asOfIso, asOf, `${id}: Today's asOf`);
      if (world.trend.kind === "insufficient-history") {
        assert.ok(
          Date.parse(world.trend.earliestPossibleIso) > Date.parse(asOf),
          `${id}: the earliest a trend could exist is in this world's past`,
        );
      }
    }
    // The world that shows it: reading on 24 October, not 16 July.
    const dst = homeFixtureWorld("dst_boundary");
    assert.equal(dst.claims[0].window.asOf, "2026-10-24T20:15:00.000Z");
    assert.equal(dst.claims[0].times.renderedAt, "2026-10-24T20:15:00.000Z");
  });

  it("A2 is a subset of A1, and neither exceeds the included population", () => {
    for (const id of SCENARIO_IDS) {
      const totals = runTotals(id);
      assert.ok(totals.openOverdue <= totals.openWork, `${id}: more overdue than open`);
      assert.ok(totals.unowned <= totals.openWork, `${id}: more unowned than open`);
      assert.ok(totals.openWork <= totals.includedRows, `${id}: more open than counted`);
    }
  });

  it("Unprojectable rows and subtasks are excluded, and the exclusion is counted", () => {
    const totals = runTotals("owner_signature");
    assert.equal(totals.excludedSubtask, 1, "an-mf-09 is a subtask");
    assert.equal(totals.excludedUnprojectable, 1, "an-mf-10 has no Project");
    const claim = homeFixtureWorld("owner_signature").claims.find(
      (entry) => entry.id === "claim-a1-open-work",
    );
    assert.ok(claim);
    const excluded = Object.fromEntries(
      claim.population.excluded.map((entry) => [entry.reason, entry.count]),
    );
    assert.equal(excluded.subtask, totals.excludedSubtask);
    assert.equal(excluded.unprojectable_row, totals.excludedUnprojectable);
  });
});

describe("Analytics oracle · claims and evidence", () => {
  it("every claim fills all fifteen required envelope fields", () => {
    for (const id of SCENARIO_IDS) {
      for (const claim of homeFixtureWorld(id).claims) {
        assert.deepEqual(
          oracleMissingClaimFields(claim),
          [],
          `${id}/${claim.id}: a claim that cannot fill a required field must not render`,
        );
      }
    }
  });

  it("the seven V1 claims are exactly the seven, in every world", () => {
    for (const id of SCENARIO_IDS) {
      assert.deepEqual(
        homeFixtureWorld(id).claims.map((claim) => claim.id),
        [...ORACLE_CLAIM_IDS],
        `${id}: the claim set drifted`,
      );
    }
  });

  it("an absent value stays absent — never 0, never a dash", () => {
    for (const id of SCENARIO_IDS) {
      for (const claim of homeFixtureWorld(id).claims) {
        assert.ok(
          oracleValueIsHonest(claim),
          `${id}/${claim.id}: status ${claim.status} carries value ${String(claim.value)}`,
        );
      }
    }
  });

  it("no claim without a real denominator can be turned into a percentage", () => {
    const claims = homeFixtureWorld("owner_signature").claims;
    const a1 = claims.find((claim) => claim.id === "claim-a1-open-work");
    assert.ok(a1);
    assert.equal(
      oracleShareIsComputable(a1),
      false,
      "A1 is a count of items, not a share of anything (§6 rule 1)",
    );
    const a2 = claims.find((claim) => claim.id === "claim-a2-open-overdue");
    assert.ok(a2);
    assert.equal(oracleShareIsComputable(a2), true, "A2 names A1 as its denominator");
  });

  it("no claim string expresses anything on the §13.3 boundary", () => {
    for (const id of SCENARIO_IDS) {
      for (const claim of homeFixtureWorld(id).claims) {
        assert.deepEqual(
          oracleProhibitedLanguageHits(claim, PROHIBITED_ANALYTICS_LANGUAGE),
          [],
          `${id}/${claim.id}`,
        );
      }
    }
    assert.equal(
      WITHHELD_CLAIMS.length,
      6,
      "six metrics are withheld, each with the defect that withholds it",
    );
    for (const withheld of WITHHELD_CLAIMS) {
      assert.equal(withheld.rendered, false, withheld.metric);
      assert.ok(
        !ORACLE_CLAIM_IDS.some((id) => id.includes(withheld.metric)),
        `${withheld.metric} is both withheld and rendered`,
      );
    }
  });

  it("a receipt replays to the exact claim value", () => {
    const inputs = oracleWorldInputs("owner_signature");
    const claim = homeFixtureWorld("owner_signature").claims.find(
      (entry) => entry.id === "claim-a1-open-work",
    );
    assert.ok(claim);
    const context: ClaimContext = Object.freeze({
      ...ANALYTICS_SIGNATURE_CONTEXT,
      projects: inputs.readable,
      rows: inputs.analyticsRows,
    });
    const receipt = receiptFor(claim, context);
    assert.equal(receipt.included.length, 21);
    assert.equal(
      oracleReplayOpenWork(
        receipt.included.map((entry) => entry.id),
        inputs.analyticsRows,
      ),
      claim.value,
      "replaying the calculation over the records the receipt names did not reproduce the claim",
    );
    assert.equal(
      receipt.excluded.length,
      2,
      "the receipt names the subtask and the Unprojectable row it left out",
    );
    // §12.1 — a receipt names record IDS, and every one of them is a record
    // the other two modes carry. A receipt full of ids that resolve nowhere
    // is not a receipt.
    assert.deepEqual(
      oracleUntraceableIds({
        analyticsIds: [
          ...receipt.included.map((entry) => entry.id),
          ...receipt.excluded.map((entry) => entry.id),
        ],
        sourceIds: sharedSourceIds(),
      }),
      [],
      "a receipt names a record no source population holds",
    );
  });

  it("no chart is drawn without fourteen comparable readings", () => {
    for (const id of SCENARIO_IDS) {
      const world = homeFixtureWorld(id);
      const snapshots = world.scenario.comparableSnapshots;
      assert.equal(
        world.trend.renderChart,
        oracleTrendRendersChart(snapshots),
        `${id}: ${snapshots} snapshots`,
      );
      if (!oracleTrendRendersChart(snapshots)) {
        assert.equal(world.trend.kind, "insufficient-history", id);
        assert.equal(world.trend.required, ORACLE_TREND_MINIMUM_SNAPSHOTS, id);
      }
    }
    assert.equal(
      homeFixtureWorld("insufficient_history").trend.renderChart,
      false,
      "the world named for it must be the one that proves it",
    );
  });
});

// ── 6 · The authorized Project set, and revocation ──────────────────────────

describe("Scope oracle · the authorized set", () => {
  it("every Project id in every world is a valid CONTEXT_ID and resolves", () => {
    const known = new Set(HOME_FIXTURE_ALL_PROJECTS.map((project) => project.id));
    for (const id of SCENARIO_IDS) {
      for (const projectId of oracleWorldInputs(id).scenario.projects) {
        assert.ok(oracleIsContextId(projectId), `${id}: ${projectId} is not a CONTEXT_ID`);
        assert.ok(known.has(projectId), `${id}: ${projectId} does not resolve`);
      }
    }
  });

  it("a planning-period world reads exactly the Projects that carry the period", () => {
    const grouped = oracleProjectsInPeriod(
      HOME_FIXTURE_PROJECTS,
      HOME_FIXTURE_PERIOD_ORCHARD.id,
    );
    assert.deepEqual(grouped, [...HOME_FIXTURE_ORCHARD_PROJECT_IDS].sort());
    for (const id of SCENARIO_IDS) {
      const { scenario } = oracleWorldInputs(id);
      if (scenario.readScope !== "planning-period") continue;
      assert.equal(scenario.planningPeriodId, HOME_FIXTURE_PERIOD_ORCHARD.id, id);
      assert.deepEqual([...scenario.projects].sort(), grouped, `${id}: the set drifted`);
    }
  });

  it("the Planning Period is a grouping and never the authorization", () => {
    const shared = HOME_FIXTURE_PROJECT_IDS.sineadRuairi;
    const summary = HOME_FIXTURE_PROJECTS.find((project) => project.id === shared);
    assert.ok(summary);
    assert.equal(summary.planningPeriod, null, "a member never sees another owner's period");
    const allProjects = oracleWorldInputs("permission_changed").scenario;
    assert.ok(
      allProjects.projects.includes(shared),
      "the all-projects world reads a Project the period does not group",
    );
    assert.ok(
      !oracleProjectsInPeriod(
        HOME_FIXTURE_PROJECTS,
        HOME_FIXTURE_PERIOD_ORCHARD.id,
      ).includes(shared),
    );
  });

  it("the scale world carries eighteen distinct Projects", () => {
    const { projects } = oracleWorldInputs("scale").scenario;
    assert.equal(new Set(projects).size, projects.length, "a Project is listed twice");
    assert.equal(projects.length, 18);
  });

  it("partial authorization is disclosed as a shortfall, never absorbed", () => {
    const revoked = oracleReadableProjects({
      authorized: oracleWorldInputs("permission_changed").scenario.projects,
      states: oracleWorldInputs("permission_changed").scenario.projectStates,
    });
    assert.equal(revoked.authorizedCount, 4);
    assert.equal(revoked.readable.length, 3);
    assert.equal(revoked.shortfall, 1);
    assert.deepEqual([...revoked.unresolved], [HOME_FIXTURE_PROJECT_IDS.sineadRuairi]);
  });
});

describe("Scope oracle · revocation", () => {
  const REVOKED = HOME_FIXTURE_PROJECT_IDS.sineadRuairi;

  it("a revoked Project carries exactly one neutral state to the client", () => {
    const scenario = oracleWorldInputs("permission_changed").scenario;
    const state = scenario.projectStates.find((entry) => entry.projectId === REVOKED);
    const summary = HOME_FIXTURE_PROJECTS.find((entry) => entry.id === REVOKED);
    assert.ok(state && summary);
    const result = oracleRevoke({
      state,
      summary,
      distinctWord: HOME_FIXTURE_PROJECT_WORDS[REVOKED],
    });
    assert.deepEqual(result.clientPayload, ORACLE_REVOKED_CLIENT_PAYLOAD);
    assert.deepEqual(Object.keys(result.clientPayload), ["kind"]);
    assert.deepEqual(result.leaked, [], "a field survived the transition");
    assert.equal(
      result.serverOnlyReason,
      "revoked",
      "the reason exists — and it exists only here",
    );
    assert.equal(state.lastSuccessfulReadIso, null, "not even the last-read time survives");
  });

  it("missing, forbidden and deleted are indistinguishable from revoked, client-side", () => {
    // §8.1 — the collapse is what stops the state being an existence oracle.
    for (const reason of ["missing", "forbidden", "deleted", "revoked"] as const) {
      const result = oracleRevoke({
        state: {
          projectId: REVOKED,
          routeState: "unavailable",
          sourceStatus: "unavailable",
          serverOnlyReason: reason,
          lastSuccessfulReadIso: null,
          staleAfterMs: 0,
          issues: [],
        },
        summary: HOME_FIXTURE_PROJECTS.find((entry) => entry.id === REVOKED)!,
        distinctWord: HOME_FIXTURE_PROJECT_WORDS[REVOKED],
      });
      assert.deepEqual(result.clientPayload, ORACLE_REVOKED_CLIENT_PAYLOAD, reason);
    }
  });

  it("not one byte of the revoked Project reaches the rendered world", () => {
    const world = homeFixtureWorld("permission_changed");
    const forbidden = [
      "Sinéad & Ruairí",
      HOME_FIXTURE_PROJECT_WORDS[REVOKED],
      "forbidden",
      "deleted",
    ];
    // Today, My work, Analytics claims, exceptions and the trend are what a
    // client is handed. The scenario declaration itself legitimately names the
    // Project — that is a server-side world definition, not a payload.
    for (const [name, artifact] of [
      ["today", world.today],
      ["myWork", world.myWork],
      ["claims", world.claims],
      ["exceptions", world.exceptions],
      ["trend", world.trend],
      ["badge", world.badge],
    ] as const) {
      assert.deepEqual(
        oracleScanForStrings(artifact, forbidden, `$.${name}`),
        [],
        `${name} leaked a revoked Project's metadata`,
      );
    }
  });

  it("the ledger names the unreadable Project and gives it no numbers", () => {
    const world = homeFixtureWorld("permission_changed");
    const row = world.ledger.find((entry) => entry.workspaceId === REVOKED);
    assert.ok(row, "every authorized Project appears in the ledger, including this one");
    assert.equal(row.state, "unresolved");
    assert.equal(row.projectName, null, "a Project that could not be read carries no name");
    assert.equal(row.openWork, null, "and no count — a zero here would be a claim");
    assert.equal(row.overdue, null);
    assert.equal(world.ledger.length, 4, "the ledger is complete, not trimmed");
  });

  it("the revoked Project's lens does not open, and changes neither axis", () => {
    const world = homeFixtureWorld("permission_changed");
    assert.equal(world.lens.lensProjectId, REVOKED);
    assert.equal(world.lens.opens, false);
    assert.equal(world.lens.readScopeUnchanged, true);
    assert.equal(world.lens.activeProjectUnchanged, true);
  });
});

// ── 7 · The findings, pinned so they cannot drift ───────────────────────────

describe("Pinned findings", () => {

  it("OR-2 · a withheld accounting drops Q4 from the stated reasons", () => {
    assert.equal(findingById("OR-2").severity, "contract-gap");
    for (const id of [
      "permission_changed",
      "provider_failure",
      // Joined the set when OR-3 closed: withholding on a partial provider is
      // right, and it costs this world the ability to name cappedOut.
      "partial_coverage",
    ] as const) {
      const oracle = runToday(id);
      const fixture = homeFixtureWorld(id).today;
      assert.equal(fixture.accounting, null, `${id}: the accounting is withheld`);
      assert.ok(oracle.accounting.cappedOut > 0, `${id}: something was capped out`);
      assert.ok(oracle.quietBlockedBy.includes("Q4"), `${id}: the oracle names Q4`);
      assert.ok(!fixture.quiet.blockedBy.includes("Q4"), `${id}: the fixture drops Q4`);
      assert.ok(fixture.quiet.blockedBy.includes("Q2"), `${id}: Q2 replaces it`);
      assert.equal(fixture.quiet.allowed, false, `${id}: quiet is refused either way`);
    }
    assert.equal(runToday("permission_changed").accounting.cappedOut, 2);
    assert.equal(runToday("provider_failure").accounting.cappedOut, 1);
    assert.equal(runToday("partial_coverage").accounting.cappedOut, 2);
  });

  it("OR-7 · Today and My work read four of the same records differently", () => {
    assert.equal(findingById("OR-7").severity, "defect");
    const byId = new Map(
      [
        ...MY_WORK_SIGNATURE_ROWS,
        ...MY_WORK_QUIET_ROWS,
        ...MY_WORK_DST_ROWS,
        ...MY_WORK_SCALE_ROWS,
      ].map((row) => [row.taskId, row] as const),
    );
    const shared = Object.values(TODAY_CANDIDATE_SETS)
      .flat()
      .filter((signal) => byId.has(signal.ref.id));
    const disagreements: string[] = [];
    for (const signal of shared) {
      const row = byId.get(signal.ref.id);
      if (!row) continue;
      const todayDue =
        signal.dueAtIso === null
          ? null
          : zonedCalendarDate(signal.dueAtIso, ORACLE_ZONE);
      if (todayDue !== row.dueDate) {
        disagreements.push(`${signal.ref.id}:due:${todayDue}/${row.dueDate}`);
      }
      if ((signal.lane === "shipped") !== row.isDone) {
        disagreements.push(`${signal.ref.id}:done:${signal.lane}/${row.isDone}`);
      }
      if (signal.projectId !== row.workspaceId) {
        disagreements.push(`${signal.ref.id}:project`);
      }
    }
    assert.equal(shared.length, 16, "the join between Today and My work moved");
    assert.deepEqual(
      disagreements.sort(),
      [
        "home-task-at-ceremony-time:due:null/2026-07-21",
        "home-task-at-running-order:due:2026-07-25/2026-07-24",
        "home-task-nc-favours:done:next/true",
        "home-task-nc-marquee-lighting:due:null/2026-07-19",
      ],
      "OR-7 changed — either a record was reconciled (narrow it) or one drifted (widen it)",
    );
    // Analytics resolves each of these by the stated rule rather than by
    // accident: My work wins on `isDone` and on the due instant.
    const rows = new Map(
      oracleWorldInputs("owner_signature").analyticsRows.map(
        (row) => [row.taskId, row] as const,
      ),
    );
    assert.equal(rows.get("home-task-nc-favours")?.isDone, true);
    assert.equal(rows.get("home-task-at-running-order")?.dueDate, "2026-07-24");
  });

  it("OR-8 · two worlds hand Today a candidate set narrower than their own scope", () => {
    assert.equal(findingById("OR-8").severity, "defect");
    const scale = runToday("scale");
    const scaleTotals = runTotals("scale");
    assert.equal(scale.accounting.read, 20, "Today's read in the scale world");
    assert.equal(
      oracleWorldInputs("scale").myWorkRows.length,
      60,
      "and My work holds sixty responsibilities in the same world",
    );
    assert.equal(scaleTotals.openWork, 78, "and Analytics counts all of them");
    const signature = runToday("owner_signature");
    assert.equal(signature.accounting.read, 20);
    assert.equal(runTotals("owner_signature").includedRows, 21);
    assert.equal(runTotals("owner_signature").openWork, 19);
  });

  it("OR-9 · one record still exists twice, under two ids", () => {
    assert.equal(findingById("OR-9").severity, "defect");
    const titleKey = (workspaceId: string | null, title: string) =>
      `${workspaceId}|${title}`;
    const ids = new Map<string, Set<string>>();
    for (const signal of Object.values(TODAY_CANDIDATE_SETS).flat()) {
      const key = titleKey(signal.projectId, signal.title);
      ids.set(key, (ids.get(key) ?? new Set()).add(signal.ref.id));
    }
    for (const row of [
      ...MY_WORK_SIGNATURE_ROWS,
      ...MY_WORK_QUIET_ROWS,
      ...MY_WORK_DST_ROWS,
      ...MY_WORK_SCALE_ROWS,
    ]) {
      const key = titleKey(row.workspaceId, row.title);
      ids.set(key, (ids.get(key) ?? new Set()).add(row.taskId));
    }
    const doubled = [...ids.entries()]
      .filter(([, held]) => held.size > 1)
      .map(([key, held]) => `${key.split("|")[1]} → ${[...held].sort().join(", ")}`)
      .sort();
    assert.deepEqual(
      doubled,
      ["Ballyhoura walk-through → home-task-dst-monday, home-task-dst-week"],
      "OR-9 changed — a duplicate was merged (narrow it) or a new one appeared (widen it)",
    );
    // The visible cost: eight Analytics rows in a world holding seven records.
    assert.equal(oracleWorldInputs("dst_boundary").analyticsRows.length, 8);
  });



  it("OR-5 · the scale set clears eight rows and blames arrival for it", () => {
    assert.equal(findingById("OR-5").severity, "defect");
    const illegal = oracleIllegalDispositionRows(
      oracleWorldInputs("scale").inboxStates,
    );
    assert.deepEqual(
      [...illegal],
      [
        "home-evt-scale-0001:arrival-on-cleared",
        "home-evt-scale-0008:arrival-on-cleared",
        "home-evt-scale-0015:arrival-on-cleared",
        "home-evt-scale-0022:arrival-on-cleared",
        "home-evt-scale-0029:arrival-on-cleared",
        "home-evt-scale-0036:arrival-on-cleared",
        "home-evt-scale-0043:arrival-on-cleared",
        "home-evt-scale-0050:arrival-on-cleared",
      ],
      "OR-5 changed — either it was fixed (delete it) or it spread (widen it)",
    );
    // The badge is unaffected: a cleared row is excluded by clause 2 whatever
    // reason it names. This is a provenance defect, not a count defect.
    assert.equal(runBadge("scale").count, 42);
  });


  it("the register holds exactly the findings the suite pins", () => {
    assert.deepEqual(
      ORACLE_FINDINGS.map((finding) => finding.id),
      // OR-1, OR-3, OR-4 and OR-6 were closed in this pass. Their entries are
      // deleted rather than marked resolved, and each is replaced by a
      // positive assertion above: the world's own clock, the withholding
      // rule, the section precedence, and the shared population.
      ["OR-2", "OR-5", "OR-7", "OR-8", "OR-9"],
    );
    for (const finding of ORACLE_FINDINGS) {
      assert.ok(finding.clause.length > 0, `${finding.id} names no contract clause`);
      assert.ok(finding.measured.length > 0, `${finding.id} carries no measurement`);
    }
  });
});
