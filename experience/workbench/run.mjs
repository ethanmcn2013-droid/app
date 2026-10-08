#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import {
  createHash,
  randomUUID,
} from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  lstatSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workbench = path.join(repo, "experience", "workbench");
const definitionPath = path.join(workbench, "definition.json");
const definition = JSON.parse(readFileSync(definitionPath, "utf8"));
const outputRoot = path.join(repo, "experience", "output", "workbench-runs");
const title = definition.scenario.playwrightTitle;
const startedAt = new Date().toISOString();
const started = Date.now();
const runId = `workbench-${new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
const missingProof = [
  "No authenticated identity, customer data, or persistence is exercised.",
  "No database readback or server-action mutation is exercised.",
  "No original-build versus candidate-build visual comparison is produced.",
  "No human receiving, acceptance, or release disposition is produced.",
  "The scenario uses the repository's synthetic demo fixture and configured preview-mode flags.",
];

function fail(message) {
  console.error(`Workbench runner refused: ${message}`);
  process.exit(2);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function git(args) {
  const result = spawnSyncSafe("git", args);
  if (result.status !== 0) fail(`git ${args[0]} could not establish source state`);
  return result.stdout.trim();
}

function gitRaw(args) {
  const result = spawnSyncSafe("git", args);
  if (result.status !== 0) fail(`git ${args[0]} could not establish source state`);
  return result.stdout.trimEnd();
}

function spawnSyncSafe(file, args) {
  return spawnSync(file, args, { cwd: repo, encoding: "utf8", windowsHide: true });
}

function isWithin(parent, child) {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel));
}

function rejectSymlinkComponents(target) {
  const rel = path.relative(repo, target);
  if (!isWithin(repo, target)) fail("output must remain inside the repository evidence directory");
  let current = repo;
  for (const segment of rel.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      if (lstatSync(current).isSymbolicLink()) fail("output path contains a symbolic link or junction");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

function parseArgs(argv) {
  let output;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--output" && argv[index + 1]) {
      if (output) fail("pass --output once");
      output = path.resolve(repo, argv[index + 1]);
      index += 1;
    } else {
      fail(`unsupported argument ${argv[index]}`);
    }
  }
  if (!output) fail("--output <fresh-run-directory> is required");
  if (!isWithin(outputRoot, output) || output === outputRoot || path.dirname(output) !== outputRoot) {
    fail("--output must be a new direct child of experience/output/workbench-runs");
  }
  rejectSymlinkComponents(outputRoot);
  rejectSymlinkComponents(output);
  try {
    lstatSync(output);
    fail("--output already exists; each attempt needs a fresh run directory");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return output;
}

function verifyDefinition() {
  if (definition.schema !== "signal-workbench-scenario/1" || definition.id !== "tasks-populated-task-detail-panel" || definition.version !== 1) {
    fail("scenario definition is not the admitted version");
  }
  const branch = git(["branch", "--show-current"]);
  if (branch !== definition.source.branch) fail("current branch does not match the scenario source pin");
  const head = git(["rev-parse", "HEAD"]);
  const base = definition.source.baseCommit;
  if (git(["merge-base", "--is-ancestor", base, "HEAD"]) === "") {
    // git's successful --is-ancestor has no output; non-zero is handled above.
  }
  const status = gitRaw(["status", "--porcelain=v1", "--untracked-files=all"]);
  const runtimeDirty = status.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3)).filter((file) =>
    /^(src\/|app\/|pages\/|components\/|next\.config\.|package\.json$|pnpm-lock\.yaml$|experience\/(tests\/|critical-fixtures\.json$|browser-contract\.json$|playwright\.config\.ts$))/.test(file.replaceAll("\\", "/")),
  );
  if (runtimeDirty.length) fail(`runtime source is dirty (${runtimeDirty.length} path(s)); commit the candidate before evidence capture`);
  const localEnvFiles = readdirSync(repo, { withFileTypes: true })
    .map((entry) => entry.name)
    .filter((file) => /^\.env(?:\.|$)/.test(file) && file !== ".env.example");
  if (localEnvFiles.length) fail("an ignored or untracked local environment file exists; remove it from this isolated runner checkout before building");

  const fixtures = JSON.parse(readFileSync(path.join(repo, definition.scenario.fixtureSource), "utf8"));
  const fixture = fixtures.experiences.find((entry) => entry.id === definition.scenario.fixtureId);
  if (!fixture || fixture.caseName !== definition.scenario.caseName || fixture.interaction !== "task-detail-panel") {
    fail("registered fixture no longer matches the admitted task detail scenario");
  }
  const browserContract = JSON.parse(readFileSync(path.join(repo, definition.scenario.browserContract), "utf8"));
  const projectNames = browserContract.projects.map((project) => project.name);
  if (canonical(projectNames) !== canonical(definition.journey.viewports)) fail("browser viewport registry is stale for this scenario");
  if (browserContract.determinism.accessMode !== definition.fidelity.accessMode || browserContract.determinism.deploymentEnvironment !== definition.fidelity.deploymentEnvironment) {
    fail("browser fidelity configuration no longer matches the scenario definition");
  }

  const tree = git(["rev-parse", "HEAD^{tree}"]);
  const dirtyNonRuntime = status.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3).replaceAll("\\", "/"));
  return {
    branch,
    head,
    baseCommit: base,
    ancestry: "base-commit-is-ancestor-of-head",
    tree,
    worktree: status ? "dirty-non-runtime" : "clean",
    dirtyNonRuntimePaths: dirtyNonRuntime,
    runtimeDirty: false,
    runtimeSourceSha256: sha256(Buffer.from(`${tree}\n`)),
    fixtureSha256: sha256(readFileSync(path.join(repo, definition.scenario.fixtureSource))),
    browserContractSha256: sha256(readFileSync(path.join(repo, definition.scenario.browserContract))),
    playrightConfigSha256: sha256(readFileSync(path.join(repo, "experience", "playwright.config.ts"))),
    testSourceSha256: sha256(readFileSync(path.join(repo, "experience", "tests", "critical-experiences.spec.ts"))),
  };
}

function runPlaywright(output) {
  return new Promise((resolve) => {
    const cli = path.join(repo, "node_modules", "@playwright", "test", "cli.js");
    const args = [
      cli,
      "test",
      "--config", "experience/playwright.config.ts",
      "--grep", title,
      "--reporter=json",
      "--output", path.join(output, "playwright-results"),
    ];
    const safeEnv = {};
    for (const name of ["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "APPDATA", "LOCALAPPDATA", "USERPROFILE", "COREPACK_HOME"]) {
      if (process.env[name]) safeEnv[name] = process.env[name];
    }
    if (process.env.CI) safeEnv.CI = "1";
    const child = spawn(process.execPath, args, {
      cwd: repo,
      env: safeEnv,
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
      shell: false,
    });
    const chunks = [];
    let bytes = 0;
    let overflow = false;
    child.stdout.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > 100 * 1024 * 1024) {
        overflow = true;
        child.kill();
      } else chunks.push(chunk);
    });
    child.on("error", () => resolve({ exitCode: null, report: null, outputOverflow: false }));
    child.on("close", (code) => {
      let report = null;
      if (!overflow) {
        const text = Buffer.concat(chunks).toString("utf8");
        const first = text.indexOf("{");
        const last = text.lastIndexOf("}");
        if (first >= 0 && last > first) {
          try { report = JSON.parse(text.slice(first, last + 1)); } catch { report = null; }
        }
      }
      resolve({ exitCode: code, report, outputOverflow: overflow });
    });
  });
}

function pngSize(buffer) {
  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function extractScreenshots(report, output) {
  const screenshots = [];
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      if (spec.title !== title) continue;
      for (const test of spec.tests ?? []) {
        for (const result of test.results ?? []) {
          for (const attachment of result.attachments ?? []) {
            if (attachment.contentType !== "image/png" || typeof attachment.body !== "string") continue;
            const bytes = Buffer.from(attachment.body, "base64");
            const dimensions = pngSize(bytes);
            if (!dimensions) continue;
            const project = test.projectName;
            if (!definition.journey.viewports.includes(project)) continue;
            const file = `task-detail-${project}.png`;
            writeFileSync(path.join(output, file), bytes, { flag: "wx" });
            screenshots.push({ project, file, sha256: sha256(bytes), bytes: bytes.length, ...dimensions });
          }
        }
      }
    }
    for (const nested of suite.suites ?? []) walk(nested);
  };
  for (const suite of report?.suites ?? []) walk(suite);
  return screenshots;
}

function buildMetadata() {
  const buildDir = path.join(repo, ".next");
  const files = ["BUILD_ID", "build-manifest.json", "routes-manifest.json", "prerender-manifest.json", "server/app-build-manifest.json"];
  const parts = [];
  for (const relative of files) {
    const file = path.join(buildDir, relative);
    try {
      const bytes = readFileSync(file);
      parts.push(`${relative}\0${sha256(bytes)}`);
    } catch { /* Optional manifest for this framework build. */ }
  }
  return {
    buildId: readFileSync(path.join(buildDir, "BUILD_ID"), "utf8").trim(),
    manifestSha256: sha256(Buffer.from(parts.join("\n"))),
  };
}

async function collectRuntimeMetadata(report) {
  const browserContract = JSON.parse(readFileSync(path.join(repo, definition.scenario.browserContract), "utf8"));
  const channel = process.env.CI ? null : "chrome";
  const projectData = browserContract.projects.map((project) => ({
    name: project.name,
    viewport: project.viewport,
    browserName: "chromium",
    channel,
  }));
  let actualVersion = null;
  let versionError = null;
  try {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
    actualVersion = browser.version();
    await browser.close();
  } catch (error) {
    versionError = error.message;
  }
  return {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    playwright: JSON.parse(readFileSync(path.join(repo, "node_modules", "@playwright", "test", "package.json"), "utf8")).version,
    browser: { engine: "chromium", configuredChannel: channel ?? "playwright-bundled", actualVersion, versionError },
    projects: projectData,
  };
}

function summarizeReport(report) {
  const cases = [];
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      if (spec.title !== title) continue;
      for (const test of spec.tests ?? []) {
        cases.push({
          project: test.projectName,
          status: test.results?.at(-1)?.status ?? "unknown",
          durationMs: test.results?.at(-1)?.duration ?? null,
        });
      }
    }
    for (const nested of suite.suites ?? []) walk(nested);
  };
  for (const suite of report?.suites ?? []) walk(suite);
  return cases;
}

async function main() {
  if (definition.source.repository !== "ethanmcn2013-droid/app") fail("scenario repository mismatch");
  const output = parseArgs(process.argv.slice(2));
  const source = verifyDefinition();
  mkdirSync(outputRoot, { recursive: true });
  rejectSymlinkComponents(outputRoot);
  mkdirSync(output);

  const scenarioDigest = sha256(Buffer.from(canonical(definition)));
  const execution = await runPlaywright(output);
  let screenshots = [];
  if (execution.report) screenshots = extractScreenshots(execution.report, output);
  let build = null;
  try { build = buildMetadata(); } catch { /* Failed builds have no completed build receipt. */ }
  const cases = summarizeReport(execution.report);
  const expectedProjects = definition.journey.viewports;
  const passed = execution.exitCode === 0 && cases.length === expectedProjects.length && cases.every((item) => item.status === "passed") && screenshots.length === expectedProjects.length;
  const browser = await collectRuntimeMetadata(execution.report);
  const status = execution.exitCode === null ? "unknown" : passed ? "passed" : "failed";
  const viewportByName = new Map(browser.projects.map((project) => [project.name, project.viewport]));
  const artifacts = screenshots.map((shot) => ({
    name: shot.file,
    path: shot.file,
    sha256: `sha256:${shot.sha256}`,
    mediaType: "image/png",
  }));
  const receipt = {
    schema: "signal-workbench-run/1",
    candidate: { commit: source.head, tree: source.tree, dirty: false },
    definition: { id: "tasks-detail-panel@1", digest: `sha256:${scenarioDigest}` },
    instanceId: runId,
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    status,
    exitCode: execution.exitCode,
    ready: passed,
    fidelity: { rendering: "built-product", identity: "synthetic", persistence: "not-exercised" },
    viewports: expectedProjects.map((name) => ({ name, ...(viewportByName.get(name) ?? {}) })),
    artifacts,
    missingProof,
    limitations: missingProof,
    scenario: { id: definition.id, version: definition.version, digest: `sha256:${scenarioDigest}` },
    run: { id: runId, startedAt, completedAt: new Date().toISOString(), durationMs: Date.now() - started },
    source: { repository: definition.source.repository, ...source },
    build: build ? { ...build, sourceTree: source.tree, status: execution.exitCode === 0 ? "built-by-playwright-webserver" : "build-or-browser-command-failed" } : { status: "unavailable" },
    journey: {
      title,
      command: "node_modules/@playwright/test/cli.js test --config experience/playwright.config.ts --grep <fixed-title> --reporter=json --output <run-dir>/playwright-results",
      exitCode: execution.exitCode,
      status,
      cases,
      screenshotCount: screenshots.length,
    },
    fidelity: { ...definition.fidelity, source: "experience/browser-contract.json and experience/critical-fixtures.json" },
    runtime: browser,
    screenshots,
    proofLimits: missingProof,
    failure: execution.outputOverflow ? "Reporter output exceeded the 100 MiB safety cap." : execution.exitCode === null ? "Playwright process could not be started." : passed ? null : "The exact journey did not complete with four passed viewport cases and four captured PNGs. Consult the run status; raw process output was intentionally not retained.",
    custody: { location: path.relative(repo, output).replaceAll("\\", "/"), secretFree: true, rawLogsRetained: false },
  };
  writeFileSync(path.join(output, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify({ status: receipt.journey.status, runId, scenarioDigest: receipt.scenario.digest, screenshots: screenshots.length, output: receipt.custody.location }));
  process.exitCode = passed ? 0 : 1;
}

main().catch((error) => {
  console.error(`Workbench runner failed: ${error.message}`);
  process.exitCode = 1;
});
