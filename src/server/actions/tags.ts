"use server";

/**
 * Tag-definition mutations (Phase 3A). Reusable tag definitions (name +
 * colour) persist in the existing `meta` KV under `board:{ws}:tags` — no
 * schema migration. A task's tag *assignments* live in `tasks.tags` and
 * are edited through the normal updateTaskAction path; this module only
 * owns the shared definition registry (which colour a tag renders in, and
 * the pick-list of existing tags).
 *
 * Equivalence is case-insensitive (see tagKey). Creating a tag that
 * already exists (any casing) is idempotent and returns the existing def.
 */

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { meta } from "@/server/db/schema";
import { getActiveWorkspaceOrNull } from "@/server/auth";
import { authorizeProjectCandidate } from "@/server/actions/project-authz";
import { isDemoMode } from "@/lib/access-mode";
import { isColumnColorKey, type ColumnColorKey } from "@/lib/board-colors";
import { MAX_TAGS, MAX_TAG_LEN, tagKey, type TagDef } from "@/lib/tags";

function tagsKey(workspaceId: string): string {
  return `board:${workspaceId}:tags`;
}

/**
 * The Project a tag-registry write lands in — ADR 0001 §9, create/list.
 *
 * Same shape as board.ts: the registry is a `meta` row keyed
 * `board:{workspaceId}:tags`, so the resolved id is the destination rather
 * than a predicate that could simply match nothing. Membership is proved
 * before the key is built, and the cookie can no longer decay into
 * LEGACY_WORKSPACE_ID and rewrite another workspace's tag list (D-005).
 */
async function provedTagProject(candidate: string | null): Promise<string> {
  const grant = await authorizeProjectCandidate({
    candidateProjectId: candidate,
    capability: "createOrEditTasks",
  });
  if (!grant.ok) throw new Error("That project isn’t available.");
  return grant.projectId;
}

function parseTagDefs(raw: string): TagDef[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: TagDef[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const name = (item as { name?: unknown }).name;
      const color = (item as { color?: unknown }).color;
      if (typeof name !== "string" || !name.trim()) continue;
      const key = tagKey(name);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        name: name.slice(0, MAX_TAG_LEN),
        color: isColumnColorKey(color) ? color : "neutral",
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function readTagDefs(workspaceId: string): Promise<TagDef[]> {
  const [row] = await db
    .select({ value: meta.value })
    .from(meta)
    .where(eq(meta.key, tagsKey(workspaceId)));
  return row ? parseTagDefs(row.value) : [];
}

async function writeTagDefs(workspaceId: string, defs: TagDef[]): Promise<void> {
  const value = JSON.stringify(defs);
  await db.run(sql`
    INSERT INTO meta (key, value, updated_at)
    VALUES (${tagsKey(workspaceId)}, ${value}, unixepoch())
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
}

/** Read all tag definitions for a workspace (used by the layout so the
 *  board's chips are server-rendered with their colours). */
export async function getTagDefs(workspaceId: string): Promise<TagDef[]> {
  if (isDemoMode()) return [];
  return readTagDefs(workspaceId);
}

/**
 * Create a tag definition (or return the existing one, case-insensitively).
 * Idempotent: reusing an existing name never duplicates it.
 */
export async function addTagAction(
  name: string,
  color: ColumnColorKey = "neutral",
): Promise<{ ok: true; tag: TagDef }> {
  const trimmed = name.trim().slice(0, MAX_TAG_LEN);
  if (!trimmed) throw new Error("Tag name can’t be empty.");
  const chosen: ColumnColorKey = isColumnColorKey(color) ? color : "neutral";
  if (isDemoMode()) return { ok: true, tag: { name: trimmed, color: chosen } };

  const ws = await provedTagProject(await getActiveWorkspaceOrNull());
  const defs = await readTagDefs(ws);
  const existing = defs.find((d) => tagKey(d.name) === tagKey(trimmed));
  if (existing) return { ok: true, tag: existing };
  if (defs.length >= MAX_TAGS) {
    throw new Error(`Workspace is at the tag limit (${MAX_TAGS}).`);
  }
  const tag: TagDef = { name: trimmed, color: chosen };
  await writeTagDefs(ws, [...defs, tag]);
  revalidatePath("/app", "layout");
  return { ok: true, tag };
}

/** Recolour an existing tag definition. */
export async function setTagColorAction(
  name: string,
  color: ColumnColorKey,
): Promise<{ ok: true }> {
  if (!isColumnColorKey(color)) throw new Error("Unknown tag colour.");
  if (isDemoMode()) return { ok: true };
  const ws = await provedTagProject(await getActiveWorkspaceOrNull());
  const defs = await readTagDefs(ws);
  const next = defs.map((d) =>
    tagKey(d.name) === tagKey(name) ? { ...d, color } : d,
  );
  await writeTagDefs(ws, next);
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Remove a tag definition. Task assignments are left untouched (the tag
 *  simply renders neutral until redefined), so no task data is mutated. */
export async function deleteTagAction(name: string): Promise<{ ok: true }> {
  if (isDemoMode()) return { ok: true };
  const ws = await provedTagProject(await getActiveWorkspaceOrNull());
  const defs = await readTagDefs(ws);
  await writeTagDefs(
    ws,
    defs.filter((d) => tagKey(d.name) !== tagKey(name)),
  );
  revalidatePath("/app", "layout");
  return { ok: true };
}
