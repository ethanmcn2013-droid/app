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
import { sidebarProjectMarks, type SidebarProjectMark } from "@/lib/projects/sidebar-projects";

/** Statuses are read for at most this many Projects, as the console does. */
const MARKS_LIMIT = 200;

export type LoadSidebarProjectsResult =
  | Readonly<{ ok: true; rows: readonly ChooserRow[]; marks: Readonly<Record<string, SidebarProjectMark>> }>
  | Readonly<{ ok: false; reason: "disabled" | "unavailable" }>;

export async function loadSidebarProjectsAction(): Promise<LoadSidebarProjectsResult> {
  const result = await loadProjectCatalogAction();
  if (!result.ok) return result;
  const rows = result.catalog.rows.filter((row) => !row.archived);
  if (isDemoMode() || rows.length === 0) return { ok: true, rows, marks: {} };

  let marks: Record<string, SidebarProjectMark> = {};
  try {
    const ids = rows.map((row) => row.id as string).slice(0, MARKS_LIMIT);
    const viewerId = await getCurrentUser();
    const [metaRows, timeZone] = await Promise.all([
      db
        .select({ key: meta.key, value: meta.value })
        .from(meta)
        .where(inArray(meta.key, ids.flatMap((id) => [projectStatusMetaKey(id), projectTargetDateMetaKey(id)]))),
      getUserPreferences(viewerId).then(
        (preferences) => validTimeZone(preferences.timeZone),
        () => "UTC",
      ),
    ]);
    marks = sidebarProjectMarks(ids, metaRows, ordinalToIsoDate(dayOrdinalIn(timeZone)(Date.now())));
  } catch {
    marks = {};
  }
  return { ok: true, rows, marks };
}
