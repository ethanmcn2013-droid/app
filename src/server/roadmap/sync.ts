import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { roadmapItems } from "@/server/db/schema";
import { parsePlan, type ParsedItem } from "./parser";

/**
 * Roadmap sync — re-parse the plan markdown and reconcile against
 * the `roadmap_items` table. Idempotent: deterministic IDs mean
 * re-syncing without changes is a no-op. Adds new items, updates
 * shape-fields on existing items, preserves user-set `status`,
 * `note`, and `completedAt`. Removes nothing — the user might have
 * marked an item completed and the parser might shift the slug
 * slightly; orphans are left in place as historical.
 *
 * Returns the synced item set so callers can render directly.
 */

export interface RoadmapRow {
  id: string;
  week: number;
  weekTheme: string | null;
  weekRange: string | null;
  date: string | null;
  day: string | null;
  kind: string;
  channel: string | null;
  format: string | null;
  source: string | null;
  cta: string | null;
  postingTime: string | null;
  body: string | null;
  status: "pending" | "in_progress" | "completed";
  isLaunch: boolean;
  note: string | null;
  blockerId: string | null;
  ord: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export async function syncAndRead(): Promise<RoadmapRow[]> {
  const { items } = parsePlan();
  if (items.length === 0) {
    // Plan markdown missing — return whatever's already stored.
    return readAll();
  }

  const ids = items.map((i) => i.id);
  const existingRows = await db
    .select()
    .from(roadmapItems)
    .where(inArray(roadmapItems.id, ids));
  const existingById = new Map(existingRows.map((r) => [r.id, r]));

  const now = new Date();

  // Upsert in a single batched loop. Drizzle's better-sqlite3 driver
  // is sync, so a tight `for…of` is fine here.
  for (const it of items) {
    const prior = existingById.get(it.id);
    if (!prior) {
      await db.insert(roadmapItems).values({
        id: it.id,
        week: it.week,
        weekTheme: it.weekTheme,
        weekRange: it.weekRange,
        date: it.date,
        day: it.day,
        kind: it.kind,
        channel: it.channel,
        format: it.format,
        source: it.source,
        cta: it.cta,
        postingTime: it.postingTime,
        body: it.body,
        isLaunch: it.isLaunch,
        ord: it.ord,
        createdAt: now,
        updatedAt: now,
      });
      continue;
    }
    // Update shape fields only if they actually changed; preserve
    // user fields (status, note, completedAt).
    const drift = shapeDrifted(prior, it);
    if (drift) {
      await db
        .update(roadmapItems)
        .set({
          week: it.week,
          weekTheme: it.weekTheme,
          weekRange: it.weekRange,
          date: it.date,
          day: it.day,
          kind: it.kind,
          channel: it.channel,
          format: it.format,
          source: it.source,
          cta: it.cta,
          postingTime: it.postingTime,
          body: it.body,
          isLaunch: it.isLaunch,
          ord: it.ord,
          updatedAt: now,
        })
        .where(eq(roadmapItems.id, it.id));
    }
  }

  return readAll();
}

function shapeDrifted(prior: typeof roadmapItems.$inferSelect, it: ParsedItem) {
  return (
    prior.week !== it.week ||
    prior.weekTheme !== it.weekTheme ||
    prior.weekRange !== it.weekRange ||
    prior.date !== it.date ||
    prior.day !== it.day ||
    prior.kind !== it.kind ||
    prior.channel !== it.channel ||
    prior.format !== it.format ||
    prior.source !== it.source ||
    prior.cta !== it.cta ||
    prior.postingTime !== it.postingTime ||
    prior.body !== it.body ||
    prior.isLaunch !== it.isLaunch ||
    prior.ord !== it.ord
  );
}

export async function readAll(): Promise<RoadmapRow[]> {
  const rows = await db.select().from(roadmapItems);
  return rows.map((r) => ({
    ...r,
    weekTheme: r.weekTheme ?? null,
    weekRange: r.weekRange ?? null,
    date: r.date ?? null,
    day: r.day ?? null,
    channel: r.channel ?? null,
    format: r.format ?? null,
    source: r.source ?? null,
    cta: r.cta ?? null,
    postingTime: r.postingTime ?? null,
    body: r.body ?? null,
    note: r.note ?? null,
    blockerId: r.blockerId ?? null,
    completedAt: r.completedAt ?? null,
  })) as RoadmapRow[];
}
