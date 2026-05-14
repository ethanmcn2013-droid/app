import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { tasks } from "./schema";
import { recordActivity } from "./activity";
import { type LaneId } from "@/lib/data";
import { getTemplate, TEMPLATES } from "@/lib/templates";

/**
 * Apply a template to a known workspace without touching the Next.js
 * cache or the realtime task-stream emitter.
 *
 * Why this exists separately from `applyTemplateAction`: the redemption
 * Server Component renders the comp action synchronously during route
 * render, and the action used to delegate template-apply to
 * `applyTemplateAction`, which calls `revalidatePath` — illegal during
 * render in Next 15 and the cause of the cycle-8.5 fresh-user 500. This
 * helper is the pure DB-only path; callers that need cache invalidation
 * still go through `applyTemplateAction`.
 */
export async function applyTemplateToWorkspace(
  templateId: string,
  workspaceId: string,
): Promise<void> {
  if (!TEMPLATES.some((t) => t.id === templateId)) {
    throw new Error(`Unknown template id: ${templateId}`);
  }
  const template = getTemplate(templateId);

  const lanes = Array.from(new Set(template.tasks.map((t) => t.lane)));
  const lanePositions = new Map<LaneId, number>();
  for (const lane of lanes) {
    const [row] = await db
      .select({ max: sql<number | null>`MAX(${tasks.position})` })
      .from(tasks)
      .where(and(eq(tasks.lane, lane), eq(tasks.workspaceId, workspaceId)));
    lanePositions.set(lane, (row?.max ?? 0) + 1.0);
  }

  const now = new Date(Math.floor(Date.now() / 1000) * 1000);
  for (const t of template.tasks) {
    const id = `t-${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8)}`;
    const position = lanePositions.get(t.lane)!;
    lanePositions.set(t.lane, position + 1.0);
    await db.insert(tasks).values({
      id,
      workspaceId,
      title: t.title,
      lane: t.lane,
      priority: t.priority,
      assignees: [],
      due: t.due,
      tags: t.tags,
      position,
      updatedAt: now,
    });
    await recordActivity(id, { kind: "taskAdd", lane: t.lane });
  }
}
