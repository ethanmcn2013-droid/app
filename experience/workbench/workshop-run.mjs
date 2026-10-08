#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, lstatSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const definitionPath = path.join(repo, "experience/workbench/workshop-definition.json");
const definition = JSON.parse(readFileSync(definitionPath, "utf8"));
const APPROVED_DEFINITION_SHA256 = "571fde8b22427e4f2fd19139c06814e569221da4f5f1454ce6d7775b9706de71";
const outputRoot = path.join(repo, "experience/output/workbench-workshop-runs");
const variants = ["record-first", "context-first"];
const viewports = ["mobile", "tablet", "desktop", "wide"];
const requiredChecks = ["section-order", "original-controls", "initial-axe", "initial-overflow", "keyboard-open-close-focus", "popover-escape", "title-edit", "priority-edit", "notes-edit", "expand-baseline", "navigation-selector", "invalid-selector-default", "long-content", "runtime"];
const recipeFiles = ["experience/workbench/workshop-run.mjs", "experience/workbench/workshop-definition.json",
  "experience/workbench/workshop.playwright.config.ts", "experience/tests/workshop-task-detail.spec.ts",
  "experience/browser-contract.json", "experience/critical-fixtures.json", "experience/runtime-policy.ts",
  "package.json", "pnpm-lock.yaml", "vercel.json"];
const retainedSources = {
  "runner-source.mjs": "experience/workbench/workshop-run.mjs",
  "scenario-definition.json": "experience/workbench/workshop-definition.json",
  "workshop-config.ts": "experience/workbench/workshop.playwright.config.ts",
  "workshop-spec.ts": "experience/tests/workshop-task-detail.spec.ts",
  "browser-contract.json": "experience/browser-contract.json",
  "critical-fixtures.json": "experience/critical-fixtures.json",
  "runtime-policy.ts": "experience/runtime-policy.ts",
};
const limitations = [
  "The real built App uses its registered synthetic demo task; authenticated identity and customer data are not exercised.",
  "Title, priority and Notes readbacks cover the in-memory demo context; persistence, database writes and server-action readbacks are not exercised.",
  "Loading, error, stale-task, uploads, authenticated and provider-dependent states are outside this workshop.",
  "Clock behavior is inherited from the registered built-App fixture; no clock override is claimed.",
  "No human comprehension study, founder preference, measured ROI, receiving acceptance, or release disposition is produced.",
];
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const digest = value => `sha256:${hash(Buffer.from(canonical(value)))}`;
function refuse(message) { throw new Error(`Workshop runner refused: ${message}`); }
function git(args) {
  const result = spawnSync("git", args, { cwd: repo, encoding: "utf8", windowsHide: true, shell: false });
  if (result.status !== 0) refuse(`git ${args[0]} could not establish source state`);
  return result.stdout.trim();
}
function rejectSymlinks(target) {
  let current = path.parse(target).root;
  for (const part of target.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try { if (lstatSync(current).isSymbolicLink()) refuse("evidence/source path contains a symbolic link or junction"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}
export function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== "--output" || !argv[1]) refuse("only --output <fresh-run-directory> is supported");
  const output = path.resolve(repo, argv[1]);
  if (path.dirname(output) !== outputRoot) refuse("output must be a new direct child of experience/output/workbench-workshop-runs");
  rejectSymlinks(output);
  try { lstatSync(output); refuse("output already exists; failed attempts are immutable"); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  return output;
}
function verifySource() {
  rejectSymlinks(repo);
  if (hash(Buffer.from(canonical(definition))) !== APPROVED_DEFINITION_SHA256) refuse("scenario definition differs from the fixed admitted recipe");
  if (definition.source.repository !== "ethanmcn2013-droid/app" || definition.id !== "tasks-detail-workshop" || definition.version !== 1) refuse("scenario identity mismatch");
  const branch = git(["branch", "--show-current"]);
  if (branch !== "feat/workbench-task-workshop" || branch !== definition.source.branch) refuse("unknown source branch");
  const status = git(["status", "--porcelain=v1", "--untracked-files=all"]);
  if (status) refuse("candidate worktree is dirty; commit all source before qualification");
  git(["merge-base", "--is-ancestor", definition.source.baseCommit, "HEAD"]);
  if (readdirSync(repo).some(file => /^\.env(?:\.|$)/.test(file) && file !== ".env.example")) refuse("local .env file exists in the isolated build checkout");
  const fixtures = JSON.parse(readFileSync(path.join(repo, definition.scenario.fixtureSource), "utf8"));
  const fixture = fixtures.experiences.find(entry => entry.id === "tasks.surface.task-detail-panel");
  if (!fixture || fixture.caseName !== "populated task" || fixture.interaction !== "task-detail-panel") refuse("registered fixture changed");
  const contract = JSON.parse(readFileSync(path.join(repo, definition.scenario.browserContract), "utf8"));
  if (canonical(contract.projects.map(project => project.name)) !== canonical(viewports) || contract.determinism.accessMode !== "demo" || contract.determinism.deploymentEnvironment !== "preview") refuse("registered browser/fidelity contract changed");
  const files = Object.fromEntries(recipeFiles.map(file => {
    rejectSymlinks(path.join(repo, file));
    return [file, `sha256:${hash(readFileSync(path.join(repo, file)))}`];
  }));
  return { repository: definition.source.repository, branch, candidate: { commit: git(["rev-parse", "HEAD"]), tree: git(["rev-parse", "HEAD^{tree}"]), dirty: false }, baseCommit: definition.source.baseCommit, recipeFiles: files };
}
function terminate(child) {
  if (!child.pid) return { requested: true, result: "no-child-pid" };
  if (process.platform === "win32") {
    const killed = spawnSync(path.join(process.env.SystemRoot ?? "C:\\Windows", "System32/taskkill.exe"), ["/PID", String(child.pid), "/T", "/F"], { cwd: repo, windowsHide: true, encoding: "utf8", shell: false });
    if (killed.status !== 0) child.kill();
    return { requested: true, mechanism: "taskkill-process-tree", result: killed.status === 0 ? "terminated" : "child-kill-requested" };
  }
  try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
  return { requested: true, mechanism: "SIGTERM-process-group", result: "requested" };
}
function runPlaywright(output, signal) {
  return new Promise(resolve => {
    // An allowlist, not ambient inheritance: no provider/production credentials,
    // caller-selected ports, external servers, Node hooks or feature flags.
    const env = {};
    for (const name of ["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "APPDATA", "LOCALAPPDATA", "USERPROFILE"]) if (process.env[name]) env[name] = process.env[name];
    if (process.env.CI) env.CI = "1";
    env.PLAYWRIGHT_JSON_OUTPUT_NAME = path.join(output, "playwright-report.json");
    const cli = path.join(repo, "node_modules/@playwright/test/cli.js");
    const args = [cli, "test", "--config", "experience/workbench/workshop.playwright.config.ts", "--output", path.join(output, "playwright-results")];
    const child = spawn(process.execPath, args, { cwd: repo, env, windowsHide: true, shell: false, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [], stderr = [];
    let outBytes = 0, errBytes = 0, settled = false, termination = null, overflow = false;
    const stop = () => { if (!settled && !termination) termination = terminate(child); };
    const timer = setTimeout(stop, 720_000);
    const finish = (code = null, childSignal = null, error = null) => {
      if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener("abort", stop);
      writeFileSync(path.join(output, "playwright-stdout.log"), Buffer.concat(stdout), { flag: "wx" });
      writeFileSync(path.join(output, "playwright-stderr.log"), Buffer.concat(stderr), { flag: "wx" });
      let report = null, reportError = null;
      try { report = JSON.parse(readFileSync(path.join(output, "playwright-report.json"), "utf8")); }
      catch (failure) { reportError = failure.message; }
      resolve({ exitCode: termination || error ? null : code, childSignal, termination, outputOverflow: overflow, spawnError: error?.message ?? null, report, reportError, commandArgv: [process.execPath, ...args] });
    };
    child.stdout.on("data", chunk => { outBytes += chunk.length; if (outBytes > 100 * 1024 * 1024) { overflow = true; stop(); } else stdout.push(chunk); });
    child.stderr.on("data", chunk => { errBytes += chunk.length; if (errBytes > 100 * 1024 * 1024) { overflow = true; stop(); } else stderr.push(chunk); });
    child.on("error", error => finish(null, null, error)); child.on("close", (code, childSignal) => finish(code, childSignal));
    signal?.addEventListener("abort", stop, { once: true }); if (signal?.aborted) stop();
  });
}
function emptyQualification(failure) {
  return { failure, cases: viewports.flatMap(viewport => variants.map(variant => ({ variant, viewport, passed: false, initialCaptureBeforeEditing: false, initialStateDigest: null, checks: [], failure: "not observed" }))) };
}
function extractEvidence(report, output) {
  const expected = new Set(viewports.flatMap(viewport => variants.map(variant => `task-detail-${variant}-${viewport}.png`)));
  let qualification = null;
  const screenshots = [];
  const failures = [];
  const walk = suite => {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) for (const result of test.results ?? []) {
      for (const attachment of result.attachments ?? []) {
        if (typeof attachment.body !== "string") continue;
        const bytes = Buffer.from(attachment.body, "base64");
        if (expected.has(attachment.name) && attachment.contentType === "image/png") {
          if (screenshots.some(shot => shot.file === attachment.name)) { failures.push(`duplicate screenshot ${attachment.name}`); continue; }
          if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") { failures.push(`invalid PNG ${attachment.name}`); continue; }
          writeFileSync(path.join(output, attachment.name), bytes, { flag: "wx" });
          screenshots.push({ file: attachment.name, sha256: `sha256:${hash(bytes)}`, bytes: bytes.length, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });
        } else if (attachment.name === "qualification.json" && attachment.contentType === "application/json") {
          if (qualification) { failures.push("duplicate qualification attachment"); continue; }
          try { qualification = JSON.parse(bytes.toString("utf8")); } catch { failures.push("invalid qualification JSON"); }
        }
      }
    }
    for (const nested of suite.suites ?? []) walk(nested);
  };
  for (const suite of report?.suites ?? []) walk(suite);
  return { qualification, screenshots, failures };
}
export function validateQualification(qualification, screenshots) {
  const errors = [];
  if (!qualification || qualification.failure !== null || !Array.isArray(qualification.cases) || qualification.cases.length !== 8 || qualification.allInitialCapturesBeforeEditing !== true || qualification.initialCaptureCount !== 8) errors.push("Eight initial captures and qualification cases were not all completed before editing.");
  const cases = Array.isArray(qualification?.cases) ? qualification.cases : [];
  const initialStateDigests = {};
  for (const variant of variants) {
    const parts = [];
    for (const viewport of viewports) {
      const matches = cases.filter(item => item.variant === variant && item.viewport === viewport);
      const item = matches.length === 1 ? matches[0] : null;
      if (!item || item.passed !== true || item.initialCaptureBeforeEditing !== true || !/^sha256:[a-f0-9]{64}$/.test(item.initialStateDigest ?? "") || requiredChecks.some(name => item.checks?.filter(check => check.name === name && check.passed === true).length !== 1)) errors.push(`Qualification did not pass ${variant}/${viewport} with every required observed check.`);
      parts.push({ viewport, digest: item?.initialStateDigest ?? null });
      const captures = screenshots.filter(shot => shot.file === `task-detail-${variant}-${viewport}.png`);
      if (captures.length !== 1) errors.push(`Missing unique initial PNG for ${variant}/${viewport}.`);
    }
    initialStateDigests[variant] = parts.every(part => /^sha256:[a-f0-9]{64}$/.test(part.digest ?? "")) ? digest(parts) : null;
  }
  for (const viewport of viewports) {
    const pair = variants.map(variant => cases.find(item => item.variant === variant && item.viewport === viewport)?.initialStateDigest ?? null);
    if (!pair[0] || pair[0] !== pair[1]) errors.push(`Initial state differs or is unobserved at ${viewport}.`);
  }
  if (!initialStateDigests[variants[0]] || initialStateDigests[variants[0]] !== initialStateDigests[variants[1]]) errors.push("Four-viewport aggregate initial states differ or are unobserved.");
  return { errors, initialStateDigests };
}
function buildMetadata(source, confirmed) {
  if (!confirmed) return { status: "not-confirmed" };
  try {
    const files = ["BUILD_ID", "build-manifest.json", "routes-manifest.json", "prerender-manifest.json"];
    const manifests = Object.fromEntries(files.map(file => [file, `sha256:${hash(readFileSync(path.join(repo, ".next", file)))}`]));
    return { status: "built-by-playwright-webserver", sourceTree: source.candidate.tree, buildId: readFileSync(path.join(repo, ".next/BUILD_ID"), "utf8").trim(), manifests };
  } catch (error) { return { status: "not-confirmed", error: error.message }; }
}
export async function runWithOutput({ output: requestedOutput, signal } = {}) {
  const startedAt = new Date().toISOString(), started = Date.now();
  const instanceId = `task-workshop-${randomUUID()}`;
  const output = parseArgs(["--output", requestedOutput]);
  const source = verifySource();
  const sourceBytes = Object.fromEntries(Object.entries(retainedSources).map(([name, file]) => [name, readFileSync(path.join(repo, file))]));
  mkdirSync(outputRoot, { recursive: true }); rejectSymlinks(outputRoot); mkdirSync(output);
  const execution = await runPlaywright(output, signal);
  const evidence = extractEvidence(execution.report, output);
  const qualification = evidence.qualification ?? emptyQualification(execution.spawnError ?? execution.reportError ?? "Qualification attachment not produced.");
  const validation = validateQualification(qualification, evidence.screenshots);
  let sourceAfter = null, sourceFailure = null;
  try { sourceAfter = verifySource(); if (canonical(sourceAfter) !== canonical(source)) sourceFailure = "Candidate commit, tree or recipe hashes changed during qualification."; }
  catch (error) { sourceFailure = error.message; }
  const missingProof = [...evidence.failures, ...validation.errors];
  if (sourceFailure) missingProof.push(sourceFailure);
  if (!execution.report || execution.report.errors?.length || execution.report.stats?.expected !== 1 || execution.report.stats?.unexpected !== 0 || execution.report.stats?.skipped !== 0 || execution.report.stats?.flaky !== 0) missingProof.push("Native Playwright report did not confirm the one complete serial journey without errors, skipped or failed cases.");
  const build = buildMetadata(source, !!evidence.qualification);
  if (build.status !== "built-by-playwright-webserver") missingProof.push("Built App metadata was not confirmed.");
  const passed = execution.exitCode === 0 && !execution.outputOverflow && missingProof.length === 0;
  const status = execution.exitCode === null ? "unknown" : passed ? "passed" : "failed";
  if (!passed && !missingProof.length) missingProof.push("Browser journey process did not complete successfully.");
  const sourceEvidence = { ...source, sourceAfter, sourceStable: !sourceFailure, sourceFailure };
  const saveJson = (name, value) => writeFileSync(path.join(output, name), `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  saveJson("qualification.json", qualification);
  saveJson("source-metadata.json", sourceEvidence);
  saveJson("build-metadata.json", build);
  for (const [name, bytes] of Object.entries(sourceBytes)) writeFileSync(path.join(output, name), bytes, { flag: "wx" });
  const artifacts = readdirSync(output, { withFileTypes: true }).filter(entry => entry.isFile()).map(entry => {
    const bytes = readFileSync(path.join(output, entry.name));
    return { name: entry.name, path: entry.name, sha256: `sha256:${hash(bytes)}`, bytes: bytes.length,
      mediaType: entry.name.endsWith(".png") ? "image/png" : entry.name.endsWith(".json") ? "application/json" : entry.name.endsWith(".mjs") ? "text/javascript" : "text/plain" };
  });
  const browserVersion = typeof qualification.browserVersion === "string" ? qualification.browserVersion : null;
  const receipt = {
    schema: "signal-workbench-run/1", candidate: source.candidate,
    definition: { id: "tasks-detail-workshop@1", digest: digest(definition) }, instanceId, startedAt,
    completedAt: new Date().toISOString(), durationMs: Date.now() - started, status,
    exitCode: execution.exitCode, ready: passed, wrapperExitCode: passed ? 0 : 1,
    fidelity: { rendering: "built-product", identity: "synthetic", persistence: "not-exercised" },
    viewports: JSON.parse(readFileSync(path.join(repo, "experience/browser-contract.json"), "utf8")).projects.map(project => ({ name: project.name, ...project.viewport })),
    artifacts, limitations, missingProof,
    comparison: { fixtureId: "tasks.surface.task-detail-panel", taskName: definition.scenario.taskName, variants, initialStateDigests: validation.initialStateDigests },
    runtime: { node: process.version, platform: process.platform, architecture: process.arch,
      playwright: JSON.parse(readFileSync(path.join(repo, "node_modules/@playwright/test/package.json"), "utf8")).version,
      browser: browserVersion ? `Chromium ${browserVersion}` : "unknown", browserVersion, channel: process.env.CI ? "playwright-bundled" : "chrome" },
    source: sourceEvidence, build, screenshots: evidence.screenshots,
    journey: { commandArgv: execution.commandArgv, exitCode: execution.exitCode, childSignal: execution.childSignal, termination: execution.termination, spawnError: execution.spawnError, reportError: execution.reportError, outputOverflow: execution.outputOverflow },
    failure: passed ? null : missingProof.join("\n"), custody: { location: path.relative(repo, output).replaceAll("\\", "/"), rawLogsRetained: true },
  };
  saveJson("receipt.json", receipt);
  return receipt;
}
export async function main(argv = process.argv.slice(2)) {
  const output = parseArgs(argv);
  const receipt = await runWithOutput({ output });
  console.log(JSON.stringify({ status: receipt.status, ready: receipt.ready, instanceId: receipt.instanceId, output: receipt.custody.location, wrapperExitCode: receipt.wrapperExitCode }));
  return receipt.wrapperExitCode;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code; }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
