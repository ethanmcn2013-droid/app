import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { CaptureContract } from "./invariants";

/**
 * Home operating-layer evidence harness · the Playwright config.
 *
 * A sibling of `experience/playwright.config.ts`, never an extension of it, for
 * three reasons that are engineering facts rather than preference:
 *
 * 1. **It starts no server.** The base config runs `next build && next start`.
 *    A build cannot open this lab: the guard refuses demo and review access
 *    mode outright (contracts/LAB_ISOLATION.md §3), so the freshly built server
 *    would answer 404 to every route this suite exists to test. The lab needs a
 *    server somebody configured with a real Clerk session and the review flag,
 *    and this config attaches to it. `globalSetup` says plainly which of the
 *    four states it found.
 *
 * 2. **Its anchor does not suppress motion.** The base config pins
 *    `reducedMotion: "reduce"` for the whole Tasks suite via
 *    `browser-contract.json`. Inheriting that would make the reduced-motion
 *    variant render an identical screen to the baseline — a comparison that
 *    proves nothing while reporting green. Determinism is recovered at capture
 *    time instead, by disabling animations in the screenshot call.
 *
 * 3. **It covers eight viewports, not four.** The base config's four are the
 *    registry breakpoints. This suite adds 375×812, 812×375, 320×568 and
 *    568×320, because the brief's floor — no horizontal scroll at 320px, no
 *    Home mode hidden behind a More menu — is only testable at those sizes.
 *    The first four are still pixel-identical to the registry breakpoints, and
 *    the capture pipeline's self-test fails if they ever drift apart.
 *
 * NOTHING HERE HARDCODES A SIZE, A THEME OR A MOTION PREFERENCE. Every project
 * is generated from `capture-contract.json`, the same file the capture pipeline
 * reads, so a config project and a capture can never describe different worlds.
 */

const REPO_ROOT = process.cwd();
const contract = JSON.parse(
  readFileSync(path.join(REPO_ROOT, "experience/home-layer/capture-contract.json"), "utf8"),
) as CaptureContract;

const baseURL =
  process.env[contract.server.envVar] ?? contract.server.defaultBaseUrl;

const viewportsByName = new Map(contract.viewports.map((viewport) => [viewport.name, viewport]));
const variantsByName = new Map(contract.variants.map((variant) => [variant.name, variant]));

const required = contract.viewports.filter((viewport) => viewport.tier === "required");
const anchors = contract.anchorViewports.map((name) => viewportsByName.get(name)!);

const engineDevice = {
  chromium: devices["Desktop Chrome"],
  firefox: devices["Desktop Firefox"],
  webkit: devices["Desktop Safari"],
} as const;

type EngineName = keyof typeof engineDevice;

function project(engine: EngineName, viewportName: string, variantName: string) {
  const viewport = viewportsByName.get(viewportName)!;
  const variant = variantsByName.get(variantName)!;
  if (!variant.browsers.includes(engine)) {
    throw new Error(
      `home-lab config: variant "${variantName}" does not support ${engine}. ` +
        `capture-contract.json records why: ${variant.unsupportedBrowsers?.[engine] ?? "no reason recorded"}`,
    );
  }
  const suffix = variantName === "anchor" ? "" : `-${variantName}`;
  return {
    name: `${engine}-${viewportName}${suffix}`,
    testMatch: /home-lab-invariants\.spec\.ts/,
    use: {
      ...engineDevice[engine],
      // devices[] carries its own viewport and deviceScaleFactor; both are
      // overridden here so the contract, not the device preset, decides.
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: contract.determinism.deviceScaleFactor as number,
      colorScheme: variant.colorScheme,
      reducedMotion: variant.reducedMotion,
      forcedColors: variant.forcedColors,
      channel: undefined,
    },
    metadata: {
      viewport: `${viewport.width}x${viewport.height}`,
      registryBreakpoint: viewport.registryBreakpoint,
      theme: variant.colorScheme,
      motion: variant.reducedMotion,
      forcedColors: variant.forcedColors,
    },
  };
}

const projects = [
  // The one project that is green today. It runs against surfaces that serve
  // now, so a broken harness fails here rather than hiding behind a shut lab.
  {
    name: "harness-self-proof",
    testMatch: /harness-self-proof\.spec\.ts/,
    use: {
      ...engineDevice.chromium,
      viewport: { width: anchors[0].width, height: anchors[0].height },
      colorScheme: "light" as const,
      reducedMotion: "no-preference" as const,
      channel: undefined,
    },
  },

  // The eight required viewports, Chromium, anchor variant.
  ...required.map((viewport) => project("chromium", viewport.name, "anchor")),

  // Dark, reduced motion and forced colours at the anchor viewports.
  ...anchors.flatMap((viewport) =>
    ["dark", "reduced-motion", "forced-colors"].map((variantName) =>
      project("chromium", viewport.name, variantName),
    ),
  ),

  // Cross-engine behaviour. Screenshots from these are evidence, not baselines:
  // text rendering differs between engines and a pixel diff across them is not
  // a defect.
  ...(["firefox", "webkit"] as const).flatMap((engine) =>
    anchors.map((viewport) => project(engine, viewport.name, "anchor")),
  ),
];

export default defineConfig({
  testDir: path.join(REPO_ROOT, "experience/home-layer"),
  outputDir: path.join(REPO_ROOT, contract.paths.playwrightResults),
  snapshotPathTemplate: path.join(
    REPO_ROOT,
    "experience/home-layer/baselines/{projectName}/{testFilePath}/{arg}{ext}",
  ),
  globalSetup: path.join(REPO_ROOT, "experience/home-layer/global-setup.ts"),
  fullyParallel: false,
  workers: 1,
  // Generous: one test walks a whole mode at one viewport, and the invariant
  // sweep alone costs the busy-sample gap plus up to fourteen Tab probes.
  timeout: 120_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.0025,
      threshold: 0.1,
    },
  },
  reporter: [
    ["list"],
    ["json", { outputFile: path.join(REPO_ROOT, contract.paths.outputRoot, "home-lab-results.json") }],
    ["html", { outputFolder: path.join(REPO_ROOT, contract.paths.playwrightReport), open: "never" }],
  ],
  use: {
    baseURL,
    locale: contract.determinism.locale as string,
    timezoneId: contract.determinism.timezoneId as string,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    navigationTimeout: contract.invariants.navigationTimeoutMs,
    // A signed-in reviewer session, exported once with
    // `playwright open --save-storage`. Without it the lab is 404 for everyone,
    // which globalSetup reports rather than this config papering over.
    storageState: process.env.HOME_LAB_STORAGE_STATE || undefined,
  },
  projects,
});
