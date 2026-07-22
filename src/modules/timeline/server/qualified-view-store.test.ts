import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { hashAudienceToken } from "@/modules/timeline/lib/audience-timeline";
import * as timelineSchema from "@/modules/timeline/server/db/timeline-schema";
import {
  recordQualifiedViewWith,
  type QualifiedViewDatabase,
} from "./qualified-view-store";

const TOKEN_A = "A".repeat(43);
const TOKEN_B = "B".repeat(43);
const SESSION_A = "7bd648de-1aa0-4a81-82d7-2d722942a092";
const SESSION_B = "6ca537cd-3bb1-48fe-9ce1-860b9b228dc4";
const NOW = new Date("2026-07-22T12:00:00.000Z");

async function freshQualifiedViewDatabase(): Promise<{
  client: Client;
  database: QualifiedViewDatabase;
  cleanup: () => Promise<void>;
}> {
  const directory = mkdtempSync(join(tmpdir(), "signal-qualified-view-"));
  const databasePath = join(directory, "test.db").replaceAll("\\", "/");
  const client = createClient({ url: `file:${databasePath}` });
  await client.executeMultiple(`
      CREATE TABLE timeline_publications (
        id TEXT PRIMARY KEY NOT NULL,
        state TEXT NOT NULL,
        qualified_view_count INTEGER NOT NULL DEFAULT 0,
        last_qualified_view_at INTEGER
      );
      CREATE TABLE audience_shares (
        publication_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        state TEXT NOT NULL,
        expires_at INTEGER
      );
      CREATE TABLE audience_view_receipts (
        publication_id TEXT NOT NULL,
        session_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY (publication_id, session_hash)
      ) WITHOUT ROWID;
      CREATE INDEX idx_audience_view_receipts_expiry
        ON audience_view_receipts (expires_at);
      INSERT INTO timeline_publications (id, state)
        VALUES ('publication-1', 'published');
      INSERT INTO audience_shares (publication_id, token_hash, state)
        VALUES ('publication-1', '${hashAudienceToken(TOKEN_A)}', 'active');
  `);
  return {
    client,
    database: drizzle(client, { schema: timelineSchema }),
    // libSQL's native Windows handle can outlive close briefly. CI temp space
    // is process-scoped, so close the client and let the runner clear its temp.
    cleanup: async () => client.close(),
  };
}

describe("qualified view persistence", () => {
  it("counts once per publication session and stores only its digest", async (context) => {
    const { client, database, cleanup } = await freshQualifiedViewDatabase();
    context.after(cleanup);
    assert.equal(
      await recordQualifiedViewWith(
        database,
        TOKEN_A,
        { sessionId: SESSION_A, visibleForMs: 2_000 },
        NOW,
      ),
      "counted",
    );
    assert.equal(
      await recordQualifiedViewWith(
        database,
        TOKEN_A,
        { sessionId: SESSION_A, visibleForMs: 2_000 },
        NOW,
      ),
      "duplicate",
    );

    const aggregate = await client.execute(
      "SELECT qualified_view_count, last_qualified_view_at FROM timeline_publications",
    );
    assert.equal(aggregate.rows[0].qualified_view_count, 1);
    assert.equal(aggregate.rows[0].last_qualified_view_at, Math.floor(NOW.getTime() / 1_000));

    const receipts = await client.execute(
      "SELECT session_hash, created_at, expires_at FROM audience_view_receipts",
    );
    assert.equal(receipts.rows.length, 1);
    assert.match(String(receipts.rows[0].session_hash), /^[a-f0-9]{64}$/);
    assert.notEqual(receipts.rows[0].session_hash, SESSION_A);
    assert.equal(
      Number(receipts.rows[0].expires_at) - Number(receipts.rows[0].created_at),
      30 * 60,
    );
  });

  it("deduplicates across link rotation at the publication boundary", async (context) => {
    const { client, database, cleanup } = await freshQualifiedViewDatabase();
    context.after(cleanup);
    await recordQualifiedViewWith(
      database,
      TOKEN_A,
      { sessionId: SESSION_A, visibleForMs: 2_000 },
      NOW,
    );
    await client.execute({
      sql: "UPDATE audience_shares SET state='rotated' WHERE token_hash=?",
      args: [hashAudienceToken(TOKEN_A)],
    });
    await client.execute({
      sql: "INSERT INTO audience_shares (publication_id, token_hash, state) VALUES ('publication-1', ?, 'active')",
      args: [hashAudienceToken(TOKEN_B)],
    });

    assert.equal(
      await recordQualifiedViewWith(
        database,
        TOKEN_B,
        { sessionId: SESSION_A, visibleForMs: 2_000 },
        NOW,
      ),
      "duplicate",
    );
    assert.equal(
      await recordQualifiedViewWith(
        database,
        TOKEN_B,
        { sessionId: SESSION_B, visibleForMs: 2_000 },
        NOW,
      ),
      "counted",
    );
    const aggregate = await client.execute(
      "SELECT qualified_view_count FROM timeline_publications",
    );
    assert.equal(aggregate.rows[0].qualified_view_count, 2);
  });

  it("expires receipts, but never counts revoked or unpublished access", async (context) => {
    const { client, database, cleanup } = await freshQualifiedViewDatabase();
    context.after(cleanup);
    await recordQualifiedViewWith(
      database,
      TOKEN_A,
      { sessionId: SESSION_A, visibleForMs: 2_000 },
      NOW,
    );
    await client.execute(
      "INSERT INTO timeline_publications (id, state) VALUES ('publication-inactive', 'unpublished')",
    );
    await client.execute({
      sql: "INSERT INTO audience_view_receipts (publication_id, session_hash, created_at, expires_at) VALUES ('publication-inactive', ?, 1, 1)",
      args: ["c".repeat(64)],
    });
    await client.execute(
      "UPDATE audience_view_receipts SET expires_at=1 WHERE publication_id='publication-1'",
    );
    assert.equal(
      await recordQualifiedViewWith(
        database,
        TOKEN_A,
        { sessionId: SESSION_A, visibleForMs: 2_000 },
        new Date(NOW.getTime() + 31 * 60 * 1_000),
      ),
      "counted",
    );
    const expired = await client.execute(
      "SELECT COUNT(*) AS count FROM audience_view_receipts WHERE publication_id='publication-inactive'",
    );
    assert.equal(expired.rows[0].count, 0, "expired inactive receipt was retained");

    await client.execute("UPDATE audience_shares SET state='revoked'");
    assert.equal(
      await recordQualifiedViewWith(
        database,
        TOKEN_A,
        { sessionId: SESSION_B, visibleForMs: 2_000 },
        NOW,
      ),
      "invalid",
    );
    await client.execute("UPDATE audience_shares SET state='active'");
    await client.execute("UPDATE timeline_publications SET state='unpublished'");
    assert.equal(
      await recordQualifiedViewWith(
        database,
        TOKEN_A,
        { sessionId: SESSION_B, visibleForMs: 2_000 },
        NOW,
      ),
      "unpublished",
    );
    const aggregate = await client.execute(
      "SELECT qualified_view_count FROM timeline_publications",
    );
    assert.equal(aggregate.rows[0].qualified_view_count, 2);
  });
});
