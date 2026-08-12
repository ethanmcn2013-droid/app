/**
 * The Home typed URL model, exercised as behaviour.
 *
 * Specified by docs/projects/home-operating-layer/contracts/
 * HOME_ROUTE_AND_RETURN_CONTEXT.md. Section references below are to that file.
 *
 * THIS FILE IS EXPECTED TO FAIL AT THIS BASE, AND THAT IS THE DELIVERABLE.
 * `./home-url` does not exist yet. Wave 1 is a contract wave: it writes
 * documents and failing tests, never production routes. Each test loads the
 * module through `loadHomeUrl()` so the failure is reported per assertion,
 * naming the clause it proves, rather than as one unresolved import.
 *
 * The split across three files is deliberate and mirrors the pattern already
 * used by the protected-lab contract in ../lab:
 *
 *   home-url.test.ts                  the rule is right
 *   home-route-contract.test.mjs      the rule is wired into the repository
 *   home-experience-contract.test.mjs the rendered product satisfies it
 *
 * None of the three is sufficient alone.
 *
 * Run: node --import tsx --test src/lib/home-layer/experience/home-url.test.ts
 */

import { strict as assert } from "node:assert";
import test from "node:test";

const MODULE = "./home-url";

type HomeUrlModule = {
  HOME_ROUTES: readonly string[];
  HOME_SCOPES: readonly string[];
  HOME_PERIODS: readonly string[];
  parseHomeUrl: (
    pathname: string,
    search: string | URLSearchParams,
  ) => {
    state: Record<string, unknown>;
    notices: string[];
    needsCanonicalRedirect: boolean;
  };
  buildHomeUrl: (state: Record<string, unknown>) => string;
  isSafeReturnTo: (value: string) => boolean;
  canonicalHomeUrl: (parsed: unknown) => string;
};

/**
 * Load the module under test, or fail with the reason it is missing rather
 * than with a bare resolver error. `HOME_ROUTE_AND_RETURN_CONTEXT.md` §16
 * fixes the file path and the exported surface.
 */
async function loadHomeUrl(): Promise<HomeUrlModule> {
  try {
    return (await import(MODULE)) as unknown as HomeUrlModule;
  } catch (cause) {
    throw new Error(
      `src/lib/home-layer/experience/home-url.ts does not exist. ` +
        `HOME_ROUTE_AND_RETURN_CONTEXT.md §16 specifies its exports; ` +
        `§18 assertion U2 records that it is absent at this base.`,
      { cause },
    );
  }
}

// ── §16 · the module surface ────────────────────────────────────────────────

test("U2 · the parser and builder exist with the sealed export surface (§16)", async () => {
  const m = await loadHomeUrl();
  for (const name of [
    "HOME_ROUTES",
    "HOME_SCOPES",
    "HOME_PERIODS",
    "parseHomeUrl",
    "buildHomeUrl",
    "isSafeReturnTo",
    "canonicalHomeUrl",
  ]) {
    assert.ok(name in m, `home-url must export ${name} (§16)`);
  }
});

test("§2 · exactly five Home routes, and Full briefing is not a fifth mode", async () => {
  const { HOME_ROUTES } = await loadHomeUrl();
  assert.deepEqual([...HOME_ROUTES].sort(), [
    "analytics",
    "briefing",
    "inbox",
    "my-work",
    "today",
  ]);
});

test("§4.3 · the scope vocabulary is exactly all | project | planning-period", async () => {
  const { HOME_SCOPES } = await loadHomeUrl();
  assert.deepEqual([...HOME_SCOPES].sort(), ["all", "planning-period", "project"]);
});

test("§4.3 · the period vocabulary is ANALYTICS_PERIODS minus custom", async () => {
  const { HOME_PERIODS } = await loadHomeUrl();
  assert.deepEqual([...HOME_PERIODS], [
    "four_weeks",
    "twelve_weeks",
    "six_months",
    "twelve_months",
  ]);
  assert.ok(
    !HOME_PERIODS.includes("custom"),
    "custom is refused by name, not admitted (§4.3, D-HR05)",
  );
});

// ── §4 · parsing ────────────────────────────────────────────────────────────

test("§4.3 · absent homeScope defaults to project", async () => {
  const { parseHomeUrl } = await loadHomeUrl();
  const { state, notices } = parseHomeUrl("/app/home", "");
  assert.equal(state.scope, "project");
  assert.deepEqual(notices, []);
});

test("§4.2 rule 5 · values are case-sensitive; homeScope=All is invalid", async () => {
  const { parseHomeUrl } = await loadHomeUrl();
  const { state, notices } = parseHomeUrl("/app/home", "?homeScope=All");
  assert.equal(state.scope, "project", "falls to the default, never to all");
  assert.ok(notices.includes("homeScope-invalid"));
});

test("§4.2 rule 3 · a repeated key takes NO value (D-HR04)", async () => {
  const { parseHomeUrl } = await loadHomeUrl();
  const { state, notices } = parseHomeUrl("/app/home", "?item=a&item=b");
  assert.equal(state.item, null, "first-wins and last-wins are both guesses");
  assert.ok(notices.includes("duplicate-parameter"));
});

test("§4.2 rule 4 · an empty value is absent, not invalid, and is silent", async () => {
  const { parseHomeUrl } = await loadHomeUrl();
  const { state, notices } = parseHomeUrl("/app/home", "?workspaceId=");
  assert.equal(state.workspaceId, null);
  assert.deepEqual(notices, []);
});

test("§4.2 rule 7 · unknown keys are dropped and trigger canonicalisation", async () => {
  const { parseHomeUrl } = await loadHomeUrl();
  const parsed = parseHomeUrl("/app/home", "?utm_source=slack");
  assert.ok(parsed.notices.includes("unknown-parameter"));
  assert.equal(parsed.needsCanonicalRedirect, true);
});

test("§4.2 rule 8 · a known key on the wrong route is dropped, with its own notice", async () => {
  const { parseHomeUrl } = await loadHomeUrl();
  const { state, notices } = parseHomeUrl("/app/home/my-work", "?event=e1");
  assert.equal(state.event, null);
  assert.ok(notices.includes("parameter-not-valid-here"));
  assert.ok(
    !notices.includes("unknown-parameter"),
    "wrong-route and unknown describe different authoring mistakes",
  );
});

test("§4.1 · ids are validated against CONTEXT_ID, the narrowest shipped grammar (D-HR03)", async () => {
  const { parseHomeUrl } = await loadHomeUrl();
  // Legal in the analytics parser (query.ts:59 admits "." and ":"), rejected here.
  const { state, notices } = parseHomeUrl("/app/home", "?workspaceId=ws.one:two");
  assert.equal(state.workspaceId, null);
  assert.ok(notices.includes("workspaceId-invalid"));
});

test("§4.2 rule 6 · a control character invalidates the value", async () => {
  const { parseHomeUrl } = await loadHomeUrl();
  const { state } = parseHomeUrl("/app/home", "?workspaceId=ws%00one");
  assert.equal(state.workspaceId, null);
});

test("§4.3 · planningPeriodId is required by planning-period and falls to project, never to all", async () => {
  const { parseHomeUrl } = await loadHomeUrl();
  const { state, notices } = parseHomeUrl("/app/home", "?homeScope=planning-period");
  assert.equal(state.scope, "project", "falling outward to `all` silently widens a read");
  assert.equal(state.planningPeriodId, null);
  assert.ok(notices.includes("planning-period-missing"));
});

test("§4.3 · planningPeriodId without planning-period scope is not valid here", async () => {
  const { parseHomeUrl } = await loadHomeUrl();
  const { state, notices } = parseHomeUrl("/app/home", "?planningPeriodId=pp1");
  assert.equal(state.planningPeriodId, null);
  assert.ok(notices.includes("parameter-not-valid-here"));
});

test("§4.3 · period=custom is refused by name, not treated as unknown (D-HR05)", async () => {
  const { parseHomeUrl } = await loadHomeUrl();
  const { state, notices } = parseHomeUrl("/app/home/analytics", "?period=custom");
  assert.equal(state.period, "four_weeks", "the rendered window is the default, and disclosed");
  assert.ok(notices.includes("period-unsupported"));
  assert.ok(!notices.includes("unknown-parameter"));
});

test("§4.3 · start and end are not Home parameters", async () => {
  const { parseHomeUrl } = await loadHomeUrl();
  const { notices } = parseHomeUrl("/app/home/analytics", "?start=2026-01-01&end=2026-02-01");
  assert.ok(notices.includes("unknown-parameter"));
});

test("§4.3 · period is valid only on analytics", async () => {
  const { parseHomeUrl } = await loadHomeUrl();
  const { state, notices } = parseHomeUrl("/app/home", "?period=twelve_weeks");
  assert.equal(state.period, null);
  assert.ok(notices.includes("parameter-not-valid-here"));
});

test("§4.2 rule 2 · a pathological query is discarded whole, and says so", async () => {
  const { parseHomeUrl } = await loadHomeUrl();
  const { notices } = parseHomeUrl("/app/home", `?item=${"a".repeat(3000)}`);
  assert.ok(notices.includes("query-discarded"));
});

// ── §3.1 · the three-way relationship ───────────────────────────────────────

test("U8 · homeScope=all never narrows the read by workspaceId (§3.1)", async () => {
  const { parseHomeUrl } = await loadHomeUrl();
  const { state } = parseHomeUrl("/app/home", "?homeScope=all&workspaceId=ws1");
  assert.equal(state.scope, "all", "the id carries the Active Project only");
  assert.equal(state.workspaceId, "ws1");
});

test("§3.1 · homeScope=project keeps the read Project and the Active Project as one value", async () => {
  const { parseHomeUrl } = await loadHomeUrl();
  const { state } = parseHomeUrl("/app/home", "?homeScope=project&workspaceId=ws1");
  assert.equal(state.scope, "project");
  assert.equal(state.workspaceId, "ws1");
});

test("U9 · lensProjectId changes neither Read Scope nor Active Project (§3.2)", async () => {
  const { parseHomeUrl } = await loadHomeUrl();
  const { state } = parseHomeUrl(
    "/app/home",
    "?homeScope=all&workspaceId=ws1&lensProjectId=ws2",
  );
  assert.equal(state.scope, "all", "the Lens does not narrow the read");
  assert.equal(state.workspaceId, "ws1", "the Lens does not become the Active Project");
  assert.equal(state.lensProjectId, "ws2");
});

// ── §6 · serialization ──────────────────────────────────────────────────────

test("§6.2 · a default is omitted; the canonical Today URL is bare", async () => {
  const { buildHomeUrl } = await loadHomeUrl();
  assert.equal(buildHomeUrl({ route: "today", scope: "project" }), "/app/home");
});

test("§6.2 · parameters are emitted in the sealed order, so one state has one URL", async () => {
  const { buildHomeUrl } = await loadHomeUrl();
  assert.equal(
    buildHomeUrl({
      route: "analytics",
      scope: "all",
      workspaceId: "ws1",
      period: "twelve_weeks",
      lensProjectId: "ws2",
    }),
    "/app/home/analytics?homeScope=all&workspaceId=ws1&period=twelve_weeks&lensProjectId=ws2",
  );
});

test("§6.2 · all-projects is never encoded inside workspaceId (PROJECT_SCOPE §5 rule 2)", async () => {
  const { buildHomeUrl } = await loadHomeUrl();
  const url = buildHomeUrl({ route: "today", scope: "all" });
  assert.ok(!/workspaceId=/.test(url), "no sentinel, no '*', no empty string standing for all");
});

test("U13 · Home links emit no V2 or signal-native context keys (§6.3)", async () => {
  const { buildHomeUrl } = await loadHomeUrl();
  const url = buildHomeUrl({ route: "today", scope: "project", workspaceId: "ws1" });
  for (const banned of [
    "sourceProduct",
    "contextVersion",
    "projectId",
    "scope_id",
    "scope_type",
    "workspace_id",
  ]) {
    assert.ok(!url.includes(banned), `a Home link must never emit ${banned} (§6.3)`);
  }
});

test("§6.4 · a canonical URL round-trips and needs no redirect", async () => {
  const { buildHomeUrl, parseHomeUrl, canonicalHomeUrl } = await loadHomeUrl();
  const url = buildHomeUrl({ route: "inbox", scope: "all", workspaceId: "ws1" });
  const [pathname, search] = url.split("?");
  const parsed = parseHomeUrl(pathname, search ?? "");
  assert.equal(parsed.needsCanonicalRedirect, false);
  assert.equal(canonicalHomeUrl(parsed), url);
});

test("U7 · canonical form is reached in ONE hop from a legacy alias (§15.2)", async () => {
  const { parseHomeUrl, canonicalHomeUrl } = await loadHomeUrl();
  const first = parseHomeUrl("/app/home", "?briefingScope=all-projects&sourceProduct=tasks");
  assert.equal(first.state.scope, "all");
  const canonical = canonicalHomeUrl(first);
  const [pathname, search] = canonical.split("?");
  const second = parseHomeUrl(pathname, search ?? "");
  assert.equal(second.needsCanonicalRedirect, false, "one hop, never two");
});

test("D-HR11 · workspace_id normalizes; projectId is dropped, never read as a Project", async () => {
  const { parseHomeUrl } = await loadHomeUrl();
  const a = parseHomeUrl("/app/home", "?workspace_id=ws1");
  assert.equal(a.state.workspaceId, "ws1");

  const b = parseHomeUrl("/app/home", "?projectId=ws9");
  assert.equal(b.state.workspaceId, null, "projectId is ambiguous at this base and is dropped");
  assert.equal(b.state.lensProjectId, null);
  assert.ok(b.notices.includes("unknown-parameter"));
});

// ── §14 · returnTo ──────────────────────────────────────────────────────────

test("U10 · isSafeReturnTo accepts only same-origin, relative, allow-listed paths (§14)", async () => {
  const { isSafeReturnTo } = await loadHomeUrl();

  for (const good of [
    "/app/home",
    "/app/home/inbox?homeScope=all",
    "/app/tasks",
    "/app/task/abc",
    "/app/notes",
    "/app/timeline",
    "/settings/profile",
  ]) {
    assert.equal(isSafeReturnTo(good), true, `${good} must be accepted`);
  }

  for (const bad of [
    "//evil.example",
    "//evil.example/app/home",
    "https://evil.example/app/home",
    "http://app.signalstudio.ie/app/home",
    "javascript:alert(1)",
    "/\\evil.example",
    "\\\\evil.example",
    "/app/../../etc/passwd",
    "app/home",
    "",
    "/lab/home-operating-layer",
    "/api/suite-context?workspaceId=ws1",
    `/app/home?x=${"a".repeat(600)}`,
    "/app/home?returnTo=%2Fapp%2Fhome",
    "/app/home ",
  ]) {
    assert.equal(isSafeReturnTo(bad), false, `${JSON.stringify(bad)} must be rejected`);
  }
});

test("§14 rule 4 · a fragment is stripped, never carried", async () => {
  const { parseHomeUrl } = await loadHomeUrl();
  const { state } = parseHomeUrl("/app/home", "?returnTo=%2Fapp%2Ftasks%23section");
  assert.equal(state.returnTo, "/app/tasks");
});

test("§14 rule 8 · a rejected returnTo is dropped with a notice, never guessed at", async () => {
  const { parseHomeUrl } = await loadHomeUrl();
  const { state, notices } = parseHomeUrl("/app/home", "?returnTo=%2F%2Fevil.example");
  assert.equal(state.returnTo, null);
  assert.ok(notices.includes("returnTo-rejected"));
});

// ── §9 · the invalid-state matrix, at the parse boundary ────────────────────

test("§9 · the parser is total: no input throws", async () => {
  const { parseHomeUrl } = await loadHomeUrl();
  const hostile = [
    "?homeScope=%FF%FE",
    "?workspaceId=" + "%".repeat(50),
    "?" + "a=b&".repeat(200),
    "?homeScope=all&homeScope=project&workspaceId=&item=&event=",
    "?returnTo=" + encodeURIComponent("/app/home?returnTo=/app/home"),
  ];
  for (const search of hostile) {
    assert.doesNotThrow(
      () => parseHomeUrl("/app/home", search),
      `parseHomeUrl must never throw on user input (§4)`,
    );
  }
});

test("§9.1 · an unknown Home path is not silently resolved to Today", async () => {
  const { parseHomeUrl } = await loadHomeUrl();
  assert.throws(
    () => parseHomeUrl("/app/home/not-a-mode", ""),
    /route/i,
    "an unknown /app/home/* path is a 404, never a fall back to Today (§4.2 rule 1)",
  );
});
