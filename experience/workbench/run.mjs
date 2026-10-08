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
const APPROVED_DEFINITION_SHA256 = "4dd337fc722a0b043a6daf367a818cd2182d114c7d0a71d38469b55e5bf0718a";
const outputRoot = path.join(repo, "experience", "output", "workbench-runs");
const title = "tasks.surface.task-detail-panel / populated task";
const startedAt = new Date().toISOString();
const started = Date.now();
const runId = `workbench-${new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
const limitations = [
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
  const definitionDigest = sha256(Buffer.from(canonical(definition)));
  if (definition.schema !== "signal-workbench-scenario/1" || definition.id !== "tasks-populated-task-detail-panel" || definition.version !== 1 || definitionDigest !== APPROVED_DEFINITION_SHA256) fail("scenario definition differs from the admitted version");
  const branch = git(["branch", "--show-current"]);
  if (branch !== definition.source.branch) fail("current branch does not match the scenario source pin");
  const head = git(["rev-parse", "HEAD"]);
  const base = definition.source.baseCommit;
  if (git(["merge-base", "--is-ancestor", base, "HEAD"]) === "") {
    // git's successful --is-ancestor has no output; non-zero is handled above.
  }
  const status = gitRaw(["status", "--porcelain=v1", "--untracked-files=all"]);
  const runtimeDirty = status.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3)).filter((file) =>
    /^(src\/|app\/|pages\/|components\/|next\.config\.|package\.json$|pnpm-lock\.yaml$|vercel\.json$|experience\/(workbench\/|tests\/|critical-fixtures\.json$|browser-contract\.json$|playwright\.config\.ts$))/.test(file.replaceAll("\\", "/")),
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
    playwrightConfigSha256: sha256(readFileSync(path.join(repo, "experience", "playwright.config.ts"))),
    testSourceSha256: sha256(readFileSync(path.join(repo, "experience", "tests", "critical-experiences.spec.ts"))),
    definitionSha256: definitionDigest,
  };
}

function terminateChildTree(child) {
  if (!child.pid) return { requested: true, mechanism: "child process had no PID", result: "unavailable" };
  if (process.platform === "win32") {
    const taskkill = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe");
    const result = spawnSync(taskkill, ["/PID", String(child.pid), "/T", "/F"], {
      cwd: repo,
      encoding: "utf8",
      windowsHide: true,
      shell: false,
    });
    if (result.status !== 0) child.kill();
    return { requested: true, mechanism: `taskkill /PID ${child.pid} /T /F`, result: result.status === 0 ? "terminated-process-tree" : "taskkill-failed-child-kill-requested" };
  }
  try {
    process.kill(-child.pid, "SIGTERM");
    return { requested: true, mechanism: `SIGTERM process group ${child.pid}`, result: "termination-requested" };
  } catch {
    child.kill("SIGTERM");
    return { requested: true, mechanism: `SIGTERM child ${child.pid}`, result: "termination-requested" };
  }
}

function runPlaywright(output, { signal } = {}) {
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
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
      detached: process.platform !== "win32",
    });
    const chunks = [];
    const errorChunks = [];
    let bytes = 0;
    let errorBytes = 0;
    let overflow = false;
    let settled = false;
    let termination = null;
    const persistProcessOutput = () => {
      const stdout = Buffer.concat(chunks);
      const stderr = Buffer.concat(errorChunks);
      let report = null;
      if (!overflow) {
        const text = stdout.toString("utf8");
        const first = text.indexOf("{");
        const last = text.lastIndexOf("}");
        if (first >= 0 && last > first) {
          try { report = JSON.parse(text.slice(first, last + 1)); } catch { report = null; }
        }
      }
      const stdoutName = report ? "playwright-report.json" : "playwright-stdout.partial.txt";
      writeFileSync(path.join(output, stdoutName), stdout, { flag: "wx" });
      writeFileSync(path.join(output, "playwright-stderr.log"), stderr, { flag: "wx" });
      return { stdout, stderr, report, stdoutName };
    };
    const onAbort = () => {
      if (settled || termination) return;
      termination = terminateChildTree(child);
    };
    const removeAbortListener = () => signal?.removeEventListener("abort", onAbort);
    const finish = ({ code = null, childSignal = null, spawnError = null } = {}) => {
      if (settled) return;
      settled = true;
      removeAbortListener();
      const persisted = persistProcessOutput();
      resolve({
        exitCode: termination || spawnError ? null : code,
        childSignal,
        termination,
        spawnError: spawnError?.message ?? null,
        ...persisted,
        outputOverflow: overflow,
      });
    };
    child.stdout.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > 100 * 1024 * 1024) {
        overflow = true;
        child.kill();
      } else chunks.push(chunk);
    });
    child.stderr.on("data", (chunk) => {
      errorBytes += chunk.length;
      if (errorBytes > 100 * 1024 * 1024) {
        overflow = true;
        child.kill();
      } else errorChunks.push(chunk);
    });
    child.on("error", (error) => finish({ spawnError: error }));
    child.on("close", (code, childSignal) => finish({ code, childSignal }));
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
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
    browser: actualVersion ? `Chrome ${actualVersion}` : `Chromium (version unavailable: ${versionError ?? "unknown"})`,
    browserDetails: { engine: "chromium", configuredChannel: channel ?? "playwright-bundled", actualVersion, versionError },
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

export async function runWithOutput({ output: requestedOutput, signal } = {}) {
  if (definition.source.repository !== "ethanmcn2013-droid/app") fail("scenario repository mismatch");
  if (!requestedOutput) fail("--output <fresh-run-directory> is required");
  const output = parseArgs(["--output", requestedOutput]);
  const source = verifyDefinition();
  mkdirSync(outputRoot, { recursive: true });
  rejectSymlinkComponents(outputRoot);
  mkdirSync(output);

  const scenarioDigest = source.definitionSha256;
  const execution = await runPlaywright(output, { signal });
  let screenshots = [];
  if (execution.report) screenshots = extractScreenshots(execution.report, output);
  let buildFiles = null;
  try { buildFiles = buildMetadata(); } catch { /* A stale build is not presented as this run's build. */ }
  const cases = summarizeReport(execution.report);
  const expectedProjects = definition.journey.viewports;
  const passed = execution.exitCode === 0 && cases.length === expectedProjects.length && cases.every((item) => item.status === "passed") && screenshots.length === expectedProjects.length;
  const build = cases.length > 0 && buildFiles ? { ...buildFiles, sourceTree: source.tree, status: "built-by-playwright-webserver" } : { status: "not-confirmed" };
  const browser = await collectRuntimeMetadata(execution.report);
  const status = execution.exitCode === null ? "unknown" : passed ? "passed" : "failed";
  const missingProof = passed ? [] : ["The fixed populated-task browser journey did not pass with four captured viewport screenshots."];
  const viewportByName = new Map(browser.projects.map((project) => [project.name, project.viewport]));
  const runnerBytes = readFileSync(fileURLToPath(import.meta.url));
  const definitionBytes = readFileSync(definitionPath);
  writeFileSync(path.join(output, "runner-source.mjs"), runnerBytes, { flag: "wx" });
  writeFileSync(path.join(output, "scenario-definition.json"), definitionBytes, { flag: "wx" });
  const sourceEvidence = {
    repository: definition.source.repository,
    candidate: { commit: source.head, tree: source.tree, dirty: false },
    branch: source.branch,
    baseCommit: source.baseCommit,
    runtimeSourceSha256: `sha256:${source.runtimeSourceSha256}`,
    fixtureSha256: `sha256:${source.fixtureSha256}`,
    browserContractSha256: `sha256:${source.browserContractSha256}`,
    playwrightConfigSha256: `sha256:${source.playwrightConfigSha256}`,
    testSourceSha256: `sha256:${source.testSourceSha256}`,
    runnerSourceSha256: `sha256:${sha256(runnerBytes)}`,
    scenarioDefinitionSha256: `sha256:${sha256(definitionBytes)}`,
    runtimeDirty: source.runtimeDirty,
  };
  const buildEvidence = { ...build, sourceTree: source.tree };
  writeFileSync(path.join(output, "source-metadata.json"), `${JSON.stringify(sourceEvidence, null, 2)}\n`, { flag: "wx" });
  writeFileSync(path.join(output, "build-metadata.json"), `${JSON.stringify(buildEvidence, null, 2)}\n`, { flag: "wx" });
  const artifactNames = [
    ...screenshots.map((shot) => shot.file),
    execution.stdoutName,
    "playwright-stderr.log",
    "source-metadata.json",
    "build-metadata.json",
    "runner-source.mjs",
    "scenario-definition.json",
  ];
  const artifacts = artifactNames.map((file) => {
    const bytes = readFileSync(path.join(output, file));
    const mediaType = file.endsWith(".png") ? "image/png" : file.endsWith(".json") ? "application/json" : file.endsWith(".mjs") ? "text/javascript" : "text/plain";
    return { name: file, path: file, sha256: `sha256:${sha256(bytes)}`, mediaType, bytes: bytes.length };
  });
  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - started;
  const receipt = {
    schema: "signal-workbench-run/1",
    candidate: { commit: source.head, tree: source.tree, dirty: false },
    definition: { id: "tasks-detail-panel@1", digest: `sha256:${scenarioDigest}` },
    instanceId: runId,
    startedAt,
    completedAt,
    durationMs,
    status,
    exitCode: execution.exitCode,
    ready: passed,
    wrapperExitCode: passed ? 0 : 1,
    fidelity: {
      rendering: "built-product",
      identity: "synthetic",
      persistence: "not-exercised",
      details: { ...definition.fidelity, source: "experience/browser-contract.json and experience/critical-fixtures.json" },
    },
    viewports: expectedProjects.map((name) => ({ name, ...(viewportByName.get(name) ?? {}) })),
    artifacts,
    missingProof,
    limitations,
    scenario: { id: definition.id, version: definition.version, digest: `sha256:${scenarioDigest}` },
    run: { id: runId, startedAt, completedAt, durationMs },
    source: { repository: definition.source.repository, ...source },
    build,
    journey: {
      title,
      command: "node_modules/@playwright/test/cli.js test --config experience/playwright.config.ts --grep <fixed-title> --reporter=json --output <run-dir>/playwright-results",
      commandArgv: [process.execPath, path.join(repo, "node_modules", "@playwright", "test", "cli.js"), "test", "--config", "experience/playwright.config.ts", "--grep", title, "--reporter=json", "--output", path.join(output, "playwright-results")],
      exitCode: execution.exitCode,
      childSignal: execution.childSignal,
      termination: execution.termination,
      status,
      cases,
      screenshotCount: screenshots.length,
    },
    runtime: browser,
    screenshots,
    proofLimits: limitations,
    failure: execution.outputOverflow ? "Process output exceeded the 100 MiB safety cap and was truncated." : execution.termination ? "The Playwright process tree was terminated; journey outcome is unknown." : execution.spawnError ? "The Playwright process could not be started." : execution.exitCode === null ? "Playwright process could not be started." : passed ? null : "The exact journey did not complete with four passed viewport cases and four captured PNGs; inspect the retained Playwright report and stderr artifacts.",
    custody: { location: path.relative(repo, output).replaceAll("\\", "/"), secretFree: true, rawLogsRetained: true },
  };
  writeFileSync(path.join(output, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  return receipt;
}

export async function main(argv = process.argv.slice(2)) {
  const output = parseArgs(argv);
  const receipt = await runWithOutput({ output });
  console.log(JSON.stringify({ status: receipt.status, runId, scenarioDigest: receipt.scenario.digest, screenshots: receipt.screenshots.length, output: receipt.custody.location, wrapperExitCode: receipt.wrapperExitCode }));
  return receipt.wrapperExitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((exitCode) => { process.exitCode = exitCode; }).catch((error) => {
    console.error(`Workbench runner failed: ${error.message}`);
    process.exitCode = 1;
  });
}
