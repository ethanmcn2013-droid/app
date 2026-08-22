#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const GATE_SCHEMA = "signal-quality-council-gate/1";
const JOURNEY_SCHEMA = "signal-cross-suite-journey/1";
const PRODUCT_RECEIPT_SCHEMA = "signal-quality-council-product-receipt/1";
const JOURNEY_RECEIPT_SCHEMA = "signal-quality-council-journey-receipt/1";
const PREPARATION_SCHEMA = "signal-quality-council-input/1";
const BASELINE_SCHEMA = "signal-ui-council-baseline/1";
const BASELINE_PATH = "experience/council-reviews/baselines/wave-0-b0.json";
const REQUIRED_PRODUCTS = ["notes", "tasks", "timeline"];
const REQUIRED_BASELINE_SURFACES = [
  "tasks-views",
  "task-cards-detail",
  "notes",
  "timeline",
  "landing",
  "about",
  "pricing",
];
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const STABLE_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const TEXT_EXTENSIONS = new Set([
  ".css",
  ".csv",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".log",
  ".md",
  ".mjs",
  ".sql",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);
const SKIP_DIRECTORIES = new Set([".git", ".next", "coverage", "node_modules", "out"]);
const PRODUCT_RECEIPT_KEYS = [
  "assessmentUnits",
  "canonicalPath",
  "contractHashes",
  "criticalExperienceId",
  "decision",
  "declaredProductRawScore",
  "productId",
  "reviewedAt",
  "reviewers",
  "schemaVersion",
  "sourceGitCommitSha",
  "sourceTreeSha256",
];
const JOURNEY_RECEIPT_KEYS = [
  "continuousTrace",
  "contractHashes",
  "decision",
  "dimensions",
  "evidence",
  "journeyId",
  "metrics",
  "rawScore",
  "reviewedAt",
  "reviewers",
  "schemaVersion",
  "sourceGitCommitSha",
  "sourceTreeSha256",
  "steps",
  "viewport",
];
const CONTRACT_HASH_KEYS = [
  "browserContractSha256",
  "crossSuiteJourneySha256",
  "fixtureManifestSha256",
  "journeyReceiptSchemaSha256",
  "playwrightConfigSha256",
  "playwrightSpecSha256",
  "productReceiptSchemaSha256",
  "qualityCouncilGateSha256",
  "registrySha256",
  "validatorSha256",
];
const REVIEWER_KEYS = ["id", "independentReview", "kind", "lens", "name"];
const ARTIFACT_KEYS = ["path", "sha256"];
const ASSESSMENT_KEYS = [
  "decision",
  "dimensions",
  "evidence",
  "metrics",
  "rawScore",
  "state",
  "viewport",
];
const PRODUCT_EVIDENCE_KEYS = [
  "accessibilityReport",
  "approvedBaseline",
  "candidateScreenshot",
  "keyboardTrace",
  "performanceReport",
  "reducedMotionTrace",
  "renderedScreenshot",
  "responsiveTrace",
  "routeAssertions",
  "runtimeLog",
  "sourceReview",
  "visualDiff",
];
const PRODUCT_METRIC_KEYS = [
  "axeCriticalViolations",
  "axeSeriousViolations",
  "baselineStatus",
  "canonicalRouteAndContext",
  "consoleErrors",
  "documentOverflow",
  "failedRequests",
  "highSeverityFindings",
  "keyboardOnly",
  "minimumPrimaryTouchTargetCssPixels",
  "performanceBudget",
  "reducedMotion",
  "releaseBlockingFindings",
  "uncaughtPageErrors",
  "unexpectedHttpErrors",
  "visualDiffPixelRatio",
];
const JOURNEY_EVIDENCE_KEYS = [
  "accessibilityReport",
  "keyboardTrace",
  "networkLog",
  "performanceReport",
  "routeAssertions",
  "runtimeLog",
  "sourceReview",
];
const JOURNEY_METRIC_KEYS = [
  "axeCriticalViolations",
  "axeSeriousViolations",
  "brokenSourceReferences",
  "canonicalRouteAndContext",
  "consoleErrors",
  "contextBreaks",
  "duplicateMutations",
  "failedRequests",
  "highSeverityFindings",
  "keyboardOnly",
  "releaseBlockingFindings",
  "stepsCompleted",
  "uncaughtPageErrors",
  "unexpectedHttpErrors",
];
const DIMENSION_KEYS = [
  "evidenceKeys",
  "id",
  "positiveEvidence",
  "rationale",
  "reviewerId",
  "score",
];
const STEP_KEYS = [
  "action",
  "objectIdentityEvidence",
  "order",
  "path",
  "product",
  "screenshot",
];
const CONTRACT_FILES = {
  qualityCouncilGateSha256: "experience/quality-council-gate.json",
  crossSuiteJourneySha256: "experience/cross-suite-journey.json",
  browserContractSha256: "experience/browser-contract.json",
  registrySha256: "experience/registry.json",
  fixtureManifestSha256: "experience/critical-fixtures.json",
  playwrightConfigSha256: "experience/playwright.config.ts",
  playwrightSpecSha256: "experience/tests/critical-experiences.spec.ts",
  validatorSha256: "scripts/experience/quality-council.mjs",
  productReceiptSchemaSha256:
    "experience/schemas/quality-council-product-receipt.schema.json",
  journeyReceiptSchemaSha256:
    "experience/schemas/quality-council-journey-receipt.schema.json",
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeText(value) {
  return value.replace(/\r\n?/g, "\n");
}

function fileSha256(file) {
  const bytes = readFileSync(file);
  if (TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) {
    return sha256(normalizeText(bytes.toString("utf8")));
  }
  return sha256(bytes);
}

function contentSha256(relativePath, bytes) {
  if (TEXT_EXTENSIONS.has(path.extname(relativePath).toLowerCase())) {
    return sha256(normalizeText(bytes.toString("utf8")));
  }
  return sha256(bytes);
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readJson(file, label, errors) {
  if (!existsSync(file)) {
    errors.push(`${label}: missing file (${forward(path.relative(process.cwd(), file))})`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(`${label}: invalid JSON (${error.message})`);
    return null;
  }
}

function forward(value) {
  return value.split(path.sep).join("/");
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() === value && value.length > 0;
}

function exactKeys(value, keys, label, errors) {
  if (!isObject(value)) {
    errors.push(`${label}: must be an object`);
    return false;
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    errors.push(`${label}: fields must be exactly ${expected.join(", ")}`);
    return false;
  }
  return true;
}

function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function resolveRepoFile(repoRoot, relativePath, label, errors, requiredRoot = null) {
  if (
    !nonEmptyString(relativePath) ||
    path.isAbsolute(relativePath) ||
    relativePath.includes("\\") ||
    relativePath.split("/").includes("..")
  ) {
    errors.push(`${label}: must be a forward-slash path inside the repository`);
    return null;
  }
  const absolute = path.resolve(repoRoot, ...relativePath.split("/"));
  const repoPrefix = `${path.resolve(repoRoot)}${path.sep}`;
  if (!absolute.startsWith(repoPrefix)) {
    errors.push(`${label}: resolves outside the repository`);
    return null;
  }
  if (requiredRoot) {
    const allowedPrefix = `${path.resolve(repoRoot, ...requiredRoot.split("/"))}${path.sep}`;
    if (!absolute.startsWith(allowedPrefix)) {
      errors.push(`${label}: must resolve under ${requiredRoot}/`);
      return null;
    }
  }
  if (!existsSync(absolute) || !lstatSync(absolute).isFile()) {
    errors.push(`${label}: evidence file does not exist (${relativePath})`);
    return null;
  }
  if (lstatSync(absolute).isSymbolicLink()) {
    errors.push(`${label}: symbolic-link evidence is not allowed`);
    return null;
  }
  return absolute;
}

function walkFiles(directory) {
  if (!existsSync(directory)) return [];
  const stat = lstatSync(directory);
  if (stat.isSymbolicLink()) {
    throw new Error(`source integrity input cannot be a symbolic link (${directory})`);
  }
  if (stat.isFile()) return [directory];
  const files = [];
  for (const name of readdirSync(directory).sort()) {
    if (SKIP_DIRECTORIES.has(name)) continue;
    const absolute = path.join(directory, name);
    const child = lstatSync(absolute);
    if (child.isSymbolicLink()) {
      throw new Error(`source integrity input contains a symbolic link (${absolute})`);
    }
    if (child.isDirectory()) files.push(...walkFiles(absolute));
    if (child.isFile()) files.push(absolute);
  }
  return files;
}

function computeSourceTree(repoRoot, inputs) {
  const records = [];
  const seen = new Set();
  for (const input of inputs) {
    if (!nonEmptyString(input) || path.isAbsolute(input) || input.includes("\\")) {
      throw new Error(`invalid source integrity input ${String(input)}`);
    }
    const absolute = path.resolve(repoRoot, ...input.split("/"));
    const repoPrefix = `${path.resolve(repoRoot)}${path.sep}`;
    if (!absolute.startsWith(repoPrefix) || !existsSync(absolute)) {
      throw new Error(`missing or unsafe source integrity input ${input}`);
    }
    for (const file of walkFiles(absolute)) {
      const relative = forward(path.relative(repoRoot, file));
      if (seen.has(relative)) continue;
      seen.add(relative);
      records.push({ path: relative, sha256: fileSha256(file) });
    }
  }
  records.sort((left, right) => left.path.localeCompare(right.path));
  return {
    sha256: sha256(JSON.stringify(records)),
    fileCount: records.length,
    files: records,
  };
}

function computeGitSourceTree(repoRoot, commit, inputs) {
  const output = execFileSync(
    "git",
    ["ls-tree", "-r", "--name-only", commit, "--", ...inputs],
    { cwd: repoRoot, encoding: "utf8" },
  );
  const files = output
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .sort();
  const records = files.map((relativePath) => {
    const bytes = execFileSync("git", ["show", `${commit}:${relativePath}`], {
      cwd: repoRoot,
      encoding: "buffer",
      maxBuffer: 100 * 1024 * 1024,
    });
    return { path: relativePath, sha256: contentSha256(relativePath, bytes) };
  });
  return {
    sha256: sha256(JSON.stringify(records)),
    fileCount: records.length,
  };
}

function currentContractHashes(repoRoot) {
  const result = {};
  for (const [field, relativePath] of Object.entries(CONTRACT_FILES)) {
    const absolute = path.join(repoRoot, ...relativePath.split("/"));
    if (!existsSync(absolute)) throw new Error(`missing contract file ${relativePath}`);
    result[field] = fileSha256(absolute);
  }
  return result;
}

function currentGitCommit(repoRoot) {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
}

function validateGitCommit(repoRoot, commit, label, errors, skipGit) {
  if (!COMMIT_PATTERN.test(commit ?? "")) {
    errors.push(`${label}: sourceGitCommitSha must be a 40-character lowercase commit SHA`);
    return;
  }
  if (skipGit) return;
  const checks = [
    ["cat-file", "-e", `${commit}^{commit}`],
    ["merge-base", "--is-ancestor", commit, "HEAD"],
  ];
  for (const argv of checks) {
    const ran = spawnSync("git", argv, { cwd: repoRoot, encoding: "utf8" });
    if (ran.status === 0) continue;
    const detail = JSON.stringify({
      argv,
      status: ran.status,
      err: String(ran.stderr || "").slice(0, 200),
      out: String(ran.stdout || "").slice(0, 80),
    });
    errors.push(`${label}: sourceGitCommitSha must be a commit reachable from HEAD (git ${detail})`);
    return;
  }
}

function validateContract(repoRoot, errors) {
  const gate = readJson(
    path.join(repoRoot, "experience", "quality-council-gate.json"),
    "quality council gate",
    errors,
  );
  const journey = readJson(
    path.join(repoRoot, "experience", "cross-suite-journey.json"),
    "cross-suite journey",
    errors,
  );
  const registry = readJson(
    path.join(repoRoot, "experience", "registry.json"),
    "experience registry",
    errors,
  );
  const fixtures = readJson(
    path.join(repoRoot, "experience", "critical-fixtures.json"),
    "critical fixture manifest",
    errors,
  );
  const browser = readJson(
    path.join(repoRoot, "experience", "browser-contract.json"),
    "browser contract",
    errors,
  );
  if (!gate || !journey || !registry || !fixtures || !browser) {
    return null;
  }

  if (gate.schemaVersion !== GATE_SCHEMA) {
    errors.push(`quality council gate: schemaVersion must be ${GATE_SCHEMA}`);
  }
  if (journey.schemaVersion !== JOURNEY_SCHEMA) {
    errors.push(`cross-suite journey: schemaVersion must be ${JOURNEY_SCHEMA}`);
  }
  const products = gate.scope?.products;
  if (
    !Array.isArray(products) ||
    JSON.stringify(products.map((product) => product.id)) !== JSON.stringify(REQUIRED_PRODUCTS)
  ) {
    errors.push(`quality council gate: products must be exactly ${REQUIRED_PRODUCTS.join(", ")}`);
  }
  const viewports = gate.scope?.requiredViewports;
  const browserViewports = browser.projects?.map((project) => project.name);
  if (
    !Array.isArray(viewports) ||
    viewports.length === 0 ||
    JSON.stringify(viewports) !== JSON.stringify(browserViewports)
  ) {
    errors.push("quality council gate: required viewports must exactly match browser-contract.json");
  }
  if (
    gate.scoring?.dimensionScale?.minimum !== 0 ||
    gate.scoring?.dimensionScale?.maximum !== 4 ||
    gate.scoring?.dimensionScale?.integerOnly !== true ||
    gate.scoring?.dimensionCount !== 13 ||
    gate.scoring?.maximumRawScore !== 52 ||
    gate.scoring?.minimumPassingRawScore !== 50 ||
    gate.scoring?.minimumDimensionScore !== 3 ||
    gate.scoring?.maximumDimensionsAtThree !== 2 ||
    gate.scoring?.missingEvidenceBehavior !== "fail" ||
    gate.scoring?.averagingAcrossUnits !== false
  ) {
    errors.push("quality council gate: scoring policy must preserve the fail-closed 50/52 contract");
  }
  const dimensions = gate.dimensions?.map((dimension) => dimension.id);
  if (
    !Array.isArray(dimensions) ||
    dimensions.length !== 13 ||
    new Set(dimensions).size !== 13
  ) {
    errors.push("quality council gate: exactly 13 unique dimensions are required");
  }
  const receiptSchemas = gate.evidenceContract?.receiptSchemas;
  if (
    receiptSchemas?.product !==
      "experience/schemas/quality-council-product-receipt.schema.json" ||
    receiptSchemas?.crossSuiteJourney !==
      "experience/schemas/quality-council-journey-receipt.schema.json"
  ) {
    errors.push("quality council gate: receipt schema paths are missing or changed");
  }
  if (gate.evidenceContract?.checkedInEvidenceRoot !== "experience/council-evidence") {
    errors.push("quality council gate: checked-in evidence root must be experience/council-evidence");
  }
  const sourceInputs = gate.evidenceContract?.sourceIntegrity?.inputs;
  if (!Array.isArray(sourceInputs) || sourceInputs.length === 0) {
    errors.push("quality council gate: source integrity inputs are required");
  }

  const registryById = new Map(
    (registry.experiences ?? []).map((experience) => [experience.id, experience]),
  );
  const fixtureIds = new Set((fixtures.experiences ?? []).map((fixture) => fixture.id));
  const stateMap = new Map();
  for (const product of products ?? []) {
    const label = `quality council gate product ${product?.id ?? "<missing>"}`;
    const registryEntry = registryById.get(product?.criticalExperienceId);
    if (!registryEntry) {
      errors.push(`${label}: criticalExperienceId is absent from experience/registry.json`);
      continue;
    }
    if (registryEntry.route !== product.canonicalPath) {
      errors.push(`${label}: canonicalPath does not match the registered route`);
    }
    const expectedStateSource =
      `experience/registry.json#${product.criticalExperienceId}.requiredStates`;
    if (product.requiredStateSource !== expectedStateSource) {
      errors.push(`${label}: requiredStateSource must be ${expectedStateSource}`);
    }
    if (
      !Array.isArray(registryEntry.requiredStates) ||
      registryEntry.requiredStates.length === 0 ||
      new Set(registryEntry.requiredStates).size !== registryEntry.requiredStates.length
    ) {
      errors.push(`${label}: registered required states must be non-empty and unique`);
    } else if (
      !Array.isArray(product.requiredStates) ||
      JSON.stringify(product.requiredStates) !== JSON.stringify(registryEntry.requiredStates)
    ) {
      errors.push(`${label}: requiredStates must exactly lock the registered required states`);
    } else {
      stateMap.set(product.id, product.requiredStates);
    }
    if (!fixtureIds.has(product.criticalExperienceId)) {
      errors.push(`${label}: critical fixture is missing`);
    }
    const expectedReceipt = `experience/council-reviews/products/${product.id}.json`;
    if (product.receiptPath !== expectedReceipt) {
      errors.push(`${label}: receiptPath must be ${expectedReceipt}`);
    }
  }

  if (
    journey.id !== "signal-studio.note-to-home" ||
    JSON.stringify(journey.requiredViewports) !== JSON.stringify(viewports)
  ) {
    errors.push("cross-suite journey: id and required viewports must match the suite gate");
  }
  if (!Array.isArray(journey.steps) || journey.steps.length === 0) {
    errors.push("cross-suite journey: ordered steps are required");
  }
  const expectedJourneyReceipts = (viewports ?? []).map(
    (viewport) =>
      `experience/council-reviews/journeys/${journey.id}.${viewport}.json`,
  );
  if (
    !Array.isArray(journey.evidenceReceipts) ||
    JSON.stringify(journey.evidenceReceipts) !== JSON.stringify(expectedJourneyReceipts)
  ) {
    errors.push("cross-suite journey: evidenceReceipts must name one exact receipt per viewport");
  }

  return {
    gate,
    journey,
    registry,
    fixtures,
    browser,
    dimensions,
    products,
    sourceInputs,
    stateMap,
    viewports,
  };
}

function validateArtifact(
  repoRoot,
  artifact,
  label,
  errors,
  evidenceRoot,
  hashCache,
) {
  if (!exactKeys(artifact, ARTIFACT_KEYS, label, errors)) return;
  if (!HASH_PATTERN.test(artifact.sha256 ?? "")) {
    errors.push(`${label}: sha256 must be one full lowercase SHA-256 digest`);
  }
  const file = resolveRepoFile(repoRoot, artifact.path, `${label}.path`, errors, evidenceRoot);
  if (!file) return;
  const actual = hashCache.get(file) ?? fileSha256(file);
  hashCache.set(file, actual);
  if (artifact.sha256 !== actual) {
    errors.push(`${label}: sha256 does not match current evidence bytes (${artifact.path})`);
  }
}

function validateReviewers(
  repoRoot,
  reviewers,
  label,
  errors,
  evidenceRoot,
  hashCache,
) {
  if (!Array.isArray(reviewers) || reviewers.length < 3) {
    errors.push(`${label}: at least three independent council reviewers are required`);
    return new Set();
  }
  const ids = new Set();
  const lenses = new Set();
  const reviewPaths = new Set();
  for (const [index, reviewer] of reviewers.entries()) {
    const reviewerLabel = `${label}[${index}]`;
    if (!exactKeys(reviewer, REVIEWER_KEYS, reviewerLabel, errors)) continue;
    if (!STABLE_ID_PATTERN.test(reviewer.id ?? "") || ids.has(reviewer.id)) {
      errors.push(`${reviewerLabel}: id must be unique and stable`);
    }
    ids.add(reviewer.id);
    if (!nonEmptyString(reviewer.name) || !nonEmptyString(reviewer.lens)) {
      errors.push(`${reviewerLabel}: name and lens must be non-empty`);
    }
    if (lenses.has(reviewer.lens)) {
      errors.push(`${reviewerLabel}: lens must be distinct from every other council reviewer`);
    }
    lenses.add(reviewer.lens);
    if (!["human", "agent"].includes(reviewer.kind)) {
      errors.push(`${reviewerLabel}: kind must be human or agent; automation cannot award scores`);
    }
    validateArtifact(
      repoRoot,
      reviewer.independentReview,
      `${reviewerLabel}.independentReview`,
      errors,
      evidenceRoot,
      hashCache,
    );
    if (reviewPaths.has(reviewer.independentReview?.path)) {
      errors.push(`${reviewerLabel}: independentReview must be a distinct evidence file`);
    }
    reviewPaths.add(reviewer.independentReview?.path);
  }
  return ids;
}

function validateContractHashes(actual, expected, label, errors) {
  if (!exactKeys(actual, CONTRACT_HASH_KEYS, label, errors)) return;
  for (const key of CONTRACT_HASH_KEYS) {
    if (!HASH_PATTERN.test(actual[key] ?? "") || actual[key] !== expected[key]) {
      errors.push(`${label}.${key}: must match the current contract file`);
    }
  }
}

function validateDimensions({
  dimensions,
  dimensionIds,
  evidenceKeys,
  reviewerIds,
  rawScore,
  label,
  errors,
  scoring,
}) {
  if (!Array.isArray(dimensions) || dimensions.length !== dimensionIds.length) {
    errors.push(`${label}: must contain exactly ${dimensionIds.length} dimensions`);
    return null;
  }
  const actualIds = dimensions.map((dimension) => dimension?.id);
  if (JSON.stringify(actualIds) !== JSON.stringify(dimensionIds)) {
    errors.push(`${label}: dimensions must appear once in gate order`);
  }
  let computed = 0;
  let scoresAtThree = 0;
  for (const [index, dimension] of dimensions.entries()) {
    const dimensionLabel = `${label}[${index}]`;
    if (!exactKeys(dimension, DIMENSION_KEYS, dimensionLabel, errors)) continue;
    if (
      !Number.isInteger(dimension.score) ||
      dimension.score < scoring.minimumDimensionScore ||
      dimension.score > scoring.dimensionScale.maximum
    ) {
      errors.push(`${dimensionLabel}: score must be an integer from 3 to 4`);
    } else {
      computed += dimension.score;
      if (dimension.score === 3) scoresAtThree += 1;
    }
    if (!reviewerIds.has(dimension.reviewerId)) {
      errors.push(`${dimensionLabel}: reviewerId must name a declared council reviewer`);
    }
    if (!nonEmptyString(dimension.rationale) || dimension.rationale.length < 20) {
      errors.push(`${dimensionLabel}: rationale must contain at least 20 characters`);
    }
    if (
      !nonEmptyString(dimension.positiveEvidence) ||
      dimension.positiveEvidence.length < 20
    ) {
      errors.push(`${dimensionLabel}: positiveEvidence must contain at least 20 characters`);
    }
    if (
      !Array.isArray(dimension.evidenceKeys) ||
      dimension.evidenceKeys.length === 0 ||
      new Set(dimension.evidenceKeys).size !== dimension.evidenceKeys.length
    ) {
      errors.push(`${dimensionLabel}: evidenceKeys must be a non-empty unique array`);
    } else {
      for (const key of dimension.evidenceKeys) {
        if (!evidenceKeys.has(key)) {
          errors.push(`${dimensionLabel}: unknown evidence key ${String(key)}`);
        }
      }
    }
  }
  if (scoresAtThree > scoring.maximumDimensionsAtThree) {
    errors.push(`${label}: at most ${scoring.maximumDimensionsAtThree} dimensions may score 3`);
  }
  if (!Number.isInteger(rawScore) || rawScore !== computed) {
    errors.push(`${label}: rawScore must exactly equal the integer dimension sum (${computed})`);
  }
  if (computed < scoring.minimumPassingRawScore) {
    errors.push(
      `${label}: computed raw score ${computed}/52 is below ${scoring.minimumPassingRawScore}/52`,
    );
  }
  return computed;
}

function validateProductMetrics(metrics, label, errors, maximumDiffRatio) {
  if (!exactKeys(metrics, PRODUCT_METRIC_KEYS, label, errors)) return;
  const zeroFields = [
    "axeCriticalViolations",
    "axeSeriousViolations",
    "consoleErrors",
    "failedRequests",
    "highSeverityFindings",
    "releaseBlockingFindings",
    "uncaughtPageErrors",
    "unexpectedHttpErrors",
  ];
  for (const field of zeroFields) {
    if (metrics[field] !== 0) errors.push(`${label}.${field}: must be zero`);
  }
  if (metrics.baselineStatus !== "approved") {
    errors.push(`${label}.baselineStatus: must be approved`);
  }
  if (
    typeof metrics.visualDiffPixelRatio !== "number" ||
    metrics.visualDiffPixelRatio < 0 ||
    metrics.visualDiffPixelRatio > maximumDiffRatio
  ) {
    errors.push(
      `${label}.visualDiffPixelRatio: must be between 0 and ${maximumDiffRatio}`,
    );
  }
  if (metrics.documentOverflow !== false) {
    errors.push(`${label}.documentOverflow: must be false`);
  }
  for (const field of [
    "canonicalRouteAndContext",
    "keyboardOnly",
    "performanceBudget",
    "reducedMotion",
  ]) {
    if (metrics[field] !== "pass") errors.push(`${label}.${field}: must be pass`);
  }
  if (
    typeof metrics.minimumPrimaryTouchTargetCssPixels !== "number" ||
    metrics.minimumPrimaryTouchTargetCssPixels < 44
  ) {
    errors.push(`${label}.minimumPrimaryTouchTargetCssPixels: must be at least 44`);
  }
}

function validateJourneyMetrics(metrics, label, errors, stepCount) {
  if (!exactKeys(metrics, JOURNEY_METRIC_KEYS, label, errors)) return;
  if (metrics.stepsCompleted !== stepCount) {
    errors.push(`${label}.stepsCompleted: must equal ${stepCount}`);
  }
  for (const field of [
    "axeCriticalViolations",
    "axeSeriousViolations",
    "brokenSourceReferences",
    "consoleErrors",
    "contextBreaks",
    "duplicateMutations",
    "failedRequests",
    "highSeverityFindings",
    "releaseBlockingFindings",
    "uncaughtPageErrors",
    "unexpectedHttpErrors",
  ]) {
    if (metrics[field] !== 0) errors.push(`${label}.${field}: must be zero`);
  }
  for (const field of ["canonicalRouteAndContext", "keyboardOnly"]) {
    if (metrics[field] !== "pass") errors.push(`${label}.${field}: must be pass`);
  }
}

function validateReceiptEnvelope({
  repoRoot,
  receipt,
  label,
  contractHashes,
  sourceTree,
  errors,
  skipGit,
}) {
  if (!isIsoDate(receipt.reviewedAt) || receipt.reviewedAt > new Date().toISOString().slice(0, 10)) {
    errors.push(`${label}: reviewedAt must be a current or past YYYY-MM-DD`);
  }
  validateGitCommit(repoRoot, receipt.sourceGitCommitSha, label, errors, skipGit);
  if (receipt.sourceTreeSha256 !== sourceTree.sha256) {
    errors.push(`${label}: sourceTreeSha256 is stale for the current product/backend source tree`);
  }
  validateContractHashes(receipt.contractHashes, contractHashes, `${label}.contractHashes`, errors);
}

function validateProductReceipt({
  repoRoot,
  product,
  states,
  viewports,
  dimensionIds,
  contractHashes,
  sourceTree,
  gate,
  errors,
  skipGit,
  hashCache,
}) {
  const label = `product receipt ${product.id}`;
  const receiptFile = resolveRepoFile(repoRoot, product.receiptPath, label, errors);
  if (!receiptFile) return null;
  const receipt = readJson(receiptFile, label, errors);
  if (!receipt || !exactKeys(receipt, PRODUCT_RECEIPT_KEYS, label, errors)) return null;
  if (receipt.schemaVersion !== PRODUCT_RECEIPT_SCHEMA) {
    errors.push(`${label}: schemaVersion must be ${PRODUCT_RECEIPT_SCHEMA}`);
  }
  if (
    receipt.productId !== product.id ||
    receipt.criticalExperienceId !== product.criticalExperienceId ||
    receipt.canonicalPath !== product.canonicalPath
  ) {
    errors.push(`${label}: product identity must exactly match the gate`);
  }
  if (receipt.decision !== "pass") errors.push(`${label}: decision must be pass`);
  validateReceiptEnvelope({
    repoRoot,
    receipt,
    label,
    contractHashes,
    sourceTree,
    errors,
    skipGit,
  });
  const evidenceRoot = gate.evidenceContract.checkedInEvidenceRoot;
  const reviewerIds = validateReviewers(
    repoRoot,
    receipt.reviewers,
    `${label}.reviewers`,
    errors,
    evidenceRoot,
    hashCache,
  );
  const expectedUnits = states
    .flatMap((state) => viewports.map((viewport) => `${state}\u0000${viewport}`))
    .sort();
  if (!Array.isArray(receipt.assessmentUnits)) {
    errors.push(`${label}: assessmentUnits must be an array`);
    return null;
  }
  const actualUnits = receipt.assessmentUnits
    .map((unit) => `${unit?.state}\u0000${unit?.viewport}`)
    .sort();
  if (JSON.stringify(actualUnits) !== JSON.stringify(expectedUnits)) {
    errors.push(`${label}: assessmentUnits must exactly cover every required state x viewport`);
  }
  const unitScores = [];
  const contributingReviewers = new Set();
  const candidatePaths = new Set();
  for (const [index, unit] of receipt.assessmentUnits.entries()) {
    const unitLabel = `${label}.assessmentUnits[${index}]`;
    if (!exactKeys(unit, ASSESSMENT_KEYS, unitLabel, errors)) continue;
    if (!states.includes(unit.state) || !viewports.includes(unit.viewport)) {
      errors.push(`${unitLabel}: state and viewport must be required by the gate`);
    }
    if (unit.decision !== "pass") errors.push(`${unitLabel}: decision must be pass`);
    if (exactKeys(unit.evidence, PRODUCT_EVIDENCE_KEYS, `${unitLabel}.evidence`, errors)) {
      for (const key of PRODUCT_EVIDENCE_KEYS) {
        validateArtifact(
          repoRoot,
          unit.evidence[key],
          `${unitLabel}.evidence.${key}`,
          errors,
          evidenceRoot,
          hashCache,
        );
      }
      for (const screenshotKey of [
        "approvedBaseline",
        "candidateScreenshot",
        "renderedScreenshot",
        "visualDiff",
      ]) {
        if (!unit.evidence[screenshotKey]?.path?.toLowerCase().endsWith(".png")) {
          errors.push(`${unitLabel}.evidence.${screenshotKey}: must reference a PNG`);
        }
      }
      const visualPaths = [
        unit.evidence.approvedBaseline?.path,
        unit.evidence.candidateScreenshot?.path,
        unit.evidence.visualDiff?.path,
      ];
      if (new Set(visualPaths).size !== visualPaths.length) {
        errors.push(`${unitLabel}: baseline, candidate, and diff must be distinct files`);
      }
      if (candidatePaths.has(unit.evidence.candidateScreenshot?.path)) {
        errors.push(`${unitLabel}: candidateScreenshot must be unique to this state and viewport`);
      }
      candidatePaths.add(unit.evidence.candidateScreenshot?.path);
    }
    validateProductMetrics(
      unit.metrics,
      `${unitLabel}.metrics`,
      errors,
      gate.evidenceContract.visualDiff.maximumDiffPixelRatio,
    );
    const score = validateDimensions({
      dimensions: unit.dimensions,
      dimensionIds,
      evidenceKeys: new Set(PRODUCT_EVIDENCE_KEYS),
      reviewerIds,
      rawScore: unit.rawScore,
      label: `${unitLabel}.dimensions`,
      errors,
      scoring: gate.scoring,
    });
    for (const dimension of unit.dimensions ?? []) {
      if (reviewerIds.has(dimension?.reviewerId)) {
        contributingReviewers.add(dimension.reviewerId);
      }
    }
    if (score !== null) unitScores.push(score);
  }
  for (const reviewerId of reviewerIds) {
    if (!contributingReviewers.has(reviewerId)) {
      errors.push(`${label}: reviewer ${reviewerId} does not independently own any dimension score`);
    }
  }
  const productScore = unitScores.length ? Math.min(...unitScores) : null;
  if (
    !Number.isInteger(receipt.declaredProductRawScore) ||
    receipt.declaredProductRawScore !== productScore
  ) {
    errors.push(`${label}: declaredProductRawScore must equal the minimum assessment score`);
  }
  return {
    id: product.id,
    rawScore: productScore,
    sourceGitCommitSha: receipt.sourceGitCommitSha,
    unitCount: receipt.assessmentUnits.length,
  };
}

function validateJourneyReceipt({
  repoRoot,
  receiptPath,
  expectedViewport,
  dimensionIds,
  contractHashes,
  sourceTree,
  gate,
  journey,
  errors,
  skipGit,
  hashCache,
}) {
  const label = `journey receipt ${expectedViewport}`;
  const receiptFile = resolveRepoFile(repoRoot, receiptPath, label, errors);
  if (!receiptFile) return null;
  const receipt = readJson(receiptFile, label, errors);
  if (!receipt || !exactKeys(receipt, JOURNEY_RECEIPT_KEYS, label, errors)) return null;
  if (receipt.schemaVersion !== JOURNEY_RECEIPT_SCHEMA) {
    errors.push(`${label}: schemaVersion must be ${JOURNEY_RECEIPT_SCHEMA}`);
  }
  if (receipt.journeyId !== journey.id || receipt.viewport !== expectedViewport) {
    errors.push(`${label}: journeyId and viewport must exactly match the journey contract`);
  }
  if (receipt.decision !== "pass") errors.push(`${label}: decision must be pass`);
  validateReceiptEnvelope({
    repoRoot,
    receipt,
    label,
    contractHashes,
    sourceTree,
    errors,
    skipGit,
  });
  const evidenceRoot = gate.evidenceContract.checkedInEvidenceRoot;
  const reviewerIds = validateReviewers(
    repoRoot,
    receipt.reviewers,
    `${label}.reviewers`,
    errors,
    evidenceRoot,
    hashCache,
  );
  validateArtifact(
    repoRoot,
    receipt.continuousTrace,
    `${label}.continuousTrace`,
    errors,
    evidenceRoot,
    hashCache,
  );
  if (!Array.isArray(receipt.steps) || receipt.steps.length !== journey.steps.length) {
    errors.push(`${label}: steps must exactly cover the journey contract`);
  } else {
    const screenshotPaths = new Set();
    for (const [index, step] of receipt.steps.entries()) {
      const stepLabel = `${label}.steps[${index}]`;
      if (!exactKeys(step, STEP_KEYS, stepLabel, errors)) continue;
      const expected = journey.steps[index];
      for (const field of ["order", "product", "path", "action"]) {
        if (step[field] !== expected[field]) {
          errors.push(`${stepLabel}.${field}: must match the journey contract`);
        }
      }
      validateArtifact(
        repoRoot,
        step.screenshot,
        `${stepLabel}.screenshot`,
        errors,
        evidenceRoot,
        hashCache,
      );
      if (!step.screenshot?.path?.toLowerCase().endsWith(".png")) {
        errors.push(`${stepLabel}.screenshot: must reference a PNG`);
      }
      if (screenshotPaths.has(step.screenshot?.path)) {
        errors.push(`${stepLabel}.screenshot: each journey step requires a distinct screenshot`);
      }
      screenshotPaths.add(step.screenshot?.path);
      validateArtifact(
        repoRoot,
        step.objectIdentityEvidence,
        `${stepLabel}.objectIdentityEvidence`,
        errors,
        evidenceRoot,
        hashCache,
      );
    }
  }
  if (exactKeys(receipt.evidence, JOURNEY_EVIDENCE_KEYS, `${label}.evidence`, errors)) {
    for (const key of JOURNEY_EVIDENCE_KEYS) {
      validateArtifact(
        repoRoot,
        receipt.evidence[key],
        `${label}.evidence.${key}`,
        errors,
        evidenceRoot,
        hashCache,
      );
    }
  }
  validateJourneyMetrics(receipt.metrics, `${label}.metrics`, errors, journey.steps.length);
  const evidenceKeys = new Set(["continuousTrace", ...JOURNEY_EVIDENCE_KEYS]);
  for (const step of journey.steps) {
    evidenceKeys.add(`step-${step.order}-screenshot`);
    evidenceKeys.add(`step-${step.order}-object-identity`);
  }
  const score = validateDimensions({
    dimensions: receipt.dimensions,
    dimensionIds,
    evidenceKeys,
    reviewerIds,
    rawScore: receipt.rawScore,
    label: `${label}.dimensions`,
    errors,
    scoring: gate.scoring,
  });
  const contributingReviewers = new Set(
    (receipt.dimensions ?? [])
      .map((dimension) => dimension?.reviewerId)
      .filter((reviewerId) => reviewerIds.has(reviewerId)),
  );
  for (const reviewerId of reviewerIds) {
    if (!contributingReviewers.has(reviewerId)) {
      errors.push(`${label}: reviewer ${reviewerId} does not independently own any dimension score`);
    }
  }
  return {
    viewport: expectedViewport,
    rawScore: score,
    sourceGitCommitSha: receipt.sourceGitCommitSha,
  };
}

function validateBaselineArtifact(repoRoot, artifact, label, errors) {
  if (!exactKeys(artifact, ARTIFACT_KEYS, label, errors)) return;
  if (!HASH_PATTERN.test(artifact.sha256)) {
    errors.push(`${label}.sha256 must be one full lowercase SHA-256 digest`);
  }
  const file = resolveRepoFile(
    repoRoot,
    artifact.path,
    `${label}.path`,
    errors,
    "experience/council-evidence/wave-0-b0",
  );
  if (file && fileSha256(file) !== artifact.sha256) {
    errors.push(`${label}.sha256 does not match current evidence bytes (${artifact.path})`);
  }
}

function validateBaselineCouncil({ repoRoot, sourceTree, skipGit }) {
  const errors = [];
  const file = path.join(repoRoot, ...BASELINE_PATH.split("/"));
  const baseline = readJson(file, "quality council B0 baseline", errors);
  if (!baseline) return { valid: false, errors, baseline: null };
  if (
    !exactKeys(
      baseline,
      [
        "artifacts",
        "decision",
        "gate",
        "reviewedAt",
        "reviewers",
        "schemaVersion",
        "sources",
        "surfaces",
        "wave",
      ],
      "quality council B0 baseline",
      errors,
    )
  ) {
    return { valid: false, errors, baseline };
  }
  if (baseline.schemaVersion !== BASELINE_SCHEMA || baseline.wave !== "wave-0-b0") {
    errors.push(`quality council B0 baseline: schemaVersion and wave must be ${BASELINE_SCHEMA} / wave-0-b0`);
  }
  if (!isIsoDate(baseline.reviewedAt) || baseline.reviewedAt > new Date().toISOString().slice(0, 10)) {
    errors.push("quality council B0 baseline: reviewedAt must be a current or past YYYY-MM-DD");
  }
  if (
    !exactKeys(
      baseline.gate,
      ["aggregation", "minimumPassingScore", "minimumReviewers", "vetoPolicy"],
      "quality council B0 baseline.gate",
      errors,
    )
  ) {
    return { valid: false, errors, baseline };
  }
  if (
    baseline.gate.minimumPassingScore !== 9.5 ||
    baseline.gate.minimumReviewers !== 10 ||
    baseline.gate.aggregation !== "every-director-and-index-at-or-above-floor" ||
    baseline.gate.vetoPolicy !== "any-veto-is-no-pass"
  ) {
    errors.push("quality council B0 baseline.gate must preserve the external ten-seat 9.5 floor and veto contract");
  }
  if (
    !exactKeys(
      baseline.sources,
      ["app", "contract", "studio"],
      "quality council B0 baseline.sources",
      errors,
    )
  ) {
    return { valid: false, errors, baseline };
  }
  if (
    !exactKeys(
      baseline.sources.contract,
      ["homeRole", "products", "signalRouteRole"],
      "quality council B0 baseline.sources.contract",
      errors,
    ) ||
    JSON.stringify(baseline.sources.contract.products) !== JSON.stringify(REQUIRED_PRODUCTS) ||
    baseline.sources.contract.homeRole !== "front-door-and-daily-briefing" ||
    baseline.sources.contract.signalRouteRole !== "legacy-redirect"
  ) {
    errors.push("quality council B0 baseline: product contract must be Notes, Tasks, Timeline with Home briefing and legacy Signal redirect");
  }
  for (const sourceId of ["app", "studio"]) {
    const source = baseline.sources[sourceId];
    const label = `quality council B0 baseline.sources.${sourceId}`;
    const sourceKeys = sourceId === "app"
      ? ["deploymentId", "productionUrl", "sourceGitCommitSha", "sourceTreeSha256"]
      : ["deploymentId", "productionUrl", "sourceGitCommitSha"];
    if (!exactKeys(source, sourceKeys, label, errors)) continue;
    if (!COMMIT_PATTERN.test(source.sourceGitCommitSha)) {
      errors.push(`${label}.sourceGitCommitSha must be a 40-character lowercase commit SHA`);
    }
    if (!nonEmptyString(source.deploymentId) || !/^https:\/\//.test(source.productionUrl)) {
      errors.push(`${label}: deploymentId and HTTPS productionUrl are required`);
    }
    if (
      sourceId === "app" &&
      (!HASH_PATTERN.test(source.sourceTreeSha256) || source.sourceTreeSha256 !== sourceTree.sha256)
    ) {
      errors.push(`${label}.sourceTreeSha256 must match the current product/backend source tree`);
    }
  }
  if (baseline.sources.app.sourceGitCommitSha) {
    validateGitCommit(
      repoRoot,
      baseline.sources.app.sourceGitCommitSha,
      "quality council B0 baseline.sources.app",
      errors,
      skipGit,
    );
  }
  if (!Array.isArray(baseline.artifacts) || baseline.artifacts.length !== 2) {
    errors.push("quality council B0 baseline.artifacts must contain the report and evidence manifest");
  } else {
    baseline.artifacts.forEach((artifact, index) =>
      validateBaselineArtifact(repoRoot, artifact, `quality council B0 baseline.artifacts[${index}]`, errors),
    );
  }
  const reviewers = Array.isArray(baseline.reviewers) ? baseline.reviewers : [];
  if (reviewers.length !== 10) {
    errors.push("quality council B0 baseline.reviewers must contain exactly ten sealed directors");
  }
  const reviewerIds = new Set();
  const reviewerLenses = new Set();
  for (const [index, reviewer] of reviewers.entries()) {
    const label = `quality council B0 baseline.reviewers[${index}]`;
    if (!exactKeys(reviewer, ["id", "independentReviewSha256", "lens", "name"], label, errors)) continue;
    if (!STABLE_ID_PATTERN.test(reviewer.id) || reviewerIds.has(reviewer.id)) {
      errors.push(`${label}.id must be unique and stable`);
    }
    reviewerIds.add(reviewer.id);
    if (!nonEmptyString(reviewer.name) || !nonEmptyString(reviewer.lens) || reviewerLenses.has(reviewer.lens)) {
      errors.push(`${label}: name and lens must be non-empty and lens must be unique`);
    }
    reviewerLenses.add(reviewer.lens);
    if (!HASH_PATTERN.test(reviewer.independentReviewSha256)) {
      errors.push(`${label}.independentReviewSha256 must be one full lowercase SHA-256 digest`);
    }
  }
  const surfaces = Array.isArray(baseline.surfaces) ? baseline.surfaces : [];
  if (JSON.stringify(surfaces.map((surface) => surface?.id)) !== JSON.stringify(REQUIRED_BASELINE_SURFACES)) {
    errors.push(`quality council B0 baseline.surfaces must exactly cover ${REQUIRED_BASELINE_SURFACES.join(", ")}`);
  }
  for (const [index, surface] of surfaces.entries()) {
    const label = `quality council B0 baseline.surfaces[${index}]`;
    if (!exactKeys(surface, ["councilIndex", "decision", "id", "lowestLens", "name", "scores", "vetoes"], label, errors)) continue;
    const scores = Array.isArray(surface.scores) ? surface.scores : [];
    if (scores.length !== 10 || JSON.stringify(scores.map((score) => score.reviewerId)) !== JSON.stringify(reviewers.map((reviewer) => reviewer.id))) {
      errors.push(`${label}.scores must contain one ordered score for every director`);
    }
    for (const [scoreIndex, score] of scores.entries()) {
      const scoreLabel = `${label}.scores[${scoreIndex}]`;
      if (!exactKeys(score, ["reviewerId", "score", "veto"], scoreLabel, errors)) continue;
      if (typeof score.score !== "number" || score.score < 0 || score.score > 10 || Math.round(score.score * 10) !== score.score * 10) {
        errors.push(`${scoreLabel}.score must be a one-decimal number from 0 to 10`);
      }
      if (typeof score.veto !== "boolean") errors.push(`${scoreLabel}.veto must be boolean`);
    }
    const numericScores = scores.map((score) => score.score).filter((score) => typeof score === "number");
    const expectedIndex = numericScores.length === 10
      ? Number((numericScores.reduce((sum, score) => sum + score, 0) / 10).toFixed(2))
      : null;
    const expectedFloor = numericScores.length === 10 ? Math.min(...numericScores) : null;
    const expectedVetoes = scores.filter((score) => score.veto).map((score) => score.reviewerId);
    if (surface.councilIndex !== expectedIndex || surface.lowestLens !== expectedFloor) {
      errors.push(`${label}: councilIndex and lowestLens must be derived exactly from the ten scores`);
    }
    if (JSON.stringify(surface.vetoes) !== JSON.stringify(expectedVetoes)) {
      errors.push(`${label}.vetoes must exactly name the vetoing directors`);
    }
    if (surface.decision !== "no-pass" || (expectedFloor !== null && expectedFloor >= 9.5 && expectedVetoes.length === 0)) {
      errors.push(`${label}.decision must preserve the observed no-pass result`);
    }
  }
  if (baseline.decision !== "no-pass") {
    errors.push("quality council B0 baseline.decision must be no-pass; a baseline receipt can never certify release quality");
  }
  return { valid: errors.length === 0, errors, baseline };
}

function isMissingCertificationReceipt(error) {
  return (
    /^(product receipt|journey receipt) .+: evidence file does not exist/.test(error) ||
    error.startsWith("quality council: suite score is unavailable")
  );
}

/**
 * The external baseline was reviewed against an older source tree — D-029.
 *
 * This is neither a broken instrument nor a product verdict. It is a fact about
 * the REVIEW: ten directors read a tree, and the tree has since moved. It
 * happens by design on every source merge, so treating it as breakage would
 * mean no `src/` change could land without commissioning a fresh ten-director
 * review first. Published loudly, never silently, and never red.
 */
function isStaleBaselineTree(error) {
  return /^quality council B0 baseline\.sources\.\w+\.sourceTreeSha256 must match/.test(error);
}

/**
 * The two-state CI split — D-029, the F4 decision.
 *
 * `continue-on-error: true` used to sit on the council step inside a REQUIRED
 * check, which collapsed three different things into one green tick: a broken
 * validator, an honest NO-PASS, and a stale baseline. D-024's complaint was
 * exactly that — "a gate that always fails is indistinguishable from one that
 * is never consulted". The mask existed only because the validator could not
 * tell those states apart. Now it can, so the mask goes.
 *
 * Red is reserved for the instrument being wrong: a validator that cannot run,
 * a rotated contract hash, a malformed or tampered receipt, a baseline whose
 * reviewer count, artifact hashes or no-pass decision have been edited. Those
 * are the states where believing the gate would be a mistake.
 *
 * Green — with the verdict printed in full — covers the two states that are
 * TRUE rather than broken: the product has not reached 9.5 (expected until
 * State B), and the external review has aged out of the current tree (expected
 * on every merge).
 */
function classifyCiErrors(errors) {
  const expected = [];
  const structural = [];
  for (const error of errors) {
    if (isMissingCertificationReceipt(error) || isStaleBaselineTree(error)) expected.push(error);
    else structural.push(error);
  }
  return { expected, structural };
}

export function validateCouncil({ repoRoot = process.cwd(), skipGit = false } = {}) {
  const errors = [];
  const contract = validateContract(repoRoot, errors);
  if (!contract) return { achieved: false, errors, productScores: [], journeyScores: [] };
  let contractHashes;
  let sourceTree;
  try {
    contractHashes = currentContractHashes(repoRoot);
    sourceTree = computeSourceTree(repoRoot, contract.sourceInputs);
  } catch (error) {
    errors.push(`quality council integrity: ${error.message}`);
    return { achieved: false, errors, productScores: [], journeyScores: [] };
  }
  const hashCache = new Map();
  const productScores = [];
  for (const product of contract.products) {
    const result = validateProductReceipt({
      repoRoot,
      product,
      states: contract.stateMap.get(product.id) ?? [],
      viewports: contract.viewports,
      dimensionIds: contract.dimensions,
      contractHashes,
      sourceTree,
      gate: contract.gate,
      errors,
      skipGit,
      hashCache,
    });
    if (result) productScores.push(result);
  }
  const journeyScores = [];
  for (const [index, viewport] of contract.viewports.entries()) {
    const result = validateJourneyReceipt({
      repoRoot,
      receiptPath: contract.journey.evidenceReceipts[index],
      expectedViewport: viewport,
      dimensionIds: contract.dimensions,
      contractHashes,
      sourceTree,
      gate: contract.gate,
      journey: contract.journey,
      errors,
      skipGit,
      hashCache,
    });
    if (result) journeyScores.push(result);
  }
  const commits = new Set(
    [...productScores, ...journeyScores]
      .map((result) => result.sourceGitCommitSha)
      .filter(Boolean),
  );
  if (commits.size > 1) {
    errors.push("quality council: every product and journey receipt must review one source commit");
  }
  if (!skipGit) {
    for (const commit of commits) {
      try {
        const committedTree = computeGitSourceTree(repoRoot, commit, contract.sourceInputs);
        if (
          committedTree.sha256 !== sourceTree.sha256 ||
          committedTree.fileCount !== sourceTree.fileCount
        ) {
          errors.push(
            `quality council: reviewed commit ${commit} does not contain the current ` +
              "product/backend source tree; commit the exact reviewed source before issuing receipts",
          );
        }
      } catch (error) {
        errors.push(
          `quality council: could not verify the reviewed commit source tree (${error.message})`,
        );
      }
    }
  }
  const allScores = [...productScores, ...journeyScores]
    .map((result) => result.rawScore)
    .filter(Number.isInteger);
  const expectedScoreCount = contract.products.length + contract.viewports.length;
  const suiteRawScore =
    allScores.length === expectedScoreCount ? Math.min(...allScores) : null;
  if (
    suiteRawScore === null ||
    suiteRawScore < contract.gate.scoring.minimumPassingRawScore
  ) {
    errors.push(
      `quality council: suite score is ${
        suiteRawScore === null ? "unavailable" : `${suiteRawScore}/52`
      }; every product and journey viewport must reach 50/52`,
    );
  }
  const baseline = validateBaselineCouncil({ repoRoot, sourceTree, skipGit });
  if (
    baseline.valid &&
    errors.length > 0 &&
    errors.every(isMissingCertificationReceipt)
  ) {
    const failedSurfaces = baseline.baseline.surfaces.map(
      (surface) => `${surface.id} ${surface.lowestLens.toFixed(1)}/10 floor`,
    );
    return {
      achieved: false,
      errors: [
        `quality council B0: NO PASS at the hard 9.5/10 floor (${failedSurfaces.join("; ")})`,
      ],
      mode: "external-baseline",
      baseline: baseline.baseline,
      sourceTreeSha256: sourceTree.sha256,
      sourceTreeFileCount: sourceTree.fileCount,
      contractHashes,
      productScores: [],
      journeyScores: [],
      suiteRawScore: null,
      suiteTenPointScore: null,
    };
  }
  if (!baseline.valid && existsSync(path.join(repoRoot, ...BASELINE_PATH.split("/")))) {
    errors.push(...baseline.errors);
  }
  return {
    achieved: errors.length === 0,
    errors,
    sourceTreeSha256: sourceTree.sha256,
    sourceTreeFileCount: sourceTree.fileCount,
    contractHashes,
    productScores,
    journeyScores,
    suiteRawScore,
    suiteTenPointScore:
      suiteRawScore === null ? null : (suiteRawScore / contract.gate.scoring.maximumRawScore) * 10,
  };
}

function buildPreparation(repoRoot) {
  const errors = [];
  const contract = validateContract(repoRoot, errors);
  if (!contract || errors.length) {
    throw new Error(errors.join("\n"));
  }
  const sourceTree = computeSourceTree(repoRoot, contract.sourceInputs);
  const contractHashes = currentContractHashes(repoRoot);
  const products = contract.products.map((product) => ({
    id: product.id,
    canonicalPath: product.canonicalPath,
    criticalExperienceId: product.criticalExperienceId,
    receiptPath: product.receiptPath,
    requiredStates: contract.stateMap.get(product.id),
    requiredViewports: contract.viewports,
    requiredAssessmentUnits:
      (contract.stateMap.get(product.id)?.length ?? 0) * contract.viewports.length,
    receiptPresent: existsSync(path.join(repoRoot, ...product.receiptPath.split("/"))),
  }));
  const journeys = contract.viewports.map((viewport, index) => ({
    id: contract.journey.id,
    viewport,
    receiptPath: contract.journey.evidenceReceipts[index],
    receiptPresent: existsSync(
      path.join(repoRoot, ...contract.journey.evidenceReceipts[index].split("/")),
    ),
  }));
  return {
    schemaVersion: PREPARATION_SCHEMA,
    generatedAt: new Date().toISOString(),
    certificationStatus: "not-assessed-until-receipts-validate",
    sourceGitCommitSha: currentGitCommit(repoRoot),
    sourceTreeSha256: sourceTree.sha256,
    sourceTreeFileCount: sourceTree.fileCount,
    contractHashes,
    dimensions: contract.dimensions,
    minimumPassingRawScore: contract.gate.scoring.minimumPassingRawScore,
    maximumRawScore: contract.gate.scoring.maximumRawScore,
    scoreRule: "Every assessment unit and journey viewport must independently reach 50/52.",
    aggregationRule: "Product and suite scores are minimums. Averaging and rounded passes are forbidden.",
    evidenceRoot: contract.gate.evidenceContract.checkedInEvidenceRoot,
    products,
    journeys,
  };
}

function writePreparation(repoRoot) {
  const preparation = buildPreparation(repoRoot);
  const output = path.join(repoRoot, "experience", "output", "quality-council-input.json");
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, canonicalJson(preparation));
  console.log(
    `experience:council:prepare: wrote ${forward(path.relative(repoRoot, output))}; ` +
      `${preparation.products.reduce((sum, product) => sum + product.requiredAssessmentUnits, 0)} ` +
      "product assessment units and 4 continuous journey receipts require real evidence",
  );
}

function buildSelfTestFixture(root) {
  const dimensions = [
    "purpose-and-task-clarity",
    "information-architecture",
    "visual-hierarchy",
    "typography-and-content",
    "layout-and-composition",
    "interaction-quality",
    "state-completeness",
    "accessibility",
    "responsive-adaptability",
    "performance-and-perceived-speed",
    "design-system-coherence",
    "brand-distinction-and-craft",
    "implementation-fidelity",
  ];
  const productEntries = REQUIRED_PRODUCTS.map((id) => ({
    id,
    canonicalPath: `/app/${id}`,
    criticalExperienceId: `tasks.page.app-${id}`,
    requiredStateSource: `experience/registry.json#tasks.page.app-${id}.requiredStates`,
    requiredStates: ["default"],
    receiptPath: `experience/council-reviews/products/${id}.json`,
  }));
  const gate = {
    schemaVersion: GATE_SCHEMA,
    scope: {
      products: productEntries,
      requiredViewports: ["mobile"],
    },
    scoring: {
      dimensionScale: { minimum: 0, maximum: 4, integerOnly: true },
      dimensionCount: 13,
      maximumRawScore: 52,
      minimumPassingRawScore: 50,
      minimumDimensionScore: 3,
      maximumDimensionsAtThree: 2,
      missingEvidenceBehavior: "fail",
      averagingAcrossUnits: false,
    },
    dimensions: dimensions.map((id) => ({ id })),
    evidenceContract: {
      receiptSchemas: {
        product: CONTRACT_FILES.productReceiptSchemaSha256,
        crossSuiteJourney: CONTRACT_FILES.journeyReceiptSchemaSha256,
      },
      checkedInEvidenceRoot: "experience/council-evidence",
      sourceIntegrity: { inputs: ["src"] },
      visualDiff: { maximumDiffPixelRatio: 0.0025 },
    },
  };
  const steps = [
    { order: 1, product: "notes", path: "/app/notes", action: "capture" },
    { order: 2, product: "notes", path: "/app/notes", action: "extract" },
    { order: 3, product: "tasks", path: "/app/tasks", action: "promote" },
    { order: 4, product: "timeline", path: "/app/timeline", action: "inspect" },
    { order: 5, product: "home", path: "/app/home/briefing", action: "verify" },
  ];
  const journeyReceiptPath =
    "experience/council-reviews/journeys/signal-studio.note-to-home.mobile.json";
  const journey = {
    schemaVersion: JOURNEY_SCHEMA,
    id: "signal-studio.note-to-home",
    requiredViewports: ["mobile"],
    steps,
    evidenceReceipts: [journeyReceiptPath],
  };
  const registry = {
    experiences: productEntries.map((product) => ({
      id: product.criticalExperienceId,
      route: product.canonicalPath,
      requiredStates: ["default"],
    })),
  };
  const fixtures = {
    experiences: productEntries.map((product) => ({ id: product.criticalExperienceId })),
  };
  const browser = { projects: [{ name: "mobile", viewport: { width: 390, height: 844 } }] };
  const files = {
    "experience/quality-council-gate.json": gate,
    "experience/cross-suite-journey.json": journey,
    "experience/registry.json": registry,
    "experience/critical-fixtures.json": fixtures,
    "experience/browser-contract.json": browser,
  };
  for (const [relative, value] of Object.entries(files)) {
    const absolute = path.join(root, ...relative.split("/"));
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, canonicalJson(value));
  }
  for (const relative of [
    "experience/playwright.config.ts",
    "experience/tests/critical-experiences.spec.ts",
    "scripts/experience/quality-council.mjs",
    "experience/schemas/quality-council-product-receipt.schema.json",
    "experience/schemas/quality-council-journey-receipt.schema.json",
    "src/index.ts",
  ]) {
    const absolute = path.join(root, ...relative.split("/"));
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, `${relative}\n`);
  }
  const evidencePaths = [
    "experience/council-evidence/baseline.png",
    "experience/council-evidence/candidate.png",
    "experience/council-evidence/diff.png",
    "experience/council-evidence/journey-step-1.png",
    "experience/council-evidence/journey-step-2.png",
    "experience/council-evidence/journey-step-3.png",
    "experience/council-evidence/journey-step-4.png",
    "experience/council-evidence/journey-step-5.png",
    "experience/council-evidence/report.json",
    "experience/council-evidence/review-one.md",
    "experience/council-evidence/review-two.md",
    "experience/council-evidence/review-three.md",
  ];
  for (const relative of evidencePaths) {
    const absolute = path.join(root, ...relative.split("/"));
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, `real self-test evidence ${relative}\n`);
  }
  const artifact = (relative) => ({
    path: relative,
    sha256: fileSha256(path.join(root, ...relative.split("/"))),
  });
  const reviewers = ["one", "two", "three"].map((id) => ({
    id: `reviewer-${id}`,
    name: `Reviewer ${id}`,
    lens: `Independent ${id} lens`,
    kind: "agent",
    independentReview: artifact(`experience/council-evidence/review-${id}.md`),
  }));
  const dimensionScores = dimensions.map((id, index) => ({
    id,
    score: index < 2 ? 3 : 4,
    reviewerId: reviewers[index % reviewers.length].id,
    rationale: `Specific rationale for ${id} in this self-test.`,
    positiveEvidence: `Specific positive evidence for ${id} in this self-test.`,
    evidenceKeys: ["sourceReview"],
  }));
  const contractHashes = currentContractHashes(root);
  const sourceTreeSha256 = computeSourceTree(root, ["src"]).sha256;
  const common = {
    reviewedAt: "2026-07-26",
    sourceGitCommitSha: "a".repeat(40),
    sourceTreeSha256,
    contractHashes,
    reviewers,
  };
  const productEvidence = Object.fromEntries(
    PRODUCT_EVIDENCE_KEYS.map((key) => [
      key,
      artifact(
        key === "approvedBaseline"
          ? "experience/council-evidence/baseline.png"
          : key === "candidateScreenshot" || key === "renderedScreenshot"
            ? "experience/council-evidence/candidate.png"
            : key === "visualDiff"
              ? "experience/council-evidence/diff.png"
              : "experience/council-evidence/report.json",
      ),
    ]),
  );
  const productMetrics = {
    baselineStatus: "approved",
    visualDiffPixelRatio: 0,
    axeSeriousViolations: 0,
    axeCriticalViolations: 0,
    uncaughtPageErrors: 0,
    consoleErrors: 0,
    failedRequests: 0,
    unexpectedHttpErrors: 0,
    documentOverflow: false,
    keyboardOnly: "pass",
    reducedMotion: "pass",
    minimumPrimaryTouchTargetCssPixels: 44,
    performanceBudget: "pass",
    releaseBlockingFindings: 0,
    highSeverityFindings: 0,
    canonicalRouteAndContext: "pass",
  };
  for (const product of productEntries) {
    const receipt = {
      schemaVersion: PRODUCT_RECEIPT_SCHEMA,
      productId: product.id,
      criticalExperienceId: product.criticalExperienceId,
      canonicalPath: product.canonicalPath,
      ...common,
      assessmentUnits: [
        {
          state: "default",
          viewport: "mobile",
          evidence: productEvidence,
          metrics: productMetrics,
          dimensions: dimensionScores,
          rawScore: 50,
          decision: "pass",
        },
      ],
      declaredProductRawScore: 50,
      decision: "pass",
    };
    const absolute = path.join(root, ...product.receiptPath.split("/"));
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, canonicalJson(receipt));
  }
  const journeyEvidence = Object.fromEntries(
    JOURNEY_EVIDENCE_KEYS.map((key) => [
      key,
      artifact("experience/council-evidence/report.json"),
    ]),
  );
  const journeyReceipt = {
    schemaVersion: JOURNEY_RECEIPT_SCHEMA,
    journeyId: journey.id,
    viewport: "mobile",
    ...common,
    continuousTrace: artifact("experience/council-evidence/report.json"),
    steps: steps.map((step) => ({
      ...step,
      screenshot: artifact(`experience/council-evidence/journey-step-${step.order}.png`),
      objectIdentityEvidence: artifact("experience/council-evidence/report.json"),
    })),
    evidence: journeyEvidence,
    metrics: {
      stepsCompleted: 5,
      duplicateMutations: 0,
      brokenSourceReferences: 0,
      contextBreaks: 0,
      axeSeriousViolations: 0,
      axeCriticalViolations: 0,
      uncaughtPageErrors: 0,
      consoleErrors: 0,
      failedRequests: 0,
      unexpectedHttpErrors: 0,
      keyboardOnly: "pass",
      releaseBlockingFindings: 0,
      highSeverityFindings: 0,
      canonicalRouteAndContext: "pass",
    },
    dimensions: dimensionScores,
    rawScore: 50,
    decision: "pass",
  };
  const journeyAbsolute = path.join(root, ...journeyReceiptPath.split("/"));
  mkdirSync(path.dirname(journeyAbsolute), { recursive: true });
  writeFileSync(journeyAbsolute, canonicalJson(journeyReceipt));
  return {
    journeyAbsolute,
    productReceipt: path.join(
      root,
      "experience",
      "council-reviews",
      "products",
      "notes.json",
    ),
    tamperEvidence: path.join(root, "experience", "council-evidence", "report.json"),
  };
}

function expectSelfTestFailure(root, fragment) {
  const result = validateCouncil({ repoRoot: root, skipGit: true });
  if (result.achieved || !result.errors.some((error) => error.includes(fragment))) {
    throw new Error(
      `self-test failed: expected rejection containing "${fragment}"\n${result.errors.join("\n")}`,
    );
  }
}

function runSelfTest() {
  const root = mkdtempSync(path.join(tmpdir(), "signal-quality-council-"));
  try {
    const fixture = buildSelfTestFixture(root);
    const passing = validateCouncil({ repoRoot: root, skipGit: true });
    if (!passing.achieved || passing.suiteRawScore !== 50) {
      throw new Error(`self-test failed: valid 50/52 fixture was rejected\n${passing.errors.join("\n")}`);
    }

    const product = JSON.parse(readFileSync(fixture.productReceipt, "utf8"));
    product.assessmentUnits[0].dimensions[2].score = 3;
    product.assessmentUnits[0].rawScore = 49;
    product.declaredProductRawScore = 49;
    writeFileSync(fixture.productReceipt, canonicalJson(product));
    expectSelfTestFailure(root, "below 50/52");

    product.assessmentUnits[0].dimensions[2].score = 3.5;
    product.assessmentUnits[0].rawScore = 49.5;
    product.declaredProductRawScore = 49.5;
    writeFileSync(fixture.productReceipt, canonicalJson(product));
    expectSelfTestFailure(root, "score must be an integer");

    product.assessmentUnits[0].dimensions[2].score = 4;
    product.assessmentUnits[0].rawScore = 50;
    product.declaredProductRawScore = 50;
    writeFileSync(fixture.productReceipt, canonicalJson(product));
    writeFileSync(fixture.tamperEvidence, "tampered evidence\n");
    expectSelfTestFailure(root, "sha256 does not match current evidence bytes");

    writeFileSync(
      fixture.tamperEvidence,
      "real self-test evidence experience/council-evidence/report.json\n",
    );
    rmSync(fixture.journeyAbsolute);
    expectSelfTestFailure(root, "journey receipt mobile: evidence file does not exist");

    const refreshed = buildSelfTestFixture(root);
    writeFileSync(path.join(root, "src", "index.ts"), "stale source mutation\n");
    expectSelfTestFailure(root, "sourceTreeSha256 is stale");
    if (!existsSync(refreshed.productReceipt)) {
      throw new Error("self-test failed: fixture rebuild did not restore receipts");
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  console.log(
    "experience:council:self-test: pass - exact 50/52 passes; 49/52, fractional scores, missing journey evidence, stale source, and tampered evidence fail",
  );
}

function printHelp() {
  console.log(`Signal Studio quality council evidence gate

Usage:
  node scripts/experience/quality-council.mjs
  node scripts/experience/quality-council.mjs --prepare
  node scripts/experience/quality-council.mjs --hash <experience/council-evidence/...>
  node scripts/experience/quality-council.mjs --self-test

The default command validates every required product state x viewport receipt,
all four continuous cross-suite journey receipts, every evidence hash, all hard
blocker metrics, current source and contract hashes, and the minimum 50/52 rule.
`);
}

const args = process.argv.slice(2).filter((argument) => argument !== "--");
if (args.length === 0) {
  const result = validateCouncil();
  if (!result.achieved) {
    if (result.mode === "external-baseline") {
      console.error(
        "experience:council: current Wave 0 B0 matrix - NO PASS\n" +
          result.baseline.surfaces
            .map(
              (surface) =>
                `  x ${surface.name}: index ${surface.councilIndex.toFixed(2)}/10; ` +
                `floor ${surface.lowestLens.toFixed(1)}/10; ` +
                `vetoes ${surface.vetoes.length ? surface.vetoes.join(", ") : "none"}`,
            )
            .join("\n") +
          "\n  x Gate: every director and Council Index must be >=9.5 with zero vetoes. " +
          "The full state-by-viewport certification receipts remain reserved for a future pass attempt.",
      );
      process.exit(1);
    }
    console.error(
      `experience:council: ${result.errors.length} failure(s)\n` +
        result.errors.map((error) => `  x ${error}`).join("\n"),
    );
    process.exit(1);
  }
  console.log(
    `experience:council: certified - suite minimum ${result.suiteRawScore}/52 ` +
      `(${result.suiteTenPointScore.toFixed(4)}/10); ` +
      `${result.productScores.reduce((sum, product) => sum + product.unitCount, 0)} ` +
      "product assessment units and 4 journey viewports validated",
  );
} else if (args.length === 1 && args[0] === "--ci") {
  // D-029. Publishes in every state; red only when the instrument is wrong.
  const result = validateCouncil();
  if (result.achieved) {
    console.log(
      `experience:council [ci]: CERTIFIED - suite minimum ${result.suiteRawScore}/52 ` +
        `(${result.suiteTenPointScore.toFixed(4)}/10)`,
    );
  } else if (result.mode === "external-baseline") {
    console.log(
      "experience:council [ci]: NO PASS - external Wave 0 B0 baseline, instrument healthy\n" +
        result.baseline.surfaces
          .map(
            (surface) =>
              `  - ${surface.name}: index ${surface.councilIndex.toFixed(2)}/10; ` +
              `floor ${surface.lowestLens.toFixed(1)}/10; ` +
              `vetoes ${surface.vetoes.length ? surface.vetoes.join(", ") : "none"}`,
          )
          .join("\n") +
        "\n  Gate: every director and Council Index must be >=9.5 with zero vetoes. " +
        "This is the reviewed truth, not a broken check.",
    );
  } else {
    const { expected, structural } = classifyCiErrors(result.errors);
    if (structural.length > 0) {
      console.error(
        `experience:council [ci]: INSTRUMENT FAILURE - ${structural.length} structural error(s). ` +
          "The gate cannot be believed in this state.\n" +
          structural.map((error) => `  x ${error}`).join("\n") +
          (expected.length
            ? `\n  (${expected.length} expected not-yet-certified/stale-baseline note(s) suppressed)`
            : ""),
      );
      process.exit(1);
    }
    console.log(
      "experience:council [ci]: NOT CERTIFIED - instrument healthy, certification not attained\n" +
        expected.map((error) => `  - ${error}`).join("\n") +
        "\n  No 9.5 claim may be made on this basis, by anyone, including by citing this green check.",
    );
  }
} else if (args.length === 1 && args[0] === "--self-test") {
  runSelfTest();
} else if (args.length === 1 && args[0] === "--prepare") {
  writePreparation(process.cwd());
} else if (args.length === 2 && args[0] === "--hash") {
  const errors = [];
  const file = resolveRepoFile(
    process.cwd(),
    args[1],
    "evidence path",
    errors,
    "experience/council-evidence",
  );
  if (!file) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  console.log(fileSha256(file));
} else if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
  printHelp();
} else {
  printHelp();
  process.exit(1);
}
