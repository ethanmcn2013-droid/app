/**
 * Golden oracles · the count report.
 *
 * Prints every number the oracles derive, beside the number the fixture
 * universe publishes, for all thirteen worlds. This is the artifact a reviewer
 * reads: a table of two independent computations of the same facts, so
 * "the counts agree" is a thing that can be SEEN rather than a claim in a
 * commit message.
 *
 * Run:
 *   node --import tsx src/lib/home-layer/oracles/report.ts
 *
 * This file is the comparison layer, so it is the one place allowed to hold
 * both the oracle and the fixture derivation at once.
 */

import { homeFixtureWorld } from "../fixtures/scenarios";
import { MY_WORK_COLUMN_CONFIGS } from "../fixtures/my-work";
import { oracleBadge } from "./inbox.oracle";
import { oracleProjectMyWork } from "./my-work.oracle";
import { oracleTotals } from "./analytics.oracle";
import { instantAtLocalWallTime, addDays } from "./oracle-clock";
import {
  oracleVisibilityResolver,
  oracleWorldInputs,
  SCENARIO_IDS,
  type ScenarioId,
} from "./scenario-inputs";
import { oracleRankToday } from "./today.oracle";
import { checkOracleIndependence } from "./independence";
import { ORACLE_FINDINGS } from "./findings";

function pad(value: string | number, width: number): string {
  return String(value).padEnd(width);
}

function todayLine(id: ScenarioId): string {
  const inputs = oracleWorldInputs(id);
  const oracle = oracleRankToday({
    candidates: inputs.scenario.todayCandidates,
    today: inputs.today,
    asOfIso: inputs.asOfIso,
    coverage: inputs.coverage,
  });
  const fixture = homeFixtureWorld(id).today;
  const sizes = (result: { todaysSignal: unknown[]; comingUp: unknown[]; needsReview: unknown[]; movingWell: unknown[] }) =>
    `${result.todaysSignal.length}/${result.comingUp.length}/${result.needsReview.length}/${result.movingWell.length}`;
  const acc = oracle.accounting;
  const fixtureAcc = fixture.accounting;
  return [
    pad(id, 22),
    pad(sizes(oracle.sections as never), 10),
    pad(sizes(fixture.sections as never), 10),
    pad(`${acc.read}=${acc.shown}+${acc.cappedOut}+${acc.dismissed}+${acc.cleared}`, 18),
    pad(acc.flagged, 8),
    pad(oracle.balances ? "balances" : "BROKEN", 10),
    pad(oracle.quietBlockedBy.join(",") || "(quiet legal)", 30),
    pad(fixture.quiet.blockedBy.join(",") || "(quiet legal)", 30),
    pad(fixtureAcc === null ? "withheld" : "rendered", 10),
  ].join(" ");
}

function inboxLine(id: ScenarioId): string {
  const inputs = oracleWorldInputs(id);
  const oracle = oracleBadge({
    events: inputs.inboxEvents,
    states: inputs.inboxStates,
    recipientUserId: inputs.recipientUserId,
    nowMs: inputs.nowMs,
    liveProjectIds: inputs.readable,
    unreadableProjectCount: inputs.unresolved.length,
    sourceVisibilityOf: oracleVisibilityResolver(inputs.inboxDisplay),
  });
  const fixture = homeFixtureWorld(id).badge;
  return [
    pad(id, 22),
    pad(oracle.count, 7),
    pad(fixture.count, 7),
    pad(oracle.coverage, 12),
    pad(fixture.coverage, 12),
    pad(oracle.undeterminedCount, 8),
    pad(fixture.undeterminedCount, 8),
    pad(inputs.badgeRendered ? "rendered" : "no count", 10),
  ].join(" ");
}

function myWorkLine(id: ScenarioId): string {
  const inputs = oracleWorldInputs(id);
  const oracle = oracleProjectMyWork({
    rows: inputs.myWorkRows,
    frame: inputs.myWorkFrame,
    configs: MY_WORK_COLUMN_CONFIGS,
    projectsAuthorized: inputs.scenario.projects,
    projectsUnresolved: inputs.unresolved,
    pageSize: inputs.myWorkPageSize,
  });
  const fixture = homeFixtureWorld(id).myWork;
  const shape = fixture.kind === "ready"
    ? `${fixture.groups.waiting.length}/${fixture.groups.now.length}/${fixture.groups.next.length}/${fixture.groups.later.length}`
    : fixture.kind;
  return [
    pad(id, 22),
    pad(
      `${oracle.groups.waiting.length}/${oracle.groups.now.length}/${oracle.groups.next.length}/${oracle.groups.later.length}`,
      12,
    ),
    pad(shape, 20),
    pad(oracle.duplicated.length, 6),
    pad(oracle.doneExcluded, 6),
    pad(oracle.projectsWithoutWaitingSignal, 6),
  ].join(" ");
}

function analyticsLine(id: ScenarioId): string {
  const inputs = oracleWorldInputs(id);
  const windowStart = instantAtLocalWallTime(
    addDays(inputs.today, -28),
    0,
    0,
    "Europe/London",
  ).iso;
  const oracle = oracleTotals({
    // The world's own records, rejoined from its own source population.
    rows: inputs.analyticsRows,
    projects: inputs.readable,
    today: inputs.today,
    windowStartIso: windowStart,
    // The world's OWN pinned instant, not a module-level constant. That
    // difference is the whole `dst_boundary` finding.
    windowEndIso: inputs.asOfIso,
  });
  const claims = homeFixtureWorld(id).claims;
  const valueOf = (claimId: string) =>
    claims.find((claim) => claim.id === claimId)?.value ?? "null";
  return [
    pad(id, 22),
    pad(`${oracle.openWork} / ${valueOf("claim-a1-open-work")}`, 14),
    pad(`${oracle.openOverdue} / ${valueOf("claim-a2-open-overdue")}`, 14),
    pad(`${oracle.unowned} / ${valueOf("claim-a3-unowned-work")}`, 14),
    pad(`${oracle.completedInWindow} / ${valueOf("claim-b1-work-completed")}`, 14),
    pad(`${oracle.medianOpenAgeDays ?? "null"} / ${valueOf("claim-c1-open-work-age")}`, 14),
    pad(`${oracle.stalled} / ${valueOf("claim-c2-stalled-work")}`, 14),
  ].join(" ");
}

function main(): void {
  const violations = checkOracleIndependence();
  console.log("INDEPENDENCE GUARD");
  console.log(
    violations.length === 0
      ? "  0 violations — no oracle imports a derivation it is meant to check"
      : violations.map((v) => `  ${v.file}: ${v.reason}`).join("\n"),
  );

  console.log("\nTODAY  (oracle sections | fixture sections | read=shown+capped+dismissed+cleared)");
  console.log(
    [pad("scenario", 22), pad("oracle", 10), pad("fixture", 10), pad("§6 identity", 18), pad("flagged", 8), pad("balance", 10), pad("oracle quiet blockers", 30), pad("fixture quiet blockers", 30), pad("accounting", 10)].join(" "),
  );
  for (const id of SCENARIO_IDS) console.log(todayLine(id));

  console.log("\nINBOX BADGE  (oracle | fixture)");
  console.log(
    [pad("scenario", 22), pad("o.count", 7), pad("f.count", 7), pad("o.coverage", 12), pad("f.coverage", 12), pad("o.undet", 8), pad("f.undet", 8), pad("badge", 10)].join(" "),
  );
  for (const id of SCENARIO_IDS) console.log(inboxLine(id));

  console.log("\nMY WORK  (waiting/now/next/later)");
  console.log(
    [pad("scenario", 22), pad("oracle", 12), pad("fixture", 20), pad("dupes", 6), pad("done", 6), pad("noWait", 6)].join(" "),
  );
  for (const id of SCENARIO_IDS) console.log(myWorkLine(id));

  console.log("\nANALYTICS  (oracle / fixture claim value)");
  console.log(
    [pad("scenario", 22), pad("A1 open", 14), pad("A2 overdue", 14), pad("A3 unowned", 14), pad("B1 done", 14), pad("C1 median", 14), pad("C2 stalled", 14)].join(" "),
  );
  for (const id of SCENARIO_IDS) console.log(analyticsLine(id));

  console.log("\nFINDINGS  (each one pinned by an assertion in oracles.test.ts)");
  for (const finding of ORACLE_FINDINGS) {
    console.log(`\n  ${finding.id} · ${finding.severity} · owner: ${finding.owner}`);
    console.log(`     clause   ${finding.clause}`);
    console.log(`     what     ${finding.what}`);
    console.log(`     measured ${finding.measured}`);
  }
}

main();
