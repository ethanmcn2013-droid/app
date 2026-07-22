/**
 * storage-reconcile — workspace blob/disk audit tool.
 *
 * What it does (read-only by default):
 *   1. Lists every workspace known to the DB.
 *   2. For each workspace, lists blob objects under the workspace prefix
 *      (requires BLOB_READ_WRITE_TOKEN) and identifies objects with no
 *      backing attachments or resources row ("orphan blobs").
 *   3. Identifies attachments/resources rows whose bytes are missing
 *      (blob URL that no longer exists, or disk path that is gone).
 *
 * Flags:
 *   --delete        Remove orphan blob objects (requires BLOB_READ_WRITE_TOKEN).
 *   --write         Mark missing-bytes resources rows as access_state='unavailable'
 *                   in the DB. Never attempts to copy bytes; per Opus §1.4 "legacy
 *                   prod bytes are already gone — backfill marks unavailable, NEVER
 *                   attempt copy; UI says file predates cloud storage".
 *   --workspace=ID  Restrict to one workspace.
 *
 * No cron wiring yet; run manually:
 *   tsx scripts/storage-reconcile.ts [--delete] [--write] [--workspace=ws-xxx]
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, and } from "drizzle-orm";
import * as schema from "../src/server/db/schema";

const { attachments, resources, workspaces } = schema;

// ── CLI flags ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DO_DELETE = args.includes("--delete");
const DO_WRITE = args.includes("--write");
const wsFilter = args.find((a) => a.startsWith("--workspace="))?.split("=")[1];

// ── DB connection ─────────────────────────────────────────────────────

const url = process.env.TASKS_DATABASE_URL ?? "file:tasks.db";
const authToken = process.env.TASKS_AUTH_TOKEN;
const client = createClient({ url, authToken });
const db = drizzle(client, { schema });

// ── Helpers ───────────────────────────────────────────────────────────

function isHttpUrl(s: string): boolean {
  return s.startsWith("https://") || s.startsWith("http://");
}

async function blobExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function diskExists(path: string): Promise<boolean> {
  try {
    const { stat } = await import("node:fs/promises");
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log("storage-reconcile starting (read-only=%s)", !DO_DELETE && !DO_WRITE);

  // Collect workspaces to audit.
  const allWorkspaces = await db.select({ id: workspaces.id }).from(workspaces);
  const targetWorkspaces = wsFilter
    ? allWorkspaces.filter((w) => w.id === wsFilter)
    : allWorkspaces;

  if (targetWorkspaces.length === 0) {
    console.log("No workspaces found%s.", wsFilter ? ` matching ${wsFilter}` : "");
    return;
  }

  console.log("Auditing %d workspace(s).", targetWorkspaces.length);

  const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  let totalOrphanBlobs = 0;
  let totalMissingBytes = 0;

  for (const ws of targetWorkspaces) {
    const wsId = ws.id;
    console.log("\n── workspace: %s ──", wsId);

    // ── Orphan blob objects ──────────────────────────────────────────

    if (hasBlobToken) {
      const { list, del } = await import("@vercel/blob");
      let cursor: string | undefined;
      const orphans: string[] = [];

      do {
        const page = await list({ prefix: `${wsId}/`, cursor, limit: 1000 });
        for (const blob of page.blobs) {
          // Check if this blob URL appears in attachments.stored_path or resources.url.
          const attRows = await db
            .select({ id: attachments.id })
            .from(attachments)
            .where(eq(attachments.storedPath, blob.url));

          const resRows = await db
            .select({ id: resources.id })
            .from(resources)
            .where(eq(resources.url, blob.url));

          if (attRows.length === 0 && resRows.length === 0) {
            orphans.push(blob.url);
          }
        }
        cursor = page.cursor;
      } while (cursor);

      console.log("  Orphan blobs: %d", orphans.length);
      for (const url of orphans) {
        console.log("    ORPHAN: %s", url);
        if (DO_DELETE) {
          await del(url);
          console.log("    DELETED: %s", url);
        }
      }
      totalOrphanBlobs += orphans.length;
    } else {
      console.log("  Orphan blob check skipped (no BLOB_READ_WRITE_TOKEN).");
    }

    // ── Rows with missing bytes ──────────────────────────────────────

    // Check attachments rows for this workspace.
    const attRows = await db
      .select({ id: attachments.id, storedPath: attachments.storedPath })
      .from(attachments)
      .where(eq(attachments.workspaceId, wsId));

    for (const row of attRows) {
      const exists = isHttpUrl(row.storedPath)
        ? await blobExists(row.storedPath)
        : await diskExists(row.storedPath);

      if (!exists) {
        console.log("  MISSING bytes for attachment %s (path: %s)", row.id, row.storedPath);
        totalMissingBytes++;

        // Mark the mirrored resources row as unavailable if --write.
        if (DO_WRITE) {
          await db
            .update(resources)
            .set({ accessState: "unavailable" })
            .where(eq(resources.id, `res-${row.id}`));
          console.log("  MARKED unavailable: res-%s", row.id);
        }
      }
    }

    // Check resources rows (upload kind) for this workspace that aren't backed by attachments.
    const resRows = await db
      .select({ id: resources.id, url: resources.url, accessState: resources.accessState })
      .from(resources)
      .where(
        and(
          eq(resources.workspaceId, wsId),
          eq(resources.kind, "upload"),
        ),
      );

    for (const row of resRows) {
      if (!row.url) continue; // No URL to check — legacy row, skip.
      if (row.accessState === "unavailable") continue; // Already marked.

      const exists = isHttpUrl(row.url)
        ? await blobExists(row.url)
        : await diskExists(row.url);

      if (!exists) {
        console.log("  MISSING bytes for resource %s (url: %s)", row.id, row.url);
        totalMissingBytes++;

        if (DO_WRITE) {
          await db
            .update(resources)
            .set({ accessState: "unavailable" })
            .where(eq(resources.id, row.id));
          console.log("  MARKED unavailable: %s", row.id);
        }
      }
    }
  }

  console.log(
    "\nDone. orphan blobs=%d, missing-bytes rows=%d%s%s",
    totalOrphanBlobs,
    totalMissingBytes,
    DO_DELETE ? " (orphans deleted)" : "",
    DO_WRITE ? " (missing marked unavailable)" : "",
  );
}

main().catch((err) => {
  console.error("storage-reconcile error:", err);
  process.exit(1);
});
