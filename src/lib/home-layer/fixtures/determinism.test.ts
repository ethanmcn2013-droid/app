/**
 * Determinism is the product.
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/fixtures/determinism.test.ts
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HOME_FIXTURE_LOCALE,
  HOME_FIXTURE_NOW,
  HOME_FIXTURE_NOW_ISO,
  HOME_FIXTURE_TIME_ZONE,
  HOME_FIXTURE_TODAY,
  seededAvatar,
  seededHash,
} from "./clock";
import { PROJECT_TRUTH_TODAY } from "@/lib/project-truth-fixture";
import {
  HOME_FIXTURE_SCENARIOS,
  homeFixtureWorld,
  labMatrix,
  labUrl,
  SCENARIO_IDS,
} from "./scenarios";

const FIXTURE_DIR = join(process.cwd(), "src/lib/home-layer/fixtures");

/**
 * Comments are stripped before the scan. These modules DOCUMENT the banned
 * constructs by name — `Math.random()`, the ambient time zone — because a
 * reader needs to know what was refused and why. A scanner that trips on the
 * prose explaining a rule is a scanner someone deletes, so it reads code.
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|\s)\/\/[^\n]*/g, " ");
}

function sourceFiles(): { name: string; text: string }[] {
  return readdirSync(FIXTURE_DIR)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => ({
      name,
      text: stripComments(readFileSync(join(FIXTURE_DIR, name), "utf8")),
    }));
}

describe("the clock is frozen, and it is the estate's clock", () => {
  it("joins the merged Project-truth clock rather than starting a fourth", () => {
    assert.equal(HOME_FIXTURE_TODAY, PROJECT_TRUTH_TODAY);
  });

  it("pins one instant, and it falls on the pinned calendar date", () => {
    assert.equal(HOME_FIXTURE_NOW, Date.parse(HOME_FIXTURE_NOW_ISO));
    const local = new Intl.DateTimeFormat("en-CA", {
      timeZone: HOME_FIXTURE_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(HOME_FIXTURE_NOW_ISO));
    assert.equal(local, HOME_FIXTURE_TODAY);
  });

  it("declares en-GB and Europe/London explicitly", () => {
    assert.equal(HOME_FIXTURE_LOCALE, "en-GB");
    assert.equal(HOME_FIXTURE_TIME_ZONE, "Europe/London");
  });
});

describe("no non-determinism can enter the family", () => {
  const banned: [RegExp, string][] = [
    [/Math\.random\s*\(/, "Math.random()"],
    [/Date\.now\s*\(/, "Date.now()"],
    [/new Date\s*\(\s*\)/, "new Date() with no argument"],
    [/resolvedOptions\s*\(\s*\)\s*\.timeZone/, "the ambient time zone"],
    [/crypto\.randomUUID/, "crypto.randomUUID()"],
    [/\bfetch\s*\(/, "fetch()"],
    [/process\.env/, "process.env"],
  ];

  for (const { name, text } of sourceFiles()) {
    for (const [pattern, label] of banned) {
      it(`${name} contains no ${label}`, () => {
        assert.equal(
          pattern.test(text),
          false,
          `${name} reads ${label}. Every value in this universe must be the same on every machine, on every run.`,
        );
      });
    }
  }
});

describe("every scenario is a pure function of its id", () => {
  for (const id of SCENARIO_IDS) {
    it(`${id} produces a deep-equal world when built twice`, () => {
      assert.deepEqual(homeFixtureWorld(id), homeFixtureWorld(id));
    });

    it(`${id} serialises identically when built twice`, () => {
      assert.equal(
        JSON.stringify(homeFixtureWorld(id)),
        JSON.stringify(homeFixtureWorld(id)),
      );
    });
  }
});

describe("seeded identity", () => {
  it("hashes stably", () => {
    assert.equal(seededHash("truth-user"), seededHash("truth-user"));
    assert.notEqual(seededHash("truth-user"), seededHash("guest-user-dara"));
  });

  it("derives an avatar without a network request or a random tint", () => {
    const first = seededAvatar("collab-user-eabha", "Éabha");
    const second = seededAvatar("collab-user-eabha", "Éabha");
    assert.deepEqual(first, second);
    assert.equal(first.initials, "É");
    assert.ok(first.tintIndex >= 0 && first.tintIndex < 12);
  });

  it("reads an ampersand name as two initials", () => {
    assert.equal(seededAvatar("home-ws-mara-finn", "Mara & Finn").initials, "MF");
  });
});

describe("thirteen scenarios, each reachable by URL", () => {
  it("declares exactly thirteen", () => {
    assert.equal(SCENARIO_IDS.length, 13);
    assert.equal(HOME_FIXTURE_SCENARIOS.length, 13);
  });

  it("gives every scenario a distinct URL, and the URL is stable", () => {
    const urls = SCENARIO_IDS.map((id) => labUrl("editorial-line", "today", id));
    assert.equal(new Set(urls).size, 13);
    for (const id of SCENARIO_IDS) {
      assert.equal(
        labUrl("editorial-line", "today", id),
        labUrl("editorial-line", "today", id),
      );
    }
  });

  it("covers four directions by five modes by thirteen scenarios", () => {
    const matrix = labMatrix();
    assert.equal(matrix.length, 4 * 5 * 13);
    assert.equal(new Set(matrix.map((entry) => entry.url)).size, matrix.length);
  });

  it("carries the scenario id in the URL, so a reload rebuilds the same world", () => {
    for (const entry of labMatrix()) {
      assert.ok(
        entry.url.includes(`scenario=${entry.scenario}`),
        `${entry.url} does not carry its own scenario id`,
      );
    }
  });
});
