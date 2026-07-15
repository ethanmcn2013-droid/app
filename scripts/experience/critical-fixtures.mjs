#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const registryFile = path.join(root, "experience", "registry.json");
const fixturesFile = path.join(root, "experience", "critical-fixtures.json");
const browserContractFile = path.join(root, "experience", "browser-contract.json");
const registry = JSON.parse(readFileSync(registryFile, "utf8"));
const fixtures = JSON.parse(readFileSync(fixturesFile, "utf8"));
const browserContract = JSON.parse(readFileSync(browserContractFile, "utf8"));
const write = process.argv.includes("--write");
const selfTest = process.argv.includes("--self-test");
const errors = [];
const textExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const infrastructureStates = new Set(["keyboard-only", "long-content", "reduced-motion"]);
const assertionKinds = new Set(["role", "text", "url"]);
const assertionRoles = new Set(["button", "dialog", "heading", "link", "textbox"]);

function hashFile(file) {
  const bytes = readFileSync(file);
  const input = textExtensions.has(path.extname(file))
    ? bytes.toString("utf8").replace(/\r\n?/g, "\n")
    : bytes;
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function localSource(source) {
  const prefix = "tasks/";
  if (!source.startsWith(prefix)) return null;
  return path.join(root, ...source.slice(prefix.length).split("/"));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasExactKeys(value, expectedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validateBrowserContract(manifest, contract, targetErrors) {
  if (contract.schemaVersion !== "signal-experience-browser/1") {
    targetErrors.push("browser contract schema must be signal-experience-browser/1");
  }
  const determinismKeys = [
    "accessMode",
    "animationPolicy",
    "colorScheme",
    "deploymentEnvironment",
    "locale",
    "reducedMotion",
    "timezoneId",
  ];
  const exactDeterminism = {
    accessMode: "demo",
    animationPolicy: "disabled",
    colorScheme: "light",
    deploymentEnvironment: "preview",
    locale: "en-GB",
    reducedMotion: "reduce",
    timezoneId: "Europe/London",
  };
  if (!hasExactKeys(contract.determinism, determinismKeys)) {
    targetErrors.push("browser contract determinism fields are incomplete or contain unknown keys");
  } else {
    for (const key of determinismKeys) {
      if (contract.determinism[key] !== exactDeterminism[key]) {
        targetErrors.push(
          `browser contract determinism ${key} must be ${JSON.stringify(exactDeterminism[key])}`,
        );
      }
    }
  }
  if (!hasExactKeys(manifest.determinism, determinismKeys)) {
    targetErrors.push("fixture determinism fields are incomplete or contain unknown keys");
  } else {
    for (const key of determinismKeys) {
      if (manifest.determinism[key] !== contract.determinism?.[key]) {
        targetErrors.push(
          `fixture determinism ${key} must equal browser contract ${JSON.stringify(contract.determinism?.[key])}`,
        );
      }
    }
  }

  if (!Array.isArray(contract.projects) || contract.projects.length === 0) {
    targetErrors.push("browser contract must declare at least one Playwright project");
    return;
  }
  const projectNames = [];
  const seen = new Set();
  for (const [index, project] of contract.projects.entries()) {
    if (!hasExactKeys(project, ["name", "viewport"])) {
      targetErrors.push(`browser project ${index + 1} must contain only name and viewport`);
      continue;
    }
    if (!isNonEmptyString(project.name) || seen.has(project.name)) {
      targetErrors.push(`browser project ${index + 1} has a missing or duplicate name`);
      continue;
    }
    seen.add(project.name);
    projectNames.push(project.name);
    if (
      !hasExactKeys(project.viewport, ["height", "width"]) ||
      !Number.isInteger(project.viewport.width) ||
      !Number.isInteger(project.viewport.height) ||
      project.viewport.width <= 0 ||
      project.viewport.height <= 0
    ) {
      targetErrors.push(`${project.name}: browser project viewport must contain positive integer width and height`);
      continue;
    }
    const registered = registry.breakpoints?.[project.name];
    if (
      !registered ||
      registered.width !== project.viewport.width ||
      registered.height !== project.viewport.height
    ) {
      targetErrors.push(
        `${project.name}: Playwright viewport must exactly match the registry breakpoint`,
      );
    }
  }
  if (
    !Array.isArray(manifest.breakpoints) ||
    manifest.breakpoints.length !== projectNames.length ||
    manifest.breakpoints.some((name, index) => name !== projectNames[index])
  ) {
    targetErrors.push(
      `fixture breakpoints must exactly match Playwright projects in order: ${projectNames.join(", ")}`,
    );
  }
}

function validateRenderedAssertions(unit, label, targetErrors) {
  if (!Array.isArray(unit.states) || unit.states.length === 0) {
    targetErrors.push(`${label}: rendered evidence states are required`);
    return;
  }
  if (new Set(unit.states).size !== unit.states.length) {
    targetErrors.push(`${label}: rendered evidence states must be unique`);
  }
  if (!Array.isArray(unit.assertions) || unit.assertions.length === 0) {
    targetErrors.push(`${label}: executable state assertions are required`);
    return;
  }

  const provedStates = new Set();
  const seenAssertions = new Set();
  for (const [index, assertion] of unit.assertions.entries()) {
    const assertionLabel = `${label}: assertion ${index + 1}`;
    if (!assertion || typeof assertion !== "object" || Array.isArray(assertion)) {
      targetErrors.push(`${assertionLabel} must be an object`);
      continue;
    }
    const signature = JSON.stringify(assertion);
    if (seenAssertions.has(signature)) targetErrors.push(`${assertionLabel} is duplicated`);
    seenAssertions.add(signature);
    if (!assertionKinds.has(assertion.kind)) {
      targetErrors.push(`${assertionLabel} has unknown kind ${assertion.kind}`);
      continue;
    }
    if (!Array.isArray(assertion.proves) || assertion.proves.length === 0) {
      targetErrors.push(`${assertionLabel} must declare at least one proved state`);
    } else {
      for (const state of assertion.proves) {
        if (!unit.states.includes(state)) {
          targetErrors.push(`${assertionLabel} proves undeclared state ${state}`);
        } else {
          provedStates.add(state);
        }
      }
    }

    if (assertion.kind === "url") {
      if (!hasExactKeys(assertion, ["kind", "pathname", "proves"])) {
        targetErrors.push(`${assertionLabel} URL assertion has missing or unknown fields`);
      }
      if (!isNonEmptyString(assertion.pathname) || !assertion.pathname.startsWith("/")) {
        targetErrors.push(`${assertionLabel} pathname must start with /`);
      }
      continue;
    }
    if (assertion.kind === "text") {
      if (!hasExactKeys(assertion, ["kind", "proves", "text"])) {
        targetErrors.push(`${assertionLabel} text assertion has missing or unknown fields`);
      }
      if (!isNonEmptyString(assertion.text)) {
        targetErrors.push(`${assertionLabel} text must be non-empty`);
      }
      continue;
    }

    const allowedRoleKeys = new Set([
      "count",
      "disabled",
      "href",
      "kind",
      "name",
      "proves",
      "role",
      "value",
    ]);
    for (const key of Object.keys(assertion)) {
      if (!allowedRoleKeys.has(key)) targetErrors.push(`${assertionLabel} role assertion has unknown field ${key}`);
    }
    if (!assertionRoles.has(assertion.role)) {
      targetErrors.push(`${assertionLabel} has unsupported role ${assertion.role}`);
    }
    if (assertion.name !== undefined && !isNonEmptyString(assertion.name)) {
      targetErrors.push(`${assertionLabel} name must be non-empty when provided`);
    }
    if (
      assertion.count !== undefined &&
      (!Number.isInteger(assertion.count) || assertion.count < 0)
    ) {
      targetErrors.push(`${assertionLabel} count must be a non-negative integer`);
    }
    if (assertion.disabled !== undefined && typeof assertion.disabled !== "boolean") {
      targetErrors.push(`${assertionLabel} disabled must be boolean`);
    }
    if (assertion.value !== undefined && typeof assertion.value !== "string") {
      targetErrors.push(`${assertionLabel} value must be a string`);
    }
    if (assertion.href !== undefined && (!isNonEmptyString(assertion.href) || !assertion.href.startsWith("/"))) {
      targetErrors.push(`${assertionLabel} href must be a root-relative path`);
    }
    if (
      assertion.name === undefined &&
      assertion.value === undefined &&
      assertion.href === undefined &&
      assertion.disabled === undefined &&
      assertion.count !== 0
    ) {
      targetErrors.push(`${assertionLabel} must identify a route-specific role state`);
    }
    if (
      assertion.count === 0 &&
      (assertion.disabled !== undefined || assertion.value !== undefined || assertion.href !== undefined)
    ) {
      targetErrors.push(`${assertionLabel} absent role cannot assert disabled, value, or href`);
    }
  }

  for (const state of unit.states) {
    if (!infrastructureStates.has(state) && !provedStates.has(state)) {
      targetErrors.push(`${label}: state ${state} lacks an executable assertion`);
    }
  }
}

function validateSourceContract(fixture, entry, targetErrors) {
  if (!Array.isArray(fixture.sourceAssertions) || fixture.sourceAssertions.length === 0) {
    targetErrors.push(`${fixture.id}: source contract assertions are required`);
    return;
  }

  const sourceFile = localSource(entry.source);
  if (!sourceFile || !existsSync(sourceFile)) {
    targetErrors.push(`${fixture.id}: source contract file is missing (${entry.source})`);
    return;
  }

  const source = readFileSync(sourceFile, "utf8").replace(/\r\n?/g, "\n");
  const seenLiterals = new Set();
  for (const [index, assertion] of fixture.sourceAssertions.entries()) {
    const label = assertion?.label;
    const literal = assertion?.contains;
    if (!assertion || typeof assertion !== "object" || Array.isArray(assertion)) {
      targetErrors.push(`${fixture.id}: source assertion ${index + 1} must be an object`);
      continue;
    }
    if (!isNonEmptyString(label)) {
      targetErrors.push(`${fixture.id}: source assertion ${index + 1} needs a label`);
    }
    if (!isNonEmptyString(literal)) {
      targetErrors.push(`${fixture.id}: source assertion ${index + 1} needs a contains literal`);
      continue;
    }
    if (seenLiterals.has(literal)) {
      targetErrors.push(`${fixture.id}: duplicate source assertion literal ${JSON.stringify(literal)}`);
      continue;
    }
    seenLiterals.add(literal);
    if (!source.includes(literal.replace(/\r\n?/g, "\n"))) {
      targetErrors.push(
        `${fixture.id}: source contract ${JSON.stringify(label)} is absent from ${entry.source}; ` +
          `missing literal ${JSON.stringify(literal)}`,
      );
    }
  }
}

function applyMappedFixtureEvidence(targetRegistry, mappedFixtures, reviewedAt, targetErrors) {
  targetRegistry.generatedAt = reviewedAt;
  for (const entry of targetRegistry.experiences) {
    const fixture = mappedFixtures.get(entry.id);
    if (!fixture) continue;

    const sourceFile = localSource(entry.source);
    if (!sourceFile || !existsSync(sourceFile)) {
      targetErrors.push(`${entry.id}: source is missing (${entry.source})`);
      continue;
    }

    // A write is an explicit review action for mapped critical fixtures only.
    // Unmapped/core/supporting entries retain their prior hash and review state,
    // so validate.mjs can still catch drift on those sources.
    entry.materialityHash = hashFile(sourceFile);
    entry.automatedTestCoverage = "partial";
    entry.lastReviewedAt = reviewedAt;
    if (fixture.evidence === "rendered") {
      entry.fixtureCoverage = "partial";
      entry.screenshotCoverage = "partial";
      entry.accessibilityCoverage = "partial";
    } else {
      entry.fixtureCoverage = "none";
      entry.screenshotCoverage = "none";
      entry.accessibilityCoverage = "none";
    }
    entry.approvedBaselineReference = null;
  }
}

if (fixtures.schemaVersion !== "signal-experience-fixtures/1") {
  errors.push("fixture schema must be signal-experience-fixtures/1");
}
if (fixtures.product !== "tasks") errors.push("fixture product must be tasks");
if (!/^\d{4}-\d{2}-\d{2}$/.test(fixtures.generatedAt ?? "")) {
  errors.push("fixture generatedAt must be YYYY-MM-DD");
}
if (!Array.isArray(fixtures.experiences)) {
  errors.push("fixture experiences must be an array");
}
validateBrowserContract(fixtures, browserContract, errors);

const critical = registry.experiences.filter((entry) => entry.reviewTier === "critical");
const criticalById = new Map(critical.map((entry) => [entry.id, entry]));
const fixtureById = new Map();

for (const fixture of fixtures.experiences ?? []) {
  if (fixtureById.has(fixture.id)) errors.push(`${fixture.id}: duplicate fixture`);
  fixtureById.set(fixture.id, fixture);
  const entry = criticalById.get(fixture.id);
  if (!entry) {
    errors.push(`${fixture.id}: fixture does not map to a critical Tasks experience`);
    continue;
  }
  if (!new Set(["rendered", "source-contract"]).has(fixture.evidence)) {
    errors.push(`${fixture.id}: evidence must be rendered or source-contract`);
  }

  const coveredStates = new Set(
    fixture.evidence === "rendered"
      ? fixture.interaction
        ? fixture.states ?? []
        : (fixture.cases ?? []).flatMap((item) => item.states ?? [])
      : [],
  );
  const remainingStates = new Set(fixture.remainingStates ?? []);
  for (const state of [...coveredStates, ...remainingStates]) {
    if (!entry.requiredStates.includes(state)) {
      errors.push(`${fixture.id}: undeclared state ${state}`);
    }
  }
  for (const state of entry.requiredStates) {
    if (!coveredStates.has(state) && !remainingStates.has(state)) {
      errors.push(`${fixture.id}: state ${state} is neither evidenced nor remaining`);
    }
  }
  for (const state of coveredStates) {
    if (remainingStates.has(state)) {
      errors.push(`${fixture.id}: state ${state} is both evidenced and remaining`);
    }
  }

  if (fixture.evidence === "rendered" && !fixture.interaction) {
    if (!Array.isArray(fixture.cases) || fixture.cases.length === 0) {
      errors.push(`${fixture.id}: rendered route fixture needs at least one case`);
    }
    for (const item of fixture.cases ?? []) {
      const caseLabel = `${fixture.id} / ${item.name ?? "<missing-name>"}`;
      if (!isNonEmptyString(item.name)) errors.push(`${fixture.id}: fixture case name is required`);
      if (typeof item.path !== "string" || !item.path.startsWith("/")) {
        errors.push(`${fixture.id}: fixture path must start with /`);
      }
      if (
        item.expectedStatus !== undefined &&
        (!Number.isInteger(item.expectedStatus) || item.expectedStatus < 100 || item.expectedStatus > 599)
      ) {
        errors.push(`${fixture.id}: invalid expectedStatus`);
      }
      validateRenderedAssertions(item, caseLabel, errors);
    }
  }
  if (fixture.evidence === "rendered" && fixture.interaction) {
    if (!new Set(["command-palette", "quick-create", "task-detail-panel"]).has(fixture.interaction)) {
      errors.push(`${fixture.id}: unknown interaction ${fixture.interaction}`);
    }
    if (!isNonEmptyString(fixture.caseName)) {
      errors.push(`${fixture.id}: rendered interaction caseName is required`);
    }
    if (fixture.cases !== undefined) {
      errors.push(`${fixture.id}: rendered interaction must not also declare route cases`);
    }
    validateRenderedAssertions(fixture, `${fixture.id} / ${fixture.interaction}`, errors);
  }
  if (fixture.evidence === "source-contract") validateSourceContract(fixture, entry, errors);
}

for (const entry of critical) {
  if (!fixtureById.has(entry.id)) errors.push(`${entry.id}: missing critical fixture mapping`);
}

const nextRegistry = structuredClone(registry);
applyMappedFixtureEvidence(nextRegistry, fixtureById, fixtures.generatedAt, errors);

if (selfTest) {
  const mapped = nextRegistry.experiences.find((entry) => fixtureById.has(entry.id));
  const unmapped = registry.experiences.find((entry) => !fixtureById.has(entry.id));
  if (!mapped || !unmapped) throw new Error("self-test needs mapped and unmapped registry entries");

  const probe = structuredClone(registry);
  const probeMapped = probe.experiences.find((entry) => entry.id === mapped.id);
  const probeUnmapped = probe.experiences.find((entry) => entry.id === unmapped.id);
  const unmappedBefore = JSON.stringify(probeUnmapped);
  probeMapped.materialityHash = "0000000000000000";
  applyMappedFixtureEvidence(probe, fixtureById, fixtures.generatedAt, []);
  if (probeMapped.materialityHash === "0000000000000000") {
    throw new Error("self-test failed: mapped materiality hash was not refreshed");
  }
  if (JSON.stringify(probeUnmapped) !== unmappedBefore) {
    throw new Error("self-test failed: unmapped registry entry was mutated");
  }

  const sourceFixture = fixtures.experiences.find((entry) => entry.evidence === "source-contract");
  const sourceEntry = sourceFixture ? criticalById.get(sourceFixture.id) : null;
  if (!sourceFixture || !sourceEntry) throw new Error("self-test needs a source-contract fixture");
  const assertionErrors = [];
  validateSourceContract(
    {
      ...sourceFixture,
      sourceAssertions: [
        { label: "deliberately missing contract", contains: "__missing_contract_literal__" },
      ],
    },
    sourceEntry,
    assertionErrors,
  );
  if (!assertionErrors.some((error) => error.includes("missing literal"))) {
    throw new Error("self-test failed: absent source-contract literal was not rejected");
  }

  const renderedAssertionErrors = [];
  validateRenderedAssertions(
    {
      states: ["success"],
      assertions: [{ kind: "text", text: "Looks successful", proves: ["default"] }],
    },
    "self-test rendered state",
    renderedAssertionErrors,
  );
  if (!renderedAssertionErrors.some((error) => error.includes("undeclared state"))) {
    throw new Error("self-test failed: mislabeled rendered state assertion was not rejected");
  }

  const browserContractErrors = [];
  validateBrowserContract(
    { ...fixtures, breakpoints: [...fixtures.breakpoints].reverse() },
    browserContract,
    browserContractErrors,
  );
  if (!browserContractErrors.some((error) => error.includes("exactly match Playwright projects"))) {
    throw new Error("self-test failed: Playwright project drift was not rejected");
  }

  console.log(
    "experience:critical-fixtures:self-test: pass - mapped-only writes, source literals, rendered states, and browser-project parity are enforced",
  );
  process.exit(0);
}

if (errors.length) {
  console.error(
    `experience:critical-fixtures: ${errors.length} failure(s)\n` +
      errors.map((error) => `  x ${error}`).join("\n"),
  );
  process.exit(1);
}

const expectedRegistry = `${JSON.stringify(nextRegistry, null, 2)}\n`;
if (write) {
  writeFileSync(registryFile, expectedRegistry);
} else if (readFileSync(registryFile, "utf8") !== expectedRegistry) {
  console.error(
    "experience:critical-fixtures: registry coverage or materiality hashes are stale; run with --write",
  );
  process.exit(1);
}

const rendered = fixtures.experiences.filter((entry) => entry.evidence === "rendered");
const routeCases = rendered.reduce((sum, entry) => sum + (entry.cases?.length ?? 1), 0);
console.log(
  `experience:critical-fixtures: clean - ${critical.length}/${critical.length} critical experiences mapped, ` +
    `${rendered.length} rendered, ${critical.length - rendered.length} source-contract, ` +
    `${routeCases} deterministic cases x ${fixtures.breakpoints.length} breakpoints`,
);
