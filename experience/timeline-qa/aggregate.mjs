#!/usr/bin/env node
/**
 * Rolls up the per-state-per-viewport JSON files that
 * timeline-visual-qa.spec.ts writes into one summary JSON, one summary CSV,
 * and a console table. Also supports comparing two runs so a future change
 * can be checked against a saved baseline, per the harness brief.
 *
 * Usage:
 *   node experience/timeline-qa/aggregate.mjs [runDir]
 *   node experience/timeline-qa/aggregate.mjs [runDir] --compare <otherRunDir>
 *
 * runDir defaults to TIMELINE_QA_OUT_DIR env var, else
 * <os tempdir>/timeline-qa-captures -- the same default the spec file uses.
 *
 * This script does not talk to a browser or the app; it only reads the JSON
 * files the spec already wrote, so it is safe to run any number of times.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function defaultOutDir() {
  return process.env.TIMELINE_QA_OUT_DIR
    ? path.resolve(process.env.TIMELINE_QA_OUT_DIR)
    : path.join(os.tmpdir(), "timeline-qa-captures");
}

function loadRun(runDir) {
  const measurementDir = path.join(runDir, "measurements");
  if (!fs.existsSync(measurementDir)) {
    throw new Error("No measurements directory at " + measurementDir + " -- run the spec first.");
  }
  const files = fs.readdirSync(measurementDir).filter((f) => f.endsWith(".json"));
  const rows = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(measurementDir, file), "utf8");
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      rows.push({
        file,
        stateId: file,
        viewportName: "",
        parseError: String(err),
      });
      continue;
    }
    rows.push(summariseRecord(file, parsed));
  }
  return rows;
}

function summariseRecord(file, parsed) {
  if (parsed.error) {
    return {
      file,
      stateId: parsed.stateId ?? null,
      viewportName: parsed.viewportName ?? null,
      requestedPath: parsed.requestedPath ?? null,
      captureFailed: true,
      error: parsed.error,
      httpStatus: parsed.httpStatus ?? null,
    };
  }
  const m = parsed.measurement ?? {};
  const hardClips = (m.clippedText ?? []).filter((c) => c.kind === "ancestor-clip");
  const selfTruncated = (m.clippedText ?? []).filter((c) => c.kind === "self-truncated");
  const runtimeFailureCount = (parsed.runtimeFailureSummary ?? []).length;
  const pass =
    !parsed.captureFailed &&
    runtimeFailureCount === 0 &&
    m.horizontalOverflow === false &&
    hardClips.length === 0 &&
    parsed.httpStatus === (parsed.expectedStatus ?? parsed.httpStatus);

  return {
    file,
    stateId: parsed.stateId ?? null,
    stateCategory: parsed.stateCategory ?? null,
    viewportName: parsed.viewportName ?? null,
    viewportWidth: parsed.viewport?.width ?? null,
    viewportHeight: parsed.viewport?.height ?? null,
    requestedPath: parsed.requestedPath ?? null,
    httpStatus: parsed.httpStatus ?? null,
    captureFailed: false,
    pass,
    scrollHeight: m.document?.scrollHeight ?? null,
    clientHeight: m.document?.clientHeight ?? null,
    verticalOverflowPx: m.verticalOverflowPx ?? null,
    fitsWithoutVerticalScroll: m.fitsWithoutVerticalScroll ?? null,
    horizontalOverflow: m.horizontalOverflow ?? null,
    horizontalOverflowPx: m.horizontalOverflowPx ?? null,
    hardClipCount: hardClips.length,
    selfTruncatedCount: selfTruncated.length,
    runtimeFailureCount,
    footerPresent: m.footer?.present ?? null,
    footerWithinFirstViewport: m.footer?.withinFirstViewport ?? null,
    density: m.artifact?.density ?? null,
    axisMode: m.artifact?.axisMode ?? null,
    artifactCount: m.artifact?.count ?? null,
    heroText: m.hero?.text ?? null,
    heroFontSizePx: m.hero?.fontSizePx ?? null,
    heroEstimatedLines: m.hero?.estimatedLines ?? null,
    metricValue: m.metric?.value ?? null,
    progressAriaValueNow: m.progressbar?.ariaValueNow ?? null,
    milestoneCount: m.milestones?.count ?? null,
    milestoneLabelledCount: m.milestones?.labelledCount ?? null,
    labelCollisionCount: m.milestones?.labelCollisions?.length ?? null,
    dotCollisionCount: m.milestones?.dotCollisions?.length ?? null,
    minTouchTargetPx: m.milestones?.minTouchTargetPx ?? null,
    monthTicksTotal: m.monthTicks?.total ?? null,
    monthTicksQuiet: m.monthTicks?.quiet ?? null,
    focusFirstDescription: parsed.focus?.firstFocusable?.description ?? null,
    focusFirstRingVisible: parsed.focus?.firstFocusable?.ringVisible ?? null,
    focusMilestoneRingVisible: parsed.focus?.milestoneButtonFocus?.ringVisible ?? null,
  };
}

const CSV_COLUMNS = [
  "stateId",
  "stateCategory",
  "viewportName",
  "viewportWidth",
  "viewportHeight",
  "httpStatus",
  "pass",
  "captureFailed",
  "scrollHeight",
  "clientHeight",
  "verticalOverflowPx",
  "fitsWithoutVerticalScroll",
  "horizontalOverflow",
  "horizontalOverflowPx",
  "hardClipCount",
  "selfTruncatedCount",
  "runtimeFailureCount",
  "footerPresent",
  "footerWithinFirstViewport",
  "density",
  "axisMode",
  "artifactCount",
  "heroFontSizePx",
  "heroEstimatedLines",
  "metricValue",
  "progressAriaValueNow",
  "milestoneCount",
  "milestoneLabelledCount",
  "labelCollisionCount",
  "dotCollisionCount",
  "minTouchTargetPx",
  "monthTicksTotal",
  "monthTicksQuiet",
  "focusFirstRingVisible",
  "focusMilestoneRingVisible",
  "error",
];

function toCsv(rows) {
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows) {
    const cells = CSV_COLUMNS.map((col) => {
      const value = row[col];
      if (value === null || value === undefined) return "";
      const text = String(value).replace(/"/g, "\"\"");
      return /[,"\n]/.test(text) ? "\"" + text + "\"" : text;
    });
    lines.push(cells.join(","));
  }
  return lines.join("\n") + "\n";
}

function keyOf(row) {
  return (row.stateId ?? "") + " / " + (row.viewportName ?? "");
}

const DIFF_FIELDS = [
  "pass",
  "httpStatus",
  "scrollHeight",
  "verticalOverflowPx",
  "horizontalOverflow",
  "hardClipCount",
  "selfTruncatedCount",
  "runtimeFailureCount",
  "footerWithinFirstViewport",
  "density",
  "axisMode",
  "milestoneCount",
  "labelCollisionCount",
  "dotCollisionCount",
  "heroEstimatedLines",
];

function diffRuns(baseRows, compareRows) {
  const baseByKey = new Map(baseRows.map((r) => [keyOf(r), r]));
  const compareByKey = new Map(compareRows.map((r) => [keyOf(r), r]));
  const allKeys = new Set([...baseByKey.keys(), ...compareByKey.keys()]);
  const diffs = [];
  for (const key of allKeys) {
    const a = baseByKey.get(key);
    const b = compareByKey.get(key);
    if (!a || !b) {
      diffs.push({ key, kind: !a ? "added-in-compare" : "missing-in-compare" });
      continue;
    }
    const changedFields = {};
    for (const field of DIFF_FIELDS) {
      if (a[field] !== b[field]) {
        changedFields[field] = { base: a[field], compare: b[field] };
      }
    }
    if (Object.keys(changedFields).length > 0) {
      diffs.push({ key, kind: "changed", changedFields });
    }
  }
  return diffs;
}

function printTable(rows) {
  const failing = rows.filter((r) => r.captureFailed || r.pass === false);
  const passing = rows.filter((r) => !r.captureFailed && r.pass === true);
  console.log("");
  console.log("Timeline visual-QA summary");
  console.log("  total captures : " + rows.length);
  console.log("  passing        : " + passing.length);
  console.log("  failing        : " + failing.length);
  console.log("");
  if (failing.length > 0) {
    console.log("Failing (state / viewport -- reason):");
    for (const row of failing) {
      const reason = row.captureFailed
        ? "capture failed: " + String(row.error).split("\n")[0]
        : [
            row.horizontalOverflow ? "horizontal overflow " + row.horizontalOverflowPx + "px" : null,
            row.hardClipCount ? row.hardClipCount + " hard-clipped text node(s)" : null,
            row.runtimeFailureCount ? row.runtimeFailureCount + " console/network error(s)" : null,
            row.httpStatus && row.httpStatus >= 400 ? "http " + row.httpStatus : null,
          ]
            .filter(Boolean)
            .join(", ");
      console.log("  " + keyOf(row) + " -- " + reason);
    }
    console.log("");
  }
}

function main() {
  const args = process.argv.slice(2);
  const compareIndex = args.indexOf("--compare");
  const runDir = args[0] && args[0] !== "--compare" ? path.resolve(args[0]) : defaultOutDir();
  const compareDir = compareIndex >= 0 ? path.resolve(args[compareIndex + 1]) : null;

  const rows = loadRun(runDir);
  rows.sort((a, b) => keyOf(a).localeCompare(keyOf(b)));

  fs.writeFileSync(path.join(runDir, "_summary.json"), JSON.stringify(rows, null, 2), "utf8");
  fs.writeFileSync(path.join(runDir, "_summary.csv"), toCsv(rows), "utf8");
  console.log("Run directory: " + runDir);
  console.log("Wrote _summary.json and _summary.csv (" + rows.length + " rows).");
  printTable(rows);

  if (compareDir) {
    const compareRows = loadRun(compareDir);
    const diffs = diffRuns(rows, compareRows);
    fs.writeFileSync(
      path.join(runDir, "_diff-vs-" + path.basename(compareDir) + ".json"),
      JSON.stringify(diffs, null, 2),
      "utf8",
    );
    console.log("Compared against: " + compareDir);
    console.log("Differences: " + diffs.length + " (of " + rows.length + " combinations)");
    for (const d of diffs.slice(0, 50)) {
      if (d.kind !== "changed") {
        console.log("  " + d.key + " -- " + d.kind);
        continue;
      }
      console.log("  " + d.key + ":");
      for (const [field, values] of Object.entries(d.changedFields)) {
        console.log("    " + field + ": " + JSON.stringify(values.base) + " -> " + JSON.stringify(values.compare));
      }
    }
    if (diffs.length > 50) {
      console.log("  ... and " + (diffs.length - 50) + " more, see the written diff JSON.");
    }
  }
}

main();
