/**
 * Home operating-layer evidence harness · the page driver and the verdicts.
 *
 * ONE implementation, two callers. `scripts/home-layer/capture-home-lab.mjs`
 * drives the capture matrix with it; `invariants.ts` wraps it in Playwright
 * `expect` for the behavioural specs. Nothing here imports `@playwright/test`,
 * so it can be unit-tested without a browser, and nothing here writes a file,
 * so it can run inside a Playwright worker.
 *
 * THE STANDING INVARIANTS, in the order `evaluateInvariants` reports them:
 *
 *   1. no horizontal overflow on non-exempt content
 *   2. no indefinite spinner
 *   3. no console or hydration error
 *   4. exactly one `main`
 *   5. exactly one `h1`
 *   6. no nested interactive control inside a wrapping link
 *   7. focus visible and unobscured
 *
 * Each returns `pass` · `fail` · `unknown`. `unknown` is a first-class outcome
 * and never collapses into `pass`. If the focus sweep found no focusable
 * element, invariant 7 did not pass — it did not run, and a review sheet that
 * printed a tick there would be making the claim on nobody's behalf.
 */

import { busyProbe, focusProbe, restingStyleProbe, structureProbe } from "./dom-audit.mjs";

export const INVARIANT_IDS = Object.freeze([
  "no-horizontal-overflow",
  "no-indefinite-spinner",
  "no-console-or-hydration-error",
  "single-main",
  "single-h1",
  "no-nested-interactive-in-link",
  "focus-visible-and-unobscured",
]);

const STYLE_KEYS = Object.freeze([
  "outlineStyle",
  "outlineWidth",
  "outlineColor",
  "outlineOffset",
  "boxShadow",
  "backgroundColor",
  "borderColor",
  "borderWidth",
  "textDecorationLine",
  "filter",
]);

/**
 * Applies every determinism control this harness owns to one browser context.
 * Locale, timezone, colour scheme, motion and forced colours are set when the
 * context is created (Playwright cannot change them afterwards); the clock is
 * set here because it is per-scenario.
 *
 * `setFixedTime`, not `install`. `install` replaces the whole timer stack and
 * pauses `setTimeout`, which deadlocks React's scheduler; `setFixedTime` pins
 * `Date.now()` and `new Date()` and leaves timers alone. The fixture family is
 * pure and reads no clock, so this guards against a *component* reading one —
 * a relative "2 hours ago" rendered from the real wall clock would drift
 * between runs and quietly poison every screenshot comparison.
 */
export async function freezeClock(context, fixedTimeIso) {
  if (!fixedTimeIso) throw new Error("harness: freezeClock needs an ISO instant");
  const at = new Date(fixedTimeIso);
  if (Number.isNaN(at.getTime())) {
    throw new Error(`harness: freezeClock got an unparseable instant "${fixedTimeIso}"`);
  }
  await context.clock.setFixedTime(at);
  return at.toISOString();
}

/** Console, page-error and request-failure collection, attached before navigation. */
export function attachErrorCollectors(page) {
  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const requestFailures = [];

  page.on("console", (message) => {
    const entry = {
      text: message.text().slice(0, 400),
      location: message.location?.() ?? null,
    };
    if (message.type() === "error") consoleErrors.push(entry);
    else if (message.type() === "warning") consoleWarnings.push(entry);
  });
  page.on("pageerror", (error) => {
    pageErrors.push({ text: String(error?.message ?? error).slice(0, 400), stack: null });
  });
  page.on("requestfailed", (request) => {
    requestFailures.push({
      url: request.url().slice(0, 300),
      failure: request.failure()?.errorText ?? null,
    });
  });

  return {
    consoleErrors,
    consoleWarnings,
    pageErrors,
    requestFailures,
    drain() {
      return {
        consoleErrors: consoleErrors.splice(0),
        consoleWarnings: consoleWarnings.splice(0),
        pageErrors: pageErrors.splice(0),
        requestFailures: requestFailures.splice(0),
      };
    },
  };
}

/**
 * Navigate and settle. `networkidle` is attempted but never required: the four
 * Tasks-runtime routes hold an open connection and never reach it (recorded in
 * design/LAB_BRIEF.md constraint 2), so waiting on it would time them out and
 * report a layout problem as a network problem. Whether idle was reached is
 * returned as a fact instead.
 */
export async function navigateAndSettle(page, url, config) {
  const startedAt = Date.now();
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: config.navigationTimeoutMs,
  });
  let reachedNetworkIdle = true;
  try {
    await page.waitForLoadState("networkidle", { timeout: config.networkIdleTimeoutMs });
  } catch {
    reachedNetworkIdle = false;
  }
  await page.waitForTimeout(config.settleMs);
  return {
    status: response?.status() ?? null,
    finalUrl: page.url(),
    reachedNetworkIdle,
    settleMs: Date.now() - startedAt,
  };
}

/**
 * Two busy samples separated by `busySampleGapMs`. An indicator whose identity
 * survives both samples, and which is not a determinate progress bar, is
 * indefinite. One sample cannot tell a spinner that is about to finish from one
 * that never will, and this harness must never call the second the first.
 */
export async function sampleBusyIndicators(page, config) {
  const first = await page.evaluate(busyProbe, { busySelector: config.busySelector });
  await page.waitForTimeout(config.busySampleGapMs);
  const second = await page.evaluate(busyProbe, { busySelector: config.busySelector });

  const firstIds = new Map(first.map((entry) => [entry.identity, entry]));
  const persistent = second.filter((entry) => firstIds.has(entry.identity));
  return {
    firstSample: first,
    secondSample: second,
    persistent,
    indefinite: persistent.filter((entry) => !entry.determinate),
  };
}

/**
 * Tab through up to `focusSweepLimit` controls, recording for each one whether
 * the focus indicator is visible (any computed style property moved) and
 * whether the focused box is obscured.
 *
 * Driven by real `Tab` presses rather than `element.focus()`, because
 * `:focus-visible` is a heuristic about HOW focus arrived: a programmatic focus
 * on a link does not set it in Chromium, so a probe built on `.focus()` would
 * report "no focus ring" on a page whose focus ring is perfect.
 */
export async function sweepFocus(page, config, availableFocusables = null) {
  const steps = [];
  let firstIdentity = null;
  let previousIdentity = null;
  let terminated = "limit-reached";

  for (let index = 0; index < config.focusSweepLimit; index += 1) {
    const resting = await page.evaluate(restingStyleProbe, {
      focusableSelector: config.focusableSelector,
      index,
    });
    await page.keyboard.press("Tab");
    let focused = await page.evaluate(focusProbe);

    if (!focused.ok) {
      steps.push({ index, ...focused, indicatorVisible: null, obscured: null });
      previousIdentity = null;
      continue;
    }

    // EVERY NEGATIVE READING IS RE-MEASURED ONCE, after the motion settle.
    //
    // Measured, not theorised. On /app/home at 1440x960 the first version of
    // this sweep reported the logo and the Home link as obscured at Tab stops 1
    // and 2. The obstruction was the skip link — focused at stop 0, sliding
    // back out of view, and still over them at the instant stop 1 was probed.
    // A real product defect and a transition caught in flight look identical in
    // a single reading, and shipping that would have put two false failures on
    // every candidate's review sheet. The brief caps routine motion at 300ms,
    // so waiting past it and looking again is the difference between the two.
    let reMeasuredAfterMotion = false;
    const negative = (probe) =>
      !probe.visibleInViewport || probe.covers.some((point) => point.state === "covered");
    if (negative(focused)) {
      await page.waitForTimeout(config.focusSettleMs);
      focused = await page.evaluate(focusProbe);
      reMeasuredAfterMotion = true;
      if (!focused.ok) {
        steps.push({ index, ...focused, indicatorVisible: null, obscured: null });
        previousIdentity = null;
        continue;
      }
    }

    if (index === 0) firstIdentity = focused.identity;
    // Focus did not move. Two very different causes, and calling them both a
    // trap would be wrong.
    //
    // Measured on this repository: on /lab/timeline-a (two links) headless
    // Firefox visits both, then hands the third Tab to its own browser chrome
    // and leaves `document.activeElement` on the second link. Chromium wraps
    // back to the first instead. Identical page, identical harness, opposite
    // reading — so the tie-break is whether anything was left to reach. With
    // every focusable already visited, a non-advancing Tab means the document
    // is exhausted. With controls still unvisited, it means focus is stuck.
    if (previousIdentity !== null && focused.identity === previousIdentity) {
      const exhausted =
        availableFocusables !== null && steps.length >= availableFocusables;
      terminated = exhausted ? "exhausted-document" : "focus-did-not-advance";
      if (!exhausted) {
        steps.push({
          index,
          path: focused.path,
          name: focused.name,
          identity: focused.identity,
          focusDidNotAdvance: true,
          indicatorVisible: null,
          obscured: null,
        });
      }
      break;
    }
    // A genuine wrap back to the first stop means the sweep saw everything.
    if (index > 0 && focused.identity === firstIdentity) {
      terminated = "wrapped";
      break;
    }
    previousIdentity = focused.identity;

    const changed = resting
      ? STYLE_KEYS.filter((property) => resting[property] !== focused.style[property])
      : null;
    const indicatorVisible = changed === null ? null : changed.length > 0;
    const covered = focused.covers.filter((point) => point.state === "covered");

    steps.push({
      index,
      path: focused.path,
      identity: focused.identity,
      tag: focused.tag,
      role: focused.role,
      name: focused.name,
      matchesFocusVisible: focused.matchesFocusVisible,
      changedStyleProperties: changed,
      indicatorVisible,
      visibleInViewport: focused.visibleInViewport,
      fullyInViewport: focused.fullyInViewport,
      reMeasuredAfterMotion,
      obscured: covered.length > 0,
      // How much of the focused box is covered, not merely whether any of it
      // is. One corner behind a floating button and a control completely
      // buried under a sheet are both failures, and a reviewer triaging fifty
      // of them needs to see which is which without opening the screenshot.
      coveredPointCount: covered.length,
      samplePointCount: focused.covers.length,
      coveredBy: covered.slice(0, 3),
      rect: focused.rect,
    });
  }

  return {
    steps,
    terminated,
    // How many controls the page actually offers, so a sweep that stopped at
    // its limit cannot be read as a sweep that covered everything.
    sweptCount: steps.length,
    availableFocusables,
    limit: config.focusSweepLimit,
  };
}

/**
 * One full read of a settled page: structure, busy indicators, focus sweep and
 * an ARIA snapshot. The ARIA snapshot is taken FIRST, before the focus sweep
 * moves focus and before the overflow probe scrolls, so the snapshot describes
 * the page as it arrives rather than as the harness left it.
 */
export async function auditSurface(page, config) {
  const aria = await page.locator("body").ariaSnapshot();
  const busy = await sampleBusyIndicators(page, config);
  const structure = await page.evaluate(structureProbe, {
    overflowExemptSelector: config.overflowExemptSelector,
    overflowTolerancePx: config.overflowTolerancePx,
    nestedInteractiveSelector: config.nestedInteractiveSelector,
    nestedInteractiveChildSelector: config.nestedInteractiveChildSelector,
    focusableSelector: config.focusableSelector,
  });
  const focus = await sweepFocus(page, config, structure.focusableCount ?? null);
  return { aria, structure, busy, focus };
}

function allowlistMatch(text, allowlist) {
  for (const entry of allowlist ?? []) {
    if (!entry?.pattern) continue;
    if (new RegExp(entry.pattern, "i").test(text)) return entry;
  }
  return null;
}

/**
 * Facts in, verdicts out. Every verdict is `pass`, `fail` or `unknown`, and
 * carries the evidence that produced it.
 *
 * @param {{ structure?: any, busy?: any, focus?: any }} audit
 * @param {{ consoleErrors: any[], pageErrors: any[] } | null} errors
 * @param {object} config the `invariants` block of capture-contract.json
 */
export function evaluateInvariants(audit, errors, config) {
  const results = [];
  const verdict = (id, status, summary, evidence) => {
    if (!["pass", "fail", "unknown"].includes(status)) {
      throw new Error(`harness: invariant ${id} produced an illegal status ${status}`);
    }
    results.push({ id, status, summary, evidence });
  };

  const structure = audit?.structure;

  // 1 · horizontal overflow
  if (!structure?.overflow) {
    verdict("no-horizontal-overflow", "unknown", "the structure probe did not report overflow", null);
  } else {
    const { documentOverflowPx, reachableScrollLeft, offenders, clientWidth } = structure.overflow;
    const tolerance = config.overflowTolerancePx;
    const scrolls = reachableScrollLeft > tolerance;
    const wider = documentOverflowPx > tolerance;
    if (!scrolls && !wider) {
      verdict("no-horizontal-overflow", "pass", `document fits ${clientWidth}px`, structure.overflow);
    } else if (offenders.length === 0) {
      // The page scrolls sideways and no non-exempt element explains it. That is
      // not a pass — it is a measurement that did not resolve, and it says so.
      verdict(
        "no-horizontal-overflow",
        "unknown",
        `document scrolls ${reachableScrollLeft}px right but every spilling element sits inside a declared scroller — the cause is not attributed`,
        structure.overflow,
      );
    } else {
      verdict(
        "no-horizontal-overflow",
        "fail",
        `${offenders.length} non-exempt element(s) spill past ${clientWidth}px; the page scrolls ${reachableScrollLeft}px right`,
        structure.overflow,
      );
    }
  }

  // 2 · indefinite spinner
  if (!audit?.busy) {
    verdict("no-indefinite-spinner", "unknown", "busy indicators were not sampled", null);
  } else if (audit.busy.indefinite.length > 0) {
    verdict(
      "no-indefinite-spinner",
      "fail",
      `${audit.busy.indefinite.length} busy indicator(s) survived both samples with no determinate value`,
      audit.busy,
    );
  } else {
    verdict(
      "no-indefinite-spinner",
      "pass",
      audit.busy.persistent.length
        ? `${audit.busy.persistent.length} persistent indicator(s), all determinate`
        : "no busy indicator survived the second sample",
      audit.busy,
    );
  }

  // 3 · console and hydration errors
  //
  // A missing collector is unknown, not clean. Nothing was listening, so "no
  // errors were seen" is a statement about the harness rather than the page —
  // and a page that failed to load emits no console errors either.
  const collected =
    errors && Array.isArray(errors.consoleErrors) && Array.isArray(errors.pageErrors);
  const allConsole = collected ? [...errors.consoleErrors, ...errors.pageErrors] : [];
  const hydrationPattern = new RegExp(config.hydrationErrorPattern, "i");
  const unexcused = [];
  const excused = [];
  for (const entry of allConsole) {
    const match = allowlistMatch(entry.text, config.consoleErrorAllowlist);
    if (match) excused.push({ ...entry, allowlist: match });
    else unexcused.push(entry);
  }
  const hydration = allConsole.filter((entry) => hydrationPattern.test(entry.text));
  if (!collected) {
    verdict(
      "no-console-or-hydration-error",
      "unknown",
      "no console collector was attached for this page — nothing was listening",
      null,
    );
  } else if (hydration.length > 0) {
    verdict(
      "no-console-or-hydration-error",
      "fail",
      `${hydration.length} hydration error(s) — never allowlistable`,
      { hydration, unexcused, excused },
    );
  } else if (unexcused.length > 0) {
    verdict(
      "no-console-or-hydration-error",
      "fail",
      `${unexcused.length} console/page error(s)`,
      { hydration, unexcused, excused },
    );
  } else {
    verdict(
      "no-console-or-hydration-error",
      "pass",
      excused.length ? `clean, ${excused.length} allowlisted` : "clean",
      { hydration, unexcused, excused },
    );
  }

  // 4 · one main
  const mainCount = structure?.landmarks?.mainCount;
  if (mainCount === undefined || mainCount === null) {
    verdict("single-main", "unknown", "landmarks were not read", null);
  } else {
    verdict(
      "single-main",
      mainCount === 1 ? "pass" : "fail",
      `${mainCount} visible main landmark(s)`,
      structure.landmarks,
    );
  }

  // 5 · one h1
  const h1Count = structure?.headings?.h1Count;
  if (h1Count === undefined || h1Count === null) {
    verdict("single-h1", "unknown", "headings were not read", null);
  } else {
    verdict(
      "single-h1",
      h1Count === 1 ? "pass" : "fail",
      `${h1Count} visible level-1 heading(s)${h1Count ? `: ${structure.headings.h1Text.join(" | ")}` : ""}`,
      structure.headings,
    );
  }

  // 6 · nested interactive inside a wrapping link
  const nested = structure?.nestedInteractiveInsideLink;
  if (!Array.isArray(nested)) {
    verdict("no-nested-interactive-in-link", "unknown", "the nested-interactive probe did not run", null);
  } else {
    verdict(
      "no-nested-interactive-in-link",
      nested.length === 0 ? "pass" : "fail",
      nested.length === 0 ? "no interactive control inside a wrapping link" : `${nested.length} wrapping link(s) contain a control`,
      nested,
    );
  }

  // 7 · focus visible and unobscured
  const focusReport = audit?.focus ?? null;
  const steps = Array.isArray(focusReport?.steps) ? focusReport.steps.filter((step) => step.path) : null;
  if (steps === null) {
    verdict("focus-visible-and-unobscured", "unknown", "the focus sweep did not run", null);
  } else if (steps.length === 0) {
    verdict(
      "focus-visible-and-unobscured",
      "unknown",
      `${config.focusSweepLimit} Tab press(es) reached no focusable element — the invariant was not tested, which is not the same as met`,
      focusReport,
    );
  } else {
    const invisible = steps.filter((step) => step.indicatorVisible === false);
    const unmeasured = steps.filter((step) => step.indicatorVisible === null && !step.focusDidNotAdvance);
    const obscured = steps.filter((step) => step.obscured === true);
    const offscreen = steps.filter((step) => step.visibleInViewport === false);
    const stuck = steps.filter((step) => step.focusDidNotAdvance === true);
    const problems = [];
    if (invisible.length) problems.push(`${invisible.length} with no focus indicator`);
    if (obscured.length) {
      const worst = Math.max(...obscured.map((step) => step.coveredPointCount ?? 1));
      const points = obscured[0]?.samplePointCount ?? 5;
      problems.push(`${obscured.length} obscured while focused (worst ${worst}/${points} sample points covered)`);
    }
    if (offscreen.length) problems.push(`${offscreen.length} off screen while focused, after the motion settle`);
    if (stuck.length) problems.push(`${stuck.length} where Tab did not advance focus`);

    if (problems.length) {
      verdict(
        "focus-visible-and-unobscured",
        "fail",
        `${problems.join(", ")}, across ${steps.length} stop(s)`,
        { invisible, obscured, offscreen, stuck, terminated: focusReport.terminated, steps },
      );
    } else if (unmeasured.length) {
      verdict(
        "focus-visible-and-unobscured",
        "unknown",
        `${unmeasured.length} of ${steps.length} stop(s) could not be measured against a resting style`,
        { unmeasured, terminated: focusReport.terminated, steps },
      );
    } else if (
      // The sweep ran out of page before it ran out of budget, yet the page
      // reports controls it never reached. Measured on WebKit, which does not
      // Tab to links unless full keyboard access is on: on a two-link page it
      // visited one, wrapped, and would otherwise have reported a clean pass
      // for a control it never touched. Reachable is the claim; this is the
      // shortfall in it.
      focusReport.availableFocusables !== null &&
      ["wrapped", "exhausted-document"].includes(focusReport.terminated) &&
      steps.length < Math.min(focusReport.availableFocusables, config.focusSweepLimit)
    ) {
      verdict(
        "focus-visible-and-unobscured",
        "unknown",
        `Tab reached ${steps.length} of the ${focusReport.availableFocusables} focusable control(s) this page reports, then ${focusReport.terminated}. The controls never visited are untested, not passing`,
        { terminated: focusReport.terminated, sweptCount: steps.length, availableFocusables: focusReport.availableFocusables, steps },
      );
    } else {
      const unreached = Math.max(0, (focusReport.availableFocusables ?? steps.length) - steps.length);
      verdict(
        "focus-visible-and-unobscured",
        "pass",
        `${steps.length} stop(s), all with a visible unobscured indicator (sweep ended: ${focusReport.terminated ?? "unrecorded"}` +
          `${unreached ? `, ${unreached} control(s) beyond the ${config.focusSweepLimit}-stop budget were not visited` : ""})`,
        { terminated: focusReport.terminated, sweptCount: focusReport.sweptCount, availableFocusables: focusReport.availableFocusables, steps },
      );
    }
  }

  const byId = Object.fromEntries(results.map((result) => [result.id, result]));
  const missing = INVARIANT_IDS.filter((id) => !byId[id]);
  if (missing.length) {
    throw new Error(`harness: invariants not reported: ${missing.join(", ")}`);
  }

  return {
    results,
    byId,
    failed: results.filter((result) => result.status === "fail").map((result) => result.id),
    unknown: results.filter((result) => result.status === "unknown").map((result) => result.id),
    // `ok` requires every invariant to PASS. An unknown is not an ok.
    ok: results.every((result) => result.status === "pass"),
  };
}

/**
 * Reduces an axe run to a record. Violations fail; `incomplete` entries are
 * carried in full and reported as unresolved rather than folded into the pass
 * count, because an incomplete is a question axe could not answer.
 */
export function summariseAxe(results) {
  if (!results) return { status: "unknown", reason: "axe did not run", violations: [], incomplete: [] };
  const violations = (results.violations ?? []).map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: (violation.nodes ?? []).slice(0, 5).map((node) => ({
      target: node.target,
      failureSummary: (node.failureSummary ?? "").slice(0, 300),
    })),
    nodeCount: (violation.nodes ?? []).length,
  }));
  const incomplete = (results.incomplete ?? []).map((entry) => ({
    id: entry.id,
    impact: entry.impact,
    help: entry.help,
    nodeCount: (entry.nodes ?? []).length,
  }));
  return {
    status: violations.length ? "fail" : incomplete.length ? "unresolved" : "pass",
    violationCount: violations.length,
    incompleteCount: incomplete.length,
    passCount: (results.passes ?? []).length,
    violations,
    incomplete,
    testEngine: results.testEngine ?? null,
  };
}

// ── Self-test ───────────────────────────────────────────────────────────────

const TEST_CONFIG = Object.freeze({
  overflowTolerancePx: 1,
  focusSweepLimit: 14,
  focusSettleMs: 350,
  hydrationErrorPattern: "hydrat|did not match",
  consoleErrorAllowlist: [],
});

function focusStep(overrides) {
  return {
    path: "a",
    identity: "a|Name|0,0",
    indicatorVisible: true,
    obscured: false,
    visibleInViewport: true,
    ...overrides,
  };
}

function cleanAudit() {
  return {
    structure: {
      overflow: { clientWidth: 320, documentOverflowPx: 0, reachableScrollLeft: 0, offenders: [] },
      landmarks: { mainCount: 1 },
      headings: { h1Count: 1, h1Text: ["Today"] },
      nestedInteractiveInsideLink: [],
    },
    busy: { persistent: [], indefinite: [] },
    focus: {
      terminated: "wrapped",
      sweptCount: 2,
      limit: 14,
      steps: [
        focusStep({ path: "a", identity: "a|A|0,0" }),
        focusStep({ path: "b", identity: "b|B|0,40" }),
      ],
    },
  };
}

export function selfTest() {
  const failures = [];
  const check = (name, condition, detail) => {
    if (!condition) failures.push(`${name}${detail ? `: ${detail}` : ""}`);
  };
  const evaluate = (audit, errors) =>
    evaluateInvariants(audit, errors ?? { consoleErrors: [], pageErrors: [] }, TEST_CONFIG);

  const clean = evaluate(cleanAudit());
  check("a clean page passes every invariant", clean.ok, clean.failed.concat(clean.unknown).join(","));
  check("all seven invariants are reported", clean.results.length === INVARIANT_IDS.length);

  const overflowing = cleanAudit();
  overflowing.structure.overflow = {
    clientWidth: 320,
    documentOverflowPx: 40,
    reachableScrollLeft: 40,
    offenders: [{ path: "div.wide", spillPx: 40 }],
  };
  check("attributed overflow fails", evaluate(overflowing).byId["no-horizontal-overflow"].status === "fail");

  const unattributed = cleanAudit();
  unattributed.structure.overflow = {
    clientWidth: 320,
    documentOverflowPx: 40,
    reachableScrollLeft: 40,
    offenders: [],
  };
  check(
    "unattributed overflow is unknown, never pass",
    evaluate(unattributed).byId["no-horizontal-overflow"].status === "unknown",
  );

  const spinning = cleanAudit();
  spinning.busy = {
    persistent: [{ identity: "a", determinate: false }],
    indefinite: [{ identity: "a", determinate: false }],
  };
  check("an indefinite spinner fails", evaluate(spinning).byId["no-indefinite-spinner"].status === "fail");

  const determinate = cleanAudit();
  determinate.busy = {
    persistent: [{ identity: "a", determinate: true }],
    indefinite: [],
  };
  check(
    "a determinate progress bar passes",
    evaluate(determinate).byId["no-indefinite-spinner"].status === "pass",
  );

  check(
    "a console error fails",
    evaluate(cleanAudit(), { consoleErrors: [{ text: "boom" }], pageErrors: [] }).byId[
      "no-console-or-hydration-error"
    ].status === "fail",
  );

  const withAllowlist = evaluateInvariants(
    cleanAudit(),
    { consoleErrors: [{ text: "third-party pixel blocked" }], pageErrors: [] },
    { ...TEST_CONFIG, consoleErrorAllowlist: [{ pattern: "third-party pixel", reason: "r", owner: "o", expiresAt: "2026-12-31" }] },
  );
  check("an allowlisted console error passes", withAllowlist.byId["no-console-or-hydration-error"].status === "pass");

  const hydrationAllowlisted = evaluateInvariants(
    cleanAudit(),
    { consoleErrors: [{ text: "Hydration failed because the server HTML did not match" }], pageErrors: [] },
    { ...TEST_CONFIG, consoleErrorAllowlist: [{ pattern: ".*", reason: "r", owner: "o", expiresAt: "2026-12-31" }] },
  );
  check(
    "a hydration error is not allowlistable",
    hydrationAllowlisted.byId["no-console-or-hydration-error"].status === "fail",
  );

  const twoMains = cleanAudit();
  twoMains.structure.landmarks.mainCount = 2;
  check("two mains fail", evaluate(twoMains).byId["single-main"].status === "fail");
  const noMain = cleanAudit();
  noMain.structure.landmarks.mainCount = 0;
  check("zero mains fail", evaluate(noMain).byId["single-main"].status === "fail");

  const twoH1 = cleanAudit();
  twoH1.structure.headings = { h1Count: 2, h1Text: ["A", "B"] };
  check("two h1s fail", evaluate(twoH1).byId["single-h1"].status === "fail");

  const nested = cleanAudit();
  nested.structure.nestedInteractiveInsideLink = [{ link: "a.row", children: ["button"] }];
  check("a nested control fails", evaluate(nested).byId["no-nested-interactive-in-link"].status === "fail");

  const withFocus = (steps, terminated, availableFocusables) => {
    const audit = cleanAudit();
    audit.focus = {
      terminated: terminated ?? "wrapped",
      sweptCount: steps.length,
      availableFocusables: availableFocusables ?? steps.length,
      limit: 14,
      steps,
    };
    return audit;
  };

  check(
    "an empty focus sweep is unknown, never pass",
    evaluate(withFocus([])).byId["focus-visible-and-unobscured"].status === "unknown",
  );
  check("an empty focus sweep makes the page not ok", evaluate(withFocus([])).ok === false);

  check(
    "an invisible focus ring fails",
    evaluate(withFocus([focusStep({ indicatorVisible: false })])).byId["focus-visible-and-unobscured"].status === "fail",
  );
  check(
    "an obscured focused control fails",
    evaluate(withFocus([focusStep({ obscured: true })])).byId["focus-visible-and-unobscured"].status === "fail",
  );
  check(
    "a focused control still off screen after the motion settle fails",
    evaluate(withFocus([focusStep({ visibleInViewport: false })])).byId["focus-visible-and-unobscured"].status === "fail",
  );
  check(
    "a Tab that does not advance focus fails",
    evaluate(
      withFocus([focusStep({ focusDidNotAdvance: true, indicatorVisible: null })], "focus-did-not-advance"),
    ).byId["focus-visible-and-unobscured"].status === "fail",
  );
  check(
    "an unmeasurable focus stop is unknown",
    evaluate(withFocus([focusStep({ indicatorVisible: null })])).byId["focus-visible-and-unobscured"].status === "unknown",
  );
  check(
    "a sweep that wrapped without reaching every focusable is unknown, never pass",
    evaluate(withFocus([focusStep({})], "wrapped", 6)).byId["focus-visible-and-unobscured"].status === "unknown",
  );
  check(
    "a sweep that visited everything the page reports passes",
    evaluate(withFocus([focusStep({ identity: "a|A|0,0" }), focusStep({ identity: "b|B|0,40", path: "b" })], "wrapped", 2)).byId[
      "focus-visible-and-unobscured"
    ].status === "pass",
  );
  check(
    "a sweep stopped by its own budget still passes for what it covered",
    evaluate(
      withFocus(
        Array.from({ length: 14 }, (unused, index) => focusStep({ path: `a${index}`, identity: `a${index}|N|0,${index}` })),
        "limit-reached",
        40,
      ),
    ).byId["focus-visible-and-unobscured"].status === "pass",
  );

  const empty = evaluate({});
  check(
    "a page with no audit reports six unknowns, console excepted because it was collected",
    empty.unknown.length === INVARIANT_IDS.length - 1,
    empty.unknown.join(","),
  );
  check("a page with no audit is not ok", empty.ok === false);

  const noCollector = evaluateInvariants({}, null, TEST_CONFIG);
  check(
    "with no console collector every invariant is unknown",
    noCollector.unknown.length === INVARIANT_IDS.length,
    noCollector.unknown.join(","),
  );
  check("a missing collector never reads as clean", noCollector.ok === false);

  check("axe with no result is unknown", summariseAxe(null).status === "unknown");
  check(
    "axe incomplete is unresolved, never pass",
    summariseAxe({ violations: [], incomplete: [{ id: "colour-contrast", nodes: [{}] }], passes: [] }).status ===
      "unresolved",
  );
  check(
    "axe violations fail",
    summariseAxe({ violations: [{ id: "x", nodes: [{ target: ["a"] }] }], incomplete: [], passes: [] }).status === "fail",
  );

  return failures;
}
