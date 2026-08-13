/**
 * Wave 5 · The Analytics lab's data must stay bound to the one fixture.
 *
 * The lab exists so a founder can choose a composition. That choice is only
 * meaningful if all five compositions argue from identical, honest data — so
 * this file checks the two things that would quietly destroy that:
 *
 *   1. DRIFT. The view model is a derivation of `project-truth-fixture.ts`,
 *      not a second fixture. If someone edits a name, a count or the review
 *      clock in one and not the other, these assertions fail rather than the
 *      lab silently arguing from data that no longer matches the wave.
 *
 *   2. HONESTY. `docs/wave/ANALYTICS_TRUTH.md` records what cannot be claimed
 *      today. Those refusals are load-bearing product behaviour, not copy, so
 *      they are asserted: no chart, no zero standing in for unknown, no
 *      portfolio, no "Project" label on a tag-derived concept, and no
 *      suppressed observation that the reader is not told about.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  PROJECT_TRUTH_A,
  PROJECT_TRUTH_PROJECTS,
  PROJECT_TRUTH_TODAY,
  projectTruthContentFor,
} from "../project-truth-fixture";
import {
  LAB_PROJECT_NAME,
  LAB_PROJECT_OPEN_COUNT,
  LAB_STATE_IDS,
  LAB_TODAY,
  LABEL_OVERLAP_COUNT,
  VARIANTS,
  labView,
  parseLabState,
  type LabStateId,
} from "./model";

// ── 1 · The lab is a derivation, not a second fixture ───────────────────────

test("the lab reads the fixture's reference Project, by name and by id", () => {
  const view = labView("today");
  assert.equal(view.scope.projectId, PROJECT_TRUTH_A.id);
  assert.equal(view.scope.projectName, PROJECT_TRUTH_A.name);
  assert.equal(LAB_PROJECT_NAME, PROJECT_TRUTH_A.name);
  assert.equal(view.scope.periodName, PROJECT_TRUTH_A.planningPeriod?.name);
});

test("the review clock has not drifted from the fixture", () => {
  assert.equal(LAB_TODAY, PROJECT_TRUTH_TODAY);
});

test("the ledger's open counts reconcile with the fixture's open count", () => {
  const view = labView("today");
  const summed = view.ledger.rows.reduce((total, row) => total + row.open, 0);
  assert.equal(LAB_PROJECT_OPEN_COUNT, PROJECT_TRUTH_A.activeRootTaskCount);
  // Labels overlap, so the rows deliberately exceed the Project's open count.
  // The gap must be exactly the number of items carrying two labels, or the
  // denominator sentence shown on screen is wrong.
  assert.equal(summed - PROJECT_TRUTH_A.activeRootTaskCount, LABEL_OVERLAP_COUNT);
});

test("evidence quotes the fixture's own task titles verbatim", () => {
  const content = projectTruthContentFor(PROJECT_TRUTH_A.id);
  const titles = labView("today")
    .observations.flatMap((o) => o.evidence)
    .map((e) => e.title);
  for (const rootTask of content.rootTaskTitles) {
    assert.ok(
      titles.includes(rootTask),
      `evidence lost the fixture's task title: ${rootTask}`,
    );
  }
});

// ── 2 · There is no portfolio, and the gap is stated ────────────────────────

test("every state states the one Project it read, and names no other", () => {
  for (const id of LAB_STATE_IDS) {
    const view = labView(id);
    assert.ok(
      view.scope.declaration.includes(view.scope.projectName),
      `${id}: the scope line does not name the Project it read`,
    );
    assert.ok(
      view.scope.declaration.includes("only"),
      `${id}: the scope line does not limit itself to one Project`,
    );
  }
});

test("the portfolio gap counts exactly the fixture's other Projects", () => {
  const gap = labView("today").portfolioGap;
  assert.equal(gap.otherProjectCount, PROJECT_TRUTH_PROJECTS.length - 1);
  assert.equal(gap.others.length, PROJECT_TRUTH_PROJECTS.length - 1);
  assert.ok(!gap.others.some((p) => p.id === PROJECT_TRUTH_A.id));
});

test("no route ever points at /app/trends, which does not exist", () => {
  for (const id of LAB_STATE_IDS) {
    for (const observation of labView(id).observations) {
      for (const row of observation.evidence) {
        assert.ok(
          !row.route.includes("/app/trends"),
          `${id}: evidence links to a route that 404s`,
        );
      }
    }
  }
});

// ── 3 · Unknown never renders as zero, and no chart is ever drawn ───────────

test("no state produces a trend, in any state, ever", () => {
  for (const id of LAB_STATE_IDS) {
    const trend = labView(id).trend;
    assert.equal(
      trend.status.kind,
      "insufficient-history",
      `${id}: a trend resolved to something drawable, and no snapshot writer exists`,
    );
    if (trend.status.kind === "insufficient-history") {
      assert.equal(trend.status.comparableReadings, 0);
      assert.ok(trend.status.readingsNeeded > 0);
    }
  }
});

test("the three structurally unsupported metrics are named as unsupported", () => {
  const unsupported = labView("today").unsupported;
  assert.equal(unsupported.length, 3);
  const names = unsupported.map((m) => m.name.toLowerCase()).join(" | ");
  assert.ok(names.includes("waiting on something else"));
  assert.ok(names.includes("decisions taken"));
  assert.ok(names.includes("commitment date moved"));
  for (const metric of unsupported) {
    assert.ok(metric.because.length > 0, `${metric.name} has no reason`);
    assert.ok(metric.wouldNeed.length > 0, `${metric.name} has no path forward`);
  }
});

test("nothing connected yet renders an empty table, never a table of zeros", () => {
  const view = labView("first-use");
  assert.equal(view.ledger.rows.length, 0);
  assert.equal(view.ledger.status.kind, "not-connected");
  for (const source of view.coverage) {
    assert.equal(source.status.kind, "not-connected");
  }
});

// ── 3b · The trace refuses to claim history it does not have ───────────────

test("every commitment refuses to say how its own date moved", () => {
  for (const id of LAB_STATE_IDS) {
    for (const commitment of labView(id).commitments) {
      assert.equal(
        commitment.movement.kind,
        "unsupported",
        `${id}/${commitment.id}: claimed date movement, which nothing records`,
      );
    }
  }
});

test("a source that could not be read produces no commitments, not zero of them", () => {
  // The distinction is the whole point: "Timeline could not be read" and
  // "there are no commitments" are different sentences, and the second one
  // would be a lie in these three states.
  for (const id of ["first-use", "partial", "failure"] as const) {
    assert.equal(
      labView(id).commitments.length,
      0,
      `${id}: drew commitments from a source it could not read`,
    );
    const view = labView(id);
    assert.ok(
      view.coverage.some((c) => c.status.kind !== "available"),
      `${id}: dropped commitments without recording why`,
    );
  }
});

test("trace items agree with themselves about past and ahead", () => {
  for (const id of LAB_STATE_IDS) {
    for (const commitment of labView(id).commitments) {
      assert.ok(commitment.items.length > 0, `${commitment.id}: nothing behind it`);
      for (const item of commitment.items) {
        const expected = item.dayOffset < 0 ? "past-date" : "ahead";
        assert.equal(
          item.state,
          expected,
          `${commitment.id}/${item.id}: its date and its state disagree`,
        );
      }
    }
  }
});

// ── 4 · A top-three brief discloses the rest ────────────────────────────────

test("today's truth carries five observations, shows three, discloses five", () => {
  const view = labView("today");
  assert.equal(view.observations.length, 5);
  assert.equal(view.suppression.total, 5);
  assert.equal(view.suppression.shown, 3);
  assert.equal(view.suppression.hidden, 2);
  assert.equal(view.suppression.reviewAllLabel, "Review all 5");
});

test("every state discloses its own suppressed count truthfully", () => {
  for (const id of LAB_STATE_IDS) {
    const view = labView(id);
    assert.equal(view.suppression.total, view.observations.length);
    assert.equal(
      view.suppression.shown + view.suppression.hidden,
      view.observations.length,
      `${id}: the shown and hidden counts do not add up to what exists`,
    );
    assert.ok(view.suppression.shown <= 3, `${id}: more than three shown`);
  }
});

test("ranking is explained wherever anything is ranked", () => {
  for (const id of LAB_STATE_IDS) {
    const view = labView(id);
    if (view.observations.length === 0) continue;
    assert.ok(
      view.rankingRule.length > 40,
      `${id}: observations are ordered with no rule the reader can inspect`,
    );
  }
});

// ── 5 · The observation grammar is complete on every observation ────────────

test("every observation carries the full grammar and its evidence", () => {
  for (const id of LAB_STATE_IDS) {
    for (const o of labView(id).observations) {
      const where = `${id}/${o.id}`;
      assert.ok(o.claim.length > 0, `${where}: no claim`);
      assert.ok(o.changed.length > 0, `${where}: no what-changed`);
      assert.ok(o.matters.length > 0, `${where}: no why-it-matters`);
      assert.ok(o.action.text.length > 0, `${where}: no recommended action`);
      assert.ok(o.coverage.length > 0, `${where}: no coverage receipt`);
      assert.ok(o.freshness.length > 0, `${where}: no freshness receipt`);
      assert.ok(o.evidence.length > 0, `${where}: a claim with no evidence`);
      if (o.action.kind === "deterministic-suggestion") {
        assert.ok(
          o.action.rule && o.action.rule.length > 0,
          `${where}: a deterministic suggestion that does not show its rule`,
        );
      }
    }
  }
});

test("every stamp restates its claim rather than grading it", () => {
  // A stamp is emphasis, not a severity score. Anything that reads as a grade
  // would be a composite health signal by the back door, which §8 vetoes.
  const grades = ["critical", "high", "medium", "low", "urgent", "risk", "red", "amber", "green"];
  for (const id of LAB_STATE_IDS) {
    for (const o of labView(id).observations) {
      assert.ok(o.stamp.length > 0, `${id}/${o.id}: no stamp`);
      assert.ok(
        o.stamp.split(/\s+/).length <= 3,
        `${id}/${o.id}: the stamp is a sentence, not a mark`,
      );
      for (const grade of grades) {
        assert.ok(
          !o.stamp.toLowerCase().includes(grade),
          `${id}/${o.id}: the stamp grades severity ("${grade}") instead of naming the finding`,
        );
      }
    }
  }
});

test("no recommended action claims authority it has not earned", () => {
  const banned = [" should ", " best ", " must "];
  for (const id of LAB_STATE_IDS) {
    for (const o of labView(id).observations) {
      const text = ` ${o.action.text.toLowerCase()} `;
      for (const word of banned) {
        assert.ok(
          !text.includes(word),
          `${id}/${o.id}: the action asserts authority with "${word.trim()}"`,
        );
      }
    }
  }
});

// ── 6 · Stale and failed evidence lose their privileges ────────────────────

test("a stale reading is not ranked and is never called all clear", () => {
  const view = labView("stale");
  assert.equal(view.quiet, false);
  assert.ok(view.banner, "a stale reading must announce itself");
  assert.ok(view.rankingRule.toLowerCase().includes("nothing is ranked"));
  assert.ok(view.coverage.some((c) => c.status.kind === "stale"));
});

test("a failed source is contained, announced, and offers a way back", () => {
  const view = labView("failure");
  const failed = view.coverage.find((c) => c.status.kind === "failed");
  assert.ok(failed, "the failure state must carry a failed source");
  if (failed?.status.kind === "failed") {
    assert.ok(failed.status.recovery.length > 0);
  }
  assert.equal(view.quiet, false, "nothing is quiet while a source has failed");
  assert.ok(view.banner);
});

test("only the quiet state is quiet, and it still refuses to say all clear", () => {
  for (const id of LAB_STATE_IDS) {
    const view = labView(id);
    if (id !== "quiet") {
      assert.equal(view.quiet, false, `${id}: claimed quiet without earning it`);
      continue;
    }
    assert.equal(view.observations.length, 0);
    const prose = view.read.join(" ").toLowerCase();
    assert.ok(
      prose.includes("not the same as all clear"),
      "the quiet state must say why it is not all clear",
    );
  }
});

test("the permission-limited state carries the exact required sentence", () => {
  const view = labView("permission");
  const required =
    "Based on the Projects visible to you; organization-wide completeness is unavailable.";
  assert.ok(
    view.read.some((line) => line.includes(required)),
    "the permission-limited state must carry the exact disclosure sentence",
  );
  assert.ok(
    !view.ledger.denominator.match(/\bof \d+\b/),
    "the permission-limited ledger must never show a denominator the reader has no right to",
  );
});

// ── 7 · Labels are never called Projects, anywhere on screen ────────────────

test("no ledger row is named or typed as a Project", () => {
  for (const id of LAB_STATE_IDS) {
    const view = labView(id);
    for (const row of view.ledger.rows) {
      assert.ok(
        !row.name.toLowerCase().includes("project"),
        `${id}: a label row is named as a Project — that is the false identity the truth gate exists to remove`,
      );
    }
  }
});

test("ledger copy never speaks of Projects in the plural", () => {
  // The ledger accounts for Labels inside ONE Project. A plural "Projects"
  // anywhere in its own copy is the false-identity slip returning: it would
  // tell the reader these rows are Projects, which is the exact claim
  // `docs/wave/ANALYTICS_TRUTH.md` R1 records as a coincidence, not a fact.
  for (const id of LAB_STATE_IDS) {
    const ledger = labView(id).ledger;
    const copy = [
      ledger.denominator,
      ledger.accounting,
      ...ledger.rows.map((r) => r.name),
    ].join(" ");
    assert.ok(
      !/\bprojects\b/i.test(copy),
      `${id}: the label ledger describes its rows as Projects`,
    );
  }
});

test("the model file states the one-Project scope as a standing rule", () => {
  const source = readFileSync(
    path.join(process.cwd(), "src/lib/analytics-lab/model.ts"),
    "utf8",
  );
  assert.ok(
    source.includes("THERE IS NO PORTFOLIO"),
    "the reason this model reads one Project must stay recorded in the file that encodes it",
  );
  assert.ok(
    source.includes("LABELS ARE NOT PROJECTS"),
    "the Label/Project rename must stay recorded where the Labels are declared",
  );
});

// ── 8 · The switcher and the five compositions stay in step ─────────────────

test("the state switcher offers every state, and each says what it proves", () => {
  assert.equal(LAB_STATE_IDS.length, 10);
  for (const id of LAB_STATE_IDS) {
    const view = labView(id);
    assert.equal(view.id, id);
    assert.ok(view.label.length > 0, `${id}: no switcher label`);
    assert.ok(view.proves.length > 20, `${id}: does not say what it proves`);
  }
});

test("an unknown or absent state falls back to today's truth", () => {
  assert.equal(parseLabState(undefined), "today");
  assert.equal(parseLabState("not-a-state"), "today");
  assert.equal(parseLabState(["stale", "quiet"]), "stale");
  for (const id of LAB_STATE_IDS) {
    assert.equal(parseLabState(id as string), id as LabStateId);
  }
});

test("all five compositions are routed and described", () => {
  assert.equal(VARIANTS.length, 5);
  const routes = new Set(VARIANTS.map((v) => v.route));
  assert.equal(routes.size, 5, "two compositions share a route");
  for (const variant of VARIANTS) {
    assert.ok(variant.route.startsWith("/lab/signal-analytics"));
    assert.ok(variant.idea.length > 20, `${variant.id}: no idea recorded`);
  }
});
