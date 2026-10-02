import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const ATTESTATION_SCHEMA = "signal-playwright-attestation/2";
export const RECEIPT_SCHEMA = "signal-materiality-review/2";
export const ARTIFACT_PATH = "experience/output/critical-evidence.json";

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MATERIALITY_HASH_PATTERN = /^[a-f0-9]{16}$/;
const EXPERIENCE_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const RECEIPT_KEYS = [
  "decision",
  "experienceId",
  "materialityHash",
  "playwrightEvidence",
  "reviewedAt",
  "reviewedChange",
  "reviewer",
  "schemaVersion",
  "source",
];
const PLAYWRIGHT_EVIDENCE_KEYS = [
  "artifactPath",
  "attestationPath",
  "attestationSha256",
  "canonicalEvidenceSha256",
  "caseName",
  "fixtureId",
  "projects",
  "rawArtifactSha256",
  "runId",
];
const ATTESTATION_KEYS = [
  "artifactPath",
  "browserContractSha256",
  "canonicalEvidenceSha256",
  "fixtureManifestSha256",
  "outcomes",
  "passedCount",
  "playwrightConfigSha256",
  "playwrightSpecSha256",
  "projects",
  "rawArtifactSha256",
  "runId",
  "schemaVersion",
  "startedAt",
  "testCount",
  "unexpectedCount",
];
const ATTESTATION_PROJECT_KEYS = ["name", "tests"];
const OUTCOME_KEYS = ["title", "project", "expectedStatus", "status", "finalResultStatus", "errorCount"];

export function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

export function normalizeText(text) {
  return text.replace(/\r\n?/g, "\n");
}

export function normalizedFileHash(file) {
  return sha256(normalizeText(readFileSync(file, "utf8")));
}

export function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function collectPlaywrightOutcomes(report) {
  const outcomes = [];
  function visit(suite) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const finalResult = test.results?.at(-1);
        outcomes.push({
          title: spec.title,
          project: test.projectName,
          expectedStatus: test.expectedStatus,
          status: test.status,
          finalResultStatus: finalResult?.status ?? "missing",
          errorCount: finalResult?.errors?.length ?? 0,
        });
      }
    }
    for (const child of suite.suites ?? []) visit(child);
  }
  for (const suite of report.suites ?? []) visit(suite);
  return outcomes.sort((left, right) =>
    left.title.localeCompare(right.title) || left.project.localeCompare(right.project));
}

export function canonicalEvidenceDigest({ outcomes, hashes }) {
  return sha256(JSON.stringify({
    schemaVersion: "signal-playwright-canonical/1",
    browserContractSha256: hashes.browserContractSha256,
    fixtureManifestSha256: hashes.fixtureManifestSha256,
    playwrightConfigSha256: hashes.playwrightConfigSha256,
    playwrightSpecSha256: hashes.playwrightSpecSha256,
    outcomes: outcomes.map(({ title, project, expectedStatus, status, finalResultStatus, errorCount }) => ({
      title, project, expectedStatus, status, finalResultStatus, errorCount,
    })),
  }));
}

export function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} fields must be exactly: ${wanted.join(", ")}`);
  }
}

function nonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    throw new Error(`${label} must be a non-empty trimmed string`);
  }
}

function exactHash(value, label, pattern = HASH_PATTERN) {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`);
  }
}

function exactInteger(value, label, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${label} must be an integer greater than or equal to ${minimum}`);
  }
}

function resolveCheckedInJson(repoRoot, relativePath, directory, label) {
  nonEmptyString(relativePath, label);
  if (path.isAbsolute(relativePath) || relativePath.includes("\\") || !relativePath.endsWith(".json")) {
    throw new Error(`${label} must be a forward-slash JSON path under ${directory}/`);
  }
  const absolute = path.resolve(repoRoot, ...relativePath.split("/"));
  const allowedRoot = `${path.resolve(repoRoot, ...directory.split("/"))}${path.sep}`;
  if (!absolute.startsWith(allowedRoot)) {
    throw new Error(`${label} must resolve under ${directory}/`);
  }
  if (!existsSync(absolute) || !statSync(absolute).isFile()) {
    throw new Error(`${label} does not exist (${relativePath})`);
  }
  return absolute;
}

export function readCanonicalJson(file, label) {
  const normalized = normalizeText(readFileSync(file, "utf8"));
  let value;
  try {
    value = JSON.parse(normalized);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
  if (normalized !== canonicalJson(value)) {
    throw new Error(`${label} must use exact canonical JSON formatting`);
  }
  return { value, normalized };
}

function readBrowserContract(repoRoot) {
  const file = path.join(repoRoot, "experience", "browser-contract.json");
  const contract = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(contract.projects) || contract.projects.length === 0) {
    throw new Error("browser contract projects must be a non-empty array");
  }
  return contract;
}

function expectedRenderedTitles(repoRoot) {
  const manifest = JSON.parse(readFileSync(path.join(repoRoot, "experience", "critical-fixtures.json"), "utf8"));
  const critical = manifest.experiences
    .filter((entry) => entry.evidence === "rendered")
    .flatMap((entry) => entry.interaction
      ? [`${entry.id} / ${entry.caseName}`]
      : (entry.cases ?? []).map((item) => `${entry.id} / ${item.name}`));
  const supplemental = (manifest.supplementalCoreRendered ?? [])
    .map((entry) => `${entry.id} / ${entry.caseName}`);
  const titles = [...critical, ...supplemental].sort();
  if (new Set(titles).size !== titles.length) throw new Error("rendered case titles must be unique");
  return titles;
}

function validateAttestationShape(attestation, label) {
  exactKeys(attestation, ATTESTATION_KEYS, label);
  if (attestation.schemaVersion !== ATTESTATION_SCHEMA) {
    throw new Error(`${label} schemaVersion must be ${ATTESTATION_SCHEMA}`);
  }
  exactHash(attestation.canonicalEvidenceSha256, `${label} canonicalEvidenceSha256`);
  exactHash(attestation.rawArtifactSha256, `${label} rawArtifactSha256`);
  exactHash(attestation.browserContractSha256, `${label} browserContractSha256`);
  exactHash(attestation.fixtureManifestSha256, `${label} fixtureManifestSha256`);
  exactHash(attestation.playwrightConfigSha256, `${label} playwrightConfigSha256`);
  exactHash(attestation.playwrightSpecSha256, `${label} playwrightSpecSha256`);
  const expectedRunId = `tasks-playwright-${attestation.canonicalEvidenceSha256.slice(0, 24)}`;
  if (attestation.runId !== expectedRunId) {
    throw new Error(`${label} runId must be derived from canonicalEvidenceSha256`);
  }
  if (attestation.artifactPath !== ARTIFACT_PATH) {
    throw new Error(`${label} artifactPath must be ${ARTIFACT_PATH}`);
  }
  if (!Array.isArray(attestation.projects) || attestation.projects.length === 0) {
    throw new Error(`${label} projects must be a non-empty array`);
  }
  if (!Array.isArray(attestation.outcomes) || attestation.outcomes.length === 0) {
    throw new Error(`${label} outcomes must be a non-empty array`);
  }
  for (const [index, outcome] of attestation.outcomes.entries()) {
    exactKeys(outcome, OUTCOME_KEYS, `${label} outcomes[${index}]`);
    nonEmptyString(outcome.title, `${label} outcomes[${index}].title`);
    nonEmptyString(outcome.project, `${label} outcomes[${index}].project`);
    exactInteger(outcome.errorCount, `${label} outcomes[${index}].errorCount`);
    if (outcome.expectedStatus !== "passed" || outcome.status !== "expected" ||
        outcome.finalResultStatus !== "passed" || outcome.errorCount !== 0) {
      throw new Error(`${label} outcomes[${index}] must be one passing outcome`);
    }
  }
  for (const [index, project] of attestation.projects.entries()) {
    exactKeys(project, ATTESTATION_PROJECT_KEYS, `${label} projects[${index}]`);
    nonEmptyString(project.name, `${label} projects[${index}].name`);
    exactInteger(project.tests, `${label} projects[${index}].tests`, 1);
  }
  exactInteger(attestation.testCount, `${label} testCount`, 1);
  exactInteger(attestation.passedCount, `${label} passedCount`, 1);
  exactInteger(attestation.unexpectedCount, `${label} unexpectedCount`);
  if (
    attestation.testCount !== attestation.projects.reduce((sum, project) => sum + project.tests, 0) ||
    attestation.testCount !== attestation.outcomes.length ||
    attestation.passedCount !== attestation.testCount ||
    attestation.unexpectedCount !== 0
  ) {
    throw new Error(`${label} counts must describe one fully passing run`);
  }
  if (
    typeof attestation.startedAt !== "string" ||
    !Number.isFinite(Date.parse(attestation.startedAt))
  ) {
    throw new Error(`${label} startedAt must be an ISO timestamp`);
  }
}

export function validateAttestationRecord({ repoRoot, attestationPath, requireArtifact = false }) {
  const attestationFile = resolveCheckedInJson(
    repoRoot,
    attestationPath,
    "experience/evidence-runs",
    "attestationPath",
  );
  const { value: attestation, normalized } = readCanonicalJson(
    attestationFile,
    `${attestationPath} attestation`,
  );
  validateAttestationShape(attestation, `${attestationPath} attestation`);

  const expectedHashes = {
    browserContractSha256: normalizedFileHash(
      path.join(repoRoot, "experience", "browser-contract.json"),
    ),
    fixtureManifestSha256: normalizedFileHash(
      path.join(repoRoot, "experience", "critical-fixtures.json"),
    ),
    playwrightConfigSha256: normalizedFileHash(
      path.join(repoRoot, "experience", "playwright.config.ts"),
    ),
    playwrightSpecSha256: normalizedFileHash(
      path.join(repoRoot, "experience", "tests", "critical-experiences.spec.ts"),
    ),
  };
  for (const [field, expected] of Object.entries(expectedHashes)) {
    if (attestation[field] !== expected) {
      throw new Error(`${attestationPath}: ${field} does not match the current evidence contract`);
    }
  }

  const browserContract = readBrowserContract(repoRoot);
  const contractProjects = browserContract.projects.map((project) => project.name);
  const attestedProjects = attestation.projects.map((project) => project.name);
  if (JSON.stringify(attestedProjects) !== JSON.stringify(contractProjects)) {
    throw new Error(`${attestationPath}: projects do not exactly match browser-contract.json`);
  }

  const expectedPairs = expectedRenderedTitles(repoRoot)
    .flatMap((title) => contractProjects.map((project) => `${project}\u0000${title}`)).sort();
  const actualPairs = attestation.outcomes.map((outcome) => `${outcome.project}\u0000${outcome.title}`).sort();
  if (JSON.stringify(actualPairs) !== JSON.stringify(expectedPairs) ||
      attestation.projects.some((project) => project.tests !==
        attestation.outcomes.filter((outcome) => outcome.project === project.name).length)) {
    throw new Error(`${attestationPath}: outcome pairs do not cover every rendered case at every viewport`);
  }
  const hashes = Object.fromEntries(Object.keys(expectedHashes).map((key) => [key, attestation[key]]));
  if (canonicalEvidenceDigest({ outcomes: attestation.outcomes, hashes }) !== attestation.canonicalEvidenceSha256) {
    throw new Error(`${attestationPath}: canonical digest does not match recorded outcomes`);
  }

  if (requireArtifact) {
    const artifactFile = path.resolve(repoRoot, ...attestation.artifactPath.split("/"));
    const expectedRoot = `${path.resolve(repoRoot, "experience", "output")}${path.sep}`;
    if (!artifactFile.startsWith(expectedRoot) || !existsSync(artifactFile)) {
      throw new Error(`${attestationPath}: raw Playwright artifact is unavailable`);
    }
    if (sha256(readFileSync(artifactFile)) !== attestation.rawArtifactSha256) {
      throw new Error(`${attestationPath}: raw Playwright artifact digest does not match`);
    }
    const report = JSON.parse(readFileSync(artifactFile, "utf8"));
    if (JSON.stringify(collectPlaywrightOutcomes(report)) !== JSON.stringify(attestation.outcomes) ||
        report.stats?.unexpected !== 0 || report.stats?.skipped !== 0) {
      throw new Error(`${attestationPath}: raw Playwright outcomes do not match the attestation`);
    }
  }

  return {
    attestation,
    attestationFile,
    attestationSha256: sha256(normalized),
  };
}

function validateFixtureCase(repoRoot, fixtureId, caseName, experienceId) {
  const manifest = JSON.parse(
    readFileSync(path.join(repoRoot, "experience", "critical-fixtures.json"), "utf8"),
  );
  const fixture = manifest.experiences?.find((candidate) => candidate.id === fixtureId);
  if (!fixture || fixture.evidence !== "rendered") {
    const supplemental = manifest.supplementalCoreRendered?.find((candidate) => candidate.id === fixtureId);
    const registry = JSON.parse(readFileSync(path.join(repoRoot, "experience", "registry.json"), "utf8"));
    const entry = registry.experiences?.find((candidate) => candidate.id === experienceId);
    if (!supplemental || supplemental.evidence !== "rendered" ||
        supplemental.id !== experienceId || entry?.reviewTier !== "core" ||
        entry.source !== supplemental.source || supplemental.caseName !== caseName) {
      throw new Error(`playwrightEvidence must name the target core experience's own rendered case (${fixtureId})`);
    }
    return { supplemental: true };
  }
  if (experienceId && fixtureId !== experienceId) {
    throw new Error(`playwrightEvidence.fixtureId must equal the reviewed experience (${experienceId})`);
  }
  const caseNames = fixture.interaction
    ? [fixture.caseName]
    : (fixture.cases ?? []).map((candidate) => candidate.name);
  if (!caseNames.includes(caseName)) {
    throw new Error(
      `playwrightEvidence.caseName must name an exact rendered case for ${fixtureId} (${caseName})`,
    );
  }
  return { supplemental: false };
}

function validateSupplementalOutcome({ fixtureId, caseName, record }) {
  const title = `${fixtureId} / ${caseName}`;
  const matching = record.attestation.outcomes.filter((outcome) => outcome.title === title);
  const projects = record.attestation.projects.map((item) => item.name);
  if (matching.length !== projects.length ||
      projects.some((project) => matching.filter((item) => item.project === project).length !== 1) ||
      matching.some((item) => item.expectedStatus !== "passed" || item.status !== "expected" ||
        item.finalResultStatus !== "passed" || item.errorCount !== 0)) {
    throw new Error(`supplemental rendered case lacks one passing outcome per viewport (${title})`);
  }
}

export function validateMaterialityReceipt({
  repoRoot,
  evidencePath,
  expected = {},
  requireArtifact = false,
}) {
  const receiptFile = resolveCheckedInJson(
    repoRoot,
    evidencePath,
    "experience/reviews",
    "materialityReview evidence",
  );
  const { value: receipt } = readCanonicalJson(receiptFile, `${evidencePath} receipt`);
  exactKeys(receipt, RECEIPT_KEYS, `${evidencePath} receipt`);
  if (receipt.schemaVersion !== RECEIPT_SCHEMA) {
    throw new Error(`${evidencePath}: schemaVersion must be ${RECEIPT_SCHEMA}`);
  }
  if (!EXPERIENCE_ID_PATTERN.test(receipt.experienceId ?? "")) {
    throw new Error(`${evidencePath}: experienceId must be one exact stable experience ID`);
  }
  nonEmptyString(receipt.source, `${evidencePath} source`);
  exactHash(receipt.materialityHash, `${evidencePath} materialityHash`, MATERIALITY_HASH_PATTERN);
  if (typeof receipt.reviewedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(receipt.reviewedAt)) {
    throw new Error(`${evidencePath}: reviewedAt must be YYYY-MM-DD`);
  }
  nonEmptyString(receipt.reviewer, `${evidencePath} reviewer`);
  nonEmptyString(receipt.reviewedChange, `${evidencePath} reviewedChange`);
  nonEmptyString(receipt.decision, `${evidencePath} decision`);
  exactKeys(receipt.playwrightEvidence, PLAYWRIGHT_EVIDENCE_KEYS, `${evidencePath} playwrightEvidence`);
  const evidence = receipt.playwrightEvidence;
  nonEmptyString(evidence.fixtureId, `${evidencePath} fixtureId`);
  nonEmptyString(evidence.caseName, `${evidencePath} caseName`);
  exactHash(evidence.attestationSha256, `${evidencePath} attestationSha256`);
  exactHash(evidence.canonicalEvidenceSha256, `${evidencePath} canonicalEvidenceSha256`);
  exactHash(evidence.rawArtifactSha256, `${evidencePath} rawArtifactSha256`);
  if (!Array.isArray(evidence.projects) || evidence.projects.some((project) => typeof project !== "string")) {
    throw new Error(`${evidencePath}: playwrightEvidence.projects must be an array of project names`);
  }

  for (const [field, value] of Object.entries(expected)) {
    if (value !== undefined && receipt[field] !== value) {
      throw new Error(`${evidencePath}: receipt ${field} must exactly match ${value}`);
    }
  }

  const record = validateAttestationRecord({
    repoRoot,
    attestationPath: evidence.attestationPath,
    requireArtifact,
  });
  if (evidence.attestationSha256 !== record.attestationSha256) {
    throw new Error(`${evidencePath}: attestationSha256 does not match the checked-in attestation`);
  }
  for (const field of [
    "runId",
    "canonicalEvidenceSha256",
    "rawArtifactSha256",
    "artifactPath",
  ]) {
    if (evidence[field] !== record.attestation[field]) {
      throw new Error(`${evidencePath}: playwrightEvidence.${field} does not match the attestation`);
    }
  }
  const attestedProjects = record.attestation.projects.map((project) => project.name);
  if (JSON.stringify(evidence.projects) !== JSON.stringify(attestedProjects)) {
    throw new Error(`${evidencePath}: playwrightEvidence.projects do not exactly match the attestation`);
  }
  const fixture = validateFixtureCase(repoRoot, evidence.fixtureId, evidence.caseName, receipt.experienceId);
  if (fixture.supplemental) {
    validateSupplementalOutcome({ fixtureId: evidence.fixtureId, caseName: evidence.caseName, record });
  }

  return { receipt, receiptFile, ...record };
}

export function playwrightEvidenceFromAttestation({
  repoRoot,
  attestationPath,
  experienceId,
  fixtureId,
  caseName,
  requireArtifact = true,
}) {
  nonEmptyString(fixtureId, "fixtureId");
  nonEmptyString(caseName, "caseName");
  const fixture = validateFixtureCase(repoRoot, fixtureId, caseName, experienceId);
  const record = validateAttestationRecord({ repoRoot, attestationPath, requireArtifact });
  if (fixture.supplemental) validateSupplementalOutcome({ fixtureId, caseName, record });
  return {
    attestationPath,
    attestationSha256: record.attestationSha256,
    runId: record.attestation.runId,
    canonicalEvidenceSha256: record.attestation.canonicalEvidenceSha256,
    rawArtifactSha256: record.attestation.rawArtifactSha256,
    artifactPath: record.attestation.artifactPath,
    fixtureId,
    caseName,
    projects: record.attestation.projects.map((project) => project.name),
  };
}
