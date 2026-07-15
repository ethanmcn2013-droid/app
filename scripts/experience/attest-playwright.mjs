#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ARTIFACT_PATH,
  RECEIPT_SCHEMA,
  canonicalJson,
  normalizedFileHash,
  sha256,
  validateMaterialityReceipt,
} from "./materiality-receipt.mjs";

const OUTPUT_PATH = "experience/output/evidence-attestation.json";

function expectedTitles(manifest) {
  return manifest.experiences
    .filter((entry) => entry.evidence === "rendered")
    .flatMap((entry) =>
      entry.interaction
        ? [`${entry.id} / ${entry.caseName}`]
        : (entry.cases ?? []).map((item) => `${entry.id} / ${item.name}`),
    )
    .sort();
}

function collectOutcomes(report) {
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
  return outcomes.sort(
    (left, right) =>
      left.title.localeCompare(right.title) || left.project.localeCompare(right.project),
  );
}

function canonicalDigest({ outcomes, hashes }) {
  const canonical = {
    schemaVersion: "signal-playwright-canonical/1",
    browserContractSha256: hashes.browserContractSha256,
    fixtureManifestSha256: hashes.fixtureManifestSha256,
    playwrightConfigSha256: hashes.playwrightConfigSha256,
    playwrightSpecSha256: hashes.playwrightSpecSha256,
    outcomes: outcomes.map(({ title, project, expectedStatus, status, finalResultStatus, errorCount }) => ({
      title,
      project,
      expectedStatus,
      status,
      finalResultStatus,
      errorCount,
    })),
  };
  return sha256(JSON.stringify(canonical));
}

function buildAttestation(repoRoot, artifactFile = path.join(repoRoot, ARTIFACT_PATH)) {
  const rawArtifact = readFileSync(artifactFile);
  const report = JSON.parse(rawArtifact.toString("utf8"));
  const manifestFile = path.join(repoRoot, "experience", "critical-fixtures.json");
  const browserContractFile = path.join(repoRoot, "experience", "browser-contract.json");
  const specFile = path.join(repoRoot, "experience", "tests", "critical-experiences.spec.ts");
  const configFile = path.join(repoRoot, "experience", "playwright.config.ts");
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  const browserContract = JSON.parse(readFileSync(browserContractFile, "utf8"));
  const titles = expectedTitles(manifest);
  const projects = browserContract.projects.map((project) => project.name);
  const expectedPairs = titles
    .flatMap((title) => projects.map((project) => `${project}\u0000${title}`))
    .sort();
  const outcomes = collectOutcomes(report);
  const actualPairs = outcomes.map((outcome) => `${outcome.project}\u0000${outcome.title}`).sort();
  if (JSON.stringify(actualPairs) !== JSON.stringify(expectedPairs)) {
    throw new Error("Playwright report cases/projects do not exactly match the fixture manifest and browser contract");
  }
  const failed = outcomes.filter(
    (outcome) =>
      outcome.expectedStatus !== "passed" ||
      outcome.status !== "expected" ||
      outcome.finalResultStatus !== "passed" ||
      outcome.errorCount !== 0,
  );
  if (failed.length > 0 || report.stats?.unexpected !== 0 || report.stats?.skipped !== 0) {
    throw new Error(`Playwright report is not fully green (${failed.length} failed outcome records)`);
  }

  const hashes = {
    browserContractSha256: normalizedFileHash(browserContractFile),
    fixtureManifestSha256: normalizedFileHash(manifestFile),
    playwrightConfigSha256: normalizedFileHash(configFile),
    playwrightSpecSha256: normalizedFileHash(specFile),
  };
  const canonicalEvidenceSha256 = canonicalDigest({ outcomes, hashes });
  const rawArtifactSha256 = sha256(rawArtifact);
  const projectCounts = projects.map((name) => ({
    name,
    tests: outcomes.filter((outcome) => outcome.project === name).length,
  }));

  return {
    schemaVersion: "signal-playwright-attestation/1",
    runId: `tasks-playwright-${canonicalEvidenceSha256.slice(0, 24)}`,
    canonicalEvidenceSha256,
    rawArtifactSha256,
    artifactPath: ARTIFACT_PATH,
    ...hashes,
    projects: projectCounts,
    testCount: outcomes.length,
    passedCount: outcomes.length,
    unexpectedCount: report.stats?.unexpected ?? 0,
    startedAt: report.stats?.startTime,
  };
}

function verifyReceipts(repoRoot, attestation) {
  const reviewsDirectory = path.join(repoRoot, "experience", "reviews");
  if (!existsSync(reviewsDirectory)) return;
  const receipts = readdirSync(reviewsDirectory).filter((name) => name.endsWith(".json"));
  for (const name of receipts) {
    const evidencePath = `experience/reviews/${name}`;
    const { receipt } = validateMaterialityReceipt({ repoRoot, evidencePath });
    if (receipt.schemaVersion !== RECEIPT_SCHEMA) {
      throw new Error(`${name}: unsupported materiality receipt schema`);
    }
    if (
      receipt.playwrightEvidence.runId !== attestation.runId ||
      receipt.playwrightEvidence.canonicalEvidenceSha256 !==
        attestation.canonicalEvidenceSha256
    ) {
      throw new Error(`${name}: current browser run does not reproduce the reviewed canonical evidence`);
    }
  }
}

function runSelfTest() {
  const root = mkdtempSync(path.join(tmpdir(), "signal-tasks-playwright-attestation-"));
  try {
    mkdirSync(path.join(root, "experience", "tests"), { recursive: true });
    mkdirSync(path.join(root, "experience", "output"), { recursive: true });
    writeFileSync(
      path.join(root, "experience", "critical-fixtures.json"),
      JSON.stringify({
        experiences: [
          {
            id: "tasks.page.root",
            evidence: "rendered",
            cases: [{ name: "home", assertions: [], states: ["default"] }],
          },
        ],
      }),
    );
    writeFileSync(
      path.join(root, "experience", "browser-contract.json"),
      JSON.stringify({ projects: [{ name: "mobile" }, { name: "desktop" }] }),
    );
    writeFileSync(path.join(root, "experience", "playwright.config.ts"), "export default {}\n");
    writeFileSync(path.join(root, "experience", "tests", "critical-experiences.spec.ts"), "test\n");
    const report = (startedAt, duration, body) => ({
      suites: [
        {
          specs: [
            {
              title: "tasks.page.root / home",
              tests: ["mobile", "desktop"].map((projectName) => ({
                projectName,
                expectedStatus: "passed",
                status: "expected",
                results: [
                  {
                    status: "passed",
                    errors: [],
                    duration,
                    startTime: startedAt,
                    attachments: [{ body }],
                  },
                ],
              })),
            },
          ],
        },
      ],
      stats: { startTime: startedAt, skipped: 0, unexpected: 0 },
    });
    const artifactFile = path.join(root, ARTIFACT_PATH);
    writeFileSync(artifactFile, JSON.stringify(report("2026-01-01T00:00:00.000Z", 10, "one")));
    const first = buildAttestation(root, artifactFile);
    writeFileSync(artifactFile, JSON.stringify(report("2026-02-02T00:00:00.000Z", 999, "two")));
    const second = buildAttestation(root, artifactFile);
    if (first.rawArtifactSha256 === second.rawArtifactSha256) {
      throw new Error("self-test failed: raw artifact digest ignored volatile run bytes");
    }
    if (
      first.canonicalEvidenceSha256 !== second.canonicalEvidenceSha256 ||
      first.runId !== second.runId
    ) {
      throw new Error("self-test failed: canonical run identity changed with timestamps/durations/attachments");
    }
    const changedOutcome = canonicalDigest({
      outcomes: [
        {
          title: "tasks.page.root / home",
          project: "mobile",
          expectedStatus: "passed",
          status: "unexpected",
          finalResultStatus: "failed",
          errorCount: 1,
        },
      ],
      hashes: {
        browserContractSha256: first.browserContractSha256,
        fixtureManifestSha256: first.fixtureManifestSha256,
        playwrightConfigSha256: first.playwrightConfigSha256,
        playwrightSpecSha256: first.playwrightSpecSha256,
      },
    });
    if (changedOutcome === first.canonicalEvidenceSha256) {
      throw new Error("self-test failed: changed outcome did not change canonical digest");
    }

    mkdirSync(path.join(root, "experience", "evidence-runs"), { recursive: true });
    mkdirSync(path.join(root, "experience", "reviews"), { recursive: true });
    const recordPath = "experience/evidence-runs/self-test.json";
    const recordText = canonicalJson(first);
    writeFileSync(path.join(root, ...recordPath.split("/")), recordText);
    const receiptPath = path.join(root, "experience", "reviews", "self-test.json");
    const receipt = {
      schemaVersion: RECEIPT_SCHEMA,
      experienceId: "tasks.page.root",
      source: "tasks/src/app/page.tsx",
      materialityHash: "0".repeat(16),
      reviewedAt: "2026-07-15",
      reviewer: "self-test",
      playwrightEvidence: {
        attestationPath: recordPath,
        attestationSha256: sha256(recordText),
        runId: first.runId,
        canonicalEvidenceSha256: first.canonicalEvidenceSha256,
        rawArtifactSha256: first.rawArtifactSha256,
        artifactPath: first.artifactPath,
        fixtureId: "tasks.page.root",
        caseName: "home",
        projects: first.projects.map((project) => project.name),
      },
      reviewedChange: "Self-test evidence contract.",
      decision: "Accepted for self-test.",
    };
    writeFileSync(receiptPath, canonicalJson(receipt));
    verifyReceipts(root, first);
    receipt.playwrightEvidence.rawArtifactSha256 = "0".repeat(64);
    writeFileSync(receiptPath, canonicalJson(receipt));
    let rejected = false;
    try { verifyReceipts(root, first); } catch { rejected = true; }
    if (!rejected) throw new Error("self-test failed: receipt raw digest mismatch was accepted");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  console.log(
    "experience:attest:self-test: pass - raw digest is exact; canonical identity is reproducible; receipt linkage rejects tampering",
  );
}

const args = new Set(process.argv.slice(2).filter((argument) => argument !== "--"));
const knownArgs = new Set(["--self-test", "--verify-receipts", "--write-record"]);
for (const argument of args) {
  if (!knownArgs.has(argument)) throw new Error(`unknown argument ${argument}`);
}

if (args.has("--self-test")) {
  if (args.size !== 1) throw new Error("--self-test cannot be combined with other arguments");
  runSelfTest();
} else {
  const repoRoot = process.cwd();
  const attestation = buildAttestation(repoRoot);
  if (args.has("--verify-receipts")) verifyReceipts(repoRoot, attestation);
  const outputFile = path.join(repoRoot, OUTPUT_PATH);
  mkdirSync(path.dirname(outputFile), { recursive: true });
  writeFileSync(outputFile, `${JSON.stringify(attestation, null, 2)}\n`);
  if (args.has("--write-record")) {
    const recordPath = path.join(
      repoRoot,
      "experience",
      "evidence-runs",
      `${attestation.runId}-${attestation.rawArtifactSha256.slice(0, 16)}.json`,
    );
    mkdirSync(path.dirname(recordPath), { recursive: true });
    writeFileSync(recordPath, `${JSON.stringify(attestation, null, 2)}\n`);
    console.log(`experience:attest: wrote ${path.relative(repoRoot, recordPath).replaceAll("\\", "/")}`);
  }
  console.log(
    `experience:attest: ${attestation.testCount}/${attestation.testCount} passed, ` +
      `run ${attestation.runId}, raw ${attestation.rawArtifactSha256}`,
  );
}
