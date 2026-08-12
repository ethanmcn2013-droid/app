/**
 * Home operating-layer evidence harness · the capture key.
 *
 * One capture is one point in a ten-dimensional space, and the key is what
 * makes two captures comparable or provably not:
 *
 *   candidate · commit · fixtureHash · mode · scenario · scope · viewport ·
 *   theme · motion · capturedAt
 *
 * plus `forcedColors` and `browser`, which the brief folds into "variants" and
 * this module keeps as their own axes because a forced-colours failure on
 * Chromium says nothing about WebKit.
 *
 * TWO THINGS COME OUT OF ONE KEY, and the difference between them is the whole
 * design:
 *
 *   `slug`   — a filesystem path. Stable across runs. Two runs of the same
 *              world write to the same file, so a re-run is a diff.
 *   `digest` — a 16-character SHA-256 prefix over the canonical key WITHOUT
 *              `capturedAt`. Two captures with the same digest were taken of
 *              the same thing; if their bytes differ, something moved.
 *
 * `capturedAt` is provenance and is excluded from the digest ON PURPOSE. It is
 * also the one real clock read in this harness. Everything the page renders is
 * frozen to the scenario's own instant; this timestamp records when a machine
 * looked, which is not a fact about the product.
 */

import { createHash } from "node:crypto";

export const CAPTURE_KEY_SCHEMA = "signal-home-lab-capture-key/1";

/** The axes, in the order they are canonicalised. Order is part of the digest. */
export const KEY_AXES = Object.freeze([
  "candidate",
  "commit",
  "fixtureHash",
  "mode",
  "scenario",
  "scope",
  "viewport",
  "theme",
  "motion",
  "forcedColors",
  "browser",
]);

const REQUIRED = Object.freeze([...KEY_AXES, "capturedAt"]);

/** Filesystem-safe, and lossless for the values this harness produces. */
function safe(value) {
  const text = String(value);
  const cleaned = text.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!cleaned) throw new Error(`capture-key: value "${text}" has no filesystem-safe form`);
  return cleaned;
}

export function canonicalKey(key) {
  const missing = REQUIRED.filter(
    (axis) => key?.[axis] === undefined || key?.[axis] === null || key?.[axis] === "",
  );
  if (missing.length) {
    throw new Error(`capture-key: missing required axis/axes ${missing.join(", ")}`);
  }
  const canonical = {};
  for (const axis of KEY_AXES) canonical[axis] = String(key[axis]);
  return canonical;
}

/** 16 hex characters over the canonical key, `capturedAt` deliberately absent. */
export function captureDigest(key) {
  const canonical = canonicalKey(key);
  const payload = JSON.stringify({ schema: CAPTURE_KEY_SCHEMA, key: canonical });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

/**
 * The path this capture writes to, relative to the capture root.
 *
 * `{candidate}/{mode}/{scenario}/{viewport}--{theme}--{motion}--{forcedColors}--{browser}`
 *
 * Neither `commit` nor `fixtureHash` appears in the path. That is the point:
 * re-running at a new commit overwrites the same file, so `git diff` shows what
 * a code change did to the screen. Both still ride inside every receipt and
 * inside the digest, so a comparison across commits can never be mistaken for a
 * comparison within one.
 */
export function captureSlug(key) {
  const canonical = canonicalKey(key);
  return [
    safe(canonical.candidate),
    safe(canonical.mode),
    safe(canonical.scenario),
    [
      safe(canonical.viewport),
      safe(canonical.theme),
      safe(canonical.motion),
      `fc-${safe(canonical.forcedColors)}`,
      safe(canonical.browser),
    ].join("--"),
  ].join("/");
}

/** Every artefact one capture writes, keyed by kind. */
export function captureArtefacts(key) {
  const slug = captureSlug(key);
  return Object.freeze({
    slug,
    screenshot: `${slug}.png`,
    aria: `${slug}.aria.txt`,
    axe: `${slug}.axe.json`,
    receipt: `${slug}.receipt.json`,
  });
}

/**
 * The full record written beside every capture. `outcome` is one of
 * `captured` · `blocked` · `failed`, and a record is never written without one.
 * There is no fourth value meaning "probably fine".
 */
export function buildReceipt({ key, outcome, invariants, axe, notes, timings }) {
  if (!["captured", "blocked", "failed"].includes(outcome)) {
    throw new Error(`capture-key: outcome must be captured|blocked|failed, got ${outcome}`);
  }
  const canonical = canonicalKey(key);
  return {
    schemaVersion: CAPTURE_KEY_SCHEMA,
    digest: captureDigest(key),
    outcome,
    key: { ...canonical, capturedAt: String(key.capturedAt) },
    artefacts: captureArtefacts(key),
    invariants: invariants ?? null,
    axe: axe ?? null,
    timings: timings ?? null,
    notes: notes ?? [],
  };
}

// ── Self-test ───────────────────────────────────────────────────────────────

const SAMPLE = Object.freeze({
  candidate: "editorial-line",
  commit: "c592e83",
  fixtureHash: "0123456789abcdef",
  mode: "my-work",
  scenario: "provider_failure",
  scope: "planning-period",
  viewport: "narrow-landscape",
  theme: "dark",
  motion: "reduce",
  forcedColors: "active",
  browser: "webkit",
  capturedAt: "2026-08-12T22:00:00.000Z",
});

export function selfTest() {
  const failures = [];
  const check = (name, condition, detail) => {
    if (!condition) failures.push(`${name}${detail ? `: ${detail}` : ""}`);
  };

  const digest = captureDigest(SAMPLE);
  check("digest is 16 lowercase hex", /^[0-9a-f]{16}$/.test(digest), digest);

  check(
    "digest ignores capturedAt",
    digest === captureDigest({ ...SAMPLE, capturedAt: "2027-01-01T00:00:00.000Z" }),
  );

  for (const axis of KEY_AXES) {
    const moved = captureDigest({ ...SAMPLE, [axis]: `${SAMPLE[axis]}-x` });
    check(`digest moves when ${axis} moves`, moved !== digest);
  }

  check(
    "slug is stable and shaped",
    captureSlug(SAMPLE) ===
      "editorial-line/my-work/provider_failure/narrow-landscape--dark--reduce--fc-active--webkit",
    captureSlug(SAMPLE),
  );

  check(
    "slug ignores commit and fixtureHash",
    captureSlug({ ...SAMPLE, commit: "deadbee", fixtureHash: "ffffffffffffffff" }) ===
      captureSlug(SAMPLE),
  );

  for (const axis of ["candidate", "mode", "scenario", "viewport", "theme", "motion", "forcedColors", "browser"]) {
    check(
      `slug moves when ${axis} moves`,
      captureSlug({ ...SAMPLE, [axis]: `${SAMPLE[axis]}-x` }) !== captureSlug(SAMPLE),
    );
  }
  // `scope` rides in the digest and the receipt but not the path: two scopes of
  // the same scenario are the same world by construction (scope is derived from
  // the scenario). Asserted so a future change to that has to face this line.
  check(
    "slug deliberately ignores scope",
    captureSlug({ ...SAMPLE, scope: "all" }) === captureSlug(SAMPLE),
  );
  check(
    "digest still separates scope",
    captureDigest({ ...SAMPLE, scope: "all" }) !== captureDigest(SAMPLE),
  );

  for (const axis of REQUIRED) {
    let threw = false;
    try {
      captureDigest({ ...SAMPLE, [axis]: undefined });
    } catch {
      threw = true;
    }
    check(`missing ${axis} throws rather than defaults`, threw);
  }

  let outcomeThrew = false;
  try {
    buildReceipt({ key: SAMPLE, outcome: "probably-fine" });
  } catch {
    outcomeThrew = true;
  }
  check("receipt refuses an unknown outcome", outcomeThrew);

  const receipt = buildReceipt({ key: SAMPLE, outcome: "blocked", notes: ["lab closed"] });
  check("blocked receipt carries its digest", receipt.digest === digest);
  check("blocked receipt has no invariant verdict", receipt.invariants === null);
  check("artefact set is complete", Object.keys(receipt.artefacts).length === 5);

  return failures;
}
