/**
 * Canonical Project identity — ADR 0001 §3.
 *
 * A Project is a Tasks `workspaces.id`. Nothing else in Signal Studio is a
 * Project: not a Planning Period, not a Timeline database `workspace`, not a
 * Timeline `project` row, not a tag-derived analytics scope, not a Note's
 * private filing `workspaceId`.
 *
 * The brand exists so that handing any of those to a Project-scoped API is a
 * compile error rather than a silent wrong-tenant read. It carries no runtime
 * cost: `ProjectId` is a `string` at runtime, and every value that becomes one
 * passes through `parseProjectId`/`assertProjectId` first.
 *
 * This module is client-safe on purpose — the shared provider needs the types.
 * It performs no I/O and reads no environment.
 */

import type { PlanningPeriodContext } from "@/lib/planning/context";

declare const brand: unique symbol;

/** Nominal typing helper. `Brand<string, "X">` is assignable to `string`. */
export type Brand<T, B extends string> = T & { readonly [brand]: B };

/** A Tasks `workspaces.id`. The one user-facing Project identity. */
export type ProjectId = Brand<string, "TasksWorkspaceId">;

/**
 * Sibling brands. These exist so a Planning Period id, a Timeline slug, a note
 * id, or a tag-derived Label id cannot be passed where a Project is required.
 * They are deliberately *different* brands, not aliases.
 */
export type PlanningPeriodId = Brand<string, "PlanningPeriodId">;
export type TimelineSlug = Brand<string, "TimelineSlug">;
export type NoteId = Brand<string, "NoteId">;
export type LabelId = Brand<string, "TagDerivedLabelId">;

/**
 * Serialized shape of the Active Project. `workspaceId` stays the field name
 * for this wave: it is established, rename-safe, and avoids repurposing the
 * ambiguous `SuiteContextV2.projectId` (ADR 0001 §3).
 */
export type ActiveProjectContextV3 = Readonly<{
  version: 3;
  workspaceId: ProjectId;
}>;

export type ProjectRole = "primary-owner" | "owner" | "member";

/**
 * Capability defaults, plan §5. Every one of these is a *hint for the UI so it
 * cannot imply an unavailable action*. None of them authorize anything: every
 * server action reauthorizes regardless of the catalog (ADR 0001 §9).
 */
export type ProjectCapabilities = Readonly<{
  open: boolean;
  viewPrivateTimeline: boolean;
  createOrEditTasks: boolean;
  manageProject: boolean;
  moveIntoPlanningPeriod: boolean;
  curatePrimaryTimeline: boolean;
  publishOrRevokeTimeline: boolean;
  deleteOrTransferOwnership: boolean;
}>;

export type ProjectPlanningPeriodRef = Readonly<{
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  contextType: PlanningPeriodContext;
}>;

/** Plan §5. Serializable: it crosses the server/client boundary as props. */
export type ProjectSummary = Readonly<{
  id: ProjectId;
  /** Display / public metadata. Never identity — renames must not break links. */
  slug: string;
  name: string;
  role: ProjectRole;
  capabilities: ProjectCapabilities;
  /**
   * Non-null only when the caller owns the period. A regular shared member
   * never receives another owner's Planning Period name or dates (plan §5).
   */
  planningPeriod: ProjectPlanningPeriodRef | null;
  position: number;
  revision: number;
  archivedAt: number | null;
  /** One count definition: active (not done) top-level tasks. */
  activeRootTaskCount: number;
  /** Permission-safe, server-provided. Never a raw or internal id. */
  disambiguator: string | null;
}>;

/**
 * ADR 0001 §3. `unavailable` deliberately collapses missing, forbidden and
 * deleted: distinguishing them to the client is an existence leak.
 */
export type ProjectRouteState =
  | Readonly<{ kind: "ready"; project: ProjectSummary; source: "url" | "fallback" }>
  | Readonly<{ kind: "archived"; project: ProjectSummary }>
  | Readonly<{ kind: "unavailable" }>
  | Readonly<{ kind: "empty" }>;

export type NotesReadScope =
  | Readonly<{ kind: "all" }>
  | Readonly<{ kind: "current-project" }>
  | Readonly<{ kind: "unfiled" }>;

export type BriefingReadScope =
  | Readonly<{ kind: "current-project" }>
  | Readonly<{ kind: "planning-period"; planningPeriodId: string }>
  | Readonly<{ kind: "all-projects" }>;

export type TimelineRef = Readonly<{
  workspaceId: ProjectId;
  timelineSlug: string;
}>;

/**
 * Shape gate. Deliberately the same alphabet the suite context has always
 * accepted (`isSuiteContextId`) so a link that worked yesterday still parses:
 * one leading alphanumeric, then up to 127 of alphanumeric / underscore /
 * hyphen. Shape is not authorization — every caller must still prove
 * membership.
 */
const PROJECT_ID_SHAPE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function isProjectId(value: unknown): value is ProjectId {
  return typeof value === "string" && PROJECT_ID_SHAPE.test(value);
}

/**
 * Parse an untrusted value into a branded `ProjectId`, or `null`.
 *
 * Accepts the `string | string[] | undefined` that Next.js `searchParams`
 * yields. A repeated parameter (`?workspaceId=a&workspaceId=b`) is refused
 * outright rather than silently taking the first: an ambiguous explicit
 * Project is not an explicit Project.
 */
export function parseProjectId(
  value: string | readonly string[] | null | undefined,
): ProjectId | null {
  if (Array.isArray(value)) return null;
  if (typeof value !== "string") return null;
  return isProjectId(value) ? value : null;
}

/** Narrow a value already proved to be a workspace id by a membership query. */
export function assertProjectId(value: string): ProjectId {
  if (!isProjectId(value)) {
    throw new Error("Not a Project id.");
  }
  return value;
}

export function isActiveProjectContextV3(
  value: unknown,
): value is ActiveProjectContextV3 {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { version?: unknown; workspaceId?: unknown };
  return candidate.version === 3 && isProjectId(candidate.workspaceId);
}
