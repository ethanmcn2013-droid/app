import { createHash } from "node:crypto";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

export const FIXTURE = Object.freeze({
  alice: "synthetic-alice",
  bob: "synthetic-bob",
  charlie: "synthetic-charlie",
  dave: "synthetic-dave",
  projectA: "synthetic-project-a",
  projectB: "synthetic-project-b",
  projectConversationA: "synthetic-project-room-a",
  projectConversationB: "synthetic-project-room-b",
  dmConversation: "synthetic-dm-alice-bob",
});

export class LostResponseError extends Error {
  constructor() {
    super("simulated_response_loss_after_commit");
    this.name = "LostResponseError";
  }
}

export class SeamFailureError extends Error {
  constructor(seam) {
    super(`simulated_failure_after_${seam}`);
    this.name = "SeamFailureError";
    this.seam = seam;
  }
}

function localFileUrl(databasePath) {
  const absolute = resolve(databasePath).replaceAll("\\", "/");
  return `file:${absolute}`;
}

function rowValue(row, key) {
  return row?.[key];
}

function integer(value) {
  return typeof value === "bigint" ? Number(value) : Number(value);
}

function normalizeBody(body) {
  return body.replace(/\r\n?/g, "\n");
}

function validBody(body) {
  return typeof body === "string" && body.trim().length > 0 &&
    Array.from(body).length <= 8_000 && new TextEncoder().encode(body).byteLength <= 32_768 &&
    !body.includes("\u0000");
}

function normalizeMentions(mentions) {
  if (!Array.isArray(mentions) || mentions.some((value) => typeof value !== "string" || value.length === 0)) return null;
  return [...new Set(mentions)].sort();
}

function payloadHash(input, body, mentions) {
  return createHash("sha256")
    .update(JSON.stringify([input.actorId, input.conversationId, body, input.rootId ?? null, mentions]))
    .digest("hex");
}

function logicalRequestHash(input) {
  return createHash("sha256")
    .update(JSON.stringify([input.conversationId, input.actorId, input.clientRequestId]))
    .digest("hex");
}

function isBusy(error) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`;
  return /SQLITE_BUSY|DATABASE_BUSY|database is locked/i.test(text);
}

async function backoff(attempt) {
  const delay = Math.min(20, 1 + attempt);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
}

export async function applySupportedBaseline(client, { drizzleDir = join(repoRoot, "drizzle") } = {}) {
  const files = (await readdir(drizzleDir))
    .filter((file) => /^\d{4}_.+\.sql$/.test(file) && file >= "0014_")
    .sort();
  await client.execute("PRAGMA foreign_keys = OFF");
  for (const file of files) {
    await client.executeMultiple(await readFile(join(drizzleDir, file), "utf8"));
  }
  return files;
}

export async function installProposedConversationSchema(
  client,
  { schemaPath = join(here, "proposed-schema.sql") } = {},
) {
  await client.executeMultiple(await readFile(schemaPath, "utf8"));
}

export async function seedSyntheticFixture(client) {
  const now = Date.now();
  for (const [id, handle, name, initials] of [
    [FIXTURE.alice, "synthetic_alice", "Synthetic Alice", "SA"],
    [FIXTURE.bob, "synthetic_bob", "Synthetic Bob", "SB"],
    [FIXTURE.charlie, "synthetic_charlie", "Synthetic Charlie", "SC"],
    [FIXTURE.dave, "synthetic_dave", "Synthetic Dave", "SD"],
  ]) {
    await client.execute({
      sql: "INSERT INTO users(id, handle, name, color, initials) VALUES (?, ?, ?, ?, ?)",
      args: [id, handle, name, "#64748b", initials],
    });
  }
  await client.execute({
    sql: "INSERT INTO workspaces(id, slug, name, owner_user_id, context_type, created_at, updated_at) VALUES (?, ?, ?, ?, 'project', ?, ?), (?, ?, ?, ?, 'project', ?, ?)",
    args: [
      FIXTURE.projectA, "synthetic-project-a", "Synthetic Project A", FIXTURE.alice, now, now,
      FIXTURE.projectB, "synthetic-project-b", "Synthetic Project B", FIXTURE.charlie, now, now,
    ],
  });
  for (const [workspaceId, userId, role] of [
    [FIXTURE.projectA, FIXTURE.alice, "owner"],
    [FIXTURE.projectA, FIXTURE.bob, "member"],
    [FIXTURE.projectB, FIXTURE.charlie, "owner"],
  ]) {
    await client.execute({
      sql: "INSERT INTO workspace_members(workspace_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
      args: [workspaceId, userId, role, now],
    });
  }
  await client.execute({
    sql: `INSERT INTO conversation_spike_conversations
      (id, workspace_id, kind, lifecycle, audience_epoch, next_create_seq, next_change_seq, created_by, created_at)
      VALUES (?, ?, 'project', 'active', 1, 1, 1, ?, ?), (?, ?, 'project', 'active', 1, 1, 1, ?, ?)`,
    args: [
      FIXTURE.projectConversationA, FIXTURE.projectA, FIXTURE.alice, now,
      FIXTURE.projectConversationB, FIXTURE.projectB, FIXTURE.charlie, now,
    ],
  });
  await client.execute({
    sql: `INSERT INTO conversation_spike_conversations
      (id, workspace_id, kind, lifecycle, audience_epoch, next_create_seq, next_change_seq,
       dm_low_user_id, dm_high_user_id, pair_state, created_by, created_at)
      VALUES (?, ?, 'dm', 'active', 1, 1, 1, ?, ?, 'active', ?, ?)`,
    args: [FIXTURE.dmConversation, FIXTURE.projectA, FIXTURE.alice, FIXTURE.bob, FIXTURE.alice, now],
  });
  await client.batch([
    {
      sql: `INSERT INTO conversation_spike_participants
        (conversation_id, user_id, status, consented, retains_history) VALUES (?, ?, 'active', 1, 1)`,
      args: [FIXTURE.dmConversation, FIXTURE.alice],
    },
    {
      sql: `INSERT INTO conversation_spike_participants
        (conversation_id, user_id, status, consented, retains_history) VALUES (?, ?, 'active', 1, 1)`,
      args: [FIXTURE.dmConversation, FIXTURE.bob],
    },
  ], "write");
}

export async function createFreshSpikeDatabase({ databasePath, foreignKeys = false, busyTimeoutMs = 250 }) {
  await mkdir(dirname(resolve(databasePath)), { recursive: true });
  const client = createClient({ url: localFileUrl(databasePath) });
  await client.execute(`PRAGMA busy_timeout = ${Math.max(0, Math.trunc(busyTimeoutMs))}`);
  const journal = await client.execute("PRAGMA journal_mode = WAL");
  const baselineFiles = await applySupportedBaseline(client);
  await installProposedConversationSchema(client);
  await client.execute(`PRAGMA foreign_keys = ${foreignKeys ? "ON" : "OFF"}`);
  await seedSyntheticFixture(client);
  return {
    client,
    baselineFiles,
    settings: {
      databasePath: resolve(databasePath),
      foreignKeys,
      busyTimeoutMs,
      journalMode: String(journal.rows[0]?.journal_mode ?? "unknown"),
    },
  };
}

async function authorize(tx, scope, operation, expectedAudienceEpoch) {
  const result = await tx.execute({
    sql: `SELECT c.id, c.workspace_id, c.kind, c.lifecycle, c.audience_epoch, c.pair_state,
        wm.user_id AS current_member,
        p.status AS participant_status, p.consented, p.retains_history,
        (SELECT COUNT(*) FROM conversation_spike_participants both_p
          JOIN workspace_members both_wm ON both_wm.workspace_id = c.workspace_id AND both_wm.user_id = both_p.user_id
          WHERE both_p.conversation_id = c.id AND both_p.status = 'active' AND both_p.consented = 1) AS active_pair_count
      FROM conversation_spike_conversations c
      JOIN workspaces w ON w.id = c.workspace_id
      LEFT JOIN workspace_members wm ON wm.workspace_id = c.workspace_id AND wm.user_id = ?
      LEFT JOIN conversation_spike_participants p ON p.conversation_id = c.id AND p.user_id = ?
      WHERE c.id = ? AND c.workspace_id = ?`,
    args: [scope.actorId, scope.actorId, scope.conversationId, scope.projectId],
  });
  const row = result.rows[0];
  if (!row || !rowValue(row, "current_member")) return { ok: false, code: "unavailable" };
  const epoch = integer(rowValue(row, "audience_epoch"));
  if (rowValue(row, "kind") === "dm") {
    if (!rowValue(row, "participant_status")) return { ok: false, code: "unavailable" };
    const pairState = String(rowValue(row, "pair_state"));
    if (pairState === "pending" || pairState === "declined") return { ok: false, code: "consent_required" };
    if (integer(rowValue(row, "retains_history")) !== 1) return { ok: false, code: "unavailable" };
    if (operation === "write" && (pairState !== "active" || integer(rowValue(row, "active_pair_count")) !== 2)) {
      return { ok: false, code: "read_only" };
    }
  }
  if (operation === "write") {
    if (rowValue(row, "lifecycle") === "archived") return { ok: false, code: "archived" };
    if (!Number.isSafeInteger(expectedAudienceEpoch) || expectedAudienceEpoch !== epoch) {
      return { ok: false, code: "audience_changed", audienceEpoch: epoch };
    }
  }
  return { ok: true, row, audienceEpoch: epoch };
}

function receiptFrom(row) {
  return {
    messageId: String(rowValue(row, "message_id")),
    clientRequestId: String(rowValue(row, "client_request_id")),
    createSeq: integer(rowValue(row, "create_seq")),
    changeSeq: integer(rowValue(row, "change_seq")),
    revision: integer(rowValue(row, "revision")),
    committedAt: integer(rowValue(row, "committed_at")),
  };
}

export async function openConversationSpikeStore({ databasePath, foreignKeys = false, busyTimeoutMs = 250 }) {
  const client = createClient({ url: localFileUrl(databasePath) });
  await client.execute(`PRAGMA busy_timeout = ${Math.max(0, Math.trunc(busyTimeoutMs))}`);
  await client.execute(`PRAGMA foreign_keys = ${foreignKeys ? "ON" : "OFF"}`);
  const counters = { submissions: 0, transactionAttempts: 0, busyRetries: 0, activeWriteTransactions: 0, maxActiveWriteTransactions: 0 };
  let previousOperation = Promise.resolve();

  async function withOperation(fn) {
    const previous = previousOperation;
    let release;
    previousOperation = new Promise((resolveRelease) => { release = resolveRelease; });
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  // @libsql/client 0.17.3 maps transaction("write") to BEGIN IMMEDIATE,
  // but its local adapter detaches a native handle for each interactive
  // transaction. The 40-way experiment crashed during finalization. This
  // spike issues the same documented SQL on the store's serialized, persistent
  // local connection so every transaction is bounded and explicitly closed.
  async function beginLocalTransaction(mode) {
    await client.execute(mode === "write" ? "BEGIN IMMEDIATE" : "BEGIN TRANSACTION READONLY");
    let closed = false;
    return {
      get closed() { return closed; },
      execute: (statement, args) => client.execute(statement, args),
      async commit() {
        await client.execute("COMMIT");
        closed = true;
      },
      async rollback() {
        if (!closed) await client.execute("ROLLBACK");
        closed = true;
      },
    };
  }

  async function withWriteRetry(fn, maxBusyRetries = 100) {
    for (let attempt = 0; ; attempt += 1) {
      counters.transactionAttempts += 1;
      let tx;
      try {
        tx = await beginLocalTransaction("write");
        counters.activeWriteTransactions += 1;
        counters.maxActiveWriteTransactions = Math.max(counters.maxActiveWriteTransactions, counters.activeWriteTransactions);
        return await fn(tx);
      } catch (error) {
        if (tx && !tx.closed) await tx.rollback();
        if (!isBusy(error) || attempt >= maxBusyRetries) throw error;
        counters.busyRetries += 1;
        await backoff(attempt);
      } finally {
        if (tx) {
          counters.activeWriteTransactions -= 1;
        }
      }
    }
  }

  // A duplicate fast path is one same-snapshot statement: receipt, exact Project,
  // current membership and DM retained-history entitlement are proved together.
  // This also avoids creating one native interactive transaction handle per retry.
  async function recoverCommittedReceipt(input, hash) {
    const result = await client.execute({
      sql: `SELECT r.* FROM conversation_spike_receipts r
        JOIN conversation_spike_conversations c ON c.id = r.conversation_id
        JOIN workspaces w ON w.id = c.workspace_id
        JOIN users u ON u.id = ?
        JOIN workspace_members wm ON wm.workspace_id = c.workspace_id AND wm.user_id = u.id
        LEFT JOIN conversation_spike_participants p ON p.conversation_id = c.id AND p.user_id = u.id
        WHERE r.conversation_id = ? AND r.actor_id = ? AND r.client_request_id = ?
          AND c.workspace_id = ?
          AND (c.kind = 'project' OR (
            p.user_id IS NOT NULL AND p.retains_history = 1
            AND c.pair_state NOT IN ('pending', 'declined')
          ))`,
      args: [input.actorId, input.conversationId, input.actorId, input.clientRequestId, input.projectId],
    });
    const prior = result.rows[0];
    if (!prior) return null;
    if (String(rowValue(prior, "payload_hash")) !== hash) return { ok: false, code: "request_conflict" };
    return { ok: true, value: receiptFrom(prior), recovered: true };
  }

  async function send(input, options = {}) {
    counters.submissions += 1;
    if (!input || typeof input.actorId !== "string" || typeof input.projectId !== "string" ||
        typeof input.conversationId !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(input.clientRequestId ?? "")) {
      return { ok: false, code: "invalid_input" };
    }
    if (typeof input.body !== "string") return { ok: false, code: "invalid_input" };
    const body = normalizeBody(input.body);
    const mentions = normalizeMentions(input.mentionUserIds ?? []);
    if (!validBody(body) || mentions === null) return { ok: false, code: "invalid_input" };
    const hash = payloadHash(input, body, mentions);
    const requestHash = logicalRequestHash(input);
    return withOperation(async () => {
      const recovered = await recoverCommittedReceipt(input, hash);
      if (recovered) {
        if (options.dropResponseAfterCommit && recovered.ok) throw new LostResponseError();
        return recovered;
      }
      const committed = await withWriteRetry(async (tx) => {
      const auth = await authorize(tx, input, "write", input.expectedAudienceEpoch);
      if (!auth.ok) {
        await tx.rollback();
        return auth;
      }
      const priorResult = await tx.execute({
        sql: `SELECT * FROM conversation_spike_receipts
          WHERE conversation_id = ? AND actor_id = ? AND client_request_id = ?`,
        args: [input.conversationId, input.actorId, input.clientRequestId],
      });
      const prior = priorResult.rows[0];
      if (prior) {
        // No write occurred on this path; close the write snapshot explicitly.
        // The local adapter can reject COMMIT while a just-read statement is
        // still being finalized, whereas ROLLBACK safely ends this snapshot.
        await tx.rollback();
        if (String(rowValue(prior, "payload_hash")) !== hash) return { ok: false, code: "request_conflict" };
        return { ok: true, value: receiptFrom(prior), recovered: true };
      }
      if (mentions.length > 0) {
        const placeholders = mentions.map(() => "?").join(",");
        const eligible = await tx.execute({
          sql: `SELECT wm.user_id FROM workspace_members wm
            WHERE wm.workspace_id = ? AND wm.user_id IN (${placeholders})
              AND (? = 'project' OR EXISTS (
                SELECT 1 FROM conversation_spike_participants p
                WHERE p.conversation_id = ? AND p.user_id = wm.user_id
                  AND p.status = 'active' AND p.consented = 1
              ))`,
          args: [input.projectId, ...mentions, String(rowValue(auth.row, "kind")), input.conversationId],
        });
        if (eligible.rows.length !== mentions.length) {
          await tx.rollback();
          return { ok: false, code: "invalid_input" };
        }
      }
      if (input.rootId !== null && input.rootId !== undefined) {
        const root = await tx.execute({
          sql: `SELECT id FROM conversation_spike_messages
            WHERE id = ? AND conversation_id = ? AND workspace_id = ? AND root_id IS NULL`,
          args: [input.rootId, input.conversationId, input.projectId],
        });
        if (root.rows.length !== 1) {
          await tx.rollback();
          return { ok: false, code: "invalid_input" };
        }
      }
      const sequenceResult = await tx.execute({
        sql: "SELECT next_create_seq, next_change_seq FROM conversation_spike_conversations WHERE id = ?",
        args: [input.conversationId],
      });
      const createSeq = integer(rowValue(sequenceResult.rows[0], "next_create_seq"));
      const changeSeq = integer(rowValue(sequenceResult.rows[0], "next_change_seq"));
      const now = Date.now();
      const messageId = `message_${requestHash.slice(0, 32)}`;
      await tx.execute({
        sql: "UPDATE conversation_spike_conversations SET next_create_seq = next_create_seq + 1, next_change_seq = next_change_seq + 1 WHERE id = ?",
        args: [input.conversationId],
      });
      await tx.execute({
        sql: `INSERT INTO conversation_spike_messages
          (id, conversation_id, workspace_id, author_id, root_id, create_seq, revision, body, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        args: [messageId, input.conversationId, input.projectId, input.actorId, input.rootId ?? null, createSeq, body, now],
      });
      if (options.failAfter === "source") throw new SeamFailureError("source");
      await tx.execute({
        sql: `INSERT INTO conversation_spike_changes
          (conversation_id, change_seq, kind, message_id, revision, audience_epoch, happened_at)
          VALUES (?, ?, 'create', ?, 1, ?, ?)`,
        args: [input.conversationId, changeSeq, messageId, auth.audienceEpoch, now],
      });
      if (options.failAfter === "change") throw new SeamFailureError("change");
      const recipients = await tx.execute({
        sql: `SELECT wm.user_id FROM workspace_members wm
          WHERE wm.workspace_id = ? AND wm.user_id <> ?
            AND (? = 'project' OR EXISTS (
              SELECT 1 FROM conversation_spike_participants p
              WHERE p.conversation_id = ? AND p.user_id = wm.user_id AND p.status = 'active' AND p.consented = 1
            )) ORDER BY wm.user_id`,
        args: [input.projectId, input.actorId, String(rowValue(auth.row, "kind")), input.conversationId],
      });
      for (const recipient of recipients.rows) {
        const recipientId = String(rowValue(recipient, "user_id"));
        await tx.execute({
          sql: `INSERT INTO conversation_spike_attention
            (id, conversation_id, workspace_id, recipient_id, message_id, root_id, create_seq)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [`attention_${requestHash.slice(0, 24)}_${recipientId}`, input.conversationId, input.projectId, recipientId, messageId, input.rootId ?? null, createSeq],
        });
      }
      if (options.failAfter === "attention") throw new SeamFailureError("attention");
      for (const recipient of recipients.rows) {
        const recipientId = String(rowValue(recipient, "user_id"));
        await tx.execute({
          sql: `INSERT INTO conversation_spike_outbox
            (id, conversation_id, workspace_id, recipient_id, message_id, state, created_at)
            VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
          args: [`outbox_${requestHash.slice(0, 24)}_${recipientId}`, input.conversationId, input.projectId, recipientId, messageId, now],
        });
      }
      if (options.failAfter === "outbox") throw new SeamFailureError("outbox");
      await tx.execute({
        sql: `INSERT INTO conversation_spike_receipts
          (conversation_id, actor_id, client_request_id, payload_hash, message_id, create_seq, change_seq, revision, committed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        args: [input.conversationId, input.actorId, input.clientRequestId, hash, messageId, createSeq, changeSeq, now],
      });
      if (options.failAfter === "receipt") throw new SeamFailureError("receipt");
      await tx.commit();
      return {
        ok: true,
        value: { messageId, clientRequestId: input.clientRequestId, createSeq, changeSeq, revision: 1, committedAt: now },
        recovered: false,
      };
      });
      if (committed.ok && options.dropResponseAfterCommit) throw new LostResponseError();
      return committed;
    });
  }

  async function withReadTransaction(scope, fn) {
    return withOperation(async () => {
      const tx = await beginLocalTransaction("read");
      try {
        const auth = await authorize(tx, scope, "read");
        if (!auth.ok) {
          await tx.rollback();
          return auth;
        }
        const value = await fn(tx, auth);
        await tx.commit();
        return value;
      } catch (error) {
        if (!tx.closed) await tx.rollback();
        throw error;
      }
    });
  }

  async function lookupReceipt(scope) {
    return withReadTransaction(scope, async (tx) => {
      const result = await tx.execute({
        sql: `SELECT * FROM conversation_spike_receipts
          WHERE conversation_id = ? AND actor_id = ? AND client_request_id = ?`,
        args: [scope.conversationId, scope.actorId, scope.clientRequestId],
      });
      return result.rows[0]
        ? { ok: true, value: { state: "committed", receipt: receiptFrom(result.rows[0]) } }
        : { ok: true, value: { state: "absent" } };
    });
  }

  async function readChanges(scope) {
    return withReadTransaction(scope, async (tx, auth) => {
      const limit = Math.max(1, Math.min(100, Math.trunc(scope.limit ?? 50)));
      const result = await tx.execute({
        sql: `SELECT ch.conversation_id, ch.change_seq,
            CASE WHEN m.deleted_at IS NOT NULL THEN 'delete' ELSE ch.kind END AS effective_kind,
            ch.message_id, m.revision AS current_revision, m.body AS current_body,
            ch.audience_epoch, ch.happened_at
          FROM conversation_spike_changes ch
          LEFT JOIN conversation_spike_messages m
            ON m.id = ch.message_id AND m.conversation_id = ch.conversation_id
          WHERE ch.conversation_id = ? AND ch.change_seq > ?
          ORDER BY ch.change_seq LIMIT ?`,
        args: [scope.conversationId, Math.max(0, Math.trunc(scope.afterChangeSeq ?? 0)), limit],
      });
      const through = result.rows.length === 0
        ? Math.max(0, Math.trunc(scope.afterChangeSeq ?? 0))
        : integer(rowValue(result.rows.at(-1), "change_seq"));
      const remaining = await tx.execute({
        sql: "SELECT 1 FROM conversation_spike_changes WHERE conversation_id = ? AND change_seq > ? LIMIT 1",
        args: [scope.conversationId, through],
      });
      return {
        ok: true,
        value: {
          audienceEpoch: auth.audienceEpoch,
          throughChangeSeq: through,
          hasMore: remaining.rows.length > 0,
          changes: result.rows.map((row) => ({
            changeSeq: integer(rowValue(row, "change_seq")),
            kind: String(rowValue(row, "effective_kind")),
            messageId: rowValue(row, "message_id") === null ? null : String(rowValue(row, "message_id")),
            revision: rowValue(row, "current_revision") === null ? null : integer(rowValue(row, "current_revision")),
            body: rowValue(row, "current_body") === null ? null : String(rowValue(row, "current_body")),
            audienceEpoch: integer(rowValue(row, "audience_epoch")),
          })),
        },
      };
    });
  }

  async function mutateMessage(input, kind) {
    if (kind === "edit" && typeof input.body !== "string") return { ok: false, code: "invalid_input" };
    const normalized = kind === "edit" ? normalizeBody(input.body) : null;
    if (kind === "edit" && !validBody(normalized)) return { ok: false, code: "invalid_input" };
    return withOperation(() => withWriteRetry(async (tx) => {
      const auth = await authorize(tx, input, "write", input.expectedAudienceEpoch);
      if (!auth.ok) {
        await tx.rollback();
        return auth;
      }
      const sourceResult = await tx.execute({
        sql: "SELECT * FROM conversation_spike_messages WHERE id = ? AND conversation_id = ? AND workspace_id = ?",
        args: [input.messageId, input.conversationId, input.projectId],
      });
      const source = sourceResult.rows[0];
      if (!source || String(rowValue(source, "author_id")) !== input.actorId) {
        await tx.rollback();
        return { ok: false, code: "unavailable" };
      }
      if (integer(rowValue(source, "revision")) !== input.expectedRevision || rowValue(source, "deleted_at") !== null) {
        await tx.rollback();
        return { ok: false, code: "revision_conflict" };
      }
      const sequenceResult = await tx.execute({
        sql: "SELECT next_change_seq FROM conversation_spike_conversations WHERE id = ?",
        args: [input.conversationId],
      });
      const changeSeq = integer(rowValue(sequenceResult.rows[0], "next_change_seq"));
      const revision = input.expectedRevision + 1;
      const now = Date.now();
      await tx.execute({
        sql: "UPDATE conversation_spike_conversations SET next_change_seq = next_change_seq + 1 WHERE id = ?",
        args: [input.conversationId],
      });
      await tx.execute({
        sql: kind === "edit"
          ? "UPDATE conversation_spike_messages SET body = ?, revision = ?, edited_at = ? WHERE id = ?"
          : "UPDATE conversation_spike_messages SET body = NULL, revision = ?, deleted_at = ? WHERE id = ?",
        args: kind === "edit" ? [normalized, revision, now, input.messageId] : [revision, now, input.messageId],
      });
      await tx.execute({
        sql: `INSERT INTO conversation_spike_changes
          (conversation_id, change_seq, kind, message_id, revision, audience_epoch, happened_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [input.conversationId, changeSeq, kind === "edit" ? "edit" : "delete", input.messageId, revision, auth.audienceEpoch, now],
      });
      await tx.commit();
      return { ok: true, value: { messageId: input.messageId, revision, changeSeq } };
    }));
  }

  async function confirmDm(scope) {
    return withOperation(() => withWriteRetry(async (tx) => {
      const basic = await tx.execute({
        sql: `SELECT c.audience_epoch FROM conversation_spike_conversations c
          JOIN workspace_members wm ON wm.workspace_id = c.workspace_id AND wm.user_id = ?
          JOIN conversation_spike_participants p ON p.conversation_id = c.id AND p.user_id = ?
          WHERE c.id = ? AND c.workspace_id = ? AND c.kind = 'dm'`,
        args: [scope.actorId, scope.actorId, scope.conversationId, scope.projectId],
      });
      if (!basic.rows[0]) {
        await tx.rollback();
        return { ok: false, code: "unavailable" };
      }
      await tx.execute({
        sql: `UPDATE conversation_spike_participants
          SET status = 'active', consented = 1, retains_history = 1
          WHERE conversation_id = ? AND user_id = ?`,
        args: [scope.conversationId, scope.actorId],
      });
      const pair = await tx.execute({
        sql: `SELECT COUNT(*) AS count FROM conversation_spike_participants p
          JOIN conversation_spike_conversations c ON c.id = p.conversation_id
          JOIN workspace_members wm ON wm.workspace_id = c.workspace_id AND wm.user_id = p.user_id
          WHERE p.conversation_id = ? AND p.status = 'active' AND p.consented = 1`,
        args: [scope.conversationId],
      });
      if (integer(rowValue(pair.rows[0], "count")) === 2) {
        await tx.execute({
          sql: "UPDATE conversation_spike_conversations SET pair_state = 'active' WHERE id = ?",
          args: [scope.conversationId],
        });
      }
      await tx.commit();
      return { ok: true, value: { active: integer(rowValue(pair.rows[0], "count")) === 2 } };
    }));
  }

  async function listAttention(scope) {
    return withReadTransaction(scope, async (tx) => {
      const result = await tx.execute({
        sql: `SELECT id, message_id, root_id, create_seq, observed_at FROM conversation_spike_attention
          WHERE conversation_id = ? AND recipient_id = ? ORDER BY create_seq`,
        args: [scope.conversationId, scope.actorId],
      });
      return { ok: true, value: result.rows };
    });
  }

  async function markObserved(scope) {
    return withOperation(() => withWriteRetry(async (tx) => {
      const auth = await authorize(tx, scope, "read");
      if (!auth.ok) {
        await tx.rollback();
        return auth;
      }
      await tx.execute({
        sql: `UPDATE conversation_spike_attention SET observed_at = ?
          WHERE conversation_id = ? AND recipient_id = ? AND root_id IS ? AND create_seq <= ?`,
        args: [Date.now(), scope.conversationId, scope.actorId, scope.rootId ?? null, scope.throughCreateSeq],
      });
      await tx.commit();
      return { ok: true };
    }));
  }

  return {
    client,
    counters,
    send,
    lookupReceipt,
    readChanges,
    edit: (input) => mutateMessage(input, "edit"),
    tombstone: (input) => mutateMessage(input, "delete"),
    confirmDm,
    listAttention,
    markObserved,
    close: () => client.close(),
  };
}

export function mergeChangePage(state, changes) {
  const next = new Map(state);
  for (const change of changes) {
    if (!change.messageId || change.revision === null) continue;
    const current = next.get(change.messageId);
    if (!current || change.revision > current.revision) {
      next.set(change.messageId, {
        messageId: change.messageId,
        revision: change.revision,
        body: change.kind === "delete" ? null : change.body,
        deleted: change.kind === "delete",
      });
    }
  }
  return next;
}
