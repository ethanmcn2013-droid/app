import { expect, test } from "@playwright/test";

import {
  expectNoAxeViolations,
  expectStandingInvariants,
  invariantConfig,
  readSurface,
} from "./invariants";
import { INVARIANT_IDS } from "./harness.mjs";

/**
 * Home operating-layer evidence harness · the harness proving itself.
 *
 * The lab does not exist yet, and on any demo or review-mode server it never
 * answers 200 anyway. So there is a real risk this whole harness sits unrun
 * until Wave 3, and is discovered to be broken on the day it is first needed.
 *
 * These tests close that gap. They point the identical helper at surfaces that
 * serve today — `/app/home`, `/app/home/briefing`, and `/lab/timeline-a`, a
 * static mockup that is public by design — and assert the helper measures, not
 * that those surfaces are perfect. When Wave 3 lands, the only thing that
 * changes is the URL.
 *
 * WHAT THIS DOES NOT CLAIM. Nothing here proves anything about the Home
 * operating layer. It proves the instrument works.
 */

const SURFACES = [
  ["current Home", "/app/home"],
  ["current Full briefing", "/app/home/briefing"],
  ["existing lab mockup", "/lab/timeline-a"],
] as const;

test.describe("the instrument measures", () => {
  for (const [label, route] of SURFACES) {
    test(`${label} · all seven invariants return a verdict`, async ({ page }, testInfo) => {
      const reading = await readSurface(page, route);

      expect(reading.navigation.status, `${route} did not serve`).toBe(200);

      // Every invariant reported, with a legal status. This is the assertion
      // that catches a probe that silently stopped working: a helper that
      // returned six verdicts instead of seven would otherwise look like a
      // clean run with one fewer thing to worry about.
      expect(reading.invariants.results.map((result) => result.id).sort()).toEqual(
        [...INVARIANT_IDS].sort(),
      );
      for (const result of reading.invariants.results) {
        expect(["pass", "fail", "unknown"]).toContain(result.status);
        expect(result.summary.length, `${result.id} reported no summary`).toBeGreaterThan(0);
      }

      await testInfo.attach(`verdicts · ${label}`, {
        body: JSON.stringify(reading.invariants.results, null, 2),
        contentType: "application/json",
      });
    });
  }

  test("the structure probe reads a real page rather than an empty one", async ({ page }) => {
    const reading = await readSurface(page, "/app/home");
    const structure = reading.audit.structure;

    // A probe that threw and was swallowed would report zeros everywhere, and
    // zeros are indistinguishable from a clean simple page. These floors make
    // that impossible: the authenticated app has a title, headings, landmarks
    // and controls, so a zero here is a broken probe, not a quiet page.
    expect(structure.title.length, "no document title read").toBeGreaterThan(0);
    expect(structure.headings.total, "no headings read").toBeGreaterThan(0);
    expect(structure.landmarks.mainCount, "no main landmark read").toBeGreaterThan(0);
    expect(structure.focusableCount, "no focusable controls read").toBeGreaterThan(0);
    expect(structure.overflow.clientWidth, "no client width read").toBeGreaterThan(0);
    expect(reading.audit.aria.length, "the ARIA snapshot came back empty").toBeGreaterThan(50);
  });

  test("the focus sweep visits more than one control", async ({ page }) => {
    const reading = await readSurface(page, "/app/home");
    const focus = reading.audit.focus;

    // Regression guard, and it is a real regression. The first version of the
    // sweep identified a stop by a four-level tag path, so twelve nav links
    // collapsed to one identity and the sweep stopped after two stops of a
    // twenty-one-control page — reporting a confident pass for nineteen
    // controls it never touched.
    expect(focus.steps.length, "the focus sweep stopped almost immediately").toBeGreaterThan(2);
    expect(focus.terminated).toBeTruthy();
    expect(focus.availableFocusables).toBeGreaterThan(0);

    const named = focus.steps.filter((step) => step.path);
    expect(named.length).toBeGreaterThan(2);
    // Distinct identities: the whole point of the fix.
    const identities = new Set(named.map((step) => step.identity));
    expect(identities.size, "the sweep visited the same control twice").toBe(named.length);
  });

  test("the busy sampler takes two samples, not one", async ({ page }) => {
    const started = Date.now();
    const reading = await readSurface(page, "/app/home");
    const elapsed = Date.now() - started;
    const config = invariantConfig();

    expect(reading.audit.busy.firstSample).toBeDefined();
    expect(reading.audit.busy.secondSample).toBeDefined();
    // If the gap were skipped, a spinner about to finish and a spinner that
    // never will would be the same reading.
    expect(elapsed, "the run was too fast to have waited the busy sample gap").toBeGreaterThan(
      config.busySampleGapMs,
    );
  });

  test("a settled current surface meets the seven invariants", async ({ page }, testInfo) => {
    const reading = await readSurface(page, "/app/home");
    await expectStandingInvariants(reading, testInfo, "/app/home");
  });

  test("axe runs and reports violations and incompletes separately", async ({ page }, testInfo) => {
    await readSurface(page, "/app/home");
    const summary = await expectNoAxeViolations(page, testInfo, "/app/home");
    expect(summary.passCount, "axe reported no passing checks, so it probably did not run").toBeGreaterThan(0);
    expect(["pass", "unresolved"]).toContain(summary.status);
  });
});
