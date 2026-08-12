#!/usr/bin/env node
/**
 * Home operating-layer evidence harness · the capture pipeline.
 *
 * For every (candidate, mode, scenario, viewport, theme, motion, forced-colours,
 * browser) the chosen plan asks for, this writes four artefacts:
 *
 *   <slug>.png            full-page screenshot
 *   <slug>.aria.txt       ARIA snapshot of the settled page
 *   <slug>.axe.json       axe-core result, violations AND incompletes
 *   <slug>.receipt.json   the key, the digest, the seven invariant verdicts
 *
 * plus one `index.json` for the whole run, which records what was planned,
 * what was captured, and — the part that matters — what was NOT, and why.
 *
 * MUST BE RUN UNDER tsx. It imports the fixture universe directly so the lab
 * URLs come from `labUrl()` rather than from a copy of the rules:
 *
 *   node --import tsx scripts/home-layer/capture-home-lab.mjs --plan smoke
 *
 * WHAT THIS REFUSES TO DO. If preflight cannot see the lab, it writes zero
 * screenshots and exits non-zero. It will write `blocked` receipts on request
 * (`--allow-closed`), because a recorded blocked run is evidence and an empty
 * directory is not, but it will never write a screenshot of a 404 page under a
 * key that says it is a screenshot of a candidate.
 *
 * Modelled on scripts/home-layer/capture-current-product.mjs, which already
 * works against the running server: same domcontentloaded-then-try-networkidle
 * navigation, same per-viewport context, same "record the failure rather than
 * throw" loop. What is added is the key, the receipts, the variants and the
 * verdicts.
 */

import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, firefox, webkit } from "@playwright/test";

import {
  buildReceipt,
  captureArtefacts,
  selfTest as captureKeySelfTest,
} from "../../experience/home-layer/capture-key.mjs";
import {
  attachErrorCollectors,
  auditSurface,
  evaluateInvariants,
  freezeClock,
  navigateAndSettle,
  selfTest as harnessSelfTest,
  summariseAxe,
} from "../../experience/home-layer/harness.mjs";
import {
  formatPreflight,
  preflight,
  selfTest as preflightSelfTest,
} from "../../experience/home-layer/preflight.mjs";

const REPO_ROOT = process.cwd();
const CONTRACT_PATH = path.join(REPO_ROOT, "experience/home-layer/capture-contract.json");
const ENGINES = { chromium, firefox, webkit };

const EXIT = { ok: 0, invariantFailure: 1, blocked: 2, usage: 3 };

// ── Arguments ───────────────────────────────────────────────────────────────

const KNOWN_VALUES = new Set([
  "plan", "target", "base", "candidates", "modes", "scenarios",
  "viewports", "variants", "browsers", "out",
]);
const KNOWN_FLAGS = new Set(["allow-closed", "dry-run", "self-test", "help"]);

/**
 * Strict. An unrecognised option is a usage error, never a shrug.
 *
 * `--scenario owner_quiet` (singular, and wrong) parsed loosely would be
 * silently dropped, the run would capture the default thirteen, and the
 * operator would read the result as evidence about one world. A harness whose
 * job is to stop confident wrong answers cannot start by giving one.
 */
function parseArgs(argv) {
  const args = { flags: new Set(), values: {} };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`unexpected argument "${token}"`);
    const name = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      if (!KNOWN_FLAGS.has(name)) {
        throw new Error(
          `unknown flag "--${name}". Flags: ${[...KNOWN_FLAGS].map((flag) => `--${flag}`).join(" ")}`,
        );
      }
      args.flags.add(name);
    } else {
      if (!KNOWN_VALUES.has(name)) {
        throw new Error(
          `unknown option "--${name}". Options: ${[...KNOWN_VALUES].map((value) => `--${value}`).join(" ")}`,
        );
      }
      args.values[name] = next;
      index += 1;
    }
  }
  return args;
}

const list = (value) =>
  value === undefined ? null : value.split(",").map((entry) => entry.trim()).filter(Boolean);

// ── Provenance ──────────────────────────────────────────────────────────────

function git(args, fallback) {
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    return fallback;
  }
}

function provenance(contract) {
  const commit = git(["rev-parse", "HEAD"], "unknown");
  const dirty = git(["status", "--porcelain"], "").length > 0;
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], "unknown");
  const manifestPath = path.join(REPO_ROOT, contract.paths.fixtureManifest);
  const manifestRaw = readFileSync(manifestPath, "utf8").replace(/\r\n?/g, "\n");
  const fixtureHash = createHash("sha256").update(manifestRaw).digest("hex").slice(0, 16);
  const contractRaw = readFileSync(CONTRACT_PATH, "utf8").replace(/\r\n?/g, "\n");
  const contractHash = createHash("sha256").update(contractRaw).digest("hex").slice(0, 16);
  return {
    commit: commit.slice(0, 12),
    fullCommit: commit,
    branch,
    workingTreeDirty: dirty,
    fixtureHash,
    fixtureManifest: contract.paths.fixtureManifest,
    captureContractHash: contractHash,
    // A dirty tree means the commit does not describe what was captured. Said
    // out loud in every receipt rather than left for someone to notice.
    provenanceWarning: dirty
      ? "the working tree had uncommitted changes; `commit` does not fully describe what was rendered"
      : null,
  };
}

// ── Plan resolution ─────────────────────────────────────────────────────────

function resolveViewports(contract, selector) {
  const all = contract.viewports;
  if (Array.isArray(selector)) {
    return selector.map((name) => {
      const found = all.find((viewport) => viewport.name === name);
      if (!found) throw new Error(`unknown viewport "${name}"`);
      return found;
    });
  }
  if (selector === "all") return all;
  if (selector === "required") return all.filter((viewport) => viewport.tier === "required");
  if (selector === "anchor") {
    return contract.anchorViewports.map((name) => all.find((viewport) => viewport.name === name));
  }
  throw new Error(`unknown viewport selector "${selector}"`);
}

function resolvePlan(contract, planName) {
  const plan = contract.plans[planName];
  if (!plan) {
    throw new Error(`unknown plan "${planName}" — have ${Object.keys(contract.plans).join(", ")}`);
  }
  if (plan.composeOf) {
    return plan.composeOf.map((name) => ({ name, ...contract.plans[name] }));
  }
  return [{ name: planName, ...plan }];
}

/**
 * The full job list. Every job carries its own key axes, so nothing downstream
 * has to re-derive which world it is looking at.
 */
function buildJobs({ contract, plans, fixtures, overrides, provenanceInfo }) {
  const jobs = [];
  const skipped = [];

  for (const plan of plans) {
    const candidates = overrides.candidates ?? (plan.candidates === "all" ? [...fixtures.LAB_DIRECTIONS] : plan.candidates);
    const modes = overrides.modes ?? (plan.modes === "all" ? [...fixtures.HOME_MODES] : plan.modes);
    const scenarios = overrides.scenarios ?? (plan.scenarios === "all" ? [...fixtures.SCENARIO_IDS] : plan.scenarios);
    const viewports = resolveViewports(contract, overrides.viewports ?? plan.viewports);
    const variantNames = overrides.variants ?? plan.variants;
    const browserNames = overrides.browsers ?? plan.browsers;

    for (const variantName of variantNames) {
      const variant = contract.variants.find((entry) => entry.name === variantName);
      if (!variant) throw new Error(`unknown variant "${variantName}"`);

      for (const browser of browserNames) {
        if (!ENGINES[browser]) throw new Error(`unknown browser "${browser}"`);
        if (!variant.browsers.includes(browser)) {
          skipped.push({
            reason: "variant-unsupported-on-browser",
            plan: plan.name,
            variant: variantName,
            browser,
            detail:
              variant.unsupportedBrowsers?.[browser] ??
              `variant ${variantName} does not declare ${browser}`,
          });
          continue;
        }

        for (const candidate of candidates) {
          for (const mode of modes) {
            for (const scenarioId of scenarios) {
              const world = fixtures.scenario(scenarioId);
              const url = fixtures.labUrl(candidate, mode, scenarioId);
              const scope =
                world.readScope === "current-project"
                  ? "project"
                  : world.readScope === "planning-period"
                    ? "planning-period"
                    : "all";
              for (const viewport of viewports) {
                jobs.push({
                  plan: plan.name,
                  url,
                  fixedTimeIso: world.asOfIso,
                  mustNeverRender: world.mustNeverRender,
                  viewportSize: { width: viewport.width, height: viewport.height },
                  variant,
                  key: {
                    candidate,
                    commit: provenanceInfo.commit,
                    fixtureHash: provenanceInfo.fixtureHash,
                    mode,
                    scenario: scenarioId,
                    scope,
                    viewport: viewport.name,
                    theme: variant.colorScheme,
                    motion: variant.reducedMotion,
                    forcedColors: variant.forcedColors,
                    browser,
                  },
                });
              }
            }
          }
        }
      }
    }
  }

  // Deduplicate: `council` composes overlapping plans on purpose.
  const seen = new Set();
  const unique = [];
  for (const job of jobs) {
    const signature = JSON.stringify(job.key);
    if (seen.has(signature)) continue;
    seen.add(signature);
    unique.push(job);
  }
  return { jobs: unique, skipped, duplicatesCollapsed: jobs.length - unique.length };
}

/**
 * The self-proof target. Not the lab — the lab does not exist yet and is
 * refused on any review-mode server anyway. These are surfaces that render
 * today, captured through the identical pipeline, so the pipeline itself is
 * proven before there is anything to point it at. Written to its own directory
 * and keyed with candidate `current-product`, so no self-proof capture can ever
 * be mistaken for candidate evidence.
 */
function buildSelfProofJobs({ contract, overrides, provenanceInfo }) {
  const surfaces = [
    ["today", "/app/home"],
    ["briefing", "/app/home/briefing"],
    ["lab-control", "/lab/timeline-a"],
  ];
  const viewports = resolveViewports(contract, overrides.viewports ?? "anchor");
  const variantNames = overrides.variants ?? ["anchor"];
  const browserNames = overrides.browsers ?? ["chromium"];
  const jobs = [];
  for (const variantName of variantNames) {
    const variant = contract.variants.find((entry) => entry.name === variantName);
    if (!variant) throw new Error(`unknown variant "${variantName}"`);
    for (const browser of browserNames) {
      if (!variant.browsers.includes(browser)) continue;
      for (const [mode, route] of surfaces) {
        for (const viewport of viewports) {
          jobs.push({
            plan: "self-proof",
            url: route,
            fixedTimeIso: null,
            mustNeverRender: [],
            viewportSize: { width: viewport.width, height: viewport.height },
            variant,
            key: {
              candidate: "current-product",
              commit: provenanceInfo.commit,
              fixtureHash: provenanceInfo.fixtureHash,
              mode,
              scenario: "as-served",
              scope: "all",
              viewport: viewport.name,
              theme: variant.colorScheme,
              motion: variant.reducedMotion,
              forcedColors: variant.forcedColors,
              browser,
            },
          });
        }
      }
    }
  }
  return { jobs, skipped: [], duplicatesCollapsed: 0 };
}

// ── Capture ─────────────────────────────────────────────────────────────────

async function captureOne({ page, job, contract, baseUrl, outRoot, capturedAt }) {
  const invariantConfig = contract.invariants;
  const artefacts = captureArtefacts({ ...job.key, capturedAt });
  const absolute = (relative) => path.join(outRoot, relative);
  mkdirSync(path.dirname(absolute(artefacts.screenshot)), { recursive: true });

  const errors = attachErrorCollectors(page);
  const notes = [];
  const timings = {};

  const navigation = await navigateAndSettle(page, new URL(job.url, baseUrl).href, invariantConfig);
  timings.navigationMs = navigation.settleMs;
  if (!navigation.reachedNetworkIdle) {
    notes.push("network idle was never reached; recorded, not waited on");
  }
  if (navigation.status !== 200) {
    const drained = errors.drain();
    return {
      receipt: buildReceipt({
        key: { ...job.key, capturedAt },
        outcome: "failed",
        notes: [...notes, `navigation answered ${navigation.status} for ${job.url}`],
        timings,
        invariants: evaluateInvariants({}, drained, invariantConfig),
      }),
      wroteArtefacts: false,
    };
  }

  await page.screenshot({
    path: absolute(artefacts.screenshot),
    fullPage: contract.determinism.screenshot.fullPage,
    animations: contract.determinism.screenshot.animations,
    caret: contract.determinism.screenshot.caret,
    scale: contract.determinism.screenshot.scale,
    mask: (contract.determinism.maskSelectors ?? []).map((selector) => page.locator(selector)),
  });

  const audit = await auditSurface(page, invariantConfig);
  writeFileSync(absolute(artefacts.aria), audit.aria, "utf8");

  let axeSummary;
  try {
    const builder = new AxeBuilder({ page }).withTags(contract.axe.tags);
    if (contract.axe.disableRules?.length) builder.disableRules(contract.axe.disableRules);
    const axeResult = await builder.analyze();
    axeSummary = summariseAxe(axeResult);
    writeFileSync(absolute(artefacts.axe), `${JSON.stringify(axeResult, null, 2)}\n`, "utf8");
  } catch (error) {
    axeSummary = { status: "unknown", reason: String(error?.message ?? error).slice(0, 300), violations: [], incomplete: [] };
    writeFileSync(absolute(artefacts.axe), `${JSON.stringify(axeSummary, null, 2)}\n`, "utf8");
  }

  // The forbidden-string check the scenario carries with it. It belongs in the
  // capture rather than in a spec, because the strings are per-world data and
  // the harness already has the rendered text in front of it.
  const forbidden = [];
  if (job.mustNeverRender?.length) {
    const text = await page.evaluate(() => document.body.innerText);
    for (const phrase of job.mustNeverRender) {
      if (text.toLowerCase().includes(phrase.toLowerCase())) forbidden.push(phrase);
    }
  }
  if (forbidden.length) {
    notes.push(`scenario forbids these strings and the page rendered them: ${forbidden.join(" | ")}`);
  }

  const drained = errors.drain();
  const invariants = evaluateInvariants(audit, drained, invariantConfig);

  const receipt = buildReceipt({
    key: { ...job.key, capturedAt },
    outcome: "captured",
    invariants,
    axe: axeSummary,
    timings,
    notes,
  });
  receipt.navigation = navigation;
  receipt.structure = audit.structure;
  receipt.forbiddenStringsRendered = forbidden;
  writeFileSync(absolute(artefacts.receipt), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

  return { receipt, wroteArtefacts: true };
}

// ── Run ─────────────────────────────────────────────────────────────────────

async function run(args) {
  const contract = JSON.parse(readFileSync(CONTRACT_PATH, "utf8"));
  const target = args.values.target ?? "lab";
  const planName = args.values.plan ?? "smoke";
  const baseUrl = args.values.base ?? process.env[contract.server.envVar] ?? contract.server.defaultBaseUrl;
  const allowClosed = args.flags.has("allow-closed");
  const dryRun = args.flags.has("dry-run");

  const provenanceInfo = provenance(contract);
  const overrides = {
    candidates: list(args.values.candidates),
    modes: list(args.values.modes),
    scenarios: list(args.values.scenarios),
    viewports: args.values.viewports
      ? ["all", "required", "anchor"].includes(args.values.viewports)
        ? args.values.viewports
        : list(args.values.viewports)
      : null,
    variants: list(args.values.variants),
    browsers: list(args.values.browsers),
  };
  for (const key of Object.keys(overrides)) if (overrides[key] === null) delete overrides[key];

  const outRoot = path.join(
    REPO_ROOT,
    args.values.out ??
      (target === "self-proof"
        ? path.join(contract.paths.outputRoot, "self-proof")
        : contract.paths.captureRoot),
  );

  let fixtures = null;
  let planned;
  if (target === "self-proof") {
    planned = buildSelfProofJobs({ contract, overrides, provenanceInfo });
  } else {
    fixtures = await import(
      pathToFileURL(path.join(REPO_ROOT, "src/lib/home-layer/fixtures/index.ts")).href
    );
    planned = buildJobs({
      contract,
      plans: resolvePlan(contract, planName),
      fixtures,
      overrides,
      provenanceInfo,
    });
  }

  console.log(
    `home-lab capture: target=${target} plan=${planName} jobs=${planned.jobs.length} ` +
      `base=${baseUrl} commit=${provenanceInfo.commit}${provenanceInfo.workingTreeDirty ? "+dirty" : ""} ` +
      `fixture=${provenanceInfo.fixtureHash}`,
  );
  for (const skip of planned.skipped) console.log(`  skipped ${skip.variant}/${skip.browser}: ${skip.detail}`);

  if (dryRun) {
    for (const job of planned.jobs.slice(0, 20)) {
      console.log(`  ${captureArtefacts({ ...job.key, capturedAt: "x" }).slug}  ${job.url}`);
    }
    if (planned.jobs.length > 20) console.log(`  … ${planned.jobs.length - 20} more`);
    return EXIT.ok;
  }

  const flight = await preflight({ baseUrl });
  mkdirSync(path.join(REPO_ROOT, contract.paths.outputRoot), { recursive: true });
  writeFileSync(
    path.join(REPO_ROOT, contract.paths.preflightFile),
    `${JSON.stringify(flight, null, 2)}\n`,
    "utf8",
  );
  console.log(formatPreflight(flight));

  // The self-proof target does not need the lab open; it deliberately points at
  // surfaces that serve today. Everything else does.
  const needsLab = target !== "self-proof";
  if (needsLab && !flight.canCapture) {
    const capturedAt = new Date().toISOString();
    if (allowClosed) {
      mkdirSync(outRoot, { recursive: true });
      const receipts = planned.jobs.map((job) =>
        buildReceipt({
          key: { ...job.key, capturedAt },
          outcome: "blocked",
          notes: [flight.reason, ...(flight.causes ?? [])],
        }),
      );
      writeIndex({ contract, outRoot, planName, target, baseUrl, provenanceInfo, flight, planned, receipts, capturedAt });
      console.log(`\n${receipts.length} blocked receipt(s) written. Zero screenshots — nothing was rendered to screenshot.`);
    }
    console.error(
      `\nREFUSED: the lab is ${flight.state}. No capture was taken and none is claimed.` +
        `\nRun with --target self-proof to prove the harness against surfaces that do serve today.`,
    );
    return EXIT.blocked;
  }

  const capturedAt = new Date().toISOString();
  const receipts = [];
  const byContext = new Map();
  for (const job of planned.jobs) {
    const contextKey = [
      job.key.browser,
      job.key.viewport,
      job.key.theme,
      job.key.motion,
      job.key.forcedColors,
    ].join("|");
    if (!byContext.has(contextKey)) byContext.set(contextKey, []);
    byContext.get(contextKey).push(job);
  }

  for (const [contextKey, contextJobs] of byContext) {
    const sample = contextJobs[0];
    const engine = ENGINES[sample.key.browser];
    const browser = await engine.launch();
    try {
      const context = await browser.newContext({
        viewport: sample.viewportSize,
        locale: contract.determinism.locale,
        timezoneId: contract.determinism.timezoneId,
        deviceScaleFactor: contract.determinism.deviceScaleFactor,
        colorScheme: sample.variant.colorScheme,
        reducedMotion: sample.variant.reducedMotion,
        forcedColors: sample.variant.forcedColors,
        storageState: process.env.HOME_LAB_STORAGE_STATE || undefined,
      });
      const page = await context.newPage();

      for (const job of contextJobs) {
        if (contract.determinism.freezeClock && job.fixedTimeIso) {
          await freezeClock(context, job.fixedTimeIso);
        }
        try {
          const { receipt } = await captureOne({ page, job, contract, baseUrl, outRoot, capturedAt });
          receipts.push(receipt);
          const status =
            receipt.outcome !== "captured"
              ? receipt.outcome.toUpperCase()
              : receipt.invariants.ok
                ? "ok"
                : `${receipt.invariants.failed.length}f/${receipt.invariants.unknown.length}u`;
          console.log(`  ${status.padEnd(8)} ${receipt.artefacts.slug}`);
        } catch (error) {
          const receipt = buildReceipt({
            key: { ...job.key, capturedAt },
            outcome: "failed",
            notes: [String(error?.message ?? error).slice(0, 400)],
          });
          receipts.push(receipt);
          console.log(`  FAILED   ${receipt.artefacts.slug}: ${String(error?.message ?? error).slice(0, 120)}`);
        }
      }
      await context.close();
    } finally {
      await browser.close();
    }
    console.log(`  — context ${contextKey} done (${contextJobs.length})`);
  }

  const index = writeIndex({
    contract, outRoot, planName, target, baseUrl, provenanceInfo, flight, planned, receipts, capturedAt,
  });

  console.log(
    `\nplanned ${index.summary.planned} · captured ${index.summary.captured} · ` +
      `blocked ${index.summary.blocked} · failed ${index.summary.failed}` +
      `\ninvariant failures ${index.summary.invariantFailures} · unknowns ${index.summary.invariantUnknowns} · ` +
      `axe violations ${index.summary.axeViolations} · axe unresolved ${index.summary.axeUnresolved}` +
      `\nindex: ${path.relative(REPO_ROOT, path.join(outRoot, "index.json"))}`,
  );

  const clean =
    index.summary.failed === 0 &&
    index.summary.invariantFailures === 0 &&
    index.summary.invariantUnknowns === 0 &&
    index.summary.axeViolations === 0 &&
    index.summary.forbiddenStrings === 0;
  return clean ? EXIT.ok : EXIT.invariantFailure;
}

function writeIndex({ contract, outRoot, planName, target, baseUrl, provenanceInfo, flight, planned, receipts, capturedAt }) {
  const captured = receipts.filter((receipt) => receipt.outcome === "captured");
  const index = {
    schemaVersion: "signal-home-lab-capture-index/1",
    $comment:
      "Planned is what the plan asked for. Captured is what exists. The two are printed side by side on purpose: a run that captured fewer than it planned has a coverage gap, and a gap that is not written down becomes a claim of completeness by the time it reaches a review sheet.",
    target,
    plan: planName,
    baseUrl,
    capturedAt,
    provenance: provenanceInfo,
    captureContract: {
      path: "experience/home-layer/capture-contract.json",
      sha256Prefix: provenanceInfo.captureContractHash,
      determinism: contract.determinism,
      invariants: contract.invariants,
      axe: contract.axe,
    },
    preflight: flight,
    skipped: planned.skipped,
    duplicatesCollapsed: planned.duplicatesCollapsed,
    summary: {
      planned: planned.jobs.length,
      captured: captured.length,
      blocked: receipts.filter((receipt) => receipt.outcome === "blocked").length,
      failed: receipts.filter((receipt) => receipt.outcome === "failed").length,
      notAttempted: planned.jobs.length - receipts.length,
      invariantFailures: captured.reduce((total, receipt) => total + (receipt.invariants?.failed.length ?? 0), 0),
      invariantUnknowns: captured.reduce((total, receipt) => total + (receipt.invariants?.unknown.length ?? 0), 0),
      axeViolations: captured.reduce((total, receipt) => total + (receipt.axe?.violationCount ?? 0), 0),
      axeUnresolved: captured.reduce((total, receipt) => total + (receipt.axe?.incompleteCount ?? 0), 0),
      forbiddenStrings: captured.reduce((total, receipt) => total + (receipt.forbiddenStringsRendered?.length ?? 0), 0),
    },
    captures: receipts.map((receipt) => ({
      digest: receipt.digest,
      outcome: receipt.outcome,
      slug: receipt.artefacts.slug,
      key: receipt.key,
      invariants: receipt.invariants
        ? { ok: receipt.invariants.ok, failed: receipt.invariants.failed, unknown: receipt.invariants.unknown }
        : null,
      axe: receipt.axe
        ? { status: receipt.axe.status, violations: receipt.axe.violationCount ?? 0, incomplete: receipt.axe.incompleteCount ?? 0 }
        : null,
      forbiddenStringsRendered: receipt.forbiddenStringsRendered ?? [],
      notes: receipt.notes,
    })),
  };
  mkdirSync(outRoot, { recursive: true });
  writeFileSync(path.join(outRoot, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  return index;
}

// ── Self-test ───────────────────────────────────────────────────────────────

function runSelfTest() {
  const failures = [
    ...captureKeySelfTest().map((entry) => `capture-key: ${entry}`),
    ...harnessSelfTest().map((entry) => `harness: ${entry}`),
    ...preflightSelfTest().map((entry) => `preflight: ${entry}`),
  ];
  const check = (name, condition, detail) => {
    if (!condition) failures.push(`${name}${detail ? `: ${detail}` : ""}`);
  };

  const contract = JSON.parse(readFileSync(CONTRACT_PATH, "utf8"));

  check("contract schema is the expected one", contract.schemaVersion === "signal-home-lab-capture/1");

  const required = contract.viewports.filter((viewport) => viewport.tier === "required");
  check("eight required viewports are declared", required.length === 8, String(required.length));
  const expectedSizes = [
    "1440x960", "1280x900", "768x1024", "390x844",
    "375x812", "812x375", "320x568", "568x320",
  ].sort();
  const actualSizes = required.map((viewport) => `${viewport.width}x${viewport.height}`).sort();
  check(
    "the eight required viewports are exactly the brief's list",
    JSON.stringify(actualSizes) === JSON.stringify(expectedSizes),
    actualSizes.join(","),
  );

  // The four named breakpoints must be pixel-identical to experience/registry.json,
  // or a Home capture and a registry breakpoint are two different sizes wearing
  // one name.
  const registry = JSON.parse(readFileSync(path.join(REPO_ROOT, "experience/registry.json"), "utf8"));
  for (const [name, size] of Object.entries(registry.breakpoints)) {
    const viewport = contract.viewports.find((entry) => entry.registryBreakpoint === name);
    check(`registry breakpoint ${name} is declared`, Boolean(viewport));
    if (viewport) {
      check(
        `registry breakpoint ${name} matches to the pixel`,
        viewport.width === size.width && viewport.height === size.height,
        `${viewport.width}x${viewport.height} vs ${size.width}x${size.height}`,
      );
    }
  }

  const variantNames = contract.variants.map((variant) => variant.name);
  for (const name of ["anchor", "dark", "reduced-motion", "forced-colors"]) {
    check(`variant ${name} is declared`, variantNames.includes(name));
  }
  const anchor = contract.variants.find((variant) => variant.name === "anchor");
  const reduced = contract.variants.find((variant) => variant.name === "reduced-motion");
  check(
    "the anchor variant does not already suppress motion, or the reduced-motion variant proves nothing",
    anchor.reducedMotion !== reduced.reducedMotion,
  );
  const forced = contract.variants.find((variant) => variant.name === "forced-colors");
  check("forced-colors records why WebKit is absent", Boolean(forced.unsupportedBrowsers?.webkit));
  check("forced-colors does not silently list WebKit", !forced.browsers.includes("webkit"));

  check("the console-error allowlist starts empty", contract.invariants.consoleErrorAllowlist.length === 0);
  check(
    "axe asks for the WCAG AA tags",
    ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"].every((tag) => contract.axe.tags.includes(tag)),
  );
  check("the harness declares that it starts no server", contract.server.startsItsOwnServer === false);

  // Plan resolution must not throw for any declared plan, and must not silently
  // produce an empty job list.
  const stubFixtures = {
    LAB_DIRECTIONS: ["editorial-line", "context-rail", "reading-index", "signal-desk"],
    HOME_MODES: ["today", "inbox", "my-work", "analytics", "briefing"],
    SCENARIO_IDS: ["owner_signature", "owner_quiet", "new_user", "guest_limited", "provider_failure", "scale"],
    scenario: (id) => ({ readScope: "planning-period", asOfIso: "2026-07-16T07:40:00.000Z", mustNeverRender: [], id }),
    labUrl: (direction, mode, id) => `/lab/home-operating-layer?direction=${direction}&mode=${mode}&scenario=${id}`,
  };
  const stubProvenance = { commit: "abc123", fixtureHash: "0123456789abcdef" };
  for (const planName of Object.keys(contract.plans)) {
    let built = null;
    try {
      built = buildJobs({
        contract,
        plans: resolvePlan(contract, planName),
        fixtures: stubFixtures,
        overrides: {},
        provenanceInfo: stubProvenance,
      });
    } catch (error) {
      check(`plan ${planName} resolves`, false, String(error?.message ?? error));
      continue;
    }
    check(`plan ${planName} produces jobs`, built.jobs.length > 0);
    const digests = new Set(built.jobs.map((job) => JSON.stringify(job.key)));
    check(`plan ${planName} produces no duplicate keys`, digests.size === built.jobs.length);
  }

  const council = buildJobs({
    contract,
    plans: resolvePlan(contract, "council"),
    fixtures: stubFixtures,
    overrides: {},
    provenanceInfo: stubProvenance,
  });
  check("council collapses the overlap it creates", council.duplicatesCollapsed > 0, String(council.duplicatesCollapsed));
  check(
    "council skips forced-colors on webkit with a recorded reason",
    council.skipped.some((entry) => entry.browser === "webkit" && entry.variant === "forced-colors") ||
      !contract.plans["cross-browser"].variants.includes("forced-colors"),
  );

  let usageThrew = false;
  try {
    resolveViewports(contract, ["not-a-viewport"]);
  } catch {
    usageThrew = true;
  }
  check("an unknown viewport name throws rather than being dropped", usageThrew);

  return failures;
}

// ── Entry ───────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
let args;
try {
  args = parseArgs(argv);
} catch (error) {
  console.error(`home-lab capture: ${error.message}`);
  process.exit(EXIT.usage);
}

if (args.flags.has("help")) {
  console.log(
    [
      "node --import tsx scripts/home-layer/capture-home-lab.mjs [options]",
      "",
      "  --plan <name>          smoke | full | responsive | variants | cross-browser | council   (default smoke)",
      "  --target <name>        lab | self-proof                                                 (default lab)",
      "  --base <url>           default from HOME_LAB_BASE_URL or the contract",
      "  --candidates a,b       --modes a,b   --scenarios a,b",
      "  --viewports required|anchor|all|a,b  --variants a,b  --browsers a,b",
      "  --out <dir>            override the output root",
      "  --allow-closed         write blocked receipts when the lab is shut (still exits 2)",
      "  --dry-run              print the plan, launch no browser",
      "  --self-test            run the harness's own checks and exit",
      "",
      "  exit 0 clean · 1 invariant/axe/forbidden-string failure · 2 lab not open · 3 usage",
    ].join("\n"),
  );
  process.exit(EXIT.ok);
}

if (args.flags.has("self-test")) {
  const failures = runSelfTest();
  if (failures.length) {
    console.error(`home-lab capture self-test: ${failures.length} failure(s)`);
    for (const failure of failures) console.error(`  x ${failure}`);
    process.exit(EXIT.invariantFailure);
  }
  console.log("home-lab capture self-test: all checks pass");
  process.exit(EXIT.ok);
}

try {
  process.exit(await run(args));
} catch (error) {
  // A plan, viewport, variant or browser this contract does not declare is a
  // usage error with a named cause, not a stack trace and an exit 1 that reads
  // like a test failure.
  console.error(`home-lab capture: ${String(error?.message ?? error)}`);
  process.exit(EXIT.usage);
}
