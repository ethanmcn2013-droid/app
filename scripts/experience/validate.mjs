#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateMaterialityReceipt } from "./materiality-receipt.mjs";

const EXPERIENCE_SCHEMA_VERSION = "signal-experience/1";
const PRODUCT_ID = "tasks";
const REQUIRED_BREAKPOINTS = ["mobile", "tablet", "desktop", "wide"];
const SPECIAL_FILES = new Map([
  ["page", "page"],
  ["loading", "loading"],
  ["error", "error"],
  ["not-found", "error"],
]);
const PAGE_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js"]);
const SKIP_DIRECTORIES = new Set([
  ".git",
  ".next",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);

const SURFACE_TYPES = new Set([
  "page",
  "nested-view",
  "embedded-workspace",
  "dialog",
  "drawer",
  "popover",
  "menu",
  "command-palette",
  "onboarding",
  "authentication",
  "invitation",
  "shared-link",
  "loading",
  "empty",
  "error",
  "success",
  "restricted",
  "notification",
  "report",
  "export",
  "email",
  "extension-overlay",
]);
const ARCHETYPES = new Set([
  "application-shell-and-navigation",
  "dashboard-or-command-centre",
  "list-and-data-table",
  "detail-or-record-view",
  "create-and-edit-form",
  "editor-or-canvas",
  "review-and-approval-workspace",
  "search-and-command-interface",
  "settings-and-administration",
  "onboarding-and-authentication",
  "feedback-interruption-and-exception",
  "public-information-and-proof",
]);
const EXPERIENCE_STATES = new Set([
  "default",
  "first-use",
  "empty",
  "populated",
  "loading",
  "slow-loading",
  "partial-failure",
  "error",
  "success",
  "restricted",
  "disabled",
  "read-only",
  "dense",
  "long-content",
  "saved",
  "unsaved",
  "reduced-motion",
  "keyboard-only",
]);
const REVIEW_TIERS = new Set(["critical", "core", "supporting"]);
const IMPLEMENTATION_STATUSES = new Set(["live", "preview", "legacy", "planned"]);
const AUDIT_STATUSES = new Set([
  "registered",
  "baseline-captured",
  "under-remediation",
  "passing",
  "blocked",
  "exception",
]);
const COVERAGE_STATUSES = new Set(["none", "partial", "complete", "blocked"]);
const REQUIRED_STRING_FIELDS = [
  "id",
  "product",
  "surfaceType",
  "source",
  "parentJourney",
  "archetype",
  "primaryJob",
  "primaryAction",
  "reviewTier",
  "designOwner",
  "engineeringOwner",
  "implementationStatus",
  "auditStatus",
  "materialityHash",
];
const REQUIRED_ARRAY_FIELDS = [
  "roles",
  "requiredStates",
  "requiredBreakpoints",
  "componentDependencies",
  "patternDependencies",
  "openFindingIds",
  "intentionalExceptions",
];

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function hashText(text) {
  const normalized = text.replace(/\r\n?/g, "\n");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

function hashFile(file) {
  const bytes = readFileSync(file);
  if (PAGE_EXTENSIONS.has(path.extname(file))) {
    return hashText(bytes.toString("utf8"));
  }
  return createHash("sha256").update(bytes).digest("hex").slice(0, 16);
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const name of readdirSync(directory).sort()) {
    const absolute = path.join(directory, name);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      if (!SKIP_DIRECTORIES.has(name)) files.push(...walk(absolute));
    } else {
      files.push(absolute);
    }
  }
  return files;
}

function kebab(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function visibleRouteSegments(relativeDirectory) {
  if (!relativeDirectory || relativeDirectory === ".") return [];
  return relativeDirectory
    .split(path.sep)
    .filter(Boolean)
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")))
    .filter((segment) => !segment.startsWith("@"));
}

function normalizeRoute(appRoot, sourceFile) {
  const relativeDirectory = path.relative(appRoot, path.dirname(sourceFile));
  const segments = visibleRouteSegments(relativeDirectory);
  return segments.length ? `/${segments.join("/")}` : "/";
}

function slugSegment(segment) {
  const optionalCatchAll = segment.match(/^\[\[\.\.\.(.+)\]\]$/);
  if (optionalCatchAll) return `by-${kebab(optionalCatchAll[1])}`;
  const catchAll = segment.match(/^\[\.\.\.(.+)\]$/);
  if (catchAll) return `by-${kebab(catchAll[1])}`;
  const dynamic = segment.match(/^\[(.+)\]$/);
  if (dynamic) return `by-${kebab(dynamic[1])}`;
  return kebab(segment);
}

function routeSlug(route) {
  if (route === "/") return "root";
  return route.split("/").filter(Boolean).map(slugSegment).join("-");
}

function sourceRelative(repoRoot, sourceFile) {
  const local = path.relative(repoRoot, sourceFile).split(path.sep).join("/");
  return `${PRODUCT_ID}/${local}`;
}

function isRouteSource(source) {
  if (!isNonEmptyString(source) || !source.startsWith(`${PRODUCT_ID}/src/app/`)) return false;
  const extension = path.posix.extname(source);
  const basename = path.posix.basename(source, extension);
  return PAGE_EXTENSIONS.has(extension) && SPECIAL_FILES.has(basename);
}

function discoverRoutes(repoRoot) {
  const appRoot = path.join(repoRoot, "src", "app");
  const discovered = [];
  for (const file of walk(appRoot)) {
    const extension = path.extname(file);
    if (!PAGE_EXTENSIONS.has(extension)) continue;
    const basename = path.basename(file, extension);
    if (!SPECIAL_FILES.has(basename)) continue;

    const route = normalizeRoute(appRoot, file);
    const kind = basename === "page" ? "page" : "state";
    const suffix = basename === "page" ? routeSlug(route) : `${routeSlug(route)}-${basename}`;
    const discoveryContext = path
      .relative(appRoot, path.dirname(file))
      .split(path.sep)
      .filter(
        (segment) =>
          (segment.startsWith("(") && segment.endsWith(")")) || segment.startsWith("@"),
      )
      .map((segment) => kebab(segment.replace(/^[@(]+|[)]+$/g, "")))
      .filter(Boolean)
      .join("-");

    discovered.push({
      id: `${PRODUCT_ID}.${kind}.${suffix}`,
      route,
      source: sourceRelative(repoRoot, file),
      surfaceType: SPECIAL_FILES.get(basename),
      discoveryContext: discoveryContext || "default",
      materialityHash: hashFile(file),
    });
  }

  const idCounts = new Map();
  for (const entry of discovered) idCounts.set(entry.id, (idCounts.get(entry.id) ?? 0) + 1);
  return discovered
    .map(({ discoveryContext, ...entry }) => ({
      ...entry,
      id:
        (idCounts.get(entry.id) ?? 0) > 1
          ? `${entry.id}-${discoveryContext}`
          : entry.id,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function resolveSource(repoRoot, source) {
  if (!isNonEmptyString(source) || !source.startsWith(`${PRODUCT_ID}/`)) return null;
  const absolute = path.resolve(repoRoot, source.slice(PRODUCT_ID.length + 1).replaceAll("/", path.sep));
  const rootPrefix = `${path.resolve(repoRoot)}${path.sep}`;
  return absolute.startsWith(rootPrefix) ? absolute : null;
}

function validateMaterialityReview(entry, repoRoot, today) {
  if (entry.materialityReview === undefined) return [];
  const errors = [];
  const review = entry.materialityReview;
  if (!review || typeof review !== "object" || Array.isArray(review)) {
    return [`${entry.id}: materialityReview must be an object`];
  }
  if (review.materialityHash !== entry.materialityHash) {
    errors.push(`${entry.id}: materialityReview hash must match materialityHash`);
  }
  if (!isIsoDate(review.reviewedAt) || review.reviewedAt > today) {
    errors.push(`${entry.id}: materialityReview reviewedAt must be a current or past YYYY-MM-DD`);
  }
  if (review.reviewedAt !== entry.lastReviewedAt) {
    errors.push(`${entry.id}: materialityReview reviewedAt must match lastReviewedAt`);
  }
  try {
    validateMaterialityReceipt({
      repoRoot,
      evidencePath: review.evidence,
      expected: {
        experienceId: entry.id,
        source: entry.source,
        materialityHash: entry.materialityHash,
        reviewedAt: review.reviewedAt,
      },
    });
  } catch (error) {
    errors.push(`${entry.id}: invalid materialityReview receipt: ${error.message}`);
  }
  return errors;
}

function materialityDriftError(entry, actualHash) {
  if (entry.materialityHash === actualHash) return null;
  return (
    `${entry.id}: changed materiality hash requires an explicit reviewed hash refresh; ` +
    "coverage and baseline metadata never waive later source drift"
  );
}

function compareRouteCoverage(registeredEntries, discoveredEntries) {
  const errors = [];
  const registeredById = new Map(registeredEntries.map((entry) => [entry.id, entry]));
  const discoveredById = new Map(discoveredEntries.map((entry) => [entry.id, entry]));

  for (const [id, discovered] of discoveredById) {
    const registered = registeredById.get(id);
    if (!registered) {
      errors.push(`${id}: discovered experience is not registered (${discovered.source})`);
      continue;
    }
    if (registered.source !== discovered.source) {
      errors.push(`${id}: obsolete source reference ${registered.source}; expected ${discovered.source}`);
    }
  }

  for (const registered of registeredEntries) {
    if (!discoveredById.has(registered.id)) {
      errors.push(`${registered.id}: registered route is obsolete (${registered.source})`);
    }
  }
  return errors;
}

function validateRegistry({ registry, repoRoot }) {
  const errors = [];
  const ids = new Set();
  const sourceKeys = new Set();
  const routeKeys = new Set();
  const today = new Date().toISOString().slice(0, 10);

  if (registry.schemaVersion !== EXPERIENCE_SCHEMA_VERSION) {
    errors.push(`registry schema must be ${EXPERIENCE_SCHEMA_VERSION}`);
  }
  if (!isIsoDate(registry.generatedAt)) errors.push("registry generatedAt must be YYYY-MM-DD");
  if (!registry.breakpoints || typeof registry.breakpoints !== "object") {
    errors.push("registry breakpoints are required");
  } else {
    for (const breakpoint of REQUIRED_BREAKPOINTS) {
      const dimensions = registry.breakpoints[breakpoint];
      if (!dimensions || !Number.isInteger(dimensions.width) || !Number.isInteger(dimensions.height)) {
        errors.push(`registry breakpoint ${breakpoint} must declare integer width and height`);
      }
    }
  }
  if (!Array.isArray(registry.experiences)) {
    return [...errors, "registry experiences must be an array"];
  }

  for (const entry of registry.experiences) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push("registry experience entries must be objects");
      continue;
    }
    const label = isNonEmptyString(entry?.id) ? entry.id : "<missing-id>";
    for (const field of REQUIRED_STRING_FIELDS) {
      if (!isNonEmptyString(entry?.[field])) errors.push(`${label}: missing ${field}`);
    }
    for (const field of REQUIRED_ARRAY_FIELDS) {
      if (!Array.isArray(entry?.[field])) errors.push(`${label}: ${field} must be an array`);
    }
    if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(entry?.id ?? "")) {
      errors.push(`${label}: unstable ID format`);
    }
    if (!/^[a-f0-9]{16}$/.test(entry.materialityHash ?? "")) {
      errors.push(`${label}: materialityHash must be a 16-character lowercase SHA-256 prefix`);
    }
    if (ids.has(entry.id)) errors.push(`${label}: duplicate experience ID`);
    ids.add(entry.id);

    if (entry.product !== PRODUCT_ID) errors.push(`${label}: product must be ${PRODUCT_ID}`);
    if (!SURFACE_TYPES.has(entry.surfaceType)) errors.push(`${label}: unknown surface type ${entry.surfaceType}`);
    if (!ARCHETYPES.has(entry.archetype)) errors.push(`${label}: unknown archetype ${entry.archetype}`);
    if (!REVIEW_TIERS.has(entry.reviewTier)) errors.push(`${label}: unknown review tier ${entry.reviewTier}`);
    if (!IMPLEMENTATION_STATUSES.has(entry.implementationStatus)) {
      errors.push(`${label}: unknown implementation status ${entry.implementationStatus}`);
    }
    if (!AUDIT_STATUSES.has(entry.auditStatus)) errors.push(`${label}: unknown audit status ${entry.auditStatus}`);
    for (const field of [
      "automatedTestCoverage",
      "screenshotCoverage",
      "accessibilityCoverage",
      "fixtureCoverage",
    ]) {
      if (!COVERAGE_STATUSES.has(entry[field])) errors.push(`${label}: invalid ${field} ${entry[field]}`);
    }
    if (!entry.route && !entry.trigger) errors.push(`${label}: route or trigger is required`);
    if (!Array.isArray(entry.roles) || !entry.roles.length) errors.push(`${label}: roles are required`);
    if (!Array.isArray(entry.requiredStates) || !entry.requiredStates.length) {
      errors.push(`${label}: required states are missing`);
    } else {
      for (const state of entry.requiredStates) {
        if (!EXPERIENCE_STATES.has(state)) errors.push(`${label}: unknown required state ${state}`);
      }
    }
    if (!Array.isArray(entry.requiredBreakpoints) || !entry.requiredBreakpoints.length) {
      errors.push(`${label}: required breakpoints are missing`);
    } else {
      for (const breakpoint of REQUIRED_BREAKPOINTS) {
        if (!entry.requiredBreakpoints.includes(breakpoint)) {
          errors.push(`${label}: missing breakpoint ${breakpoint}`);
        }
      }
    }

    const sourceKey = `${entry.product}|${entry.source}|${entry.surfaceType}`;
    if (sourceKeys.has(sourceKey)) errors.push(`${label}: duplicate registered source ${entry.source}`);
    sourceKeys.add(sourceKey);
    if (entry.route) {
      const routeKey = `${entry.route}|${entry.surfaceType}`;
      if (routeKeys.has(routeKey)) errors.push(`${label}: duplicate registered route ${entry.route}`);
      routeKeys.add(routeKey);
    }

    const sourceFile = resolveSource(repoRoot, entry.source);
    if (!sourceFile || !existsSync(sourceFile) || !statSync(sourceFile).isFile()) {
      errors.push(`${label}: broken source reference ${entry.source}`);
    } else {
      const driftError = materialityDriftError(entry, hashFile(sourceFile));
      if (driftError) errors.push(driftError);
    }

    if (entry.lastReviewedAt !== null && !isIsoDate(entry.lastReviewedAt)) {
      errors.push(`${label}: lastReviewedAt must be null or YYYY-MM-DD`);
    } else if (isIsoDate(entry.lastReviewedAt) && entry.lastReviewedAt > today) {
      errors.push(`${label}: lastReviewedAt cannot be in the future`);
    }
    if (entry.approvedBaselineReference !== null && !isNonEmptyString(entry.approvedBaselineReference)) {
      errors.push(`${label}: approvedBaselineReference must be null or a non-empty string`);
    }
    errors.push(...validateMaterialityReview(entry, repoRoot, today));
    for (const exception of entry.intentionalExceptions ?? []) {
      for (const field of ["id", "rationale", "owner", "scope", "approvalSource", "expiresAt", "remediationPlan"]) {
        if (!isNonEmptyString(exception?.[field])) errors.push(`${label}: exception is missing ${field}`);
      }
      if (!isIsoDate(exception?.expiresAt) || exception.expiresAt < today) {
        errors.push(`${label}: expired or invalid exception ${exception?.id ?? "<missing-id>"}`);
      }
    }
  }

  const discovered = discoverRoutes(repoRoot);
  const registeredRoutes = registry.experiences.filter(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      (entry.id?.startsWith(`${PRODUCT_ID}.page.`) ||
        entry.id?.startsWith(`${PRODUCT_ID}.state.`) ||
        isRouteSource(entry.source)),
  );
  errors.push(...compareRouteCoverage(registeredRoutes, discovered));
  return errors;
}

function runSelfTest() {
  const root = mkdtempSync(path.join(tmpdir(), "signal-tasks-experience-"));
  let caught = false;
  try {
    const lfSource = "export default function Page() {\n  return null;\n}\n";
    const crlfSource = lfSource.replaceAll("\n", "\r\n");
    const crSource = lfSource.replaceAll("\n", "\r");
    if (
      hashText(lfSource) !== hashText(crlfSource) ||
      hashText(lfSource) !== hashText(crSource)
    ) {
      throw new Error("self-test failed: LF, CRLF, and CR text hashes differ");
    }

    const repoRoot = path.join(root, PRODUCT_ID);
    const appRoot = path.join(repoRoot, "src", "app");
    mkdirSync(appRoot, { recursive: true });
    writeFileSync(path.join(appRoot, "page.tsx"), "export default function Page(){return null}\n");
    const registered = discoverRoutes(repoRoot);

    const unregisteredRoot = path.join(appRoot, "deliberately-unregistered");
    mkdirSync(unregisteredRoot, { recursive: true });
    writeFileSync(
      path.join(unregisteredRoot, "page.tsx"),
      "export default function Page(){return null}\n",
    );
    const errors = compareRouteCoverage(registered, discoverRoutes(repoRoot));
    caught = errors.some((error) => error.includes("discovered experience is not registered"));
    if (!caught) throw new Error(`self-test failed: unregistered route was not caught\n${errors.join("\n")}`);

    const staleCompleteEvidence = {
      id: "tasks.self-test.stale-complete-evidence",
      materialityHash: "0000000000000000",
      fixtureCoverage: "complete",
      screenshotCoverage: "complete",
      accessibilityCoverage: "complete",
      lastReviewedAt: "2020-01-01",
      approvedBaselineReference: "https://example.test/stale-baseline",
    };
    if (!materialityDriftError(staleCompleteEvidence, "1111111111111111")) {
      throw new Error("self-test failed: stale complete evidence waived later source drift");
    }
    if (materialityDriftError(staleCompleteEvidence, "0000000000000000")) {
      throw new Error("self-test failed: matching materiality hash was rejected");
    }

    mkdirSync(path.join(repoRoot, "experience", "reviews"), { recursive: true });
    writeFileSync(
      path.join(repoRoot, "experience", "reviews", "invalid.json"),
      '{"experienceId":"tasks.page.root","materialityHash":"0000000000000000"}\n',
    );
    const invalidReceiptErrors = validateMaterialityReview(
      {
        id: "tasks.page.root",
        source: "tasks/src/app/page.tsx",
        materialityHash: "0000000000000000",
        lastReviewedAt: "2026-07-15",
        materialityReview: {
          materialityHash: "0000000000000000",
          reviewedAt: "2026-07-15",
          evidence: "experience/reviews/invalid.json",
        },
      },
      repoRoot,
      "2026-07-15",
    );
    if (!invalidReceiptErrors.some((error) => error.includes("invalid materialityReview receipt"))) {
      throw new Error("self-test failed: inexact structured review receipt was accepted");
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  if (existsSync(root)) throw new Error("self-test failed: temporary route fixture was not removed");
  console.log(
    "experience:self-test: pass - line-ending hashes match; unregistered route, stale evidence waiver, and inexact receipt were rejected",
  );
}

if (process.argv.includes("--self-test")) {
  runSelfTest();
} else {
  const repoRoot = process.cwd();
  const registryFile = path.join(repoRoot, "experience", "registry.json");
  if (!existsSync(registryFile)) {
    console.error(`experience:validate: registry is missing (${registryFile})`);
    process.exit(1);
  }
  const registry = readJson(registryFile);
  const errors = validateRegistry({ registry, repoRoot });
  if (errors.length) {
    console.error(
      `experience:validate: ${errors.length} failure(s)\n${errors.map((error) => `  x ${error}`).join("\n")}`,
    );
    process.exit(1);
  }
  const stateVariants = registry.experiences.reduce(
    (sum, entry) => sum + entry.requiredStates.length,
    0,
  );
  const breakpointVariants = registry.experiences.reduce(
    (sum, entry) => sum + entry.requiredBreakpoints.length,
    0,
  );
  console.log(
    `experience:validate: clean - ${registry.experiences.length} Tasks experiences, ` +
      `${stateVariants} required state variants, ${breakpointVariants} breakpoint variants`,
  );
}
