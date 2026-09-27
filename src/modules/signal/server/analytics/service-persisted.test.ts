import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdtempSync } from "node:fs";
import { join, resolve, relative, isAbsolute, sep } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { before, after, test } from "node:test";
import { createClient, type Client } from "@libsql/client";
import ts from "typescript";
import { freshFileDb } from "@/server/db/memory-test-db";
import { parseAnalyticsQuery } from "./query";
import type { BriefingResponse } from "../../lib/analytics/contracts";

// A bounded service integration fixture, separate from the frozen scoring
// adapter. All providers/service/ledger are actual imports against four explicit
// file databases. Only Clerk is controlled; no provider or service is replaced.
const NOW = Date.parse("2026-09-27T12:00:00Z");
const DAY = 86_400_000;
const PROJECT = "synthetic-service-project";
const FOREIGN = "synthetic-service-foreign";
const PRIVATE = "SYNTHETIC_PRIVATE_NOTE_BODY_CANARY";
const FOREIGN_CANARY = "SYNTHETIC_FOREIGN_SOURCE_CANARY";
let tasksFixture: Awaited<ReturnType<typeof freshFileDb>>;
let stores: Record<string, Client>;
let service: typeof import("./service");
let ledger: typeof import("./build-ledger-dto");
let policy: typeof import("./policy");
let actor: string | null = "synthetic-owner-clerk";
const envNames = ["TASKS_DATABASE_URL", "TASKS_AUTH_TOKEN", "NOTES_DATABASE_URL", "NOTES_AUTH_TOKEN", "TIMELINE_DATABASE_URL", "TIMELINE_AUTH_TOKEN", "SIGNAL_DATABASE_URL", "SIGNAL_AUTH_TOKEN", "SIGNAL_ACCESS_MODE", "NEXT_PUBLIC_SIGNAL_ACCESS_MODE", "SIGNAL_ANALYTICS_V1_ENABLED", "SIGNAL_HOME_ANALYTICS_ENABLED", "SIGNAL_ALLOWLIST", "VERCEL_ENV"];
const saved = Object.fromEntries(envNames.map(key => [key, process.env[key]]));

function assertScratchFile(url: string) {
  assert.equal(new URL(url).protocol, "file:");
  const child = relative(resolve(tmpdir()), resolve(fileURLToPath(url)));
  assert.ok(child.length > 0 && !isAbsolute(child) && child !== ".." && !child.startsWith(`..${sep}`), "database must be inside the process scratch directory");
}

function loadControlledPolicy() {
  const file = new URL("./policy.ts", import.meta.url);
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const require = createRequire(file), loaded = { exports: {} };
  const clerk = {
    auth: async () => ({ userId: actor }),
    currentUser: async () => ({ primaryEmailAddressId: "synthetic-email", emailAddresses: [{ id: "synthetic-email", emailAddress: "controlled@example.invalid" }] }),
  };
  new Function("require", "module", "exports", compiled)(
    (id: string) => id === "@clerk/nextjs/server" ? clerk : require(id), loaded, loaded.exports,
  );
  return loaded.exports as typeof import("./policy");
}

function query(type = "workspace", id = PROJECT) {
  return parseAnalyticsQuery(new Request(`https://synthetic.invalid/api/signal/briefing?scope_type=${type}&scope_id=${id}&workspace_id=${type === "workspace" ? id : PROJECT}`), new Date(NOW));
}
async function context(type = "workspace", id = PROJECT) {
  return policy.authorizeAnalyticsRequest(query(type, id));
}
async function hashes() {
  const result: Record<string, string> = {};
  for (const [name, client] of Object.entries(stores)) {
    const catalog = (await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).rows;
    const rows = [];
    for (const table of catalog) {
      const key = String(table.name), escaped = key.replaceAll('"', '""');
      const values = (await client.execute(`SELECT * FROM "${escaped}"`)).rows.map(row => JSON.stringify(row)).sort();
      rows.push({ name: key, values });
    }
    result[name] = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  }
  return result;
}
async function assertReadOnly(run: () => Promise<void>) {
  const beforeHashes = await hashes(); await run(); assert.deepEqual(await hashes(), beforeHashes);
}
function checkGrounding(view: BriefingResponse) {
  for (const observation of view.observations) {
    assert.equal(observation.scope.workspaceId, PROJECT);
    assert.equal(observation.evidenceCount, observation.sourceCounts.tasks + observation.sourceCounts.notes + observation.sourceCounts.milestones);
    const authorizedSourceIds = new Set(["synthetic-task-owner", "synthetic-task-member", "synthetic-note-owner", "synthetic-note-member", `ms-${PROJECT}-synthetic-task-owner`, "timeline-dependency:synthetic-timeline-dependency"]);
    for (const source of observation.sources) assert.ok(authorizedSourceIds.has(source.id), `unexpected source ID ${source.id}`);
    assert.ok(observation.sources.every(source => !source.title.includes(FOREIGN_CANARY)));
  }
  assert.doesNotMatch(JSON.stringify(view), new RegExp(`${PRIVATE}|${FOREIGN_CANARY}`));
}

before(async () => {
  for (const name of envNames) delete process.env[name];
  process.env.SIGNAL_ACCESS_MODE = "production";
  process.env.SIGNAL_ANALYTICS_V1_ENABLED = "true";
  process.env.SIGNAL_ALLOWLIST = "controlled@example.invalid";
  tasksFixture = await freshFileDb();
  const taskFile = (await tasksFixture.client.execute("PRAGMA database_list")).rows.find(row => row.name === "main")?.file;
  assert.equal(typeof taskFile, "string");
  const tasksUrl = pathToFileURL(String(taskFile)).href;
  assertScratchFile(tasksUrl);
  process.env.TASKS_DATABASE_URL = tasksUrl;
  const directory = mkdtempSync(join(tmpdir(), "signal-full-service-"));
  stores = { tasks: tasksFixture.client };
  for (const module of ["notes", "timeline", "signal"]) {
    const url = pathToFileURL(join(directory, `${module}.db`)).href;
    assertScratchFile(url);
    process.env[`${module.toUpperCase()}_DATABASE_URL`] = url;
    const client = createClient({ url }); stores[module] = client;
    const migrations = new URL(`../../../../../drizzle-${module}/`, import.meta.url);
    for (const file of readdirSync(migrations).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort()) {
      await client.executeMultiple(readFileSync(new URL(file, migrations), "utf8"));
    }
  }
  await stores.tasks.executeMultiple(`
    INSERT INTO users(id,clerk_id,email,color,initials) VALUES
      ('synthetic-owner','synthetic-owner-clerk','controlled@example.invalid','blue','SO'),
      ('synthetic-member','synthetic-member-clerk','controlled@example.invalid','blue','SM'),
      ('synthetic-foreign','synthetic-foreign-clerk','controlled@example.invalid','blue','SF');
    INSERT INTO workspaces(id,slug,name,owner_user_id) VALUES
      ('${PROJECT}','${PROJECT}','Synthetic service project','synthetic-owner'),
      ('${FOREIGN}','${FOREIGN}','${FOREIGN_CANARY}','synthetic-foreign');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('${PROJECT}','synthetic-member','member');
  `);
  for (const [id, workspace, assignee, title] of [
    ["synthetic-task-owner", PROJECT, "synthetic-owner", "Approved owner task"],
    ["synthetic-task-member", PROJECT, "synthetic-member", "Approved member task"],
    ["synthetic-task-foreign", FOREIGN, "synthetic-foreign", FOREIGN_CANARY],
  ]) await stores.tasks.execute({ sql: "INSERT INTO tasks(id,workspace_id,seq,title,lane,priority,assignees,tags,blocked_by,due_at,created_at,updated_at) VALUES (?,?,?,?, 'doing','p1',?,'[]','[]',?,?,?)", args: [id,workspace,id === "synthetic-task-member" ? 2 : 1,title,JSON.stringify([assignee]),Math.floor((NOW-DAY)/1000),Math.floor((NOW-10*DAY)/1000),Math.floor((NOW-DAY)/1000)] });
  await stores.signal.executeMultiple(`INSERT INTO analytics_users(clerk_id,linked_workspace_id,timezone) VALUES ('synthetic-owner-clerk','${PROJECT}','UTC'),('synthetic-member-clerk','${PROJECT}','UTC'),('synthetic-foreign-clerk','${FOREIGN}','UTC');`);
  for (const [id, user, extract, task] of [
    ["synthetic-note-owner","synthetic-owner-clerk","Approved owner extract","synthetic-task-owner"],
    ["synthetic-note-member","synthetic-member-clerk","Approved member extract","synthetic-task-member"],
    ["synthetic-note-foreign","synthetic-foreign-clerk",FOREIGN_CANARY,"synthetic-task-owner"],
    ["synthetic-note-unlinked","synthetic-owner-clerk",FOREIGN_CANARY,null],
  ]) await stores.notes.execute({ sql: "INSERT INTO notes(id,user_id,body,extract_body,promoted_task_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)", args: [id,user,PRIVATE,extract,task,NOW-5*DAY,NOW-DAY] });
  for (const [slug, project, sourceWorkspace, assignee, title] of [
    ["synthetic-timeline","synthetic-main",PROJECT,"synthetic-owner","Approved milestone"],
    ["synthetic-other-timeline","synthetic-other",FOREIGN,"synthetic-foreign",FOREIGN_CANARY],
  ]) {
    await stores.timeline.execute({ sql: "INSERT INTO workspaces(slug,name,owner_user_id) VALUES (?,?,?)", args: [slug,slug,assignee] });
    await stores.timeline.execute({ sql: "INSERT INTO projects(workspace_slug,slug,name,one_liner,accent,source_tasks_workspace_id) VALUES (?,?,?,'synthetic','blue',?)", args: [slug,project,title,sourceWorkspace] });
    await stores.timeline.execute({ sql: "INSERT INTO tasks(id,workspace_slug,project_slug,title,description,status,assignee,kind,target_date,blocker_id,created_at,updated_at) VALUES (?,?,?,?,'synthetic','next',?,'milestone',?,?,?,?)", args: [`ms-${sourceWorkspace}-synthetic-task-owner`,slug,project,title,assignee,new Date(NOW+3*DAY).toISOString().slice(0,10),"synthetic-timeline-dependency",Math.floor((NOW-10*DAY)/1000),Math.floor((NOW-DAY)/1000)] });
  }
  await stores.timeline.execute({ sql: "INSERT INTO tasks(id,workspace_slug,project_slug,title,description,status,assignee,kind,created_at,updated_at) VALUES ('synthetic-timeline-dependency','synthetic-timeline','synthetic-main','Approved dependency','synthetic','next','synthetic-owner','cycle',?,?)", args: [Math.floor((NOW-10*DAY)/1000),Math.floor((NOW-DAY)/1000)] });
  policy = loadControlledPolicy();
  service = await import("./service"); ledger = await import("./build-ledger-dto");
});

after(() => {
  for (const [name, client] of Object.entries(stores ?? {})) if (name !== "tasks") client.close();
  tasksFixture?.cleanup();
  for (const [key,value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});

test("actual briefing service uses all three providers, exposes only owned approved extracts and builds the public ledger", async () => {
  await assertReadOnly(async () => {
    for (const [clerk, noteId] of [["synthetic-owner-clerk","synthetic-note-owner"],["synthetic-member-clerk","synthetic-note-member"]]) {
      actor = clerk;
      const result = await service.calculateSignalView(await context(), "briefing", "metric:follow_up_completion");
      checkGrounding(result.view);
      assert.equal(result.view.meta.coverage.providers.tasks?.sourceRecordCount, 2);
      assert.equal(result.view.meta.coverage.providers.notes?.sourceRecordCount, 1);
      assert.equal(result.view.meta.coverage.providers.timeline?.sourceRecordCount, 2, "one actual milestone plus its actual dependency");
      assert.equal(result.view.meta.coverage.providers.notes?.status, "partial", "Notes declares unstructured decisions honestly");
      assert.ok(result.view.observations.length > 0);
      assert.deepEqual(result.evidence?.records.map(record => record.id), [noteId]);
      assert.doesNotMatch(JSON.stringify(result), new RegExp(`${PRIVATE}|${FOREIGN_CANARY}`));
      const dto = ledger.buildProgressiveLedgerDTO(result.view, { generatedAtLabel: "Synthetic service read", scopeLabel: "Synthetic service project", evidenceHref: id => `/app/home/briefing?evidence=${encodeURIComponent(id)}` });
      assert.equal(dto.freshness, "partial"); assert.ok(dto.coverageNote); assert.equal(dto.readCounts, null);
      assert.ok(dto.entries.length > 0 && dto.entries.length <= 3);
      assert.doesNotMatch(JSON.stringify(dto), /synthetic-note-|SYNTHETIC_PRIVATE|SYNTHETIC_FOREIGN/);
    }
  });
});

test("actual policy denies a foreign project before service and canonical self scope narrows Tasks, Notes and Timeline", async () => {
  await assertReadOnly(async () => {
    actor = "synthetic-owner-clerk";
    await assert.rejects(context("workspace", FOREIGN), error => { assert.equal((error as {status:number}).status, 403); return true; });
    actor = "synthetic-foreign-clerk";
    await assert.rejects(context(), error => { assert.equal((error as {status:number}).status, 403); return true; });
    actor = "synthetic-owner-clerk";
    const authorized = await context("user", "me"); assert.equal(authorized.query.scope.id, "synthetic-owner");
    const result = await service.calculateSignalView(authorized, "briefing", "metric:open_overdue_work");
    checkGrounding(result.view);
    assert.equal(result.view.meta.coverage.providers.tasks?.sourceRecordCount, 1);
    assert.equal(result.view.meta.coverage.providers.notes?.sourceRecordCount, 1);
    assert.equal(result.view.meta.coverage.providers.timeline?.sourceRecordCount, 2, "the reader owns both milestone and dependency");
    assert.deepEqual(result.evidence?.records.map(record => record.id), ["synthetic-task-owner"]);
    assert.doesNotMatch(JSON.stringify(result), /Approved member task|Approved member extract|SYNTHETIC_FOREIGN/);
  });
});

test("real Notes missing-column failure becomes unavailable coverage without an invented quiet success", async () => {
  await stores.notes.execute("ALTER TABLE notes RENAME COLUMN extract_body TO unavailable_extract_body");
  try {
    await assertReadOnly(async () => {
      actor = "synthetic-owner-clerk";
      const result = await service.calculateSignalView(await context(), "briefing");
      assert.equal(result.view.meta.coverage.providers.notes?.status, "unavailable");
      assert.ok(result.view.meta.coverage.providers.notes?.issues.includes("notes_provider_failed"));
      assert.equal(result.view.meta.coverage.providers.notes?.sourceRecordCount, 0);
      assert.notEqual(result.view.meta.coverage.status, "complete");
      assert.equal(result.view.emptyState, null); assert.ok(result.view.observations.length > 0);
      assert.doesNotMatch(JSON.stringify(result), new RegExp(`${PRIVATE}|${FOREIGN_CANARY}`));
    });
  } finally { await stores.notes.execute("ALTER TABLE notes RENAME COLUMN unavailable_extract_body TO extract_body"); }
});
