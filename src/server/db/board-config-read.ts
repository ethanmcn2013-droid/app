import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { meta } from "./schema";
import { parseColumnConfig } from "@/lib/board-config";
import { resolveDoneKeys } from "@/lib/board-columns";
import type { ColumnConfig } from "@/lib/board-config";

/** The stored column config for a workspace, or null. Server read used by
 *  surfaces that need column semantics without the client context. */
export async function readWorkspaceColumnConfig(
  workspaceId: string,
): Promise<ColumnConfig | null> {
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
