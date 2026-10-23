"use server";

/**
 * The sidebar's Projects group: the reader's Projects, and which of them are
 * late or at risk.
 *
 * ── Authorization ──────────────────────────────────────────────────────────
 *
 * The rows are `loadProjectCatalogAction`'s own: the flag gate, the
 * re-authentication and the membership query all run there, unconditionally,
 * and this action adds no way around them. The one extra read is a select on
 * `meta` for two keys per Project (the status its owner set and its target
 * date), filtered to the ids that catalog just returned. It is the same read
 * the Projects console makes (`readProjectCardStats`), minus the task counts.
 * Read-only: nothing here inserts, updates or deletes.
 *
 * A status that cannot be read is no dot, never a guessed one. Demo and
 * Review touch no database and set no status, so they show no dots.
 *
 * It also says which Projects are weddings (by their context, domain or
 * template, read from the same catalog ids), so the sidebar can nest the
 * Wedding tools under them. A read that fails nests nothing.
 */

import { inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { meta } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth";
import { getUserPreferences } from "@/server/db/preferences";
import { isDemoMode } from "@/lib/access-mode";
import { loadProjectCatalogAction } from "@/server/actions/project-catalog";
import { validTimeZone } from "@/server/projects/project-console-facts";
import type { ChooserRow } from "@/lib/projects/project-chooser";
import { dayOrdinalIn, ordinalToIsoDate } from "@/lib/projects/project-console";
import { projectStatusMetaKey, projectTargetDateMetaKey } from "@/lib/projects/project-hub";
import { readWeddingIdsWith } from "@/server/wedding/guests";
import { sidebarProjectMarks, type SidebarProjectMark } from "@/lib/projects/sidebar-projects";
import { parseProjectColorIndex, projectColorMetaKey, type ProjectColorIndex } from "@/lib/projects/project-appearance";

/** Statuses are read for at most this many Projects, as the console does. */
const MARKS_LIMIT = 200;

export type LoadSidebarProjectsResult =
  | Readonly<{
      ok: true;
      rows: readonly ChooserRow[];
      marks: Readonly<Record<string, SidebarProjectMark>>;
      colors?: Readonly<Record<string, ProjectColorIndex>>;
      /** Projects made for a wedding: their row carries the Wedding tools. */
      weddingIds: readonly string[];
    }>
  | Readonly<{ ok: false; reason: "disabled" | "unavailable" }>;

export async function loadSidebarProjectsAction(): Promise<LoadSidebarProjectsResult> {
  const result = await loadProjectCatalogAction();
  if (!result.ok) return result;
  const rows = result.catalog.rows.filter((row) => !row.archived);
  // The sample suite is a wedding venue's: every sample Project is a wedding.
  if (isDemoMode()) return { ok: true, rows, marks: {}, weddingIds: rows.map((row) => row.id as string) };
  if (rows.length === 0) return { ok: true, rows, marks: {}, weddingIds: [] };

  let marks: Record<string, SidebarProjectMark> = {};
  const colors: Record<string, ProjectColorIndex> = {};
  try {
    const ids = rows.map((row) => row.id as string).slice(0, MARKS_LIMIT);
    const viewerId = await getCurrentUser();
    const [metaRows, timeZone] = await Promise.all([
      db
        .select({ key: meta.key, value: meta.value })
        .from(meta)
        .where(inArray(meta.key, ids.flatMap((id) => [projectStatusMetaKey(id), projectTargetDateMetaKey(id), projectColorMetaKey(id)]))),
      getUserPreferences(viewerId).then(
        (preferences) => validTimeZone(preferences.timeZone),
        () => "UTC",
      ),
    ]);
    marks = sidebarProjectMarks(ids, metaRows, ordinalToIsoDate(dayOrdinalIn(timeZone)(Date.now())));
    const byKey = new Map(metaRows.map(row => [row.key, row.value]));
    for (const id of ids) {
      const color = parseProjectColorIndex(byKey.get(projectColorMetaKey(id)));
      if (color !== null) colors[id] = color;
    }
  } catch {
    marks = {};
  }
  let weddingIds: string[] = [];
  try {
    weddingIds = await readWeddingIdsWith(db, rows.map((row) => row.id as string).slice(0, MARKS_LIMIT));
  } catch {
    weddingIds = [];
  }
  return { ok: true, rows, marks, weddingIds, colors };
}
