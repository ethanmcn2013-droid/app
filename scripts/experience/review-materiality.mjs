#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ARTIFACT_PATH,
  ATTESTATION_SCHEMA,
  RECEIPT_SCHEMA,
  canonicalEvidenceDigest,
  canonicalJson,
  normalizedFileHash,
  playwrightEvidenceFromAttestation,
  readCanonicalJson,
  sha256,
  validateMaterialityReceipt,
} from "./materiality-receipt.mjs";

const PRODUCT_ID = "tasks";
const TEXT_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);

function hashFile(file) {
  const bytes = readFileSync(file);
  const input = TEXT_EXTENSIONS.has(path.extname(file))
    ? bytes.toString("utf8").replace(/\r\n?/g, "\n")
    : bytes;
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function parseArgs(argv) {
  const result = { selfTest: false };
  const names = new Map([
    ["--id", "id"],
    ["--evidence", "evidence"],
    ["--attestation", "attestation"],
    ["--fixture-id", "fixtureId"],
    ["--case-name", "caseName"],
    ["--reviewer", "reviewer"],
    ["--change", "reviewedChange"],
    ["--decision", "decision"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") continue;
    if (argument === "--self-test") {
      result.selfTest = true;
      continue;
    }
    const key = names.get(argument);
    if (!key) throw new Error(`unknown argument ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`);
    if (result[key] !== undefined) throw new Error(`${argument} may be provided only once`);
    result[key] = value;
    index += 1;
  }
  return result;
}

function resolveSource(repoRoot, source) {
  if (typeof source !== "string" || !source.startsWith(`${PRODUCT_ID}/`)) return null;
  const absolute = path.resolve(repoRoot, source.slice(PRODUCT_ID.length + 1).replaceAll("/", path.sep));
  const rootPrefix = `${path.resolve(repoRoot)}${path.sep}`;
  return absolute.startsWith(rootPrefix) ? absolute : null;
}

function resolveReceiptOutput(repoRoot, evidence) {
  if (
    typeof evidence !== "string" ||
    evidence.trim() !== evidence ||
    path.isAbsolute(evidence) ||
    evidence.includes("\\") ||
    !evidence.startsWith("experience/reviews/") ||
    !evidence.endsWith(".json")
  ) {
    return null;
  }
  const absolute = path.resolve(repoRoot, ...evidence.split("/"));
  const reviewRoot = `${path.resolve(repoRoot, "experience", "reviews")}${path.sep}`;
  return absolute.startsWith(reviewRoot) ? absolute : null;
}

function requiredValue(value, label) {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    throw new Error(`${label} is required for a new receipt`);
  }
  return value;
}

function performReview({ registry, fixtures, repoRoot, args, reviewedAt }) {
  const { id, evidence } = args;
  if (typeof id !== "string" || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(id)) {
    throw new Error("--id must be one exact stable experience ID; wildcards are not allowed");
  }
  const matches = registry.experiences.filter((entry) => entry.id === id);
  if (matches.length !== 1) throw new Error(`${id}: expected exactly one registry entry`);
  if (fixtures.experiences.some((fixture) => fixture.id === id)) {
    throw new Error(`${id}: mapped critical fixtures must be reviewed with experience:fixtures:write`);
  }
  const sourceFile = resolveSource(repoRoot, matches[0].source);
  if (!sourceFile || !existsSync(sourceFile) || !statSync(sourceFile).isFile()) {
    throw new Error(`${id}: source is missing (${matches[0].source})`);
  }
  const receiptFile = resolveReceiptOutput(repoRoot, evidence);
  if (!receiptFile) {
    throw new Error(`${id}: --evidence must be a JSON path under experience/reviews/`);
  }

  let previous = null;
  if (existsSync(receiptFile)) previous = readCanonicalJson(receiptFile, `${evidence} receipt`).value;
  if (previous && (previous.experienceId !== id || previous.source !== matches[0].source)) {
    throw new Error(`${id}: existing receipt belongs to a different experience or source`);
  }
  const attestationPath = requiredValue(
    args.attestation ?? previous?.playwrightEvidence?.attestationPath,
    "--attestation",
  );
  const fixtureId = requiredValue(
    args.fixtureId ?? previous?.playwrightEvidence?.fixtureId,
    "--fixture-id",
  );
  const caseName = requiredValue(
    args.caseName ?? previous?.playwrightEvidence?.caseName,
    "--case-name",
  );
  const reviewer = requiredValue(args.reviewer ?? previous?.reviewer, "--reviewer");
  const reviewedChange = requiredValue(
    args.reviewedChange ?? previous?.reviewedChange,
    "--change",
  );
  const decision = requiredValue(args.decision ?? previous?.decision, "--decision");
  const materialityHash = hashFile(sourceFile);
  const receipt = {
    schemaVersion: RECEIPT_SCHEMA,
    experienceId: id,
    source: matches[0].source,
    materialityHash,
    reviewedAt,
    reviewer,
    playwrightEvidence: playwrightEvidenceFromAttestation({
      repoRoot,
      attestationPath,
      experienceId: id,
      fixtureId,
      caseName,
      requireArtifact: true,
    }),
    reviewedChange,
    decision,
  };
  mkdirSync(path.dirname(receiptFile), { recursive: true });
  writeFileSync(receiptFile, canonicalJson(receipt));
  validateMaterialityReceipt({
    repoRoot,
    evidencePath: evidence,
    expected: { experienceId: id, source: matches[0].source, materialityHash, reviewedAt },
    requireArtifact: true,
  });

  const nextRegistry = structuredClone(registry);
  const entry = nextRegistry.experiences.find((candidate) => candidate.id === id);
  entry.materialityHash = materialityHash;
  entry.lastReviewedAt = reviewedAt;
  entry.materialityReview = { materialityHash, reviewedAt, evidence };
  return { nextRegistry, materialityHash };
}

function runSelfTest() {
  const root = mkdtempSync(path.join(tmpdir(), "signal-tasks-materiality-review-"));
  try {
    for (const directory of [
      "src/app/app/tasks",
      "src/app",
      "experience/reviews",
      "experience/evidence-runs",
      "experience/output",
      "experience/tests",
    ]) mkdirSync(path.join(root, ...directory.split("/")), { recursive: true });
    const sourceFile = path.join(root, "src", "app", "app", "tasks", "page.tsx");
    writeFileSync(sourceFile, "export default function Board(){return null}\n");
    writeFileSync(path.join(root, "src", "app", "page.tsx"), "export default function Root(){return null}\n");
    writeFileSync(
      path.join(root, "experience", "browser-contract.json"),
      canonicalJson({ projects: ["mobile", "tablet", "desktop", "wide"].map((name) => ({ name })) }),
    );
    writeFileSync(
      path.join(root, "experience", "critical-fixtures.json"),
      canonicalJson({
        experiences: [
          {
            id: "tasks.page.app",
            evidence: "source-contract",
          },
          { id: "tasks.page.root", evidence: "source-contract" },
        ],
        supplementalCoreRendered: [{ id: "tasks.page.app-tasks", source: "tasks/src/app/app/tasks/page.tsx",
          evidence: "rendered", path: "/app/tasks", caseName: "populated demo workspace",
          states: ["default"], assertions: [{ kind: "role", role: "heading", name: "Tasks", proves: ["default"] }] }],
      }),
    );
    writeFileSync(path.join(root, "experience", "playwright.config.ts"), "export default {}\n");
    writeFileSync(path.join(root, "experience", "tests", "critical-experiences.spec.ts"), "test\n");
    const artifactFile = path.join(root, ...ARTIFACT_PATH.split("/"));
    writeFileSync(artifactFile, JSON.stringify({ suites: [{ specs: [{
      title: "tasks.page.app-tasks / populated demo workspace",
      tests: ["mobile", "tablet", "desktop", "wide"].map((projectName) => ({ projectName, expectedStatus: "passed",
        status: "expected", results: [{ status: "passed", errors: [] }] })),
    }] }], stats: { unexpected: 0, skipped: 0 } }));
    const outcomes = ["desktop", "mobile", "tablet", "wide"].map((project) => ({
      title: "tasks.page.app-tasks / populated demo workspace",
      project,
      expectedStatus: "passed",
      status: "expected",
      finalResultStatus: "passed",
      errorCount: 0,
    }));
    const hashes = {
      browserContractSha256: normalizedFileHash(path.join(root, "experience", "browser-contract.json")),
      fixtureManifestSha256: normalizedFileHash(path.join(root, "experience", "critical-fixtures.json")),
      playwrightConfigSha256: normalizedFileHash(path.join(root, "experience", "playwright.config.ts")),
      playwrightSpecSha256: normalizedFileHash(path.join(root, "experience", "tests", "critical-experiences.spec.ts")),
    };
    const canonicalEvidenceSha256 = canonicalEvidenceDigest({ outcomes, hashes });
    const attestation = {
      schemaVersion: ATTESTATION_SCHEMA,
      runId: `tasks-playwright-${canonicalEvidenceSha256.slice(0, 24)}`,
      canonicalEvidenceSha256,
      rawArtifactSha256: sha256(readFileSync(artifactFile)),
      artifactPath: ARTIFACT_PATH,
      ...hashes,
      outcomes,
      projects: ["mobile", "tablet", "desktop", "wide"].map((name) => ({ name, tests: 1 })),
      testCount: 4,
      passedCount: 4,
      unexpectedCount: 0,
      startedAt: "2026-07-15T00:00:00.000Z",
    };
    const attestationPath = "experience/evidence-runs/self-test.json";
    writeFileSync(path.join(root, ...attestationPath.split("/")), canonicalJson(attestation));
    const evidence = "experience/reviews/self-test.json";
    const registry = {
      experiences: [
        { id: "tasks.page.app-tasks", source: "tasks/src/app/app/tasks/page.tsx", reviewTier: "core" },
        { id: "tasks.page.root", source: "tasks/src/app/page.tsx" },
      ],
    };
    writeFileSync(path.join(root, "experience", "registry.json"), canonicalJson(registry));
    const fixtures = JSON.parse(readFileSync(path.join(root, "experience", "critical-fixtures.json"), "utf8"));
    const commonArgs = {
      id: "tasks.page.app-tasks",
      evidence,
      attestation: attestationPath,
      fixtureId: "tasks.page.app-tasks",
      caseName: "populated demo workspace",
      reviewer: "self-test",
      reviewedChange: "Deterministic review-mode source isolation.",
      decision: "Accepted after exact browser evidence passed.",
    };
    const untouched = JSON.stringify(registry.experiences[1]);
    const { nextRegistry, materialityHash } = performReview({
      registry,
      fixtures,
      repoRoot: root,
      args: commonArgs,
      reviewedAt: "2026-07-15",
    });
    if (
      nextRegistry.experiences[0].materialityReview?.materialityHash !== materialityHash ||
      JSON.stringify(nextRegistry.experiences[1]) !== untouched
    ) throw new Error("self-test failed: exact targeted review did not update only one entry");

    const receiptFile = path.join(root, ...evidence.split("/"));
    const validReceipt = JSON.parse(readFileSync(receiptFile, "utf8"));
    const rawArtifact = readFileSync(artifactFile);
    rmSync(artifactFile);
    validateMaterialityReceipt({ repoRoot: root, evidencePath: evidence });
    let missingRawRejected = false;
    try { validateMaterialityReceipt({ repoRoot: root, evidencePath: evidence, requireArtifact: true }); }
    catch { missingRawRejected = true; }
    if (!missingRawRejected) throw new Error("self-test failed: review creation accepted absent raw outcome evidence");
    writeFileSync(artifactFile, rawArtifact);
    for (const [label, mutate] of [
      ["extra receipt field", (value) => { value.extra = true; }],
      ["raw digest mismatch", (value) => { value.playwrightEvidence.rawArtifactSha256 = "0".repeat(64); }],
      ["attestation hash mismatch", (value) => { value.playwrightEvidence.attestationSha256 = "0".repeat(64); }],
    ]) {
      const tampered = structuredClone(validReceipt);
      mutate(tampered);
      writeFileSync(receiptFile, canonicalJson(tampered));
      let caught = false;
      try { validateMaterialityReceipt({ repoRoot: root, evidencePath: evidence }); } catch { caught = true; }
      if (!caught) throw new Error(`self-test failed: ${label} was accepted`);
    }
    writeFileSync(receiptFile, canonicalJson(validReceipt));
    const unrelatedReceipt = { ...validReceipt, experienceId: "tasks.page.root" };
    writeFileSync(receiptFile, canonicalJson(unrelatedReceipt));
    let overwriteRejected = false;
    try { performReview({ registry, fixtures, repoRoot: root, args: commonArgs, reviewedAt: "2026-07-15" }); }
    catch { overwriteRejected = true; }
    if (!overwriteRejected) throw new Error("self-test failed: unrelated receipt was overwritten");
    writeFileSync(receiptFile, canonicalJson(validReceipt));

    // Rebind all hashes around a forged raw report missing one viewport;
    // the exact supplemental outcome check must still refuse it.
    const validArtifact = readFileSync(artifactFile);
    const validRecord = JSON.parse(readFileSync(path.join(root, ...attestationPath.split("/")), "utf8"));
    const missingRecordedViewport = { ...validRecord, outcomes: validRecord.outcomes.slice(1) };
    missingRecordedViewport.canonicalEvidenceSha256 = canonicalEvidenceDigest({
      outcomes: missingRecordedViewport.outcomes,
      hashes,
    });
    missingRecordedViewport.runId = `tasks-playwright-${missingRecordedViewport.canonicalEvidenceSha256.slice(0, 24)}`;
    const missingRecordedText = canonicalJson(missingRecordedViewport);
    writeFileSync(path.join(root, ...attestationPath.split("/")), missingRecordedText);
    writeFileSync(receiptFile, canonicalJson({ ...validReceipt, playwrightEvidence: {
      ...validReceipt.playwrightEvidence,
      runId: missingRecordedViewport.runId,
      canonicalEvidenceSha256: missingRecordedViewport.canonicalEvidenceSha256,
      attestationSha256: sha256(missingRecordedText),
    } }));
    let missingRecordedRejected = false;
    try { validateMaterialityReceipt({ repoRoot: root, evidencePath: evidence }); }
    catch { missingRecordedRejected = true; }
    if (!missingRecordedRejected) throw new Error("self-test failed: hash-rebound missing viewport outcome was accepted");
    writeFileSync(path.join(root, ...attestationPath.split("/")), canonicalJson(validRecord));
    writeFileSync(receiptFile, canonicalJson(validReceipt));
    const missingViewport = JSON.parse(validArtifact.toString("utf8"));
    missingViewport.suites[0].specs[0].tests.pop();
    const missingBytes = Buffer.from(JSON.stringify(missingViewport));
    writeFileSync(artifactFile, missingBytes);
    const changedRecord = { ...validRecord, rawArtifactSha256: sha256(missingBytes) };
    const changedRecordText = canonicalJson(changedRecord);
    writeFileSync(path.join(root, ...attestationPath.split("/")), changedRecordText);
    writeFileSync(receiptFile, canonicalJson({ ...validReceipt, playwrightEvidence: {
      ...validReceipt.playwrightEvidence,
      rawArtifactSha256: changedRecord.rawArtifactSha256,
      attestationSha256: sha256(changedRecordText),
    } }));
    let missingViewportRejected = false;
    try { validateMaterialityReceipt({ repoRoot: root, evidencePath: evidence, requireArtifact: true }); }
    catch { missingViewportRejected = true; }
    if (!missingViewportRejected) throw new Error("self-test failed: supplemental case missing one viewport was accepted");
    writeFileSync(artifactFile, validArtifact);
    writeFileSync(path.join(root, ...attestationPath.split("/")), canonicalJson(validRecord));
    writeFileSync(receiptFile, canonicalJson(validReceipt));
    for (const [id, message] of [
      ["tasks.page.*", "wildcard ID"],
      ["tasks.page.root", "mapped critical fixture"],
    ]) {
      let caught = false;
      try {
        performReview({ registry, fixtures, repoRoot: root, args: { ...commonArgs, id }, reviewedAt: "2026-07-15" });
      } catch { caught = true; }
      if (!caught) throw new Error(`self-test failed: ${message} was accepted`);
    }
    let unrelatedRejected = false;
    try { performReview({ registry, fixtures, repoRoot: root,
      args: { ...commonArgs, fixtureId: "tasks.page.app" }, reviewedAt: "2026-07-15" }); }
    catch { unrelatedRejected = true; }
    if (!unrelatedRejected) throw new Error("self-test failed: unrelated critical fixture was accepted for core review");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  console.log(
    "experience:review-materiality:self-test: pass - exact JSON receipt, attestation link, raw digest, and target isolation enforced",
  );
}

const args = parseArgs(process.argv.slice(2));
if (args.selfTest) {
  if (Object.keys(args).length !== 1) throw new Error("--self-test cannot be combined with review arguments");
  runSelfTest();
} else {
  if (!args.id || !args.evidence) {
    throw new Error(
      "usage: review-materiality.mjs --id <exact-id> --evidence experience/reviews/<receipt>.json --attestation experience/evidence-runs/<record>.json [receipt metadata]",
    );
  }
  const repoRoot = process.cwd();
  const registryFile = path.join(repoRoot, "experience", "registry.json");
  const registry = JSON.parse(readFileSync(registryFile, "utf8"));
  const fixtures = JSON.parse(readFileSync(path.join(repoRoot, "experience", "critical-fixtures.json"), "utf8"));
  const reviewedAt = new Date().toISOString().slice(0, 10);
  const { nextRegistry, materialityHash } = performReview({ registry, fixtures, repoRoot, args, reviewedAt });
  writeFileSync(registryFile, canonicalJson(nextRegistry));
  console.log(`experience:review-materiality: reviewed ${args.id} at ${materialityHash} using ${args.evidence}`);
}
