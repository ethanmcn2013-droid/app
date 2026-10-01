import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createClient, type Client } from "@libsql/client";
import { runWithTargetGuard } from "./contracts/target-manifest.mjs";
import { assertProjectId } from "../../src/lib/projects/project-ref";
import { createLocalConversationDatabaseAdapter, createRemoteConversationDatabaseAdapter } from "../../src/server/conversations/database";
import { createConversationService } from "../../src/server/conversations/service";
import { validRequestId, type ConversationResult } from "../../src/lib/conversations/contracts";
import { createConversationTaskOutcomeService, type PromoteMessageToTaskInput } from "../../src/server/conversations/work-links";

export type HostedActor = { actorId: string; clerkId: string; actorHash: string };
export type HostedManifest = { fixtureNamespace: string; environment: { kind: string; identity: string; [key: string]: unknown };
  expectedTargetHashes: Record<string, string>; testActors: Array<{ actorHash: string }>; [key: string]: unknown };
export type HostedObserved = { origin: string; [key: string]: unknown };
export type HostedFixture = { fixtureNamespace: string; actors: HostedActor[]; counts: { projects: number; tasks: number; messages: number; resources: number }; rooms: { projectId: string; projectName: string; conversationId: string; audienceEpoch: number; sourceMessageId: string; unusedSourceMessageIds: string[] }[]; deniedProjectForObserver: string };
export const hostedTargetHash = (url: string) => `sha256:${createHash("sha256").update(url).digest("hex")}`;
const SEED_FAILURE_CODES = new Set(["unauthenticated", "unavailable", "archived", "audience_changed", "consent_required", "read_only", "invalid_input", "request_conflict", "revision_conflict", "temporarily_unavailable", "resync_required", "rate_limited"]);

export function hostedSeedRequestId(namespace: string, index: number, kind: "message" | "task") {
  const requestId = `${namespace}_seed_${kind}_${index}`;
  assert.ok(Number.isSafeInteger(index) && index >= 0 && validRequestId(requestId), "hosted_seed_request_id_invalid");
  return requestId;
}

/** Persist only a fixed failure enum; never serialize provider/SQL errors or result payloads. */
export function requireSeedSuccess<T>(result: ConversationResult<T>, operation: "room" | "message" | "task"): asserts result is { ok: true; value: T } {
  assert.ok(result.ok, `hosted_seed_${operation}_failed:${!result.ok && SEED_FAILURE_CODES.has(result.code) ? result.code : "unknown_failure"}`);
}

export async function sendHostedSeedMessage(service: ReturnType<typeof createConversationService>, actorId: string,
  room: Pick<HostedFixture["rooms"][number], "projectId" | "conversationId" | "audienceEpoch">, namespace: string, index: number) {
  const result = await service.sendMessage({ actorId, input: { projectId: assertProjectId(room.projectId), conversationId: room.conversationId,
    expectedAudienceEpoch: room.audienceEpoch, clientRequestId: hostedSeedRequestId(namespace, index, "message"), body: `Synthetic fixture message ${index}`, rootId: null, mentionUserIds: [] } });
  requireSeedSuccess(result, "message");
  return result.value;
}

export function remoteHarnessAdapter(client: Client) {
  return createRemoteConversationDatabaseAdapter({ client: { transaction: async (mode) => {
    const tx = await client.transaction(mode);
    return { execute: (statement) => tx.execute(typeof statement === "string" ? statement : { sql: statement.sql, args: [...(statement.args ?? [])] }),
      batch: (statements) => tx.batch(statements.map(statement => typeof statement === "string" ? statement : { sql: statement.sql, args: [...(statement.args ?? [])] })),
      commit: () => tx.commit(), rollback: () => tx.rollback() };
  } } });
}

export async function verifyHostedSeedPrerequisites(client: Client, actors: HostedActor[], namespace: string) {
  if (!/^reliability-[a-z0-9-]{8,80}$/i.test(namespace) || actors.length !== 2 || actors[0].actorId === actors[1].actorId) throw new Error("hosted_fixture_identity_refused");
  for (const actor of actors) {
    if (!/^[a-z0-9_-]{1,128}$/i.test(actor.actorId) || !/^user_[a-z0-9]+$/i.test(actor.clerkId) || !/^sha256:[a-f0-9]{64}$/i.test(actor.actorHash)) throw new Error("hosted_actor_invalid");
    const linked = await client.execute({ sql: "SELECT id FROM users WHERE id=? AND clerk_id=?", args: [actor.actorId, actor.clerkId] });
    assert.equal(linked.rows.length, 1, "existing_test_actor_link_unverified");
  }
  for (const [table, columns] of Object.entries({ tasks: ["seq", "completed_at", "workspace_id"], conversations: ["audience_epoch", "next_change_seq"],
    conversation_messages: ["workspace_id", "create_seq"], work_operation_receipts: ["client_request_id"], resources: ["workspace_id", "access_state"] })) {
    const schema = await client.execute(`PRAGMA table_info(${table})`);
    const names = new Set(schema.rows.map((row) => row.name));
    assert.ok(columns.every((column) => names.has(column)), `hosted_schema_missing_${table}`);
  }
  const previous = await client.execute({ sql: "SELECT id FROM workspaces WHERE id LIKE ? ESCAPE '\\' LIMIT 1", args: [`${namespace.replaceAll("_", "\\_")}_project_%`] });
  assert.equal(previous.rows.length, 0, "hosted_fixture_namespace_already_used");
}

/** No migration, existing user/workspace mutation, remote provider work or ambient target discovery. */
export async function seedHostedFixture(input: { manifest: HostedManifest; observed: HostedObserved; tasksUrl: string; tasksToken: string; actors: HostedActor[];
  createFreshLocalActors?: boolean; progress?: (counts: { messages: number; tasks: number }) => void | Promise<void> }) {
  const local = input.manifest.environment.kind === "authenticated-local-test";
  if ((local ? !/^file:/i.test(input.tasksUrl) || !input.createFreshLocalActors : !/^libsql:\/\//i.test(input.tasksUrl) || !input.tasksToken || input.createFreshLocalActors) || hostedTargetHash(input.tasksUrl) !== input.manifest.expectedTargetHashes.tasks) throw new Error("hosted_seed_binding_refused");
  return runWithTargetGuard({ manifest: input.manifest, observed: input.observed, write: async ({ fixtureNamespace }: { fixtureNamespace: string }) => {
    const client = createClient({ url: input.tasksUrl, ...(local ? {} : { authToken: input.tasksToken }) });
    try {
      if (local) {
        for (const actor of input.actors) {
          const prior = await client.execute({ sql: "SELECT id FROM users WHERE id=? OR clerk_id=?", args: [actor.actorId, actor.clerkId] });
          assert.equal(prior.rows.length, 0, "local_fixture_existing_user_refused");
        }
        for (const [index, actor] of input.actors.entries()) await client.execute({ sql: "INSERT INTO users(id,clerk_id,name,color,initials) VALUES (?,?,?,'#444444','S')",
          args: [actor.actorId, actor.clerkId, `Synthetic test actor ${index}`] });
      }
      await verifyHostedSeedPrerequisites(client, input.actors, fixtureNamespace);
      const adapter = local ? createLocalConversationDatabaseAdapter({ client }) : remoteHarnessAdapter(client);
      const conversations = createConversationService(adapter);
      const outcomes = createConversationTaskOutcomeService(adapter, { captureConfig: { enabled: false, now: 0 } });
      const [writer, observer] = input.actors;
      const counts = { projects: 10, tasks: 1_000, messages: 10_000, resources: 500 };
      const rooms: HostedFixture["rooms"] = [];
      for (let index = 0; index < counts.projects; index++) {
        const projectId = assertProjectId(`${fixtureNamespace}_project_${index}`);
        const projectName = `Reliability fixture ${fixtureNamespace} project ${index}`;
        await adapter.transaction("write", async (executor) => {
          await executor.execute({ sql: "INSERT INTO workspaces(id,slug,name,owner_user_id,context_type) VALUES (?,?,?,?,'project')", args: [projectId, projectId, projectName, writer.actorId] });
          for (const actor of input.actors) await executor.execute({ sql: "INSERT INTO workspace_members(workspace_id,user_id,role) VALUES (?,?,'member')", args: [projectId, actor.actorId] });
        });
        const room = await conversations.ensureProjectConversation({ actorId: writer.actorId, projectId });
        requireSeedSuccess(room, "room");
        rooms.push({ ...room.value, projectName, sourceMessageId: "", unusedSourceMessageIds: [] });
      }
      const taskRows = [];
      for (let index = 0; index < counts.messages; index++) {
        const room = rooms[index % 2 === 0 ? 0 : Math.floor(index / 2) % rooms.length];
        const sent = await sendHostedSeedMessage(conversations, writer.actorId, room, fixtureNamespace, index);
        room.sourceMessageId ||= sent.messageId;
        if (index >= counts.tasks && room.unusedSourceMessageIds.length < 400) room.unusedSourceMessageIds.push(sent.messageId);
        if (index < counts.tasks) {
          const task = await outcomes.promoteMessageToTask({ actorId: writer.actorId, input: {
            clientRequestId: hostedSeedRequestId(fixtureNamespace, index, "task"), sourceProjectId: assertProjectId(room.projectId), destinationProjectId: assertProjectId(room.projectId),
            conversationId: room.conversationId, messageId: sent.messageId, expectedRevision: 1, expectedAudienceEpoch: room.audienceEpoch,
            title: `Synthetic fixture task ${index}`, ownerUserId: observer.actorId, dueDate: "2026-10-25" as PromoteMessageToTaskInput["dueDate"],
          } });
          requireSeedSuccess(task, "task");
          taskRows.push({ id: task.value.taskId, projectId: room.projectId });
        }
        if (index % 1_000 === 999) await input.progress?.({ messages: index + 1, tasks: taskRows.length });
      }
      for (let index = 0; index < counts.resources; index++) {
        const task = taskRows[index % taskRows.length];
        await adapter.transaction("write", (executor) => executor.execute({ sql: "INSERT INTO resources(id,workspace_id,task_id,kind,provider,title,added_at,access_state) VALUES (?,?,?,'link','url',?,?,'ok')",
          args: [`${fixtureNamespace}_resource_${index}`, task.projectId, task.id, `Synthetic fixture resource ${index}`, Math.floor(Date.now() / 1_000)] }));
      }
      // Controlled stale membership inside this run's new namespace only.
      await adapter.transaction("write", (executor) => executor.execute({ sql: "DELETE FROM workspace_members WHERE workspace_id=? AND user_id=?", args: [rooms[9].projectId, observer.actorId] }));
      return { fixtureNamespace, actors: input.actors, counts, rooms, deniedProjectForObserver: rooms[9].projectId } satisfies HostedFixture;
    } finally { client.close(); }
  } });
}
