/**
 * The protected-lab rule, exercised directly.
 *
 * `policy.ts` imports nothing, so every branch of the access decision can be
 * run here with real values instead of being asserted about. This file is the
 * proof of objectives 1 and 2 at the level of the rule; `guard.test.ts` proves
 * the guard actually applies the rule and refuses with a 404; and
 * `lab-isolation-contract.test.mjs` proves the wiring that puts the guard in
 * the request path at all. None of the three is sufficient alone.
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/lab/policy.test.ts
 */

import { strict as assert } from "node:assert";
import test from "node:test";
import {
  LAB_FLAG_ENV,
  LAB_REVIEWERS_ENV,
  isHomeReviewLabEnabled,
  isLabReviewer,
  labAccessDecision,
  labAccessGranted,
  labReviewers,
} from "./policy";

const REVIEWER = "reviewer@example.com";
const STRANGER = "someone-else@example.com";

/** An env with the lab open and one named reviewer. */
function openEnv(extra: Record<string, string | undefined> = {}) {
  return {
    [LAB_FLAG_ENV]: "true",
    [LAB_REVIEWERS_ENV]: REVIEWER,
    ...extra,
  };
}

// ── Objective 1: default off, in every environment ──────────────────────────

test("the flag is off when it is not set at all", () => {
  assert.equal(isHomeReviewLabEnabled({}), false);
});

test("the flag is off in development and test, not only in production", () => {
  // This is the whole reason the analytics convention was chosen over the
  // planning convention. `src/lib/planning/flags.ts` defaults every flag ON
  // whenever NODE_ENV !== "production"; if this file ever adopts that shape,
  // this test fails and says why.
  for (const nodeEnv of ["development", "test", "production", undefined]) {
    assert.equal(
      isHomeReviewLabEnabled({ NODE_ENV: nodeEnv }),
      false,
      `the lab must be closed by default with NODE_ENV=${String(nodeEnv)}`,
    );
  }
});

test("an unrecognised flag value is closed, not open", () => {
  for (const value of ["", "  ", "yes", "on", "enabled", "TRUEISH", "2", "-1"]) {
    assert.equal(
      isHomeReviewLabEnabled({ [LAB_FLAG_ENV]: value }),
      false,
      `${JSON.stringify(value)} must not open the lab`,
    );
  }
});

test("only an explicit true or 1 opens the lab, and case does not matter", () => {
  for (const value of ["true", "TRUE", " True ", "1", " 1 "]) {
    assert.equal(
      isHomeReviewLabEnabled({ [LAB_FLAG_ENV]: value }),
      true,
      `${JSON.stringify(value)} must open the lab`,
    );
  }
});

test("an explicit false or 0 closes the lab", () => {
  for (const value of ["false", "FALSE", "0"]) {
    assert.equal(isHomeReviewLabEnabled({ [LAB_FLAG_ENV]: value }), false);
  }
});

// ── The allowlist ───────────────────────────────────────────────────────────

test("the reviewer list is parsed from commas, spaces and newlines", () => {
  const parsed = labReviewers({
    [LAB_REVIEWERS_ENV]: " a@example.com, B@Example.com\nc@example.com  d@example.com ",
  });
  for (const email of [
    "a@example.com",
    "b@example.com",
    "c@example.com",
    "d@example.com",
  ]) {
    assert.ok(parsed.has(email), `${email} should be a reviewer`);
  }
});

test("the named reviewer survives an empty or missing list", () => {
  // The founder is the reviewer this lab exists for. An unset env var must not
  // lock him out of the surface he is required to inspect.
  assert.ok(labReviewers({}).size >= 1);
  assert.ok(labReviewers({ [LAB_REVIEWERS_ENV]: "" }).size >= 1);
});

test("an unknown email is not a reviewer, and neither is nothing", () => {
  const env = openEnv();
  assert.equal(isLabReviewer(STRANGER, env), false);
  assert.equal(isLabReviewer(null, env), false);
  assert.equal(isLabReviewer(undefined, env), false);
  assert.equal(isLabReviewer("", env), false);
  assert.equal(isLabReviewer("   ", env), false);
});

test("a reviewer is matched case-insensitively and with surrounding space", () => {
  const env = openEnv();
  assert.equal(isLabReviewer(REVIEWER, env), true);
  assert.equal(isLabReviewer(" Reviewer@Example.COM ", env), true);
});

// ── The decision matrix ─────────────────────────────────────────────────────

test("flag off refuses everyone, including a listed reviewer", () => {
  const env = { [LAB_REVIEWERS_ENV]: REVIEWER };
  const decision = labAccessDecision(
    { flagEnabled: false, seedDataPosture: false, email: REVIEWER },
    env,
  );
  assert.equal(decision, "flag-off");
  assert.equal(
    labAccessGranted(
      { flagEnabled: false, seedDataPosture: false, email: REVIEWER },
      env,
    ),
    false,
  );
});

test("the seed-data posture refuses even a listed reviewer", () => {
  // demo/review run a synthetic identity with Clerk bypassed. There is no real
  // reviewer to check, so the answer is no.
  assert.equal(
    labAccessDecision(
      { flagEnabled: true, seedDataPosture: true, email: REVIEWER },
      openEnv(),
    ),
    "seed-data-posture",
  );
});

test("an unauthenticated visitor is refused with the lab open", () => {
  for (const email of [null, undefined, ""]) {
    assert.equal(
      labAccessDecision(
        { flagEnabled: true, seedDataPosture: false, email },
        openEnv(),
      ),
      "not-authenticated",
    );
  }
});

test("THE NEGATIVE CASE: an authenticated non-reviewer is refused", () => {
  // Objective 2. Being signed in is not access. This decision carries no
  // separate "forbidden" value on purpose — see the next test.
  assert.equal(
    labAccessDecision(
      { flagEnabled: true, seedDataPosture: false, email: STRANGER },
      openEnv(),
    ),
    "not-a-reviewer",
  );
  assert.equal(
    labAccessGranted(
      { flagEnabled: true, seedDataPosture: false, email: STRANGER },
      openEnv(),
    ),
    false,
  );
});

test("exactly one input combination is granted", () => {
  const results: Array<[string, boolean]> = [];
  for (const flagEnabled of [true, false]) {
    for (const seedDataPosture of [true, false]) {
      for (const email of [null, STRANGER, REVIEWER]) {
        results.push([
          `flag=${flagEnabled} seed=${seedDataPosture} email=${String(email)}`,
          labAccessGranted({ flagEnabled, seedDataPosture, email }, openEnv()),
        ]);
      }
    }
  }
  const granted = results.filter(([, ok]) => ok).map(([label]) => label);
  assert.deepEqual(granted, ["flag=true seed=false email=reviewer@example.com"]);
});

test("a listed reviewer, flag on, real posture, is granted", () => {
  assert.equal(
    labAccessDecision(
      { flagEnabled: true, seedDataPosture: false, email: REVIEWER },
      openEnv(),
    ),
    "granted",
  );
});

test("no refusal reason is a 403 in disguise", () => {
  // Every refusal must be indistinguishable from the outside. The decision type
  // exists for tests and for the contract record; if a value ever appears here
  // that reads like an authorisation error, someone is about to render one.
  const refusals = new Set(
    [
      labAccessDecision({ flagEnabled: false, seedDataPosture: false, email: REVIEWER }, openEnv()),
      labAccessDecision({ flagEnabled: true, seedDataPosture: true, email: REVIEWER }, openEnv()),
      labAccessDecision({ flagEnabled: true, seedDataPosture: false, email: null }, openEnv()),
      labAccessDecision({ flagEnabled: true, seedDataPosture: false, email: STRANGER }, openEnv()),
    ].filter((d) => d !== "granted"),
  );
  assert.equal(refusals.size, 4, "each refusal path should be distinguishable in tests");
  for (const refusal of refusals) {
    assert.doesNotMatch(
      refusal,
      /forbidden|denied|unauthori[sz]ed|403/i,
      `refusal reason ${refusal} reads like a 403; the surface answer must stay 404`,
    );
  }
});
