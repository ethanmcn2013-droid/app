/**
 * V3 URL contract — ADR 0001 §8, plan §3.1.
 *
 * Existing product routes are preserved; one canonical parameter is appended.
 * A V3 link carries `workspaceId` and the surface's own local parameters, and
 * nothing else. It never emits `sourceProduct`, `contextVersion`,
 * `planningPeriodId`, or a global `projectId`.
 *
 * V2 links keep working. `canonicaliseProjectUrl` accepts them, validates the
 * shape, and returns the canonical form so a Server Component can
 * replace-redirect to it. The V2 *emitter* (`withSuiteContext` in
 * `src/lib/suite-context.ts`) is deliberately retained during migration —
 * plan §14.3 step 11 mandates two stable releases of V2 input support, and
 * `scripts/check-suite-switcher-contract.mjs:122-129` pins it.
 *
 * Pure module. No I/O, no environment, client-safe.
 */

import {
  BRIEFING_APP_PATH,
  HOME_APP_PATH,
  PRODUCT_APP_PATHS,
  PROJECT_APP_PATH,
  TASKS_VIEW_PATHS,
  YOUR_WORK_APP_PATH,
  type TasksViewId,
} from "@/lib/product-urls";
import { isProjectId, type ProjectId } from "@/lib/projects/project-ref";

/** The one canonical Project parameter. */
export const PROJECT_URL_PARAM = "workspaceId";

/**
 * V2 context vocabulary. Retained as *input* for at least two stable releases
 * (plan §14.3 step 11); never emitted by a V3 builder.
 */
export const V2_CONTEXT_PARAMS = [
  "sourceProduct",
  "contextVersion",
  "planningPeriodId",
] as const;

/**
 * `projectId` is the ambiguous V2 field ADR 0001 supersedes. It is stripped
 * from canonical URLs everywhere except Your Work, where it is a *local*
 * filter over the caller's own catalog rather than a global suite identity.
 * WP9 renames that local concept to Label/Workstream (DECISIONS D-010); until
 * it does, dropping it here would silently change that page's behaviour.
 */
const LOCAL_PROJECT_ID_SURFACES: readonly string[] = [YOUR_WORK_APP_PATH];

/**
 * The Notes local view union. Deliberately re-declared rather than imported:
 * `scripts/check-module-boundaries.mjs` forbids `src/lib/**` importing
 * `src/modules/notes/**`. Source of truth is
 * `src/modules/notes/lib/notes-view-model.ts` — see the interface request in
 * the WP2 report for binding these two together in WP8.
 */
export type ProjectNotesView = "notebook" | "review" | "sent";

/**
 * The destination allowlist for `switchActiveProjectAction` (plan §3.5 step 5).
 * An enum, never an arbitrary return URL: an attacker-supplied `returnTo` is
 * an open redirect, and a caller-supplied path is an unauthorized surface.
 *
 * `your-work` is present because `src/app/api/suite-context/route.ts:23` makes
 * it the sole destination of every inbound suite link today. Omitting it would
 * mean the one destination production actually uses could not be expressed.
 */
export type ProjectDestination =
  | Readonly<{ surface: "tasks"; view?: TasksViewId }>
  | Readonly<{ surface: "timeline"; timelineSlug?: string; mode?: "view" | "edit" }>
  | Readonly<{ surface: "notes"; view?: ProjectNotesView; noteId?: string }>
  | Readonly<{ surface: "project" }>
  | Readonly<{ surface: "home"; briefing?: boolean }>
  | Readonly<{ surface: "your-work" }>;

export const PROJECT_DESTINATION_SURFACES = [
  "tasks",
  "timeline",
  "notes",
  "project",
  "home",
  "your-work",
] as const;

const NOTES_VIEWS: readonly ProjectNotesView[] = ["notebook", "review", "sent"];
const TASKS_VIEWS: readonly TasksViewId[] = [
  "board",
  "list",
  "timeline",
  "calendar",
];

/** Timeline slugs are path segments; keep them to the same safe alphabet. */
const TIMELINE_SLUG_SHAPE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

/**
 * Validate an untrusted destination against the allowlist. Returns `null`
 * rather than a default: silently substituting a destination is the same class
 * of defect as silently substituting a Project.
 */
export function parseProjectDestination(value: unknown): ProjectDestination | null {
  if (typeof value !== "object" || value === null) return null;
  const input = value as Record<string, unknown>;
  switch (input.surface) {
    case "tasks": {
      if (input.view === undefined) return { surface: "tasks" };
      if (!TASKS_VIEWS.includes(input.view as TasksViewId)) return null;
      return { surface: "tasks", view: input.view as TasksViewId };
    }
    case "timeline": {
      const slug = input.timelineSlug;
      if (slug !== undefined && (typeof slug !== "string" || !TIMELINE_SLUG_SHAPE.test(slug))) {
        return null;
      }
      const mode = input.mode;
      if (mode !== undefined && mode !== "view" && mode !== "edit") return null;
      return {
        surface: "timeline",
        ...(typeof slug === "string" ? { timelineSlug: slug } : {}),
        ...(mode === "view" || mode === "edit" ? { mode } : {}),
      };
    }
    case "notes": {
      const view = input.view;
      if (view !== undefined && !NOTES_VIEWS.includes(view as ProjectNotesView)) {
        return null;
      }
      const noteId = input.noteId;
      if (noteId !== undefined && (typeof noteId !== "string" || noteId.length === 0 || noteId.length > 200)) {
        return null;
      }
      return {
        surface: "notes",
        ...(view === undefined ? {} : { view: view as ProjectNotesView }),
        ...(typeof noteId === "string" ? { noteId } : {}),
      };
    }
    case "project":
      return { surface: "project" };
    case "home": {
      if (input.briefing !== undefined && typeof input.briefing !== "boolean") {
        return null;
      }
      return { surface: "home", ...(input.briefing ? { briefing: true } : {}) };
    }
    case "your-work":
      return { surface: "your-work" };
    default:
      return null;
  }
}

function destinationPath(destination: ProjectDestination): string {
  switch (destination.surface) {
    case "tasks":
      return TASKS_VIEW_PATHS[destination.view ?? "board"];
    case "timeline":
      return destination.timelineSlug
        ? `${PRODUCT_APP_PATHS.timeline}/${encodeURIComponent(destination.timelineSlug)}`
        : PRODUCT_APP_PATHS.timeline;
    case "notes":
      return PRODUCT_APP_PATHS.notes;
    case "project":
      return PROJECT_APP_PATH;
    case "home":
      return destination.briefing ? BRIEFING_APP_PATH : HOME_APP_PATH;
    case "your-work":
      return YOUR_WORK_APP_PATH;
  }
}

function destinationLocalParams(destination: ProjectDestination): [string, string][] {
  switch (destination.surface) {
    case "timeline":
      // "view" is the default and stays out of the URL, matching the Timeline
      // product's existing href builder.
      return destination.mode === "edit" ? [["mode", "edit"]] : [];
    case "notes":
      return [
        ...(destination.view ? ([["view", destination.view]] as [string, string][]) : []),
        ...(destination.noteId ? ([["note", destination.noteId]] as [string, string][]) : []),
      ];
    default:
      return [];
  }
}

/**
 * Build a canonical V3 destination URL. Relative by design: every surface
 * lives on the one signed-in origin, and a builder that emitted a hostname
 * would be one more place to get the origin wrong.
 */
export function buildProjectUrl(
  destination: ProjectDestination,
  projectId: ProjectId,
): string {
  const params = new URLSearchParams();
  params.set(PROJECT_URL_PARAM, projectId);
  for (const [key, value] of destinationLocalParams(destination)) {
    params.set(key, value);
  }
  return `${destinationPath(destination)}?${params.toString()}`;
}

/**
 * Append the Active Project to an in-app path, preserving whatever local
 * parameters the path already carries. The contextual-link builder: following
 * one of these must never rewrite the last-active cookie (ADR 0001 §4).
 */
export function withActiveProject(appPath: string, projectId: ProjectId): string {
  if (!appPath.startsWith("/")) {
    throw new Error("withActiveProject expects an in-app path.");
  }
  const [pathname, rawQuery = "", hash] = splitPath(appPath);
  const params = new URLSearchParams(rawQuery);
  params.set(PROJECT_URL_PARAM, projectId);
  // The fragment rides along. This is *the* contextual-link builder — WP3, WP6
  // and WP9 will run every in-app link through it — and the first version
  // dropped the hash silently, so `#milestones` on a Timeline deep link, or
  // any in-page anchor, would have quietly stopped working the moment a link
  // gained a Project. `canonicaliseProjectUrl` already preserved it; these two
  // must not disagree about what an in-app URL is made of.
  return `${pathname}?${params.toString()}${hash ?? ""}`;
}

function splitPath(appPath: string): [string, string?, string?] {
  const hashAt = appPath.indexOf("#");
  const hash = hashAt >= 0 ? appPath.slice(hashAt) : undefined;
  const withoutHash = hashAt >= 0 ? appPath.slice(0, hashAt) : appPath;
  const queryAt = withoutHash.indexOf("?");
  if (queryAt < 0) return [withoutHash, undefined, hash];
  return [withoutHash.slice(0, queryAt), withoutHash.slice(queryAt + 1), hash];
}

export type ProjectUrlCanonicalisation = Readonly<{
  /** The canonical path+query. Equal to the input when nothing needed changing. */
  url: string;
  /** True when the caller should replace-redirect. */
  changed: boolean;
  /**
   * The explicit Project the URL carries, if it carries a well-formed one.
   * `null` covers both "absent" and "present but malformed" — the resolver
   * decides what each means, this function only reports shape.
   */
  workspaceId: ProjectId | null;
  /** Which V2 parameters were present. Server-side diagnostics only. */
  droppedParams: readonly string[];
}>;

/**
 * Accept a V2 (or already-V3) in-app URL and return its canonical form.
 *
 * Rules, in order:
 *  1. Strip every V2 context parameter.
 *  2. Strip the ambiguous global `projectId` unless the surface owns it
 *     locally (see `LOCAL_PROJECT_ID_SURFACES`).
 *  3. Keep a well-formed `workspaceId`; drop a malformed or repeated one
 *     rather than passing a value no membership query should ever see.
 *  4. Leave every other parameter exactly as it was — local view state is not
 *     this function's business.
 *
 * Deliberately does not redirect, does not touch cookies, and does not
 * authorize. It is a pure string transform; the route boundary owns the rest.
 */
export function canonicaliseProjectUrl(appPath: string): ProjectUrlCanonicalisation {
  if (!appPath.startsWith("/")) {
    throw new Error("canonicaliseProjectUrl expects an in-app path.");
  }
  const [pathname, rawQuery, hash] = splitPath(appPath);
  const params = new URLSearchParams(rawQuery ?? "");
  const dropped: string[] = [];

  for (const key of V2_CONTEXT_PARAMS) {
    if (params.has(key)) {
      dropped.push(key);
      params.delete(key);
    }
  }

  if (params.has("projectId") && !LOCAL_PROJECT_ID_SURFACES.includes(pathname)) {
    dropped.push("projectId");
    params.delete("projectId");
  }

  const rawWorkspaceIds = params.getAll(PROJECT_URL_PARAM);
  let workspaceId: ProjectId | null = null;
  if (rawWorkspaceIds.length === 1 && isProjectId(rawWorkspaceIds[0])) {
    workspaceId = rawWorkspaceIds[0];
  } else if (rawWorkspaceIds.length > 0) {
    // A repeated or malformed explicit Project is not an explicit Project.
    dropped.push(PROJECT_URL_PARAM);
    params.delete(PROJECT_URL_PARAM);
  }

  const query = params.toString();
  const url = `${pathname}${query ? `?${query}` : ""}${hash ?? ""}`;
  return {
    url,
    changed: url !== appPath,
    workspaceId,
    droppedParams: dropped,
  };
}

/**
 * Assert at compile time that a V3 builder never emits V2 vocabulary. Used by
 * the URL contract test; exported so a future builder is covered by the same
 * check without duplicating the literal list.
 */
export function urlEmitsV2Vocabulary(url: string): boolean {
  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  const params = new URLSearchParams(query);
  return (
    V2_CONTEXT_PARAMS.some((key) => params.has(key)) || params.has("projectId")
  );
}
