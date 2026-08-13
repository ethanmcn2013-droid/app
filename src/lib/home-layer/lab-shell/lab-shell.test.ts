/**
 * The lab shell's own contract.
 *
 * Two things are proven here and they are different jobs.
 *
 * THE URL. Every combination is directly linkable and survives reload, which
 * is a claim about a parser and a builder rather than about a browser: parse
 * what the builder wrote and you get the state back, unchanged, for every one
 * of the 4 × 5 × 13 triples.
 *
 * THE FAIRNESS RULE. The four directions receive identical data, and the
 * assembly does not quietly re-derive a world differently from the fixture
 * universe that authored it. The load-bearing assertion is the last one: at
 * each world's own scope, every count the shell publishes comes from
 * `homeFixtureWorld`, and the Inbox rows the shell reconstructs produce
 * exactly the badge the fixture derived. That is what stops the mirror in
 * `assemble.ts` drifting in silence.
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/lab-shell/lab-shell.test.ts
 */

import { strict as assert } from "node:assert";
import test from "node:test";

import {
  homeFixtureWorld,
  HOME_MODES,
  SCENARIO_IDS,
  type HomeMode,
  type ScenarioId,
} from "../fixtures";
import { assembleCandidateProps, scenarioScopeOf } from "./assemble";
import {
  buildLabUrl,
  DEFAULT_SCENARIO,
  LAB_VARIANTS,
  parseLabUrl,
  type LabUrlState,
} from "./lab-url";

const parse = (search: string) => parseLabUrl(search, scenarioScopeOf);

// ── The URL ─────────────────────────────────────────────────────────────────

test("every (variant, mode, world) triple round-trips through the builder", () => {
  let checked = 0;
  for (const variant of LAB_VARIANTS) {
    for (const mode of HOME_MODES) {
      for (const id of SCENARIO_IDS) {
        const scope = scenarioScopeOf(id);
        const url = buildLabUrl({
          v: variant.v,
          mode,
          scenario: id,
          homeScope: scope.homeScope,
          workspaceId: scope.workspaceId,
          planningPeriodId: scope.planningPeriodId,
          lensProjectId: scope.lensProjectId,
        });
        const back = parse(url.slice(url.indexOf("?"))).state;
        assert.equal(back.v, variant.v, url);
        assert.equal(back.mode, mode, url);
        assert.equal(back.scenario, id, url);
        assert.equal(back.homeScope, scope.homeScope, url);
        assert.equal(back.workspaceId, scope.workspaceId, url);
        assert.equal(back.planningPeriodId, scope.planningPeriodId, url);
        checked += 1;
      }
    }
  }
  assert.equal(checked, LAB_VARIANTS.length * HOME_MODES.length * SCENARIO_IDS.length);
  assert.equal(checked, 260);
});

test("theme and capture survive the round trip in both directions", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const capture of [false, true]) {
      const url = buildLabUrl({
        v: 3,
        mode: "analytics",
        scenario: "scale",
        theme,
        capture,
      });
      const back = parse(url.slice(url.indexOf("?"))).state;
      assert.equal(back.theme, theme);
      assert.equal(back.capture, capture);
    }
  }
});

test("a bad value falls back and says so, and never rewrites the URL", () => {
  const parsed = parse("?v=9&mode=nowhere&scenario=nothing&theme=beige&capture=maybe");
  assert.equal(parsed.state.v, 1);
  assert.equal(parsed.state.mode, "today");
  assert.equal(parsed.state.scenario, DEFAULT_SCENARIO);
  assert.equal(parsed.state.theme, "light");
  assert.equal(parsed.state.capture, false);
  assert.equal(parsed.notices.length, 5);
  for (const notice of parsed.notices) assert.equal(notice.code, "invalid-value");
});

test("a duplicated parameter takes no value", () => {
  const parsed = parse("?v=2&v=3&mode=inbox");
  assert.equal(parsed.state.v, 1);
  assert.ok(parsed.notices.some((notice) => notice.code === "duplicate-parameter"));
});

test("the fixture harness's own direction parameter still selects a variant", () => {
  // `labUrl()` in the fixture universe emits `direction=<slug>` and no `v`. If
  // the alias were refused, every capture would be of variant 1.
  for (const variant of LAB_VARIANTS) {
    assert.equal(parse(`?direction=${variant.direction}`).state.v, variant.v);
  }
});

test("a malformed identifier is dropped rather than carried", () => {
  const parsed = parse("?scenario=owner_signature&workspaceId=not%20an%20id");
  assert.ok(parsed.notices.some((notice) => notice.parameter === "workspaceId"));
  assert.equal(parsed.state.workspaceId, scenarioScopeOf("owner_signature").workspaceId);
});

test("selection is per mode, and a selection on the wrong mode is dropped", () => {
  assert.equal(parse("?mode=inbox&event=home-evt-01").state.event, "home-evt-01");
  assert.equal(parse("?mode=today&event=home-evt-01").state.event, null);
  assert.equal(parse("?mode=my-work&item=home-task-mf-corkage").state.item, "home-task-mf-corkage");
  assert.equal(parse("?mode=inbox&item=home-task-mf-corkage").state.item, null);
});

test("a planning-period scope with no period falls inward, never outward", () => {
  const parsed = parse("?scenario=owner_signature&homeScope=planning-period");
  assert.equal(parsed.state.homeScope, "project");
  assert.notEqual(parsed.state.homeScope, "all");
  assert.ok(
    parsed.notices.some((notice) => notice.code === "planning-period-missing"),
  );
});

test("a pathological query is discarded whole and disclosed", () => {
  const parsed = parse(`?mode=inbox&${"a=1&".repeat(40)}`);
  assert.equal(parsed.state.mode, "today");
  assert.equal(parsed.notices.length, 1);
  assert.equal(parsed.notices[0]?.code, "query-discarded");
});

test("period=custom is refused by name, not treated as unknown", () => {
  const parsed = parse("?period=custom");
  assert.equal(parsed.state.period, "four_weeks");
  assert.equal(parsed.notices[0]?.code, "period-unsupported");
});

// ── The assembly ────────────────────────────────────────────────────────────

function stateFor(id: ScenarioId, mode: HomeMode = "today"): LabUrlState {
  const scope = scenarioScopeOf(id);
  const url = buildLabUrl({
    v: 1,
    mode,
    scenario: id,
    homeScope: scope.homeScope,
    workspaceId: scope.workspaceId,
    planningPeriodId: scope.planningPeriodId,
    lensProjectId: scope.lensProjectId,
  });
  return parse(url.slice(url.indexOf("?"))).state;
}

test("at each world's own scope the shell publishes the fixture's own numbers", () => {
  for (const id of SCENARIO_IDS) {
    const fixture = homeFixtureWorld(id);
    const props = assembleCandidateProps({ state: stateFor(id) });

    // The badge is the one number the shell reconstructs its inputs for, so it
    // is the one most able to drift. It may not.
    assert.equal(
      props.inbox.badge.count,
      fixture.badge.count,
      `${id}: the Inbox badge the shell reconstructed differs from the fixture's`,
    );
    assert.equal(props.inbox.badge.coverage, fixture.badge.coverage, id);
    assert.equal(props.inbox.badge.rendered, fixture.badgeRendered, id);

    // Today is passed through untouched at the world's own scope.
    const shown = props.today.sections.reduce(
      (total, section) => total + section.rows.length,
      0,
    );
    const fixtureShown = Object.values(fixture.today.sections).reduce(
      (total, rows) => total + rows.length,
      0,
    );
    assert.equal(shown, fixtureShown, `${id}: Today row count`);

    assert.equal(props.analytics.claims.length, fixture.claims.length, `${id}: claims`);
    assert.equal(props.analytics.ledger.length, fixture.ledger.length, `${id}: ledger`);
    assert.equal(
      props.analytics.trend.renderChart,
      fixture.trend.renderChart,
      `${id}: trend`,
    );
  }
});

test("the assembly is deterministic: two calls produce the same screen", () => {
  for (const id of SCENARIO_IDS) {
    const a = assembleCandidateProps({ state: stateFor(id) });
    const b = assembleCandidateProps({ state: stateFor(id) });
    assert.deepEqual(
      JSON.parse(JSON.stringify({ ...a, hrefFor: undefined })),
      JSON.parse(JSON.stringify({ ...b, hrefFor: undefined })),
      `${id}: two assemblies of one world disagree`,
    );
  }
});

test("all four variants receive an identical object apart from their own label", () => {
  for (const id of SCENARIO_IDS) {
    const base = stateFor(id);
    const rendered = LAB_VARIANTS.map((variant) => {
      const props = assembleCandidateProps({ state: { ...base, v: variant.v } });
      return JSON.parse(
        JSON.stringify({ ...props, meta: undefined, state: undefined, hrefFor: undefined }),
      );
    });
    for (const other of rendered.slice(1)) {
      assert.deepEqual(
        other,
        rendered[0],
        `${id}: two directions would be handed different data`,
      );
    }
  }
});

test("a narrowed Read Scope narrows the read rather than relabelling it", () => {
  const wide = assembleCandidateProps({ state: stateFor("owner_signature") });
  const narrow = assembleCandidateProps({
    state: { ...stateFor("owner_signature"), homeScope: "project", scopeFromScenario: false },
  });
  const rowsIn = (props: typeof wide) =>
    props.today.sections.reduce((total, section) => total + section.rows.length, 0);
  assert.ok(
    rowsIn(narrow) <= rowsIn(wide),
    "narrowing scope did not narrow what Today read",
  );
  assert.ok(
    narrow.myWork.groups.every((group) =>
      group.rows.every((row) => row.provenance.projectId === narrow.chrome.scope.label
        ? true
        : row.provenance.projectId !== null),
    ),
  );
  assert.ok(
    narrow.myWork.doneExcludedLine?.includes("held back") ?? false,
    "a count that was not read at this scope must be withheld, not estimated",
  );
});

test("no view model renders an unreadable count as a number", () => {
  const props = assembleCandidateProps({ state: stateFor("provider_failure", "analytics") });
  const unreadable = props.analytics.ledger.filter(
    (row) => row.state === "unavailable" || row.state === "unresolved",
  );
  assert.ok(unreadable.length > 0, "the provider-failure world should hold an unread project");
  for (const row of unreadable) {
    assert.equal(row.projectName, null, "an unread project must carry no name");
    assert.equal(row.openWorkLabel, props.copy.unreadableCount);
    assert.equal(row.overdueLabel, props.copy.unreadableCount);
  }
});

test("only the quiet world is allowed to say nothing crossed a rule", () => {
  const allowed = SCENARIO_IDS.filter(
    (id) => assembleCandidateProps({ state: stateFor(id) }).today.quiet.allowed,
  );
  assert.deepEqual(allowed, ["owner_quiet"]);
});

test("a revoked project leaks nothing into the rows a candidate is handed", () => {
  const props = assembleCandidateProps({ state: stateFor("permission_changed", "inbox") });
  const serialised = JSON.stringify({ ...props, hrefFor: undefined });
  for (const leak of ["Sinéad & Ruairí", "Dromoland", "forbidden", "deleted"]) {
    assert.ok(
      !serialised.includes(leak),
      `the revoked project leaked "${leak}" into the candidate props`,
    );
  }
});

test("exactly one mode link claims the current page, and the briefing claims none", () => {
  for (const mode of HOME_MODES) {
    const props = assembleCandidateProps({ state: stateFor("owner_signature", mode) });
    const page = props.chrome.modes.filter((link) => link.ariaCurrent === "page");
    if (mode === "briefing") {
      assert.equal(page.length, 0, "the briefing is not one of the four modes");
      assert.equal(
        props.chrome.modes.filter((link) => link.ariaCurrent === "true").length,
        1,
        "the briefing marks Today as the current item within the set, never the page",
      );
    } else {
      assert.equal(page.length, 1, `${mode}: exactly one link claims the page`);
      assert.equal(page[0]?.mode, mode);
    }
  }
});

test("every rendered string avoids the one rule that never bends", () => {
  for (const id of SCENARIO_IDS) {
    for (const mode of HOME_MODES) {
      const props = assembleCandidateProps({ state: stateFor(id, mode) });
      // `source` carries the fixture's own claim objects verbatim, which is
      // where the Planning Period's authored em dash lives. The shell's own
      // strings are what this asserts.
      const serialised = JSON.stringify({
        ...props,
        hrefFor: undefined,
        analytics: { ...props.analytics, claims: props.analytics.claims.map((c) => ({ ...c, source: undefined })) },
      });
      assert.ok(!serialised.includes("!"), `${id}/${mode}: an exclamation mark reached a rendered string`);
    }
  }
});
