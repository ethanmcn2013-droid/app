/**
 * Stage 1 · the milestone date-history writer proves itself (D-026 / R4).
 *
 * Three things are proven here, against a real libSQL database:
 *
 *   1. The sync upsert (`writeRoadmapNodes`) records a date change when the
 *      flag is on, records nothing when it is off, and never records the
 *      one-sided cases (date appearing, date clearing).
 *   2. The overlay upsert (`upsertNodeOverlay`) records the EFFECTIVE date
 *      change an owner performs, resolves inherit/undated modes honestly,
 *      and skips manual nodes that analytics can never read.
 *   3. The rows are readable by the analytics provider's exact parse: the
 *      action contains "date", the payload carries {from, to}, and the row
 *      is workspace-scoped — asserted with the same predicates
 *      providers/timeline.ts applies, so a drift in shape fails here first.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { diffMilestoneDates } from "./milestone-date-history";

const SCRATCH_DIR = mkdtempSync(join(tmpdir(), "stage1-history-"));
const TIMELINE_URL = pathToFileURL(join(SCRATCH_DIR, "timeline.db")).href;
process.env.TIMELINE_DATABASE_URL = TIMELINE_URL;
delete process.env.TIMELINE_AUTH_TOKEN;

const WS = "ws-history";
const OTHER_WS = "ws-other";

let queries: typeof import("./timeline-queries") | null = null;
async function load() {
  queries ??= await import("./timeline-queries");
  return queries;
}

async function reset(client: Client): Promise<void> {
  await client.executeMultiple(`
    DROP TABLE IF EXISTS activity;
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS projects;
    DROP TABLE IF EXISTS workspaces;
    DROP TABLE IF EXISTS node_overlays;
  `);
  const baseline = readFileSync("drizzle-timeline/0000_timeline_baseline.sql", "utf8");
  const wanted =
    /^CREATE (TABLE|UNIQUE INDEX|INDEX) `?(tasks|projects|workspaces|node_overlays|activity|idx_activity_entity)`?/;
  await client.executeMultiple(
    baseline
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => wanted.test(s))
      .join(";\n") + ";",
  );
  await client.execute({
    sql: "INSERT INTO workspaces (slug, name, owner_user_id) VALUES (?, ?, 'owner')",
    args: [WS, WS],
  });
  await client.execute({
    sql: `INSERT INTO projects (workspace_slug, slug, name, one_liner, accent)
          VALUES (?, 'plan', 'The plan', '', 'default')`,
    args: [WS],
  });
}

async function harness(t: { after: (fn: () => void) => void }) {
  const client = createClient({ url: TIMELINE_URL });
  t.after(() => client.close());
  await reset(client);
  return { client, ...(await load()) };
}

type ActivityRow = {
  workspace_slug: string;
  entity_kind: string;
  entity_id: string;
  action: string;
  payload: string;
};

async function activityRows(client: Client): Promise<ActivityRow[]> {
  const res = await client.execute(
    "SELECT workspace_slug, entity_kind, entity_id, action, payload FROM activity ORDER BY created_at, id",
  );
  return res.rows as unknown as ActivityRow[];
}

function milestone(id: string, targetDate: string | null, sortOrder = 0) {
  return {
    id,
    projectSlug: "plan",
    workspaceSlug: WS,
    title: id,
    status: "next" as const,
    targetDate,
    sortOrder,
  };
}

function withFlag<T>(value: string | undefined, run: () => Promise<T>): Promise<T> {
  const prior = process.env.SIGNAL_MILESTONE_DATE_HISTORY_ENABLED;
  if (value === undefined) delete process.env.SIGNAL_MILESTONE_DATE_HISTORY_ENABLED;
  else process.env.SIGNAL_MILESTONE_DATE_HISTORY_ENABLED = value;
  const restore = () => {
    if (prior === undefined) delete process.env.SIGNAL_MILESTONE_DATE_HISTORY_ENABLED;
    else process.env.SIGNAL_MILESTONE_DATE_HISTORY_ENABLED = prior;
  };
  return run().finally(restore);
}

/** The provider's own predicates (providers/timeline.ts:177-183), verbatim in spirit. */
function providerWouldPlot(row: ActivityRow): boolean {
  const payload = JSON.parse(row.payload) as Record<string, unknown>;
  const from = payload.from ?? payload.previousDate;
  const to = payload.to ?? payload.targetDate;
  return (
    row.entity_kind === "task" &&
    row.action.includes("date") &&
    Boolean(from) &&
    Boolean(to)
  );
}

test("diffMilestoneDates records only two-sided changes", () => {
  const previous = new Map<string, string | null>([
    ["a", "2026-09-01"],
    ["b", null],
    ["c", "2026-09-10"],
    ["d", "2026-09-20"],
  ]);
  const changes = diffMilestoneDates(previous, [
    { id: "a", targetDate: "2026-09-05" }, // moved — recorded
    { id: "b", targetDate: "2026-09-02" }, // appeared — not movement
    { id: "c", targetDate: null }, // cleared — nothing to plot
    { id: "d", targetDate: "2026-09-20" }, // unchanged
    { id: "e", targetDate: "2026-09-30" }, // brand new row
  ]);
  assert.deepEqual(changes, [{ entityId: "a", from: "2026-09-01", to: "2026-09-05" }]);
});

test("sync upsert: flag off writes no history", async (t) => {
  const { client, writeRoadmapNodes } = await harness(t);
  await withFlag(undefined, async () => {
    await writeRoadmapNodes(WS, "plan", [milestone("ms-w-1", "2026-09-01")]);
    await writeRoadmapNodes(WS, "plan", [milestone("ms-w-1", "2026-09-08")]);
  });
  assert.equal((await activityRows(client)).length, 0);
});

test("sync upsert: flag on records the move, atomically shaped for the provider", async (t) => {
  const { client, writeRoadmapNodes } = await harness(t);
  await withFlag("true", async () => {
    await writeRoadmapNodes(WS, "plan", [
      milestone("ms-w-1", "2026-09-01"),
      milestone("ms-w-2", null, 1),
    ]);
    // First write: dates appearing on new rows, no movement.
    assert.equal((await activityRows(client)).length, 0);

    await writeRoadmapNodes(WS, "plan", [
      milestone("ms-w-1", "2026-09-08"), // moved
      milestone("ms-w-2", "2026-09-15", 1), // appeared
    ]);
  });
  const rows = await activityRows(client);
  assert.equal(rows.length, 1, "exactly the one movement is recorded");
  const row = rows[0];
  assert.equal(row.workspace_slug, WS);
  assert.equal(row.entity_id, "ms-w-1");
  assert.equal(row.action, "date-change");
  assert.deepEqual(JSON.parse(row.payload), { from: "2026-09-01", to: "2026-09-08" });
  assert.ok(providerWouldPlot(row), "the analytics provider must be able to plot this row");
});

test("sync upsert: a date reverting also records, and history is append-only", async (t) => {
  const { client, writeRoadmapNodes } = await harness(t);
  await withFlag("true", async () => {
    await writeRoadmapNodes(WS, "plan", [milestone("ms-w-1", "2026-09-01")]);
    await writeRoadmapNodes(WS, "plan", [milestone("ms-w-1", "2026-09-08")]);
    await writeRoadmapNodes(WS, "plan", [milestone("ms-w-1", "2026-09-01")]);
  });
  const rows = await activityRows(client);
  // created_at is second-resolution, so same-second rows have no stable
  // order; assert the SET of legs, which is what history preserves.
  assert.deepEqual(
    rows.map((r) => JSON.parse(r.payload)).sort((a, b) => a.from.localeCompare(b.from)),
    [
      { from: "2026-09-01", to: "2026-09-08" },
      { from: "2026-09-08", to: "2026-09-01" },
    ],
    "both legs of the round trip are kept; history never collapses",
  );
});

test("overlay upsert: records the effective-date move an owner performs", async (t) => {
  const { client, writeRoadmapNodes, upsertNodeOverlay } = await harness(t);
  await withFlag("true", async () => {
    await writeRoadmapNodes(WS, "plan", [milestone("ms-w-1", "2026-09-01")]);
    // Owner pins the date: effective moves 2026-09-01 -> 2026-09-12.
    await upsertNodeOverlay(WS, {
      nodeId: "ms-w-1",
      dateOverrideMode: "date",
      dateOverride: "2026-09-12",
    });
    // Owner clears back to inherit: effective moves 2026-09-12 -> 2026-09-01.
    await upsertNodeOverlay(WS, {
      nodeId: "ms-w-1",
      dateOverrideMode: "inherit",
    });
    // Owner hides the date entirely: one side missing, nothing to plot.
    await upsertNodeOverlay(WS, {
      nodeId: "ms-w-1",
      dateOverrideMode: "undated",
    });
    // A label-only edit never touches history.
    await upsertNodeOverlay(WS, { nodeId: "ms-w-1", labelOverride: "Renamed" });
  });
  const rows = await activityRows(client);
  // Same-second rows have no stable order (see above); assert the set.
  assert.deepEqual(
    rows
      .map((r) => [r.entity_id, JSON.parse(r.payload).from, JSON.parse(r.payload).to])
      .sort((a, b) => a[1].localeCompare(b[1])),
    [
      ["ms-w-1", "2026-09-01", "2026-09-12"],
      ["ms-w-1", "2026-09-12", "2026-09-01"],
    ],
  );
  for (const row of rows) assert.ok(providerWouldPlot(row));
});

test("overlay upsert: manual nodes and foreign workspaces record nothing", async (t) => {
  const { client, upsertNodeOverlay } = await harness(t);
  await withFlag("true", async () => {
    // Manual node: no tasks row exists, analytics can never read it.
    await upsertNodeOverlay(WS, {
      nodeId: "manual:handmade",
      source: "manual",
      manualTitle: "Handmade",
      dateOverrideMode: "date",
      dateOverride: "2026-10-01",
    });
    // A node id that exists nowhere at all.
    await upsertNodeOverlay(OTHER_WS, {
      nodeId: "ms-w-1",
      dateOverrideMode: "date",
      dateOverride: "2026-10-01",
    });
  });
  assert.equal((await activityRows(client)).length, 0);
});
