import "server-only";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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
export async function createPingProofFixture() {
  const directory = await mkdtemp(join(tmpdir(), "signal-ping-proof-"));
  const databasePath = join(directory, "synthetic.db");
  const client = createClient({ url: `file:${databasePath.replaceAll("\\", "/")}` });
  try {
    await client.execute("PRAGMA foreign_keys = ON");
    for (const name of (await readdir(resolve("drizzle"))).filter(name => /^\d{4}_.+\.sql$/.test(name) && name >= "0014_").sort()) {
      await client.executeMultiple(await readFile(join(resolve("drizzle"), name), "utf8"));
    }
    assert.equal(Number((await client.execute("PRAGMA foreign_keys")).rows[0].foreign_keys), 1);
    // Receipt schema deliberately lives in the disposable fixture, not drizzle/ or production schema.
    await client.execute(`CREATE TABLE ping_command_receipts (
      actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      command_id TEXT NOT NULL, project_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      plan_hash TEXT NOT NULL, receipt_json TEXT NOT NULL CHECK(json_valid(receipt_json)),
      committed_at INTEGER NOT NULL, PRIMARY KEY(actor_id,command_id))`);
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
    const adapter = createLocalConversationDatabaseAdapter({ client });
    return { client, adapter, databasePath };
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
    if (effects.selfAssignment) value.assignees = JSON.parse(String(row.assignees));
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
