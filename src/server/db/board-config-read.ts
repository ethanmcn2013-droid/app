import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { meta } from "./schema";
import { parseColumnConfig } from "@/lib/board-config";
import { isDemoMode } from "@/lib/access-mode";
import { resolveDoneKeys } from "@/lib/board-columns";
import type { ColumnConfig } from "@/lib/board-config";

/** The stored column config for a workspace, or null. Server read used by
 *  surfaces that need column semantics without the client context. */
export async function readWorkspaceColumnConfig(
  workspaceId: string,
): Promise<ColumnConfig | null> {
  // The demo path never touches Turso (DEMO_MODE.md's safety invariant).
  // Guarding HERE rather than at each call site: this read has three
  // callers — the inbox, the share card, and /print/list — and the one
  // that forgot the guard returned a 500 from a link the view bar offers
  // in one click. A boundary that can only be used safely by remembering
  // is a boundary that will be used unsafely.
  if (isDemoMode()) return null;
  const [row] = await db
    .select({ value: meta.value })
    .from(meta)
    .where(eq(meta.key, `board:${workspaceId}:columns`));
  return row ? parseColumnConfig(row.value) : null;
}

/** The workspace's done column keys (default ["done"]). One cheap read;
 *  callers pass the result to isDoneColumnKey/isTaskDone so every server
 *  surface agrees with the board about what finished means (T·122). */
export async function getWorkspaceDoneKeys(
  workspaceId: string,
): Promise<string[]> {
  return resolveDoneKeys(await readWorkspaceColumnConfig(workspaceId));
}
