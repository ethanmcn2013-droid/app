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
  LAB_ROUTE_PATH,
  LAB_VARIANTS,
  parseLabUrl,
  type LabUrlState,
} from "./lab-url";
import { withCandidateVariant } from "./variant";

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
      wholeProps(a),
      wholeProps(b),
      `${id}: two assemblies of one world disagree`,
    );
  }
});

/**
 * THE FAIRNESS ASSERTION, and why it names nothing.
 *
 * The old version of this test compared the props with `meta`, `state` and
 * `hrefFor` set aside, and it passed while the four candidates were being
 * handed different `briefingHref` and `returnHref` values — one carrying
 * `v=1`, another `v=2`. An exclusion list is an admission that the data is not
 * actually identical, so this version has none: it walks the WHOLE object.
 *
 * The one member that cannot be compared by value is `hrefFor`, because a
 * closure is only ever equal to itself. It is not skipped either. It is
 * replaced by what it PRODUCES over a battery of patches, which is the thing
 * that would differ if the assembly could see the candidate.
 */
const HREF_PROBES: readonly Partial<LabUrlState>[] = Object.freeze([
  {},
  { mode: "inbox" },
  { mode: "briefing" },
  { mode: "analytics" },
  { homeScope: "all" },
  { homeScope: "project", workspaceId: "home-ws-mara-finn" },
  { item: "home-task-mf-corkage" },
  { event: "home-evt-01" },
  { lensProjectId: "home-ws-nora-cian" },
  { theme: "dark" },
  { capture: true },
]);

function wholeProps(props: ReturnType<typeof assembleCandidateProps>): unknown {
  return JSON.parse(
    JSON.stringify(props, (_key, value: unknown) =>
      typeof value === "function"
        ? HREF_PROBES.map((patch) =>
            (value as (p: Partial<LabUrlState>) => string)(patch),
          )
        : value,
    ),
  );
}

test("all four candidates are handed one object, compared whole", () => {
  for (const id of SCENARIO_IDS) {
    const base = stateFor(id);
    const rendered = LAB_VARIANTS.map((variant) => {
      const state: LabUrlState = { ...base, v: variant.v };
      return wholeProps(assembleCandidateProps({ state }));
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

test("no assembled link names a candidate, and the shell puts one back", () => {
  const base = stateFor("owner_signature");
  const props = assembleCandidateProps({ state: base });

  // Nothing the assembly wrote may carry a variant. If it did, the object above
  // could not be identical across the four.
  const serialised = JSON.stringify(wholeProps(props));
  assert.ok(!serialised.includes("v=1"), "an assembled link named a candidate");
  assert.ok(!serialised.includes("v%3D1"), "an assembled link named a candidate");

  for (const variant of LAB_VARIANTS) {
    const decorated = withCandidateVariant(props, variant.v);
    assert.equal(
      decorated.today.briefingHref,
      `${LAB_ROUTE_PATH}?v=${variant.v}&${props.today.briefingHref.split("?")[1] ?? ""}`,
      "the shell must put the candidate back at the front of the link",
    );
    assert.equal(
      parse(decorated.today.briefingHref.slice(decorated.today.briefingHref.indexOf("?")))
        .state.v,
      variant.v,
      "a decorated link must parse back to the candidate it names",
    );
    // The rest of the state has to survive the decoration untouched.
    const back = parse(
      decorated.briefing.returnHref.slice(decorated.briefing.returnHref.indexOf("?")),
    ).state;
    assert.equal(back.mode, "today");
    assert.equal(back.scenario, "owner_signature");
    assert.equal(back.homeScope, base.homeScope);
    assert.equal(back.planningPeriodId, base.planningPeriodId);
    assert.equal(back.workspaceId, base.workspaceId);
    // And the built link is byte-identical to the one the builder writes.
    assert.equal(
      decorated.today.briefingHref,
      buildLabUrl({ ...base, v: variant.v, mode: "briefing", item: null }),
    );
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

/**
 * TWO FAILURES, TWO TREATMENTS, and the test keeps them apart.
 *
 * `unresolved` is a Project whose route did not resolve: revoked, missing or
 * deleted. It carries no metadata at all, not even its name.
 *
 * `unavailable` here is a Project the reader is still a member of whose SOURCE
 * did not answer. Its counts are unknown and must never render as numbers; its
 * name is not a disclosure and withholding it would tell the reader less than
 * the truth. `deriveLedger` reads `routeState` alone and returns this row as
 * `ready` with a count on it, so the shell is what refuses to pass that on.
 */
test("no view model renders an unreadable count as a number", () => {
  const failed = assembleCandidateProps({ state: stateFor("provider_failure", "analytics") });
  const silent = failed.analytics.ledger.filter((row) => row.state === "unavailable");
  assert.ok(silent.length > 0, "the provider-failure world holds a source that did not answer");
  for (const row of silent) {
    assert.equal(row.openWorkLabel, failed.copy.unreadableCount);
    assert.equal(row.overdueLabel, failed.copy.unreadableCount);
    assert.equal(row.href, null, "a project that did not answer opens nothing");
    assert.notEqual(row.projectName, null, "a member's project keeps its name");
  }
  assert.ok(
    failed.today.disclosures.some((entry) => entry.id === "coverage-source-failed"),
    "a source that did not answer has to be said on the page, not only in the ledger",
  );

  const revoked = assembleCandidateProps({
    state: stateFor("permission_changed", "analytics"),
  });
  const gone = revoked.analytics.ledger.filter((row) => row.state === "unresolved");
  assert.ok(gone.length > 0, "the permission world holds a project that did not resolve");
  for (const row of gone) {
    assert.equal(row.projectName, null, "an unresolved project must carry no name");
    assert.equal(row.openWorkLabel, revoked.copy.unreadableCount);
    assert.equal(row.overdueLabel, revoked.copy.unreadableCount);
    assert.equal(row.href, null);
  }
});

/**
 * WHAT THE FIXTURES ACTUALLY SAY, established before this test was written.
 *
 * Every one of the thirteen worlds fires Q7, because `calendar-event` is an
 * eligible kind with no producer in v1 and TODAY_RANKING TR-7 seals that as the
 * correct outcome rather than a bug. So the unqualified all clear is
 * unreachable, in every world, and a test expecting a world to reach it was
 * asking the shell to break §9.2.
 *
 * The distinction that IS real, read off the fixtures: `owner_quiet` is the
 * only world whose blockers are all platform limits. Its `blockedBy` is
 * exactly Q7 and Q8. Every other world fires at least one condition about its
 * own read — something crossed a rule, something was held back, something was
 * silenced, a project or a source did not answer. That is the difference the
 * lab brief requires a direction to render: a quiet day and a broken provider
 * must not look the same.
 */
test("no world may say the unqualified all clear, because v1 cannot see a whole day", () => {
  for (const id of SCENARIO_IDS) {
    const props = assembleCandidateProps({ state: stateFor(id) });
    assert.equal(
      props.today.quiet.allowed,
      false,
      `${id}: Q7 fires for every v1 reader, so no world may claim an all clear`,
    );
    assert.ok(
      props.today.quiet.blockedBy.includes("Q7"),
      `${id}: Q7 must be named, not silently dropped`,
    );
  }
});

test("exactly one world reports a quiet read, and it says what it could not see", () => {
  const quiet = SCENARIO_IDS.filter(
    (id) => assembleCandidateProps({ state: stateFor(id) }).today.quiet.readIsQuiet,
  );
  assert.deepEqual(quiet, ["owner_quiet"]);

  const props = assembleCandidateProps({ state: stateFor("owner_quiet") });
  assert.deepEqual([...props.today.quiet.blockedBy], ["Q7", "Q8"]);
  assert.ok(
    props.today.quiet.line.includes("not an all clear"),
    "a quiet read still refuses the all clear",
  );
  assert.ok(
    props.today.quiet.line.includes("no source connected"),
    "and it names the limit that refuses it",
  );

  // The broken world must not be able to borrow that language.
  const broken = assembleCandidateProps({ state: stateFor("provider_failure") });
  assert.equal(broken.today.quiet.readIsQuiet, false);
  assert.notEqual(broken.today.quiet.line, props.today.quiet.line);
});

test("a revoked project leaks nothing into anything a candidate is handed", () => {
  for (const mode of HOME_MODES) {
    const props = assembleCandidateProps({ state: stateFor("permission_changed", mode) });
    const serialised = JSON.stringify(wholeProps(props));
    for (const leak of ["Sinéad & Ruairí", "Dromoland", "forbidden", "deleted"]) {
      assert.ok(
        !serialised.includes(leak),
        `${mode}: the revoked project leaked "${leak}" into the candidate props`,
      );
    }
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
