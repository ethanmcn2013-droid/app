import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  HOME_MODES,
  LAB_DIRECTIONS,
  SCENARIO_IDS,
  labUrl,
  scenario,
  type HomeMode,
  type LabDirection,
  type ScenarioId,
} from "../../src/lib/home-layer/fixtures";
import {
  expectNoAxeViolations,
  expectNothingForbiddenRendered,
  expectStandingInvariants,
  loadCaptureContract,
  readSurface,
} from "./invariants";

/**
 * Home operating-layer evidence harness · the behavioural suite.
 *
 * One test per (candidate, mode, scenario), run once per Playwright project —
 * and a project is one (browser, viewport, theme, motion, forced-colours). The
 * projects are generated from `capture-contract.json`, so this file names no
 * size, theme or engine anywhere.
 *
 * SCOPE, AND WHY IT IS NARROW BY DEFAULT. The full universe is 4 candidates ×
 * 5 modes × 13 scenarios = 260 worlds, and there are 19 projects. Running every
 * world in every project is 4,940 browser tests, which nobody would run and so
 * nobody would fix. The division of labour instead:
 *
 *   this suite            behaviour — does it hold together — narrow, run often
 *   capture-home-lab.mjs  evidence — what does it look like — wide, run nightly
 *
 * So the default scenario set is one world, and breadth is opt-in:
 *
 *   HOME_LAB_SCENARIOS=all             every one of the thirteen
 *   HOME_LAB_SCENARIOS=owner_quiet,scale
 *   HOME_LAB_CANDIDATES=signal-desk    one direction while it is being built
 *   HOME_LAB_MODES=inbox,analytics
 *
 * THE GATE TEST RUNS FIRST AND FAILS LOUDLY. Every other test in this file is
 * meaningless against a lab that answers 404, and Playwright would report those
 * as skips — which read as "fine" in a summary. So the gate asserts the
 * preflight state, and one unmistakable failure carries the reason.
 */

const contract = loadCaptureContract();

function selection<T extends string>(envVar: string, all: readonly T[], fallback: readonly T[]): T[] {
  const raw = process.env[envVar];
  if (!raw) return [...fallback];
  if (raw === "all") return [...all];
  const chosen = raw.split(",").map((entry) => entry.trim()).filter(Boolean) as T[];
  const unknown = chosen.filter((entry) => !all.includes(entry));
  if (unknown.length) {
    throw new Error(`${envVar}: unknown value(s) ${unknown.join(", ")} — have ${all.join(", ")}`);
  }
  return chosen;
}

const candidates = selection<LabDirection>("HOME_LAB_CANDIDATES", LAB_DIRECTIONS, LAB_DIRECTIONS);
const modes = selection<HomeMode>("HOME_LAB_MODES", HOME_MODES, HOME_MODES);
const scenarios = selection<ScenarioId>("HOME_LAB_SCENARIOS", SCENARIO_IDS, ["owner_signature"]);

function preflightState(): { state: string; reason: string; causes: string[]; remedy: string[] } {
  try {
    return JSON.parse(
      readFileSync(path.join(process.cwd(), contract.paths.preflightFile), "utf8"),
    );
  } catch {
    return {
      state: "not-run",
      reason: "globalSetup wrote no preflight file, so nothing checked whether the lab is reachable",
      causes: [],
      remedy: ["run this suite through its own config, which registers global-setup.ts"],
    };
  }
}

test.describe("Home operating-layer lab", () => {
  test("gate · the lab is open, or nothing below this line means anything", async () => {
    const flight = preflightState();
    expect(
      flight.state,
      [
        `The lab is "${flight.state}" and every invariant below was measured against nothing.`,
        `  ${flight.reason}`,
        ...(flight.causes ?? []).map((cause) => `  cause? ${cause}`),
        ...(flight.remedy ?? []).map((step) => `  fix   ${step}`),
        "",
        "This failure is the harness working. Until a reviewer session can reach",
        "/lab/home-operating-layer, this suite cannot prove anything about it, and",
        "reporting green would be the false clear the whole programme is built to prevent.",
      ].join("\n"),
    ).toBe("open");
  });

  for (const candidate of candidates) {
    for (const mode of modes) {
      for (const scenarioId of scenarios) {
        const world = scenario(scenarioId);
        const url = labUrl(candidate, mode, scenarioId);
        const label = `${candidate} · ${mode} · ${scenarioId}`;

        test(label, async ({ page }, testInfo) => {
          testInfo.annotations.push(
            { type: "candidate", description: candidate },
            { type: "mode", description: mode },
            { type: "scenario", description: scenarioId },
            { type: "proves", description: world.proves },
            { type: "url", description: url },
          );

          const reading = await readSurface(page, url, { fixedTimeIso: world.asOfIso });

          expect(
            reading.navigation.status,
            `${label}: ${url} answered ${reading.navigation.status}. ` +
              "A 404 here is the guard, not the page — see the gate test above.",
          ).toBe(200);

          await expectStandingInvariants(reading, testInfo, label);
          await expectNothingForbiddenRendered(page, world.mustNeverRender, label);
          await expectNoAxeViolations(page, testInfo, label);

          // Home-local navigation is real route links with aria-current, never
          // ARIA tabs (LAB_BRIEF, "Responsive and accessible"). Asserted here
          // rather than left to the design review because it is structural and
          // a reviewer cannot see it.
          const tabs = await page.locator('[role="tablist"], [role="tab"]').count();
          expect(tabs, `${label}: Home-local navigation must be route links, not ARIA tabs`).toBe(0);

          // Exactly one aria-current="page", on the most specific Home-local link.
          const currentPage = reading.audit.structure.ariaCurrent.filter(
            (entry: { value: string | null }) => entry.value === "page",
          );
          expect(
            currentPage.length,
            `${label}: expected exactly one aria-current="page", found ${currentPage.length}`,
          ).toBe(1);
        });
      }
    }
  }
});
