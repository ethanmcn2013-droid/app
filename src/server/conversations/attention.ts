import "server-only";

import type { ConversationResult } from "../../lib/conversations/contracts";
import type { ConversationDatabaseAdapter, ConversationSqlExecutor } from "./database";
import { conversationWriteFencesClear } from "./write-fences";

export type AttentionSource = "conversation" | "task_discussion";
export type ObservedItem = Readonly<{ kind: AttentionSource; scopeId: string; itemId: string }>;
export type DirectedAttention = Readonly<{
  eventId: string;
  kind: AttentionSource;
  projectId: string;
  projectName: string;
  scopeId: string;
  itemId: string;
  rootId: string | null;
  createSeq: number;
  createdAt: number;
  seenAt: number | null;
  href: string;
}>;

const id = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const number = (value: unknown) => typeof value === "bigint" ? Number(value) : Number(value);
const str = (value: unknown) => String(value);
const fail = (code: "invalid_input" | "unavailable" | "temporarily_unavailable") => ({ ok: false, code } as const);

function href(kind: AttentionSource, projectId: string, itemId: string, rootId: string | null, createSeq: number): string {
  if (kind === "task_discussion") return `/app/task/${encodeURIComponent(projectId)}#comment-${encodeURIComponent(itemId)}`;
  const query = new URLSearchParams({ projectId });
  if (rootId) query.set("rootId", rootId);
  query.set("messageId", itemId);
  query.set("messageSeq", String(createSeq));
  return `/app/messages?${query.toString()}`;
}

/** The adapter's read/write transaction keeps authorization and observation together. */
export function createMessageAttentionService(adapter: ConversationDatabaseAdapter) {
  async function transaction<T>(mode: "read" | "write", operation: (db: ConversationSqlExecutor) => Promise<T>): Promise<T> {
    return adapter.transaction(mode, operation);
  }

  async function listDirected(input: { actorId: string; limit?: number }): Promise<ConversationResult<readonly DirectedAttention[]>> {
    if (!id(input.actorId) || !Number.isSafeInteger(input.limit ?? 50) || (input.limit ?? 50) < 1 || (input.limit ?? 50) > 100) return fail("invalid_input");
    if (!adapter.available) return fail("temporarily_unavailable");
    return transaction("read", async (db) => {
      const limit = input.limit ?? 50;
      const messages = await db.execute({ sql: `
        SELECT a.id AS event_id, a.conversation_id AS scope_id, c.workspace_id AS project_id,
          w.name AS project_name, a.message_id AS item_id, a.root_id, a.create_seq,
          m.created_at AS created_at, a.observed_at AS seen_at
        FROM conversation_attention a
        JOIN conversations c ON c.id=a.conversation_id AND c.workspace_id=a.workspace_id AND c.kind='project'
        JOIN conversation_messages m ON m.id=a.message_id AND m.conversation_id=c.id
        JOIN workspaces w ON w.id=c.workspace_id
        JOIN workspace_members wm ON wm.workspace_id=w.id AND wm.user_id=a.recipient_id
        JOIN users actor ON actor.id=wm.user_id
        WHERE a.recipient_id=? AND w.archived_at IS NULL AND m.deleted_at IS NULL AND m.body IS NOT NULL
        ORDER BY (a.observed_at IS NOT NULL),m.created_at DESC,a.id DESC LIMIT ?`, args: [input.actorId, limit] });
      const comments = await db.execute({ sql: `
        SELECT a.event_id, a.task_id AS scope_id, t.workspace_id AS project_id,
          w.name AS project_name, a.comment_id AS item_id, a.root_id, a.create_seq,
          cm.created_at * 1000 AS created_at, a.seen_at_ms AS seen_at
        FROM task_comment_attention a
        JOIN tasks t ON t.id=a.task_id AND t.workspace_id=a.workspace_id
        JOIN comments cm ON cm.id=a.comment_id AND cm.task_id=t.id AND cm.workspace_id=t.workspace_id
        JOIN workspaces w ON w.id=t.workspace_id
        JOIN workspace_members wm ON wm.workspace_id=w.id AND wm.user_id=a.recipient_id
        JOIN users actor ON actor.id=wm.user_id
        WHERE a.recipient_id=? AND w.archived_at IS NULL AND t.archived_at IS NULL
          AND cm.deleted_at IS NULL AND cm.body IS NOT NULL
        ORDER BY (a.seen_at_ms IS NOT NULL),cm.created_at DESC,a.event_id DESC LIMIT ?`, args: [input.actorId, limit] });
      const mapped = (row: Record<string, unknown>, kind: AttentionSource): DirectedAttention => {
        const projectId = str(row.project_id);
        const scopeId = str(row.scope_id);
        const itemId = str(row.item_id);
        const rootId = row.root_id == null ? null : str(row.root_id);
        return { eventId: str(row.event_id), kind, projectId, projectName: str(row.project_name),
          scopeId, itemId, rootId, createSeq: number(row.create_seq), createdAt: number(row.created_at),
          seenAt: row.seen_at == null ? null : number(row.seen_at),
          href: href(kind, kind === "conversation" ? projectId : scopeId, itemId, rootId, number(row.create_seq)) };
      };
      return { ok: true, value: [...messages.rows.map(row => mapped(row, "conversation")),
        ...comments.rows.map(row => mapped(row, "task_discussion"))]
        .sort((a, b) => Number(a.seenAt !== null) - Number(b.seenAt !== null) ||
          b.createdAt - a.createdAt || b.eventId.localeCompare(a.eventId)).slice(0, limit) };
    });
  }

  async function authorizedItem(db: ConversationSqlExecutor, actorId: string, item: ObservedItem) {
    if (item.kind === "conversation") {
      const found = await db.execute({ sql: `SELECT m.create_seq,m.root_id,c.workspace_id AS project_id FROM conversation_messages m
        JOIN conversations c ON c.id=m.conversation_id AND c.kind='project'
        JOIN workspaces w ON w.id=c.workspace_id
        JOIN workspace_members wm ON wm.workspace_id=w.id AND wm.user_id=?
        JOIN users actor ON actor.id=wm.user_id
        WHERE m.id=? AND m.conversation_id=? AND m.deleted_at IS NULL AND m.body IS NOT NULL`,
      args: [actorId, item.itemId, item.scopeId] });
      return found.rows[0] ?? null;
    }
    const found = await db.execute({ sql: `SELECT cm.create_seq,cm.root_id,t.workspace_id AS project_id FROM comments cm
      JOIN tasks t ON t.id=cm.task_id AND t.workspace_id=cm.workspace_id
      JOIN workspaces w ON w.id=t.workspace_id
      JOIN workspace_members wm ON wm.workspace_id=w.id AND wm.user_id=?
      JOIN users actor ON actor.id=wm.user_id
      WHERE cm.id=? AND cm.task_id=? AND cm.deleted_at IS NULL AND cm.body IS NOT NULL
        AND cm.create_seq IS NOT NULL`, args: [actorId, item.itemId, item.scopeId] });
    return found.rows[0] ?? null;
  }

  async function mergeCoverage(db: ConversationSqlExecutor, actorId: string, item: ObservedItem, row: Record<string, unknown>, now: number) {
    const seq = number(row.create_seq);
    if (!Number.isSafeInteger(seq) || seq < 1) throw new Error("invalid_source_sequence");
    const root = row.root_id == null ? "" : str(row.root_id);
    const touching = await db.execute({ sql: `SELECT range_start,range_end FROM message_read_coverage
      WHERE user_id=? AND source_kind=? AND scope_id=? AND root_key=? ORDER BY range_start`,
      args: [actorId, item.kind, item.scopeId, root] });
    let start = seq, end = seq;
    // The complete small per-thread set also closes transitive adjacency after
    // out-of-order observations, without marking any unseen sequence as read.
    const merged: Record<string, unknown>[] = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const range of touching.rows) {
        if (merged.includes(range) || number(range.range_end) < start - 1 || number(range.range_start) > end + 1) continue;
        start = Math.min(start, number(range.range_start));
        end = Math.max(end, number(range.range_end));
        merged.push(range);
        changed = true;
      }
    }
    for (const range of merged) await db.execute({ sql: `DELETE FROM message_read_coverage
      WHERE user_id=? AND source_kind=? AND scope_id=? AND root_key=? AND range_start=? AND range_end=?`,
      args: [actorId, item.kind, item.scopeId, root, number(range.range_start), number(range.range_end)] });
    await db.execute({ sql: `INSERT INTO message_read_coverage
      (user_id,source_kind,scope_id,root_key,range_start,range_end,observed_at_ms)
      VALUES(?,?,?,?,?,?,?)`, args: [actorId, item.kind, item.scopeId, root, start, end, now] });
  }

  async function readStatus(input: { actorId: string; items: readonly ObservedItem[] }): Promise<ConversationResult<{ unreadItemIds: readonly string[]; positions: readonly { itemId: string; createSeq: number }[] }>> {
    if (!id(input.actorId) || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 100 ||
      input.items.some(item => !item || !["conversation", "task_discussion"].includes(item.kind) || !id(item.scopeId) || !id(item.itemId))) return fail("invalid_input");
    if (!adapter.available) return fail("temporarily_unavailable");
    return transaction("read", async (db) => {
      const unreadItemIds: string[] = [];
      const positions: { itemId: string; createSeq: number }[] = [];
      for (const item of new Map(input.items.map(entry => [`${entry.kind}:${entry.scopeId}:${entry.itemId}`, entry])).values()) {
        const row = await authorizedItem(db, input.actorId, item);
        if (!row) return fail("unavailable");
        positions.push({ itemId: item.itemId, createSeq: number(row.create_seq) });
        const covered = await db.execute({ sql: `SELECT 1 AS covered FROM message_read_coverage
          WHERE user_id=? AND source_kind=? AND scope_id=? AND root_key=? AND range_start<=? AND range_end>=? LIMIT 1`,
          args: [input.actorId, item.kind, item.scopeId, row.root_id == null ? "" : str(row.root_id), number(row.create_seq), number(row.create_seq)] });
        if (!covered.rows.length) unreadItemIds.push(item.itemId);
      }
      return { ok: true, value: { unreadItemIds, positions } };
    });
  }

  async function observe(input: { actorId: string; items: readonly ObservedItem[] }): Promise<ConversationResult<{ observedAt: number; observedItems: number }>> {
    if (!id(input.actorId) || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 100 ||
      input.items.some(item => !item || !["conversation", "task_discussion"].includes(item.kind) || !id(item.scopeId) || !id(item.itemId))) return fail("invalid_input");
    if (!adapter.available) return fail("temporarily_unavailable");
    return transaction("write", async (db) => {
      const unique = new Map(input.items.map(item => [`${item.kind}:${item.scopeId}:${item.itemId}`, item]));
      const resolved = [] as { item: ObservedItem; row: Record<string, unknown> }[];
      for (const item of unique.values()) {
        const row = await authorizedItem(db, input.actorId, item);
        if (!row) return fail("unavailable");
        if (!await conversationWriteFencesClear(db, input.actorId, str(row.project_id))) return fail("unavailable");
        resolved.push({ item, row });
      }
      const now = Date.now();
      for (const { item, row } of resolved) {
        await mergeCoverage(db, input.actorId, item, row, now);
        if (item.kind === "conversation") await db.execute({ sql: `UPDATE conversation_attention
          SET observed_at=COALESCE(observed_at,?)
          WHERE recipient_id=? AND conversation_id=? AND message_id=?`,
          args: [now, input.actorId, item.scopeId, item.itemId] });
        else await db.execute({ sql: `UPDATE task_comment_attention
          SET seen_at_ms=COALESCE(seen_at_ms,?)
          WHERE recipient_id=? AND task_id=? AND comment_id=?`,
          args: [now, input.actorId, item.scopeId, item.itemId] });
      }
      return { ok: true, value: { observedAt: now, observedItems: resolved.length } };
    });
  }

  /** A deliberate mark-all captures source high-water inside its write transaction. */
  async function markAllObserved(input: { actorId: string }): Promise<ConversationResult<{ observedAt: number; observedEvents: number }>> {
    if (!id(input.actorId)) return fail("invalid_input");
    if (!adapter.available) return fail("temporarily_unavailable");
    return transaction("write", async (db) => {
      const now = Date.now();
      const groups = await db.execute({ sql: `SELECT 'conversation' AS kind,m.conversation_id AS scope_id,
          c.workspace_id AS project_id,
          COALESCE(m.root_id,'') AS root_key,MAX(m.create_seq) AS top
        FROM conversation_messages m JOIN conversations c ON c.id=m.conversation_id AND c.kind='project'
        JOIN workspace_members wm ON wm.workspace_id=c.workspace_id AND wm.user_id=?
        JOIN users actor ON actor.id=wm.user_id WHERE m.deleted_at IS NULL AND m.body IS NOT NULL
        GROUP BY m.conversation_id,COALESCE(m.root_id,'')
        UNION ALL
        SELECT 'task_discussion' AS kind,cm.task_id AS scope_id,t.workspace_id AS project_id,COALESCE(cm.root_id,'') AS root_key,
          MAX(cm.create_seq) AS top FROM comments cm
        JOIN tasks t ON t.id=cm.task_id AND t.workspace_id=cm.workspace_id
        JOIN workspace_members wm ON wm.workspace_id=t.workspace_id AND wm.user_id=?
        JOIN users actor ON actor.id=wm.user_id
        WHERE cm.deleted_at IS NULL AND cm.body IS NOT NULL AND cm.create_seq IS NOT NULL
        GROUP BY cm.task_id,COALESCE(cm.root_id,'')`, args: [input.actorId, input.actorId] });
      for (const projectId of new Set(groups.rows.map(row => str(row.project_id)))) {
        if (!await conversationWriteFencesClear(db, input.actorId, projectId)) return fail("unavailable");
      }
      for (const row of groups.rows) {
        await db.execute({ sql: `DELETE FROM message_read_coverage WHERE user_id=? AND source_kind=? AND scope_id=? AND root_key=?`,
          args: [input.actorId, str(row.kind), str(row.scope_id), str(row.root_key)] });
        await db.execute({ sql: `INSERT INTO message_read_coverage
          (user_id,source_kind,scope_id,root_key,range_start,range_end,observed_at_ms)
          VALUES(?,?,?,?,1,?,?)`, args: [input.actorId, str(row.kind), str(row.scope_id), str(row.root_key), number(row.top), now] });
      }
      const a = await db.execute({ sql: `UPDATE conversation_attention SET observed_at=COALESCE(observed_at,?)
        WHERE recipient_id=? AND observed_at IS NULL AND EXISTS (
          SELECT 1 FROM conversations c JOIN workspace_members wm ON wm.workspace_id=c.workspace_id
          JOIN users actor ON actor.id=wm.user_id JOIN conversation_messages m ON m.id=conversation_attention.message_id
          WHERE c.id=conversation_attention.conversation_id AND c.kind='project' AND wm.user_id=?
            AND m.deleted_at IS NULL AND m.body IS NOT NULL)`, args: [now, input.actorId, input.actorId] });
      const b = await db.execute({ sql: `UPDATE task_comment_attention SET seen_at_ms=COALESCE(seen_at_ms,?)
        WHERE recipient_id=? AND seen_at_ms IS NULL AND EXISTS (
          SELECT 1 FROM tasks t JOIN workspace_members wm ON wm.workspace_id=t.workspace_id
          JOIN users actor ON actor.id=wm.user_id JOIN comments cm ON cm.id=task_comment_attention.comment_id
          WHERE t.id=task_comment_attention.task_id AND wm.user_id=?
            AND cm.deleted_at IS NULL AND cm.body IS NOT NULL)`, args: [now, input.actorId, input.actorId] });
      return { ok: true, value: { observedAt: now, observedEvents: (a.rowsAffected ?? 0) + (b.rowsAffected ?? 0) } };
    });
  }

  return { listDirected, readStatus, observe, markAllObserved };
}
