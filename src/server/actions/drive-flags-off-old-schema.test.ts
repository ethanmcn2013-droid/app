import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { createClient } from "@libsql/client";

test("flags-off Settings reads avoid every Drive table on the production 0027 schema", async () => {
  const directory = mkdtempSync(join(tmpdir(), "signal-drive-pre-schema-"));
  const databaseUrl = pathToFileURL(join(directory, "tasks.db")).href;
  const client = createClient({ url: databaseUrl });
  const previous = {
    NEXT_PUBLIC_PROJECT_DRIVE_UI: process.env.NEXT_PUBLIC_PROJECT_DRIVE_UI,
    NEXT_PUBLIC_SIGNAL_ACCESS_MODE: process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE,
    TASKS_DATABASE_URL: process.env.TASKS_DATABASE_URL,
  };
  try {
    const migrations = readdirSync(join(process.cwd(), "drizzle"))
      .filter((file) => /^\d{4}_.+\.sql$/.test(file) && file >= "0014_" && file.slice(0, 4) <= "0027")
      .sort();
    for (const file of migrations) {
      await client.executeMultiple(readFileSync(join(process.cwd(), "drizzle", file), "utf8"));
    }
    const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='provider_connections'");
    assert.equal(tables.rows.length, 0, "the fixture has no Drive connection table");
    process.env.NEXT_PUBLIC_PROJECT_DRIVE_UI = "false";
    process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "production";
    process.env.TASKS_DATABASE_URL = databaseUrl;
    const [{ getProjectDriveStatusAction }, { getGoogleDriveConnectionSummaryAction, restoreGoogleDriveForProjectAction }] = await Promise.all([
      import("./project-drive-status"), import("./connections"),
    ]);
    assert.deepEqual(await getProjectDriveStatusAction("ws-old"), { kind: "disabled" });
    assert.deepEqual(await getGoogleDriveConnectionSummaryAction("ws-old"), {
      connected: false, accountEmail: null, status: null, connectedAt: null,
      rootFolderUrl: null, projectUsesThisAccount: false, affectedProjectCount: 0,
      revocationPending: false,
    });
    assert.equal(await restoreGoogleDriveForProjectAction("ws-old"), null);
  } finally {
    client.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key as keyof typeof previous];
      else process.env[key as keyof typeof previous] = value;
    }
    try { rmSync(directory, { recursive: true, force: true }); } catch { /* Windows handle may outlive close. */ }
  }
});
