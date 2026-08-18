/**
 * WP6 Lane A · the chooser's presentation model.
 *
 * The server already decides what the catalog *is*: `buildProjectCatalog`
 * groups, orders, disambiguates, and marks the rows whose names could not be
 * made unique. Nothing here re-decides any of that. This module turns that
 * authorized catalog into the strings and flags one control needs to render —
 * subtitle, accessible name, monogram — plus the filter, typeahead and
 * listbox/combobox threshold the WP5 lab proved out.
 *
 * Pure and server-independent on purpose: every rule below is a rule about
 * words on screen, and each one is cheaper to hold with a unit test than with a
 * browser. The component that consumes it owns no derivation at all.
 *
 * ── The two facts the lab model did not have ───────────────────────────────
 *
 * The lab argued from a fixture where every Project was selectable and the
 * catalog was always whole. Production is neither:
 *
 *   - `ambiguousProjectIds` names Projects whose visible name could not be made
 *     unique without leaking private data (plan §5). They stay in the list —
 *     hiding a Project you are a member of is its own lie — but they cannot be
 *     chosen, because "which one did I just open?" would have no answer. The
 *     model marks them `selectable: false` and says why.
 *   - `truncated` means the catalog is a bounded page, not everything. A
 *     control that silently shows the first 2000 memberships as if they were
 *     all of them turns "which Projects can I see" into a planner-dependent
 *     subset (D-016 R10). The model carries the flag; the control states it.
 */

import { suiteSurfaceFromAppPath } from "@/lib/product-urls";
import type { ProjectId, ProjectRole, ProjectSummary } from "@/lib/projects/project-ref";
import { buildProjectUrl, type ProjectDestination } from "@/lib/projects/project-url";
import type {
  ProjectCatalog,
  ProjectCatalogGroup,
  ProjectCatalogGroupKind,
} from "@/server/projects/catalog";

// ── Types ───────────────────────────────────────────────────────────────────

export type ChooserRow = Readonly<{
  id: ProjectId;
  name: string;
  /** Server-provided and permission-safe. Never an internal id (plan §5). */
  disambiguator: string | null;
  subtitle: string;
  /** Plan §5: every visible AND screen-reader option name must be unique. */
  accessibleName: string;
  archived: boolean;
  role: ProjectRole;
  /**
   * False only for an ambiguous Project. The control still renders the row and
   * still says the Project exists; what it withholds is the selection.
   */
  selectable: boolean;
  /** Populated exactly when `selectable` is false. Shown, not swallowed. */
  blockedReason: string | null;
  activeRootTaskCount: number;
  /** Two initials, for recognition ahead of reading. */
  monogram: string;
  project: ProjectSummary;
}>;

export type ChooserGroupKind = ProjectCatalogGroupKind;

export type ChooserGroup = Readonly<{
  id: string;
  kind: ChooserGroupKind;
  label: string;
  readOnly: boolean;
  rows: readonly ChooserRow[];
}>;

export type ChooserCatalog = Readonly<{
  groups: readonly ChooserGroup[];
  /** Flat, in visual order. Arrow-key navigation walks this. */
  rows: readonly ChooserRow[];
  activeCount: number;
  archivedCount: number;
  /**
   * Plan §7.3: under 8 active Projects a listbox with character typeahead; at 8
   * or more a real combobox controlling the listbox.
   */
  mode: "listbox" | "combobox";
  /** The caller has more memberships than the query returned. */
  truncated: boolean;
}>;

/** Plan §7.3, quoted here because it is a threshold and not a preference. */
export const COMBOBOX_THRESHOLD = 8;

export const AMBIGUOUS_REASON =
  "Two projects share this name. Rename one in Settings to tell them apart.";

// ── Derivation ──────────────────────────────────────────────────────────────

const ARCHIVED_ON = new Intl.DateTimeFormat("en-IE", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function taskCountLabel(count: number) {
  if (count === 0) return "Nothing open yet";
  return count === 1 ? "1 open task" : `${count} open tasks`;
}

function roleLabel(role: ProjectRole) {
  if (role === "member") return "You're a member";
  if (role === "owner") return "You're a co-owner";
  return "You own this";
}

export function monogramOf(name: string) {
  const words = name.split(/[\s·—–-]+/).filter(Boolean);
  const letters = words
    .map((word) => [...word][0] ?? "")
    .filter((ch) => /\p{L}|\p{N}/u.test(ch));
  return (letters.slice(0, 2).join("") || "··").toUpperCase();
}

/**
 * The subtitle carries what the group heading does not. Inside a Planning
 * Period group the period is already on screen, so the subtitle spends its room
 * on the count; a duplicate name spends it on the disambiguator first.
 */
function subtitleFor(
  project: ProjectSummary,
  kind: ChooserGroupKind,
  grouped: boolean,
): string {
  const count = taskCountLabel(project.activeRootTaskCount);
  if (kind === "archived") {
    const on =
      project.archivedAt === null ? "" : ARCHIVED_ON.format(new Date(project.archivedAt));
    return on ? `Archived ${on} · read-only` : "Archived · read-only";
  }
  if (kind === "shared") return `${roleLabel(project.role)} · ${count}`;
  const parts: string[] = [];
  if (project.disambiguator) parts.push(project.disambiguator);
  else if (!grouped && project.planningPeriod) parts.push(project.planningPeriod.name);
  parts.push(count);
  return parts.join(" · ");
}

function toRow(
  project: ProjectSummary,
  kind: ChooserGroupKind,
  grouped: boolean,
  ambiguous: ReadonlySet<string>,
): ChooserRow {
  const subtitle = subtitleFor(project, kind, grouped);
  const disambiguated = project.disambiguator
    ? `${project.name}, ${project.disambiguator}`
    : project.name;
  const selectable = !ambiguous.has(project.id);
  return Object.freeze({
    id: project.id,
    name: project.name,
    disambiguator: project.disambiguator,
    subtitle,
    // The blocked reason joins the accessible name rather than replacing the
    // subtitle: a screen-reader user must hear why a row will not respond
    // before they press Enter on it, not after.
    accessibleName: selectable
      ? `${disambiguated}. ${subtitle}.`
      : `${disambiguated}. ${subtitle}. ${AMBIGUOUS_REASON}`,
    archived: project.archivedAt !== null,
    role: project.role,
    selectable,
    blockedReason: selectable ? null : AMBIGUOUS_REASON,
    activeRootTaskCount: project.activeRootTaskCount,
    monogram: monogramOf(project.name),
    project,
  });
}

function labelOf(group: ProjectCatalogGroup): string {
  return group.name;
}

/**
 * Projects the chooser model over an authorized catalog.
 *
 * Group order, membership and naming are the server's and are preserved
 * exactly — re-sorting here would put the control and every other reader of the
 * catalog into disagreement about what "first" means.
 */
export function buildChooserCatalog(catalog: ProjectCatalog): ChooserCatalog {
  const ambiguous = new Set<string>(catalog.ambiguousProjectIds);

  // A single Planning Period is not a grouping; it is a heading with nothing to
  // distinguish. The subtitle then spends its room on the period name instead.
  const periodGroups = catalog.groups.filter((group) => group.kind === "planning-period");
  const grouped = periodGroups.length > 1;

  const groups: ChooserGroup[] = catalog.groups
    .map((group) =>
      Object.freeze({
        id: group.id,
        kind: group.kind,
        label: labelOf(group),
        readOnly: group.readOnly,
        rows: group.projects.map((project) =>
          toRow(project, group.kind, grouped, ambiguous),
        ),
      }),
    )
    .filter((group) => group.rows.length > 0);

  const rows = groups.flatMap((group) => group.rows);
  const archivedCount = rows.filter((row) => row.archived).length;
  const activeCount = rows.length - archivedCount;

  return Object.freeze({
    groups,
    rows,
    activeCount,
    archivedCount,
    mode: activeCount >= COMBOBOX_THRESHOLD ? "combobox" : "listbox",
    truncated: catalog.truncated,
  });
}

/** The single-group case is flat: no heading earns its room. */
export function showsGroupHeadings(catalog: ChooserCatalog) {
  return catalog.groups.length > 1;
}

// ── Filtering, typeahead, and the announcements ─────────────────────────────

function normalise(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
}

/** Substring match over name and disambiguator. Order is never disturbed. */
export function filterChooserCatalog(
  catalog: ChooserCatalog,
  query: string,
): ChooserCatalog {
  const trimmed = query.trim();
  if (trimmed === "") return catalog;
  const needle = normalise(trimmed);
  const groups = catalog.groups
    .map((group) =>
      Object.freeze({
        ...group,
        rows: group.rows.filter(
          (row) =>
            normalise(row.name).includes(needle) ||
            normalise(row.disambiguator ?? "").includes(needle),
        ),
      }),
    )
    .filter((group) => group.rows.length > 0);
  return Object.freeze({
    ...catalog,
    groups,
    rows: groups.flatMap((group) => group.rows),
  });
}

/** Plan §7.3 announcement, debounced by the caller. */
export function resultCountMessage(count: number) {
  if (count === 0) return "No projects match.";
  return count === 1 ? "1 project." : `${count} projects.`;
}

/**
 * Character typeahead for the listbox mode: jump to the next row whose name
 * starts with the buffer, wrapping from the current position.
 */
export function typeaheadIndex(
  rows: readonly ChooserRow[],
  buffer: string,
  fromIndex: number,
): number | null {
  if (buffer === "") return null;
  const count = rows.length;
  if (count === 0) return null;
  const needle = normalise(buffer);
  for (let step = 1; step <= count; step += 1) {
    const index = (fromIndex + step) % count;
    if (normalise(rows[index].name).startsWith(needle)) return index;
  }
  // A repeated single character should also match the row you are already on.
  if (fromIndex >= 0 && normalise(rows[fromIndex]?.name ?? "").startsWith(needle)) {
    return fromIndex;
  }
  return null;
}

export function rowFor(catalog: ChooserCatalog, id: ProjectId | null): ChooserRow | null {
  if (id === null) return null;
  return catalog.rows.find((row) => row.id === id) ?? null;
}

// ── Where a switch lands ────────────────────────────────────────────────────

/**
 * Switching Project keeps you on the surface you are already looking at.
 *
 * The alternative — always landing on the Tasks board — would make the control
 * in the permanent chrome a surface change as well as a Project change, and the
 * whole argument for variant A is that it is the one control that does not move
 * you. Someone comparing two projects' notes should stay in Notes.
 *
 * Surfaces with a required sub-parameter degrade to their index deliberately:
 * a Timeline slug and a note id belong to the Project you are leaving, so
 * carrying either into the new one would resolve to somebody else's row or to
 * nothing at all.
 */
export function switchDestinationFor(pathname: string): ProjectDestination {
  const surface = suiteSurfaceFromAppPath(pathname);
  switch (surface) {
    case "home":
      return { surface: "home" };
    case "notes":
      return { surface: "notes" };
    case "timeline":
      return { surface: "timeline" };
    case "signal":
      // Signal's signed-in surface is Home; there is no separate destination
      // for it in the enum (D-020, six surfaces).
      return { surface: "home" };
    default:
      return { surface: "tasks" };
  }
}

/**
 * An archived Project is opened read-only through its URL and never through the
 * switch (ADR 0001 §5): the guarded action refuses it, so offering it as an
 * ordinary selection would be a dead row. The Project overview is the landing
 * surface because it is the one that reads correctly with every write disabled.
 */
export function archivedProjectUrl(id: ProjectId): string {
  return buildProjectUrl({ surface: "project" }, id);
}
