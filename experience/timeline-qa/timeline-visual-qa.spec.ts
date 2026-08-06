/**
 * Timeline visual-QA harness.
 *
 * Sweeps every required state (routes.ts) across every required viewport
 * (viewports.ts), against the already-running review-mode dev server
 * (default http://localhost:3520 -- see ../timeline-qa.playwright.config.ts).
 * For each combination it saves a full-page screenshot and a machine
 * readable measurement record, then asserts the invariants the brief called
 * absolute: zero horizontal overflow, zero console/page errors, zero
 * ancestor-clipped text.
 *
 * This file does not import anything from src/ -- it drives the app the same
 * way a browser does, through routes and the rendered DOM, and it does not
 * modify any file outside experience/ and the scratch output directory.
 *
 * Re-run:
 *   corepack pnpm exec playwright test --config experience/timeline-qa.playwright.config.ts
 *
 * Narrow to one state or viewport with Playwright grep, for example:
 *   corepack pnpm exec playwright test --config experience/timeline-qa.playwright.config.ts -g "mobile-390"
 *
 * Output directory: TIMELINE_QA_OUT_DIR env var if set, else
 * <os tempdir>/timeline-qa-captures. See README.md for the full layout and
 * for what each field in the written JSON can and cannot prove.
 */

import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { collectTimelineQaMeasurement, type TimelineQaMeasurement } from "./measure-in-page";
import { TIMELINE_QA_STATES, type TimelineQaAction, type TimelineQaState } from "./routes";
import { TIMELINE_QA_VIEWPORTS, type TimelineQaViewport } from "./viewports";
import { runtimeFailures, type RuntimeIssue, type RuntimeWatch } from "../runtime-policy";

const OUT_DIR = process.env.TIMELINE_QA_OUT_DIR
  ? path.resolve(process.env.TIMELINE_QA_OUT_DIR)
  : path.join(os.tmpdir(), "timeline-qa-captures");
const SCREENSHOT_DIR = path.join(OUT_DIR, "screenshots");
const MEASUREMENT_DIR = path.join(OUT_DIR, "measurements");

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
fs.mkdirSync(MEASUREMENT_DIR, { recursive: true });

// Key source files whose mtime is stamped into every capture. Two runs that
// disagree on a metric are only comparable once you know whether the
// underlying component actually changed between them -- this repo is a
// worktree that another agent edits concurrently, so that is not a
// hypothetical, it happened during the run that produced this harness.
const PROVENANCE_FILES = [
  "src/modules/timeline/components/artifact/timeline-artifact.tsx",
  "src/modules/timeline/components/artifact/timeline-artifact-model.ts",
  "src/modules/timeline/components/artifact/timeline-artifact.module.css",
  "src/modules/timeline/app/plan/[projectSlug]/page.tsx",
  "src/modules/timeline/app/plan/[projectSlug]/_components/share-panel.tsx",
  "src/modules/timeline/app/plan/[projectSlug]/_components/curation-surface.tsx",
  "src/modules/timeline/app/audience/project-preview.tsx",
  "src/modules/timeline/app/audience/shared-timeline-artifact.tsx",
  "src/modules/timeline/server/audience-timeline.ts",
];

function captureProvenance(): Record<string, string | null> {
  const record: Record<string, string | null> = {};
  for (const relPath of PROVENANCE_FILES) {
    const abs = path.join(process.cwd(), relPath);
    try {
      const stat = fs.statSync(abs);
      record[relPath] = stat.mtime.toISOString();
    } catch {
      record[relPath] = null;
    }
  }
  return record;
}

function watchRuntime(page: Page): RuntimeWatch {
  const issues: RuntimeIssue[] = [];
  const intentionalEventSourceTeardowns = new Set<string>();
  const completedQualifiedViewWrites = new Set<string>();
  page.on("pageerror", (error) => issues.push({ kind: "pageerror", message: error.message }));
  page.on("console", (message) => {
    if (message.type() === "error") {
      issues.push({
        kind: "console",
        message: message.text(),
        url: message.location().url,
      });
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      issues.push({
        kind: "http",
        status: response.status(),
        resourceType: response.request().resourceType(),
        url: response.url(),
      });
    }
  });
  page.on("requestfailed", (request) => {
    issues.push({
      kind: "requestfailed",
      message: request.failure()?.errorText ?? "unknown network failure",
      resourceType: request.resourceType(),
      url: request.url(),
    });
  });
  return { issues, intentionalEventSourceTeardowns, completedQualifiedViewWrites };
}

async function applyAction(page: Page, action: TimelineQaAction) {
  if (action.kind !== "open-share-dialog") return;
  const shareButton = page.getByRole("button", { name: "Share", exact: true });
  await shareButton.waitFor({ state: "visible", timeout: 15_000 });
  await shareButton.click();
  await page.getByRole("dialog").first().waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(300);
}

type FocusSample = {
  description: string;
  ringVisible: boolean;
  outline: string;
  boxShadow: string;
  isMilestoneButton: boolean;
};

async function captureFocusSample(page: Page): Promise<{
  firstFocusable: FocusSample | null;
  milestoneButtonFocus: FocusSample | null;
  tabsToReachMilestoneButton: number | null;
  sampledCount: number;
}> {
  const attempts: FocusSample[] = [];
  let tabsToReachMilestoneButton: number | null = null;
  for (let i = 0; i < 30; i += 1) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body) return null;
      const style = getComputedStyle(active);
      const rect = active.getBoundingClientRect();
      const visible =
        rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      const isMilestoneButton = Boolean(active.closest("li[data-state]"));
      const label = active.getAttribute("aria-label") || (active.textContent || "").trim().slice(0, 60) || active.tagName.toLowerCase();
      return {
        description: label,
        visible,
        focusVisible: active.matches(":focus-visible"),
        outline: style.outlineStyle + " " + style.outlineWidth + " " + style.outlineColor,
        boxShadow: style.boxShadow,
        isMilestoneButton,
      };
    });
    if (!info) continue;
    const sample: FocusSample = {
      description: info.description,
      ringVisible:
        info.visible &&
        info.focusVisible &&
        (info.outline.indexOf("none") !== 0 || info.boxShadow !== "none"),
      outline: info.outline,
      boxShadow: info.boxShadow,
      isMilestoneButton: info.isMilestoneButton,
    };
    attempts.push(sample);
    if (info.isMilestoneButton && tabsToReachMilestoneButton === null) {
      tabsToReachMilestoneButton = attempts.length;
      break;
    }
  }
  return {
    firstFocusable: attempts[0] ?? null,
    milestoneButtonFocus: attempts.find((a) => a.isMilestoneButton) ?? null,
    tabsToReachMilestoneButton,
    sampledCount: attempts.length,
  };
}

function fileSafe(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, "-");
}

const BASE_URL = "http://localhost:" + (process.env.TIMELINE_QA_PORT ?? "3520");

test.beforeAll(async () => {
  const meta = {
    generatedAt: new Date().toISOString(),
    baseURL: BASE_URL,
    totalStates: TIMELINE_QA_STATES.length,
    totalViewports: TIMELINE_QA_VIEWPORTS.length,
    totalCombinations: TIMELINE_QA_STATES.length * TIMELINE_QA_VIEWPORTS.length,
    states: TIMELINE_QA_STATES.map((s) => ({ id: s.id, path: s.path, category: s.category, description: s.description })),
    viewports: TIMELINE_QA_VIEWPORTS,
    provenanceAtRunStart: captureProvenance(),
    outDir: OUT_DIR,
  };
  fs.writeFileSync(path.join(OUT_DIR, "_run-meta.json"), JSON.stringify(meta, null, 2), "utf8");
});

for (const state of TIMELINE_QA_STATES) {
  for (const viewport of TIMELINE_QA_VIEWPORTS) {
    test(state.id + " / " + viewport.name, async ({ page }, testInfo) => {
      test.setTimeout(75_000);
      const runtime = watchRuntime(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: "reduce" });

      const baseName = fileSafe(state.id) + "__" + fileSafe(viewport.name);
      const screenshotPath = path.join(SCREENSHOT_DIR, baseName + ".png");
      const jsonPath = path.join(MEASUREMENT_DIR, baseName + ".json");

      let response: Awaited<ReturnType<Page["goto"]>> = null;
      // Populated inside the try block on success. The hard invariant
      // checks below read from THIS, not from a fresh call, and they sit
      // OUTSIDE the try/catch on purpose: a failed expect() is a thrown
      // error like any other, and if it were caught by the same catch
      // block that handles a broken navigation, it would overwrite the
      // rich record just written to disk with a thin failure record --
      // destroying exactly the evidence a reviewer needs for the cases
      // that failed. An earlier version of this harness had that bug;
      // this comment is here so it does not come back.
      let record: Record<string, unknown> | null = null;

      try {
        response = await page.goto(state.path, { waitUntil: "domcontentloaded", timeout: 45_000 });
        await applyAction(page, state.action);
        await page.waitForLoadState("load", { timeout: 45_000 }).catch(() => {});
        // Settle past the entrance-motion first frames, matching the
        // repository convention in experience/tests/critical-experiences.spec.ts.
        await page.waitForTimeout(400);

        const measurement: TimelineQaMeasurement = await page.evaluate(collectTimelineQaMeasurement);
        const focus = await captureFocusSample(page);

        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
          animations: "disabled",
          caret: "hide",
        });

        const runtimeFailureSummary = runtimeFailures(runtime, null, page.url());

        record = {
          stateId: state.id,
          stateDescription: state.description,
          stateCategory: state.category,
          viewportName: viewport.name,
          viewportNote: viewport.note,
          viewport: { width: viewport.width, height: viewport.height },
          requestedPath: state.path,
          resolvedUrl: page.url(),
          httpStatus: response ? response.status() : null,
          screenshotPath,
          capturedAt: new Date().toISOString(),
          provenance: captureProvenance(),
          measurement,
          focus,
          runtimeIssues: runtime.issues,
          runtimeFailureSummary,
          playwrightTestTitle: testInfo.title,
        };
        fs.writeFileSync(jsonPath, JSON.stringify(record, null, 2), "utf8");
        await testInfo.attach(baseName, { path: screenshotPath, contentType: "image/png" });
      } catch (err) {
        const failureRecord = {
          stateId: state.id,
          viewportName: viewport.name,
          requestedPath: state.path,
          error: err instanceof Error ? err.stack || err.message : String(err),
          httpStatus: response ? response.status() : null,
          runtimeIssues: runtime.issues,
          capturedAt: new Date().toISOString(),
          provenance: captureProvenance(),
        };
        fs.writeFileSync(jsonPath, JSON.stringify(failureRecord, null, 2), "utf8");
        try {
          await page.screenshot({
            path: screenshotPath,
            fullPage: true,
            animations: "disabled",
            caret: "hide",
          });
        } catch {
          // The page itself may be unreachable at this point; the JSON
          // record above is then the only evidence, and that absence is
          // itself part of the finding.
        }
        throw err;
      }

      // ---- hard invariants, verbatim from the brief -------------------
      // Deliberately outside the try/catch above -- see the comment on the
      // hoisted `record` declaration. The catch block above always
      // rethrows, so reaching this line means the try block ran to
      // completion and record was assigned; the guard below only exists
      // to say that to the type checker, not because it should ever fire.
      if (!record) throw new Error("unreachable: record must be set when no error was thrown");
      const measurement = record.measurement as TimelineQaMeasurement;
      const runtimeFailureSummary = record.runtimeFailureSummary as unknown[];
      expect(record.httpStatus, "expected HTTP status for " + state.path).toBe(
        state.expectedStatus,
      );
      expect(
        runtimeFailureSummary,
        "console errors, page errors, and failed requests must be zero",
      ).toEqual([]);
      expect(
        measurement.horizontalOverflow,
        "horizontal overflow (scrollWidth > innerWidth) must be false, especially at mobile widths",
      ).toBe(false);
      const hardClips = measurement.clippedText.filter((c) => c.kind === "ancestor-clip");
      expect(
        hardClips,
        "text silently clipped by an ancestor overflow:clip/hidden box, invisible to scrollHeight checks",
      ).toEqual([]);
    });
  }
}
