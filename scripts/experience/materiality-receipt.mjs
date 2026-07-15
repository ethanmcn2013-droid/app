import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const ATTESTATION_SCHEMA = "signal-playwright-attestation/1";
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

  if (requireArtifact) {
    const artifactFile = path.resolve(repoRoot, ...attestation.artifactPath.split("/"));
    const expectedRoot = `${path.resolve(repoRoot, "experience", "output")}${path.sep}`;
    if (!artifactFile.startsWith(expectedRoot) || !existsSync(artifactFile)) {
      throw new Error(`${attestationPath}: raw Playwright artifact is unavailable`);
    }
    if (sha256(readFileSync(artifactFile)) !== attestation.rawArtifactSha256) {
      throw new Error(`${attestationPath}: raw Playwright artifact digest does not match`);
    }
  }

  return {
    attestation,
    attestationFile,
    attestationSha256: sha256(normalized),
  };
}

function validateFixtureCase(repoRoot, fixtureId, caseName) {
  const manifest = JSON.parse(
    readFileSync(path.join(repoRoot, "experience", "critical-fixtures.json"), "utf8"),
  );
  const fixture = manifest.experiences?.find((candidate) => candidate.id === fixtureId);
  if (!fixture || fixture.evidence !== "rendered") {
    throw new Error(`playwrightEvidence.fixtureId must name one rendered critical fixture (${fixtureId})`);
  }
  const caseNames = fixture.interaction
    ? [fixture.caseName]
    : (fixture.cases ?? []).map((candidate) => candidate.name);
  if (!caseNames.includes(caseName)) {
    throw new Error(
      `playwrightEvidence.caseName must name an exact rendered case for ${fixtureId} (${caseName})`,
    );
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
  validateFixtureCase(repoRoot, evidence.fixtureId, evidence.caseName);

  return { receipt, receiptFile, ...record };
}

export function playwrightEvidenceFromAttestation({
  repoRoot,
  attestationPath,
  fixtureId,
  caseName,
  requireArtifact = true,
}) {
  nonEmptyString(fixtureId, "fixtureId");
  nonEmptyString(caseName, "caseName");
  validateFixtureCase(repoRoot, fixtureId, caseName);
  const record = validateAttestationRecord({ repoRoot, attestationPath, requireArtifact });
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
