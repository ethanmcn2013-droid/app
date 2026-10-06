import "server-only";
import { isNull, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { LANE_ORDER } from "@/lib/data";
import * as schema from "./schema";
import { taskColumnsWithCount } from "./task-columns";
import { rowToTask } from "./row-mappers";
import { byWorkspace } from "./tenant";

/** Canonical active top-level read; caller supplies authority and its exact DB/transaction. */
export async function readCanonicalTasks(executor: Pick<LibSQLDatabase<typeof schema>, "select">, projectId: string) {
  const laneOrder = sql`CASE ${schema.tasks.lane} ${sql.join(
    LANE_ORDER.map((lane, index) => sql`WHEN ${lane} THEN ${index}`), sql` `,
  )} ELSE ${LANE_ORDER.length} END`;
  const positionOrder = sql`COALESCE(${schema.tasks.position}, CAST(${schema.tasks.createdAt} AS REAL))`;
  const rows = await executor.select(taskColumnsWithCount).from(schema.tasks).where(
    byWorkspace(schema.tasks.workspaceId, projectId, isNull(schema.tasks.parentTaskId), isNull(schema.tasks.archivedAt)),
  ).orderBy(laneOrder, positionOrder).limit(2000);
  return rows.map((row) => ({ ...rowToTask(row), workspaceId: row.workspaceId }));
}
