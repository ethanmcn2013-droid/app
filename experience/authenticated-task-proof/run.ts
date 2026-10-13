import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { once } from "node:events";
import { createClient } from "@libsql/client";
import { chromium, type Page, type BrowserContext } from "@playwright/test";
import { seedFiveStoreFixture, validateProofInput, type ProofInput } from "./fixture";
import { boundedServerDiagnostics } from "./server-diagnostics";
import { waitForProofReadiness } from "./readiness";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const endpoint = "/api/internal/local-task-operations";
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
type Fact = { name: string; passed: boolean; detail?: unknown };

/** This runner is deliberately inert until an explicit private runtime input
 * is supplied. Source tests do not invoke it. No browser profile or CDP API. */
export async function runAuthenticatedTaskProof(input: ProofInput) {
  validateProofInput(input);
  if (!process.send || !process.connected) throw new Error("Parent cleanup launcher is required");
  let interrupted = false;
  const active = () => { if (interrupted || Date.parse(input.runtimeGrant.expiresAt) <= Date.now()) throw new Error("Runtime admission expired or interrupted"); };
  const custody = (name: string, pid?: number) => new Promise<void>((accept, reject) => {
    const id = `${name}-${Date.now()}`;
    const timer = setTimeout(() => { process.off("message", received); reject(new Error("Native custody acknowledgement timed out")); }, 15000);
    const received = (message: unknown) => { const reply = message as { type?: string; id?: string; ok?: boolean }; if (reply.type === "custody-ack" && reply.id === id) { clearTimeout(timer); process.off("message", received); reply.ok ? accept() : reject(new Error("Native custody capture failed")); } };
    process.on("message", received); process.send!({ type: "custody-checkpoint", id, name, pid });
  });
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const tree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
  assert.equal(sha, input.runtimeGrant.sourceSha); assert.equal(tree, input.runtimeGrant.sourceTree);
  assert.equal(execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" }).trim(), "");
  const buildId = readFileSync(".next/BUILD_ID", "utf8").trim();
  assert.equal(buildId, input.runtimeGrant.buildId);
  if (!input.testEmailCodeEligible) throw new Error("Normal test-email code eligibility must be privately qualified");
  if (existsSync(input.evidenceRoot)) throw new Error("Fresh evidence root must be unoccupied");
  mkdirSync(input.evidenceRoot, { recursive: true });
  const facts: Fact[] = [];
  const save = () => writeFileSync(resolve(input.evidenceRoot, "evidence.json"), JSON.stringify({ version: 1, sourceSha: sha, sourceTree: tree, buildId, origin: input.origin, facts }, null, 2));
  const check = async (name: string, action: () => Promise<unknown>) => {
    active();
    try { const detail = await action(); facts.push({ name, passed: true, ...(detail === undefined ? {} : { detail }) }); save(); }
    catch { facts.push({ name, passed: false }); save(); throw new Error(`Proof failed: ${name}`); }
  };
  // A listening port is checked before owning any server, using the standard
  // TCP API; request readiness is separate from this custody check.
  const { createServer } = await import("node:net");
  const port = Number(new URL(input.origin).port);
  const probe = createServer();
  await new Promise<void>((resolve, reject) => { probe.once("error", reject); probe.listen(port, "127.0.0.1", () => probe.close(error => error ? reject(error) : resolve())); });
  const urls = await seedFiveStoreFixture(input);
  const database = createClient({ url: urls.TASKS_DATABASE_URL });
  const entitlementDatabase = createClient({ url: urls.ENTITLEMENTS_DATABASE_URL });
  const entitlementOracle = async () => {
    const schema = (await entitlementDatabase.execute("SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY name")).rows;
    const data = [];
    for (const table of schema.filter(row => row.type === "table")) {
      const rows = (await entitlementDatabase.execute(`SELECT * FROM "${String(table.name).replaceAll('"', '""')}"`)).rows;
      data.push({ table: table.name, rows: rows.length, sha256: hash(JSON.stringify(rows)) });
    }
    return { schema, data };
  };
  const entitlementsBefore = await entitlementOracle();
  assert.deepEqual(entitlementsBefore, { schema: [], data: [] });
  let server: ChildProcess | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let contexts: BrowserContext[] = [];
  const childEnv: NodeJS.ProcessEnv = { NODE_ENV: "production", PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, TEMP: process.env.TEMP, TMP: process.env.TMP,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    SIGNAL_LOCAL_TASK_OPERATIONS: "true", SIGNAL_ACCESS_MODE: "production", NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "production", SIGNAL_LOCAL_TASK_ORIGIN: input.origin, SIGNAL_LOCAL_TASK_STORE_ROOT: input.storeRoot,
    SIGNAL_LOCAL_TASK_ISSUER: input.issuer, SIGNAL_LOCAL_TASK_SUBJECTS: input.accounts.map(account => account.subject).join(","), SIGNAL_LOCAL_TASK_EXPIRES_AT: input.runtimeGrant.expiresAt, SIGNAL_LOCAL_TASK_CLERK_ORIGINS: JSON.stringify(input.clerkOrigins), NEXT_PUBLIC_APP_URL: input.origin, NEXT_PUBLIC_SITE_URL: input.origin, ...urls };
  let stopping: Promise<void> | undefined;
  let serverSequence = 0;
  const stop = async () => {
    if (!server) return;
    if (server.exitCode !== null) { server = undefined; return; }
    if (stopping) return stopping;
    const owned = server;
    stopping = (async () => {
      const exited = once(owned, "exit");
      owned.kill();
      let timer!: ReturnType<typeof setTimeout>;
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Owned server stop timed out")), 10000); });
      try { const exit = await Promise.race([exited, timeout]); facts.push({ name: "owned-server-native-exit", passed: true, detail: { pid: owned.pid, code: exit[0], signal: exit[1] } }); server = undefined; save(); }
      finally { clearTimeout(timer); }
    })();
    try { await stopping; } finally { stopping = undefined; }
  };
  const interrupt = (message: unknown) => { if ((message as { type?: string }).type !== "stop-owned-proof") return; interrupted = true; void browser?.close().catch(() => undefined); void stop().catch(() => undefined); };
  process.on("message", interrupt);
  const start = async () => {
    active();
    const sequence = ++serverSequence;
    const diagnostics = boundedServerDiagnostics();
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), env: childEnv, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const owned = server;
    const privateValues = [childEnv.CLERK_SECRET_KEY, childEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, input.issuer, ...input.accounts.flatMap(account => Object.values(account))];
    const file = `server-${sequence}.sanitized.log`;
    const append = (stream: "stdout" | "stderr", chunk: Buffer) => {
      diagnostics.append(stream, chunk);
      // Persist only complete, redacted lines while running so a hard child
      // failure still leaves bounded diagnostics without partial credentials.
      writeFileSync(resolve(input.evidenceRoot, file), diagnostics.finish(privateValues, true).contents);
    };
    owned.stdout?.on("data", chunk => append("stdout", Buffer.from(chunk)));
    owned.stderr?.on("data", chunk => append("stderr", Buffer.from(chunk)));
    owned.once("close", (code, signal) => {
      const result = diagnostics.finish(privateValues);
      writeFileSync(resolve(input.evidenceRoot, file), result.contents);
      facts.push({ name: "owned-server-private-diagnostics", passed: true, detail: { file, bytes: result.bytes, sha256: result.sha256, rawBytes: result.rawBytes, truncated: result.truncated, pid: owned.pid, nativeExitCode: code, signal } }); save();
    });
    await custody("owned-server-start", server.pid);
    const readiness = await waitForProofReadiness({ origin: input.origin, expiresAt: input.runtimeGrant.expiresAt, active, child: () => ({ pid: owned.pid, exitCode: owned.exitCode, signalCode: owned.signalCode }) });
    const snapshot = diagnostics.finish(privateValues, true);
    facts.push({ name: "owned-server-readiness", passed: readiness.ready, detail: { ...readiness, diagnostics: { file, bytes: snapshot.bytes, sha256: snapshot.sha256, truncated: snapshot.truncated } } }); save();
    if (!readiness.ready) throw new Error("Owned server readiness failed");
  };
  const counts = async () => {
    const result = await database.execute("SELECT (SELECT count(*) FROM tasks) tasks, (SELECT count(*) FROM activities) activities, (SELECT count(*) FROM meta WHERE key LIKE 'local-task-operation:v1:%') receipts, (SELECT count(*) FROM workspace_members) memberships");
    return result.rows[0];
  };
  const dbTask = async (taskId: string) => (await database.execute({ sql: "SELECT id, workspace_id, title FROM tasks WHERE id = ?", args: [taskId] })).rows[0];
  const stateHash = async () => {
    const records = await Promise.all(["SELECT * FROM tasks ORDER BY id", "SELECT * FROM activities ORDER BY id", "SELECT * FROM meta WHERE key LIKE 'local-task-operation:v1:%' ORDER BY key", "SELECT * FROM workspace_members ORDER BY workspace_id,user_id"].map(sql => database.execute(sql)));
    return hash(JSON.stringify(records.map(record => record.rows)));
  };
  const committedOperation = async (index: number, operation: { operationId: string; kind: string; projectId: string; taskId: string; title: string }, response: { activityId: string }) => {
    const actor = input.accounts[index].subject;
    const activity = (await database.execute({ sql: "SELECT user_id,workspace_id,task_id,kind,payload FROM activities WHERE id = ?", args: [response.activityId] })).rows[0];
    assert(activity); assert.equal(activity.user_id, actor); assert.equal(activity.workspace_id, operation.projectId); assert.equal(activity.task_id, operation.taskId);
    assert.equal(activity.kind, operation.kind === "create" ? "taskAdd" : "update");
    const receipt = (await database.execute({ sql: "SELECT value FROM meta WHERE key = ?", args: [`local-task-operation:v1:${JSON.stringify([actor, operation.operationId])}`] })).rows[0];
    assert(receipt); const stored = JSON.parse(String(receipt.value)); assert.equal(stored.actor, actor); assert.deepEqual(stored.operation, operation); assert.deepEqual(stored.response, response);
  };
  const signIn = async (index: number) => {
    active();
    const context = await browser!.newContext(); contexts.push(context);
    // Only the admitted local app and normal Clerk development endpoints can
    // receive browser requests. There is no mailbox or provider administration.
    await context.route("**/*", async route => {
      if (interrupted || Date.parse(input.runtimeGrant.expiresAt) <= Date.now()) return route.abort();
      const url = new URL(route.request().url());
      if (url.origin === input.origin || input.clerkOrigins.includes(url.origin)) await route.continue();
      else await route.abort();
    });
    const page = await context.newPage();
    await page.goto(`${input.origin}/sign-in?redirect_url=${encodeURIComponent(`${input.origin}/app/tasks?workspaceId=${input.accounts[index].projectId}`)}`);
    await page.locator('input[name="identifier"]').fill(input.accounts[index].email);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    const emailCode = page.getByRole("button", { name: /email.*code|send.*code/i }).first();
    if (await emailCode.isVisible().catch(() => false)) await emailCode.click();
    const code = page.locator('input[autocomplete="one-time-code"]');
    await code.first().waitFor({ state: "visible" });
    if (await code.count() === 1) await code.fill("424242");
    else for (const [position, digit] of [..."424242"].entries()) await code.nth(position).fill(digit);
    await page.waitForURL(/\/app\//, { timeout: 60000 });
    await page.goto(`${input.origin}/app/tasks?workspaceId=${input.accounts[index].projectId}`);
    return page;
  };
  const request = async (page: Page, method: string, payload?: unknown, query = "") => { active(); return page.evaluate(async ({ endpoint, method, payload, query }) => {
    const response = await fetch(`${endpoint}${query}`, { method, headers: { "content-type": "application/json" }, ...(method === "GET" ? {} : { body: JSON.stringify(payload) }) });
    return { status: response.status, body: await response.json() };
  }, { endpoint, method, payload, query }); };
  try {
    await start(); active(); browser = await chromium.launch({ headless: true }); await custody("owned-browser-start");
    const pages: Page[] = [];
    for (const index of [0, 1]) {
      await check(`normal-sign-in-${index + 1}`, async () => {
        const page = await signIn(index); pages.push(page);
        const read = await request(page, "GET", undefined, `?projectId=${input.accounts[index].projectId}`);
        assert.equal(read.status, 200); assert.deepEqual(read.body.identity, { subject: input.accounts[index].subject, issuer: input.issuer, authorizedParty: input.origin });
        assert(await page.getByText(`Proof project ${index + 1}`, { exact: true }).first().isVisible());
        return { subjectSha256: hash(input.accounts[index].subject), issuerSha256: hash(input.issuer), party: input.origin };
      });
    }
    const operations = input.accounts.map((account, index) => ({ operationId: `proof-create-${index + 1}`, kind: "create", projectId: account.projectId, taskId: `proof-task-${index + 1}`, title: `Authenticated proof task ${index + 1}` }));
    const updates = operations.map((operation, index) => ({ ...operation, kind: "title", operationId: `proof-title-${index + 1}`, title: `Updated proof task ${index + 1}` }));
    const responses: unknown[] = [];
    for (const index of [0, 1]) {
      await check(`persisted-create-title-replay-${index + 1}`, async () => {
        const create = await request(pages[index], "POST", operations[index]); assert.equal(create.status, 200); responses[index] = create.body;
        await committedOperation(index, operations[index], create.body);
        const update = updates[index];
        const updated = await request(pages[index], "PATCH", update); assert.equal(updated.status, 200);
        await committedOperation(index, update, updated.body);
        const replayState = await stateHash();
        assert.deepEqual((await request(pages[index], "PATCH", update)).body, updated.body);
        assert.equal(await stateHash(), replayState);
        assert.deepEqual((await request(pages[index], "POST", operations[index])).body, create.body);
        const reconciliation = await request(pages[index], "PUT", operations[index]);
        assert.deepEqual(reconciliation.body.response, create.body); assert.equal(reconciliation.body.currentTask.title, update.title);
        await pages[index].reload(); const text = pages[index].getByText(update.title, { exact: true }).first(); await text.waitFor();
        await text.screenshot({ path: resolve(input.evidenceRoot, `task-${index + 1}.png`) });
        const row = await dbTask(update.taskId); assert.equal(row.workspace_id, update.projectId); assert.equal(row.title, update.title);
        return { taskId: update.taskId, title: row.title, operationResponseSha256: hash(JSON.stringify(create.body)) };
      });
    }
    // Both main Tasks must already be persisted before either direction probes
    // a known foreign target. Every attempt gets its own denominator and oracle.
    for (const index of [0, 1]) {
      const foreign = operations[1 - index];
      const attempts = [
        { name: "foreign-project-list", method: "GET", query: `?projectId=${foreign.projectId}` },
        { name: "foreign-task-read", method: "GET", query: `?projectId=${foreign.projectId}&taskId=${foreign.taskId}` },
        { name: "foreign-create", method: "POST", payload: { ...foreign, operationId: `foreign-create-${index}` } },
        { name: "foreign-title", method: "PATCH", payload: { ...foreign, kind: "title", operationId: `foreign-title-${index}` } },
      ];
      assert(await dbTask(foreign.taskId));
      for (const attempt of attempts) await check(`${attempt.name}-${index + 1}`, async () => {
        const before = await stateHash();
        assert.deepEqual(await request(pages[index], attempt.method, attempt.payload, attempt.query), { status: 404, body: { error: "unavailable" } });
        assert.equal(await stateHash(), before);
        return { knownExistingTarget: true, beforeStateSha256: before, afterStateSha256: await stateHash(), status: 404 };
      });
      for (const [kind, original] of [["create", operations[index]], ["title", updates[index]]] as const) {
        const method = kind === "create" ? "POST" : "PATCH";
        const conflicts = [
          { name: "payload", method, payload: { ...original, title: "Different" }, status: 409, error: "conflict" },
          { name: "task", method, payload: { ...original, taskId: input.accounts[index].siblingTaskId }, status: 409, error: "conflict" },
          { name: "kind", method: kind === "create" ? "PATCH" : "POST", payload: { ...original, kind: kind === "create" ? "title" : "create" }, status: 409, error: "conflict" },
          { name: "authorized-other-project-and-task", method, payload: { ...original, projectId: input.accounts[index].controlProjectId, taskId: input.accounts[index].controlTaskId }, status: 409, error: "conflict" },
          { name: "project-only-stale-task", method, payload: { ...original, projectId: input.accounts[index].controlProjectId }, status: 404, error: "unavailable" },
          { name: "foreign-project", method, payload: { ...original, projectId: foreign.projectId, taskId: foreign.taskId }, status: 404, error: "unavailable" },
        ];
        for (const attempt of conflicts) await check(`${kind}-reuse-${attempt.name}-${index + 1}`, async () => {
          const before = await stateHash();
          assert.deepEqual(await request(pages[index], attempt.method, attempt.payload), { status: attempt.status, body: { error: attempt.error } });
          assert.equal(await stateHash(), before);
          return { beforeStateSha256: before, afterStateSha256: await stateHash(), status: attempt.status };
        });
      }
    }
    await check("after-commit-response-loss-stop-restart-reauth-read-before-retry", async () => {
      const operation = { ...operations[0], operationId: "proof-lost-response", taskId: "proof-lost-task", title: "Recovered proof task" };
      let storedResponse: unknown;
      await pages[0].route(`**${endpoint}`, async route => {
        if (route.request().method() !== "POST") return route.continue();
        const response = await route.fetch(); storedResponse = await response.json();
        assert.equal((await dbTask(operation.taskId)).title, operation.title);
        await committedOperation(0, operation, storedResponse as { activityId: string });
        await stop(); await route.abort();
      }, { times: 1 });
      await request(pages[0], "POST", operation).catch(() => undefined);
      assert(storedResponse);
      for (const context of contexts) await context.close(); contexts = [];
      await start(); const page = await signIn(0);
      const before = await counts();
      const read = await request(page, "PUT", operation); assert.equal(read.status, 200); assert.deepEqual(read.body.response, storedResponse);
      assert.deepEqual((await request(page, "POST", operation)).body, storedResponse); assert.deepEqual(await counts(), before);
      await page.reload(); await page.getByText(operation.title, { exact: true }).first().waitFor();
      return { responseSha256: hash(JSON.stringify(storedResponse)), counts: before };
    });
  } finally {
    for (const context of contexts) await context.close().catch(() => undefined);
    await browser?.close().catch(() => undefined); await stop(); database.close();
    const entitlementsAfter = await entitlementOracle();
    facts.push({ name: "entitlements-read-only-before-after", passed: JSON.stringify(entitlementsBefore) === JSON.stringify(entitlementsAfter), detail: { before: entitlementsBefore, after: entitlementsAfter } });
    entitlementDatabase.close();
    // Native libSQL handles on Windows survive close until process exit.
    // The parent launcher deletes the owned whole-store root after this exit.
    facts.push({ name: "owned-processes-stopped", passed: server === undefined }); save();
    process.off("message", interrupt);
    if (JSON.stringify(entitlementsBefore) !== JSON.stringify(entitlementsAfter)) throw new Error("Entitlements mutated");
  }
}
if (process.argv[1]?.endsWith("run.ts") && process.argv[2]) {
  runAuthenticatedTaskProof(JSON.parse(readFileSync(resolve(process.argv[2]), "utf8"))).catch(() => { console.error("Authenticated proof failed; inspect private sanitized evidence."); process.exitCode = 1; });
}
