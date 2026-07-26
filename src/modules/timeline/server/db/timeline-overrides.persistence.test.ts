import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@libsql/client";
import {
  decodePersistedAudienceState,
  decodePersistedDateOverride,
  encodePersistedAudienceState,
  encodePersistedDateOverride,
  resolveEffectiveNodeDate,
} from "./timeline-queries";

test("existing overlay columns persist inherit, custom, and undated intent distinctly", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    await client.execute(`
      CREATE TABLE node_overlays (
        workspace_slug TEXT NOT NULL,
        node_id TEXT NOT NULL,
        lane_override TEXT,
        date_override TEXT,
        PRIMARY KEY (workspace_slug, node_id)
      )
    `);
    await client.batch([
      {
        sql: "INSERT INTO node_overlays VALUES (?, ?, ?, ?)",
        args: ["weddings", "inherit", null, encodePersistedDateOverride({ mode: "inherit" })],
      },
      {
        sql: "INSERT INTO node_overlays VALUES (?, ?, ?, ?)",
        args: [
          "weddings",
          "custom",
          encodePersistedAudienceState("covered"),
          encodePersistedDateOverride({ mode: "date", date: "2026-09-01" }),
        ],
      },
      {
        sql: "INSERT INTO node_overlays VALUES (?, ?, ?, ?)",
        args: ["weddings", "undated", null, encodePersistedDateOverride({ mode: "undated" })],
      },
    ]);

    const result = await client.execute(
      "SELECT node_id, lane_override, date_override FROM node_overlays ORDER BY node_id",
    );
    const byId = new Map(
      result.rows.map((row) => [String(row.node_id), row]),
    );

    const inherited = decodePersistedDateOverride(
      byId.get("inherit")!.date_override as string | null,
    );
    assert.deepEqual(inherited, { mode: "inherit", date: null });
    assert.equal(
      resolveEffectiveNodeDate("2026-08-08", inherited.mode, inherited.date),
      "2026-08-08",
    );

    const custom = decodePersistedDateOverride(
      byId.get("custom")!.date_override as string | null,
    );
    assert.deepEqual(custom, { mode: "date", date: "2026-09-01" });
    assert.equal(
      decodePersistedAudienceState(
        byId.get("custom")!.lane_override as string | null,
      ),
      "covered",
    );

    const undated = decodePersistedDateOverride(
      byId.get("undated")!.date_override as string | null,
    );
    assert.deepEqual(undated, { mode: "undated", date: null });
    assert.equal(
      resolveEffectiveNodeDate("2026-08-22", undated.mode, undated.date),
      null,
    );
  } finally {
    client.close();
  }
});

test("legacy lane values remain readable during zero-downtime rollout", () => {
  assert.equal(decodePersistedAudienceState("Shipped"), "covered");
  assert.equal(decodePersistedAudienceState("In flight"), "now");
  assert.equal(decodePersistedAudienceState("Next"), "next");
  assert.equal(decodePersistedAudienceState("Later"), "later");
  assert.equal(decodePersistedAudienceState("unknown"), null);
});
