"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { roadmapItems, blockers, actionItems } from "@/server/db/schema";

export type RoadmapStatus = "pending" | "in_progress" | "completed";

/**
 * Toggle a roadmap item's status. From pending → in_progress on first
 * click, → completed on second, → pending on third. Sets/clears
 * `completedAt` so the side rail "completed today" badge can light
 * up. Revalidates `/roadmap` so the page refetches in place.
 */
export async function cycleRoadmapStatusAction(id: string): Promise<void> {
  const [row] = await db
    .select({ status: roadmapItems.status })
    .from(roadmapItems)
    .where(eq(roadmapItems.id, id));
  if (!row) return;

  const next: RoadmapStatus =
    row.status === "pending"
      ? "in_progress"
      : row.status === "in_progress"
        ? "completed"
        : "pending";

  const now = new Date();
  await db
    .update(roadmapItems)
    .set({
      status: next,
      updatedAt: now,
      completedAt: next === "completed" ? now : null,
    })
    .where(eq(roadmapItems.id, id));

  revalidatePath("/roadmap");
}

export async function setRoadmapStatusAction(
  id: string,
  status: RoadmapStatus,
): Promise<void> {
  const now = new Date();
  await db
    .update(roadmapItems)
    .set({
      status,
      updatedAt: now,
      completedAt: status === "completed" ? now : null,
    })
    .where(eq(roadmapItems.id, id));

  revalidatePath("/roadmap");
}

export async function setRoadmapNoteAction(
  id: string,
  note: string,
): Promise<void> {
  // UI clamps to 140; server enforces too in case someone bypasses.
  const clamped = note.trim().slice(0, 140);
  await db
    .update(roadmapItems)
    .set({
      note: clamped.length ? clamped : null,
      updatedAt: new Date(),
    })
    .where(eq(roadmapItems.id, id));

  revalidatePath("/roadmap");
}

/* ──────────────────────────────────────────────────────────────────
   Blockers — the user-only actions (purchases, account claims, ad
   spend, recordings, live launch beats, KPI write-ups) that gate
   the roadmap.
   ────────────────────────────────────────────────────────────── */

export async function toggleBlockerResolvedAction(id: string): Promise<void> {
  const [row] = await db
    .select({ resolvedAt: blockers.resolvedAt })
    .from(blockers)
    .where(eq(blockers.id, id));
  if (!row) return;

  const now = new Date();
  await db
    .update(blockers)
    .set({
      resolvedAt: row.resolvedAt ? null : now,
      updatedAt: now,
    })
    .where(eq(blockers.id, id));

  revalidatePath("/roadmap");
}

export async function setBlockerNoteAction(
  id: string,
  note: string,
): Promise<void> {
  const clamped = note.trim().slice(0, 140);
  await db
    .update(blockers)
    .set({
      note: clamped.length ? clamped : null,
      updatedAt: new Date(),
    })
    .where(eq(blockers.id, id));

  revalidatePath("/roadmap");
}

/* ──────────────────────────────────────────────────────────────────
   Action items — engineering / QA / launch-readiness checklist
   independent of gtm-plan.md.
   ────────────────────────────────────────────────────────────── */

export async function cycleActionItemStatusAction(id: string): Promise<void> {
  const [row] = await db
    .select({ status: actionItems.status })
    .from(actionItems)
    .where(eq(actionItems.id, id));
  if (!row) return;

  const next: RoadmapStatus =
    row.status === "pending"
      ? "in_progress"
      : row.status === "in_progress"
        ? "completed"
        : "pending";

  const now = new Date();
  await db
    .update(actionItems)
    .set({
      status: next,
      updatedAt: now,
      completedAt: next === "completed" ? now : null,
    })
    .where(eq(actionItems.id, id));

  revalidatePath("/roadmap");
}

export async function setActionItemNoteAction(
  id: string,
  note: string,
): Promise<void> {
  const clamped = note.trim().slice(0, 140);
  await db
    .update(actionItems)
    .set({
      note: clamped.length ? clamped : null,
      updatedAt: new Date(),
    })
    .where(eq(actionItems.id, id));

  revalidatePath("/roadmap");
}
