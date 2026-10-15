import "server-only";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, mkdir, open, lstat, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve, relative, isAbsolute, dirname } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import { canonicalVenueCodeNotes } from "@/server/venue-issuance/canonical";
import { issuanceReceiptKey, manifestHash, venueCodeFingerprint, type IssuanceManifest } from "@/lib/venue-issuance/protocol";
import { createLocalConversationDatabaseAdapter } from "@/server/conversations/database";
import type { PingCommand, PingEffects, PingTaskPrecondition } from "@/lib/ping/command";
import type { PingExecutionContext } from "./command-service";

export const PROOF_NOW = Date.parse("2026-10-06T09:00:00.000Z");
export const PROOF_PROJECT = "synthetic-ping-project";
export const PROOF_FIXTURE_MARKER_KEY = "ping:synthetic-proof-fixture";
export const PROOF_FIXTURE_MARKER_VALUE = "ping.proof.fixture.v1";
/** Synthetic file-backed database only; never an application migration or ambient connection. */
export type PingProofBinding = Readonly<{ sessionId: string; sourceRevision: string; manifestSha256: string;
  actorId: string; projectId: string }>;
export type PingProofFixtureOptions = Readonly<{ scratchDirectory: string; databasePath: string;
  mode: "create" | "reopen"; binding: PingProofBinding }>;
const bindingKey = "ping:synthetic-proof-binding";
const schemaKey = "ping:synthetic-proof-schema";
/** Explicit paths must be inside an explicitly admitted scratch directory; reopen never migrates or seeds. */
export async function createPingProofFixture(options?: PingProofFixtureOptions) {
  let databasePath: string;
  if (options) {
    assert.ok(isAbsolute(options.databasePath) && isAbsolute(options.scratchDirectory), "Explicit absolute scratch paths required");
    const rel = relative(resolve(options.scratchDirectory), resolve(options.databasePath));
    assert.ok(rel && !rel.startsWith("..") && !isAbsolute(rel), "Database must stay inside admitted scratch directory");
    assert.equal(options.binding.actorId, "alice"); assert.equal(options.binding.projectId, PROOF_PROJECT);
    assert.ok(/^[a-f0-9]{40}$/.test(options.binding.sourceRevision) && /^[a-f0-9]{64}$/.test(options.binding.manifestSha256));
    assert.ok(/^[A-Za-z0-9_-]{1,128}$/.test(options.binding.sessionId));
    await mkdir(dirname(options.databasePath), { recursive: true });
    const actualRel = relative(await realpath(options.scratchDirectory), await realpath(dirname(options.databasePath)));
    assert.ok(!actualRel.startsWith("..") && !isAbsolute(actualRel), "Scratch symlink escaped directory");
    databasePath = resolve(options.databasePath);
    if (options.mode === "create") { const reserved = await open(databasePath, "wx"); await reserved.close(); }
    else { assert.equal(options.mode, "reopen"); const info = await lstat(databasePath); assert.ok(info.isFile() && !info.isSymbolicLink()); }
  } else {
    const directory = await mkdtemp(join(tmpdir(), "signal-ping-proof-"));
    databasePath = join(directory, "synthetic.db");
  }
  const client = createClient({ url: `file:${databasePath.replaceAll("\\", "/")}` });
  try {
    await client.execute("PRAGMA foreign_keys = ON");
    const schemaFingerprint = async () => createHash("sha256").update(JSON.stringify((await client.execute(
      "SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name")).rows)).digest("hex");
    if (options?.mode === "reopen") {
      assert.equal(String((await client.execute("PRAGMA quick_check")).rows[0].quick_check), "ok");
      const marker = async (key: string) => (await client.execute({ sql: "SELECT value FROM meta WHERE key=?", args: [key] })).rows[0]?.value;
      assert.equal(await marker(PROOF_FIXTURE_MARKER_KEY), PROOF_FIXTURE_MARKER_VALUE, "Wrong fixture marker");
      assert.equal(await marker(bindingKey), JSON.stringify(options.binding), "Wrong fixture identity");
      assert.equal(await marker(schemaKey), await schemaFingerprint(), "Changed fixture schema");
      const admitted = await client.execute({ sql: `SELECT u.id FROM users u JOIN workspace_members m ON m.user_id=u.id
        JOIN workspaces w ON w.id=m.workspace_id WHERE u.id=? AND w.id=? AND w.owner_user_id='owner' AND m.role='member'`,
        args: [options.binding.actorId, options.binding.projectId] });
      assert.equal(admitted.rows.length, 1, "Wrong fixture actor or Project");
      return { client, adapter: createLocalConversationDatabaseAdapter({ client }), databasePath, reopened: true };
    }
    const migrationFiles = (await readdir(resolve("drizzle"))).filter(name => /^\d{4}_.+\.sql$/.test(name) && name >= "0014_").sort();
    const hasPingReceiptMigration = migrationFiles.includes("0041_ping_command_receipts.sql");
    for (const name of migrationFiles) {
      await client.executeMultiple(await readFile(join(resolve("drizzle"), name), "utf8"));
    }
    assert.equal(Number((await client.execute("PRAGMA foreign_keys")).rows[0].foreign_keys), 1);
    // Keep older-main fixtures usable while letting the canonical migration own this schema when present.
    if (!hasPingReceiptMigration) {
      await client.execute(`CREATE TABLE ping_command_receipts (
        actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        command_id TEXT NOT NULL, project_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        plan_hash TEXT NOT NULL, receipt_json TEXT NOT NULL CHECK(json_valid(receipt_json)),
        committed_at INTEGER NOT NULL, PRIMARY KEY(actor_id,command_id))`);
    }
    const receiptColumns = await client.execute("PRAGMA table_info('ping_command_receipts')");
    assert.deepEqual(receiptColumns.rows.map(row => [String(row.name), String(row.type).toUpperCase(), Number(row.notnull), Number(row.pk)]), [
      ["actor_id", "TEXT", 1, 1], ["command_id", "TEXT", 1, 2], ["project_id", "TEXT", 1, 0],
      ["plan_hash", "TEXT", 1, 0], ["receipt_json", "TEXT", 1, 0], ["committed_at", "INTEGER", 1, 0],
    ]);
    const receiptForeignKeys = await client.execute("PRAGMA foreign_key_list('ping_command_receipts')");
    assert.deepEqual(receiptForeignKeys.rows.map(row => [String(row.table), String(row.from), String(row.to), String(row.on_delete).toUpperCase()]).sort(), [
      ["users", "actor_id", "id", "CASCADE"], ["workspaces", "project_id", "id", "CASCADE"],
    ]);
    const receiptTable = await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='ping_command_receipts'");
    assert.equal(receiptTable.rows.length, 1);
    assert.match(String(receiptTable.rows[0].sql).toLowerCase().replaceAll(/[\s`\"]+/g, ""), /check\(json_valid\(receipt_json\)\)/);
    await client.execute({sql:"INSERT INTO meta(key,value) VALUES(?,?)",args:[PROOF_FIXTURE_MARKER_KEY,PROOF_FIXTURE_MARKER_VALUE]});
    for (const id of ["owner", "alice", "bob", "outsider"]) {
      await client.execute({ sql: "INSERT INTO users(id,clerk_id,name,color,initials) VALUES(?,?,?,'#111','SS')", args: [id, `clerk_${id}`, id] });
    }
    for (const project of [PROOF_PROJECT, "synthetic-foreign-project"]) {
      await client.execute({ sql: "INSERT INTO workspaces(id,slug,name,owner_user_id) VALUES(?,?,?,'owner')", args: [project, project, project] });
    }
    for (const id of ["owner", "alice", "bob"]) {
      await client.execute({ sql: "INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(?,?,?)", args: [PROOF_PROJECT, id, id === "owner" ? "owner" : "member"] });
    }
    if (options) {
      await client.execute({ sql: "INSERT INTO meta(key,value) VALUES(?,?)", args: [bindingKey, JSON.stringify(options.binding)] });
      await client.execute({ sql: "INSERT INTO meta(key,value) VALUES(?,?)", args: [schemaKey, await schemaFingerprint()] });
    }
    const adapter = createLocalConversationDatabaseAdapter({ client });
    return { client, adapter, databasePath, reopened: false };
  } catch (error) { client.close(); throw error; }
}

export function proofCommand(index = 1, effects: PingEffects = {}, count = 1): PingCommand {
  return { version: "ping.command.v1", commandId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    projectId: PROOF_PROJECT, referenceInstant: new Date(PROOF_NOW).toISOString(), timeZone: "Europe/Dublin",
    expectedColumnConfig: null, operation: { kind: "create_placeholders", count, title: "Untitled task", effects } };
}
export function proofContext(command: PingCommand, actorId = "alice"): PingExecutionContext {
  return { actorId, captured: { commandId: command.commandId, projectId: command.projectId,
    referenceInstant: command.referenceInstant, timeZone: command.timeZone, expectedColumnConfig: command.expectedColumnConfig,
    selectedTaskIds: command.operation.kind === "edit_selected" ? [...command.operation.taskIds] : [],
    expected: command.operation.kind === "edit_selected" ? structuredClone(command.operation.expected) : {},
    inputItemId: "synthetic-complete-input" }, input: { itemId: "synthetic-complete-input", state: "complete" } };
}
export async function seedProofTask(client: Client, id: string, extra: Partial<{ projectId: string; assignees: string[];
  due: string | null; dueAt: number | null; startDay: number | null; durationDays: number | null;
  lane: string; completedAt: number | null }> = {}) {
  await client.execute({ sql: `INSERT INTO tasks(id,workspace_id,seq,title,lane,priority,assignees,due,due_at,start_day,duration_days,completed_at,position)
    VALUES (?,?,(SELECT COALESCE(MAX(seq),0)+1 FROM tasks WHERE workspace_id=?),? ,?,'p2',?,?,?,?,?,?,1)`,
    args: [id, extra.projectId ?? PROOF_PROJECT, extra.projectId ?? PROOF_PROJECT, `Synthetic ${id}`, extra.lane ?? "todo",
      JSON.stringify(extra.assignees ?? ["bob"]), extra.due ?? null, extra.dueAt ?? null, extra.startDay ?? null,
      extra.durationDays ?? null, extra.completedAt ?? null] });
}
export async function proofEditCommand(client: Client, ids: string[], effects: PingEffects, index = 1): Promise<PingCommand> {
  const expected: Record<string, PingTaskPrecondition> = {};
  for (const id of ids) {
    const row = (await client.execute({ sql: "SELECT * FROM tasks WHERE id=?", args: [id] })).rows[0];
    const value: Record<string, unknown> = {};
    if (effects.selfAssignment || effects.namedAssignment) value.assignees = JSON.parse(String(row.assignees));
    if (Object.hasOwn(effects, "dueDate")) Object.assign(value, { due: row.due, dueAtSeconds: row.due_at,
      startDay: row.start_day, durationDays: row.duration_days });
    if (effects.statusColumnKey) Object.assign(value, { lane: row.lane, boardColumnKey: row.board_column_key, completedAtSeconds: row.completed_at });
    expected[id] = value;
  }
  const base = proofCommand(index);
  const config = (await client.execute({ sql: "SELECT value FROM meta WHERE key=?", args: [`board:${PROOF_PROJECT}:columns`] })).rows[0];
  return { ...base, expectedColumnConfig: config ? String(config.value) : null,
    operation: { kind: "edit_selected", taskIds: ids, effects, expected } };
}
export async function proofCount(client: Client, table: "tasks" | "activities" | "ping_command_receipts" | "sponsored_use_intents" | "sponsored_use_subjects") {
  return Number((await client.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n);
}
export async function seedProofSponsor(client: Client) {
  const now = PROOF_NOW, code = "VENUE-ABCDE-FGHJK";
  const manifest: IssuanceManifest = { version: 1, issuanceId: "vi-" + "a".repeat(32), sponsorId: "synthetic-sponsor",
    sponsorSlug: "synthetic", sponsorName: "Synthetic venue", environment: "internal_test", issuedAt: now - 2 * 86_400_000,
    eligibility: { kind: "pilot", reference: "synthetic-fixture-only", startsAt: now - 3 * 86_400_000, endsAt: now + 86_400_000 },
    tier: "wedding", durationDays: 548, codes: [{ licenseCodeId: "vlc-" + "a".repeat(32), codeFingerprint: venueCodeFingerprint(code) }] };
  const database = drizzle(client, { schema });
  await database.insert(schema.meta).values({ key: issuanceReceiptKey(manifest.issuanceId), value: JSON.stringify({ manifest, manifestHash: manifestHash(manifest) }) });
  await database.insert(schema.compCodes).values({ code, tier: "wedding", durationDays: 548, quantity: 1, redeemed: 1, notes: canonicalVenueCodeNotes(manifest, manifest.codes[0]) });
  await database.insert(schema.entitlements).values({ id: "synthetic-alice-claim", userId: "alice", workspaceId: PROOF_PROJECT,
    source: "comp", tier: "wedding", startedAt: new Date(now - 86_400_000), expiresAt: new Date(now + 86_400_000), notes: "comp:" + code });
  return { enabled: true, salt: "synthetic-sponsored-capture-salt", now };
}
