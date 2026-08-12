import { expect, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  attachErrorCollectors,
  auditSurface,
  evaluateInvariants,
  freezeClock,
  INVARIANT_IDS,
  navigateAndSettle,
  summariseAxe,
} from "./harness.mjs";

/**
 * Home operating-layer evidence harness · the assertion helper.
 *
 * The thin Playwright layer over `harness.mjs`. Every measurement and every
 * verdict lives there, so the capture pipeline and these specs cannot disagree
 * about what "no horizontal overflow" means. What this file adds is three
 * things Playwright is good at and a plain script is not: `expect` failures
 * that read well, attachments so a failure arrives with its evidence rather
 * than a line number, and per-test annotations.
 *
 * THE ONE RULE WORTH STATING TWICE: `expectStandingInvariants` fails on
 * `unknown` as well as on `fail`. An invariant that could not be measured has
 * not been met. A helper that quietly accepted unknowns would turn every
 * unmeasurable surface into a green tick, and green ticks are what people read.
 */

export type InvariantConfig = {
  settleMs: number;
  networkIdleTimeoutMs: number;
  navigationTimeoutMs: number;
  busySampleGapMs: number;
  focusSweepLimit: number;
  focusSettleMs: number;
  overflowTolerancePx: number;
  overflowExemptSelector: string;
  busySelector: string;
  nestedInteractiveSelector: string;
  nestedInteractiveChildSelector: string;
  focusableSelector: string;
  hydrationErrorPattern: string;
  consoleErrorAllowlist: Array<{ pattern: string; reason: string; owner: string; expiresAt: string }>;
};

export type CaptureContract = {
  schemaVersion: string;
  determinism: Record<string, unknown>;
  viewports: Array<{ name: string; width: number; height: number; tier: string; registryBreakpoint: string | null }>;
  anchorViewports: string[];
  variants: Array<{
    name: string;
    colorScheme: "light" | "dark";
    reducedMotion: "reduce" | "no-preference";
    forcedColors: "active" | "none";
    browsers: string[];
    unsupportedBrowsers?: Record<string, string>;
  }>;
  browsers: Array<{ name: string; engine: string; channel: string | null; role: string }>;
  plans: Record<string, Record<string, unknown>>;
  invariants: InvariantConfig;
  axe: { tags: string[]; disableRules: string[] };
  paths: Record<string, string>;
  server: { defaultBaseUrl: string; envVar: string; startsItsOwnServer: boolean };
};

const CONTRACT_FILE = path.join(process.cwd(), "experience/home-layer/capture-contract.json");

/** Read fresh rather than imported, so a contract edit takes effect without a rebuild. */
export function loadCaptureContract(): CaptureContract {
  return JSON.parse(readFileSync(CONTRACT_FILE, "utf8")) as CaptureContract;
}

export function invariantConfig(): InvariantConfig {
  return loadCaptureContract().invariants;
}

export type SurfaceReading = {
  navigation: Awaited<ReturnType<typeof navigateAndSettle>>;
  audit: Awaited<ReturnType<typeof auditSurface>>;
  errors: { consoleErrors: unknown[]; consoleWarnings: unknown[]; pageErrors: unknown[]; requestFailures: unknown[] };
  invariants: ReturnType<typeof evaluateInvariants>;
};

/**
 * Navigate, settle, audit, and return everything measured. Assertions are the
 * caller's business: a test that wants to inspect one invariant and ignore the
 * rest can, and a test that wants all seven calls `expectStandingInvariants`.
 */
export async function readSurface(
  page: Page,
  url: string,
  options: { fixedTimeIso?: string | null; context?: BrowserContext } = {},
): Promise<SurfaceReading> {
  const config = invariantConfig();
  const errors = attachErrorCollectors(page);
  if (options.fixedTimeIso) {
    await freezeClock(options.context ?? page.context(), options.fixedTimeIso);
  }
  const navigation = await navigateAndSettle(page, url, config);
  const audit = await auditSurface(page, config);
  const drained = errors.drain();
  return {
    navigation,
    audit,
    errors: drained,
    invariants: evaluateInvariants(audit, drained, config),
  };
}

/**
 * Asserts all seven standing invariants at once, and attaches the full verdict
 * set to the test either way. Attaching on success matters as much as on
 * failure: a passing run is the evidence a reviewer reads later, and a pass
 * with no attached measurement is a claim with no receipt.
 */
export async function expectStandingInvariants(
  reading: SurfaceReading,
  testInfo: TestInfo,
  label: string,
): Promise<void> {
  await testInfo.attach(`invariants · ${label}`, {
    body: JSON.stringify(
      { navigation: reading.navigation, invariants: reading.invariants, structure: reading.audit.structure },
      null,
      2,
    ),
    contentType: "application/json",
  });
  await testInfo.attach(`aria · ${label}`, {
    body: reading.audit.aria,
    contentType: "text/plain",
  });

  const unmet = reading.invariants.results.filter((result) => result.status !== "pass");
  const report = unmet
    .map((result) => `  ${result.status.toUpperCase()} ${result.id}: ${result.summary}`)
    .join("\n");

  expect(
    unmet.length,
    unmet.length
      ? `${label}\n${unmet.length} of ${INVARIANT_IDS.length} standing invariants not met ` +
        `(an "unknown" is not met — it was not measured):\n${report}`
      : label,
  ).toBe(0);
}

/** Asserts one named invariant. `unknown` fails, same rule. */
export function expectInvariant(
  reading: SurfaceReading,
  id: (typeof INVARIANT_IDS)[number],
  label: string,
): void {
  const result = reading.invariants.byId[id];
  expect(result, `${label}: invariant ${id} was never reported`).toBeTruthy();
  expect(result.status, `${label}: ${id} — ${result.summary}`).toBe("pass");
}

/**
 * Runs axe and asserts zero violations. `incomplete` results are attached and
 * reported but do not fail on their own: an incomplete is a question axe could
 * not answer, and failing on it would train everyone to disable the rule. It is
 * never counted as a pass either — the count is in the attachment and in the
 * summary line, where a reviewer has to look at it.
 */
export async function expectNoAxeViolations(
  page: Page,
  testInfo: TestInfo,
  label: string,
): Promise<ReturnType<typeof summariseAxe>> {
  const contract = loadCaptureContract();
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  const builder = new AxeBuilder({ page }).withTags(contract.axe.tags);
  if (contract.axe.disableRules.length) builder.disableRules(contract.axe.disableRules);
  const results = await builder.analyze();
  const summary = summariseAxe(results);

  await testInfo.attach(`axe · ${label}`, {
    body: JSON.stringify(summary, null, 2),
    contentType: "application/json",
  });

  const detail = summary.violations
    .map(
      (violation: { impact?: string; id: string; nodeCount: number; help: string }) =>
        `  ${violation.impact ?? "unknown"} ${violation.id} × ${violation.nodeCount}: ${violation.help}`,
    )
    .join("\n");
  expect(
    summary.violationCount ?? 0,
    summary.violationCount
      ? `${label}\n${summary.violationCount} axe violation(s), ${summary.incompleteCount} unresolved:\n${detail}`
      : `${label} (${summary.incompleteCount} axe result(s) unresolved, recorded not counted as passes)`,
  ).toBe(0);

  return summary;
}

/**
 * The per-scenario forbidden strings. Each world in the fixture carries a
 * `mustNeverRender` list — "all clear", "0 in Nora & Cian", the revoked
 * Project's name — and this is where the rendered page is held against it.
 */
export async function expectNothingForbiddenRendered(
  page: Page,
  forbidden: readonly string[],
  label: string,
): Promise<void> {
  if (!forbidden.length) return;
  const text = (await page.evaluate(() => document.body.innerText)).toLowerCase();
  const rendered = forbidden.filter((phrase) => text.includes(phrase.toLowerCase()));
  expect(
    rendered,
    `${label}: this world forbids these strings and the page rendered them — ${rendered.join(" | ")}`,
  ).toEqual([]);
}
