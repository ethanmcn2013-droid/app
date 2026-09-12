import { createServer } from "node:net";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  mergeDedicatedEnv,
  readDedicatedEnv,
  validateDeploymentConfig,
  validateRecipientIdentityEnv,
} from "./preflight.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const outputRoot = path.join(root, "experience", "output", "recipient-identity");
const runtimeRoot = path.join(outputRoot, "runtime");
const playwrightRoot = path.join(outputRoot, "playwright");
const evidencePath = path.join(outputRoot, "journey-result.json");
const receiptPath = path.join(outputRoot, "receipt.json");
const allowedUntrackedHooks = new Set([
  "?? .githooks/post-checkout",
  "?? .githooks/post-commit",
  "?? .githooks/post-merge",
  "?? .githooks/pre-push",
]);

const SAFE_OS_KEYS = [
  "APPDATA", "CI", "COMSPEC", "ComSpec", "HOME", "LOCALAPPDATA", "NUMBER_OF_PROCESSORS",
  "OS", "PATH", "Path", "PATHEXT", "PNPM_HOME", "PROCESSOR_ARCHITECTURE", "SYSTEMDRIVE",
  "SYSTEMROOT", "SystemRoot", "TEMP", "TMP", "USERPROFILE", "WINDIR", "windir",
];

// Next production-mode validation requires the Tasks token to be present even
// though libSQL file clients do not authenticate. This fixed, public sentinel
// is created inside the isolated child boundary; caller-supplied database
// credentials remain forbidden by preflight and never cross into the child.
export const LOCAL_DATABASE_AUTH_SENTINEL = "recipient-identity-local-file-sentinel";
export const RECIPIENT_IDENTITY_PROOF_MARKER = "local-clerk-recipient-proof-v1";

const REQUIRED_STAGES = [
  "testingTokenIssued", "twoSessionsIssued", "signedOutInviteShown", "wrongAccountRefused",
  "inviteAccepted", "recipientTaskCompleted", "homeReturned", "creatorReadback",
  "replayRefused", "removedMemberRefused",
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    env: options.env ?? process.env,
    shell: false,
  });
  if (result.error) throw result.error;
  if (options.capture && result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args.join(" ")} failed.`);
  }
  return result;
}

function git(...args) {
  return run("git", args, { capture: true }).stdout.trim();
}

async function assertPortFree(port, hostname) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () => reject(new Error(`Loopback port ${port} is already in use.`)));
    server.listen(port, hostname, () => server.close(resolve));
  });
}

function assertInsideOutput(target) {
  const resolved = path.resolve(target);
  const expectedRoot = path.resolve(root, "experience", "output", "recipient-identity");
  if (resolved !== expectedRoot && !resolved.startsWith(expectedRoot + path.sep)) {
    throw new Error("Recipient output path escaped its ignored run root.");
  }
  return resolved;
}

export function resetRunOutput(target = outputRoot) {
  const resolved = assertInsideOutput(target);
  rmSync(resolved, { recursive: true, force: true });
  mkdirSync(resolved, { recursive: true });
}

function scrubSensitiveRunState() {
  for (const target of [runtimeRoot, playwrightRoot, path.join(outputRoot, ".auth")]) {
    rmSync(assertInsideOutput(target), { recursive: true, force: true });
  }
}

function localDatabaseUrl(name) {
  return pathToFileURL(path.join(runtimeRoot, `${name}.db`)).href;
}

function atomicJson(filePath, value) {
  const temporary = `${filePath}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporary, filePath);
}

function readEvidence() {
  let value = {};
  try {
    value = JSON.parse(readFileSync(evidencePath, "utf8"));
  } catch {}
  return {
    stages: Object.fromEntries(REQUIRED_STAGES.map((stage) => [stage, value?.stages?.[stage] === true])),
    wrongAccountDiagnostic: sanitizeWrongAccountDiagnostic(value?.wrongAccountDiagnostic),
  };
}

const ROUTE_CLASSES = new Set(["invite", "sign-in", "sign-up", "app", "other"]);
const SERVER_STATES = new Set([
  "signedOut", "wrongVerified", "wrongUnverified", "matchingAccount",
  "missing", "expired", "accepted", "unclassified",
]);
const PAGE_ERROR_CLASSES = new Set([
  "none", "missingClerkProvider", "multipleClerkProviders", "hydration", "other",
]);
const IDENTITY_DIAGNOSTIC_KEYS = [
  "clerkLoaded", "signedIn", "primaryVerified", "expectedCreator",
];

export function sanitizeWrongAccountDiagnostic(value) {
  if (!value || typeof value !== "object") return null;
  const browserIdentity = Object.fromEntries(
    IDENTITY_DIAGNOSTIC_KEYS.map((key) => [key, value.browserIdentity?.[key] === true]),
  );
  const safeCount = (candidate) => Number.isSafeInteger(candidate) && candidate >= 0
    ? Math.min(candidate, 999)
    : 0;
  return {
    routeClass: ROUTE_CLASSES.has(value.routeClass) ? value.routeClass : "other",
    rendered: {
      serverState: SERVER_STATES.has(value.rendered?.serverState)
        ? value.rendered.serverState
        : "unclassified",
      genericError: value.rendered?.genericError === true,
      clerkUi: value.rendered?.clerkUi === true,
      wrongCopyVisible: value.rendered?.wrongCopyVisible === true,
      unverifiedCopyVisible: value.rendered?.unverifiedCopyVisible === true,
      switchVisible: value.rendered?.switchVisible === true,
    },
    browserIdentity,
    errors: {
      consoleCount: safeCount(value.errors?.consoleCount),
      pageCount: safeCount(value.errors?.pageCount),
      pageClass: PAGE_ERROR_CLASSES.has(value.errors?.pageClass)
        ? value.errors.pageClass
        : "other",
    },
  };
}

export function buildReceipt({ status, errorCode, sourceRevision, sourceTree, vercelBlob, deploymentGuardValidated, startedAt, evidence }) {
  const stages = evidence?.stages ?? Object.fromEntries(
    REQUIRED_STAGES.map((stage) => [stage, evidence?.[stage] === true]),
  );
  return {
    schemaVersion: 2,
    status,
    errorCode,
    source: { revision: sourceRevision, tree: sourceTree },
    deploymentGuard: {
      path: "vercel.json",
      validated: deploymentGuardValidated,
      blob: deploymentGuardValidated ? vercelBlob : null,
      deploymentEnabled: deploymentGuardValidated ? false : null,
    },
    target: "loopback Next production build with fresh local file databases",
    intendedIdentityBoundary: "two controlled accounts in one declared Clerk development instance; key-pair usability is observed only after ticket consumption and verified-user readback; ticket sign-in bypasses sign-in UI and MFA",
    fixtureBoundary: "project, pending invitation, assigned task and membership removal are isolated local database fixtures; creator invitation authoring and removal UI are not exercised",
    observedStages: stages,
    wrongAccountDiagnostic: sanitizeWrongAccountDiagnostic(evidence?.wrongAccountDiagnostic),
    signInUi: "signed-out invitation, exact redirect intent and automatic return are required; credential-entry UI is not exercised",
    providers: { clerk: "bounded testing-token and ticket-session requests only", mail: "disabled", drive: "disabled", stripe: "disabled" },
    custody: "sanitized receipt, stage booleans and fixed wrong-account diagnostic enums/counts remain in ignored local output; databases, browser output, auth state, account labels, invite tokens, traces and screenshots are removed",
    startedAt,
    completedAt: new Date().toISOString(),
  };
}

function writeReceipt(input) {
  atomicJson(receiptPath, buildReceipt(input));
}

export function buildChildEnvironment(merged, config, osEnvironment = process.env) {
  const env = {};
  for (const key of SAFE_OS_KEYS) {
    if (osEnvironment[key]) env[key] = osEnvironment[key];
  }
  Object.assign(env, {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: merged.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: merged.CLERK_SECRET_KEY,
    SIGNAL_RECIPIENT_CLERK_INSTANCE: merged.SIGNAL_RECIPIENT_CLERK_INSTANCE,
    SIGNAL_RECIPIENT_CLERK_SECRET_INSTANCE: merged.SIGNAL_RECIPIENT_CLERK_SECRET_INSTANCE,
    SIGNAL_RECIPIENT_CREATOR_EMAIL: config.creatorEmail,
    SIGNAL_RECIPIENT_RECIPIENT_EMAIL: config.recipientEmail,
    SIGNAL_RECIPIENT_EVIDENCE_PATH: evidencePath,
    SIGNAL_RECIPIENT_SOURCE_REVISION: config.sourceRevision,
    SIGNAL_RECIPIENT_IDENTITY_PROOF: RECIPIENT_IDENTITY_PROOF_MARKER,
    SIGNAL_RECIPIENT_PROOF_ORIGIN: config.baseURL,
    TASKS_DATABASE_URL: localDatabaseUrl("tasks"),
    TASKS_AUTH_TOKEN: LOCAL_DATABASE_AUTH_SENTINEL,
    NOTES_DATABASE_URL: localDatabaseUrl("notes"),
    TIMELINE_DATABASE_URL: localDatabaseUrl("timeline"),
    SIGNAL_DATABASE_URL: localDatabaseUrl("signal"),
    ENTITLEMENTS_DATABASE_URL: localDatabaseUrl("entitlements"),
    SIGNAL_RECIPIENT_PORT: String(config.port),
    NEXT_PUBLIC_SITE_URL: config.baseURL,
    SIGNAL_ACCESS_MODE: "production",
    NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "production",
    SIGNAL_ACTIVE_PROJECT_V3_ENABLED: "true",
    SIGNAL_ALLOWLIST: config.creatorEmail,
    VERCEL_ENV: "development",
    NEXT_TELEMETRY_DISABLED: "1",
  });
  return env;
}

async function main() {
  const startedAt = new Date().toISOString();
  let sourceRevision = null;
  let sourceTree = null;
  let vercelBlob = null;
  let deploymentGuardValidated = false;
  let status = "failed";
  let errorCode = "preflight_failed";
  let exitCode = 1;
  resetRunOutput();

  try {
    const dedicatedPath = path.join(root, ".env.recipient-identity.local");
    const merged = mergeDedicatedEnv(process.env, readDedicatedEnv(dedicatedPath));
    const config = validateRecipientIdentityEnv(merged, { cwd: root });
    validateDeploymentConfig({ cwd: root });

    const branch = git("branch", "--show-current");
    if (branch !== "ops/recipient-identity-proof") throw new Error(`Wrong branch: ${branch || "detached"}.`);
    for (const ancestor of ["5150171bad448c31f2c741a0d4f61b1e379e73fd", "639be07e855e3e625038a7ba8f660110da836f19"]) {
      const check = run("git", ["merge-base", "--is-ancestor", ancestor, "HEAD"], { capture: true, allowFailure: true });
      if (check.status !== 0) throw new Error(`Required source ${ancestor} is not composed into HEAD.`);
    }
    const dirty = git("status", "--porcelain=v1").split(/\r?\n/).filter(Boolean).filter((line) => !allowedUntrackedHooks.has(line));
    if (dirty.length > 0) throw new Error("Commit the recipient proof source before running the real-session journey.");

    sourceRevision = git("rev-parse", "HEAD");
    sourceTree = git("rev-parse", "HEAD^{tree}");
    vercelBlob = git("rev-parse", "HEAD:vercel.json");
    deploymentGuardValidated = true;
    await assertPortFree(config.port, new URL(config.baseURL).hostname);
    mkdirSync(runtimeRoot, { recursive: true });

    const pnpmCli = process.env.npm_execpath;
    if (!pnpmCli || !existsSync(pnpmCli)) throw new Error("Run this target through pnpm.");
    errorCode = "journey_failed";
    const result = run(process.execPath, [pnpmCli, "exec", "playwright", "test", "--config", "experience/recipient-identity/playwright.config.ts"], { env: buildChildEnvironment(merged, { ...config, sourceRevision }) });
    exitCode = result.status ?? 1;
    const evidence = readEvidence();
    if (exitCode === 0 && REQUIRED_STAGES.every((stage) => evidence.stages[stage])) {
      status = "passed";
      errorCode = null;
    } else if (exitCode === 0) {
      errorCode = "incomplete_observed_stages";
      exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
  } finally {
    const evidence = readEvidence();
    scrubSensitiveRunState();
    writeReceipt({ status, errorCode, sourceRevision, sourceTree, vercelBlob, deploymentGuardValidated, startedAt, evidence });
    process.exitCode = exitCode;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main();
