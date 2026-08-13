/**
 * WP5 lab · the shared Project catalog projection.
 *
 * Every variant on `/lab/active-project-*` argues from this one model so the
 * comparison is about composition and visual treatment, not about four
 * different ideas of what a catalog is. The plan (§7.2) locks the
 * architecture, vocabulary, catalog, guarded transition and accessibility
 * semantics; the lab only selects how they look and where they sit.
 *
 * Source of truth is `src/lib/project-truth-fixture.ts`. Nothing here invents
 * a Project, a name, a role or a count. This file is imported only by
 * `src/app/lab/**` and is unreachable from any production code path.
 */

import {
  PROJECT_TRUTH_PROJECTS,
  fixtureCapabilitiesFor,
  projectTruthContentFor,
  projectTruthScenario,
  type FixtureProjectId,
  type FixtureProjectSummary,
  type FixtureScenarioId,
} from "@/lib/project-truth-fixture";

// ── Types ───────────────────────────────────────────────────────────────────

export type LabGroupKind = "period" | "loose" | "shared" | "archived";

/**
 * A catalog row. `summary` is the fixture record untouched; everything else is
 * derived presentation. `accessibleName` is the load-bearing field — plan §5
 * requires every visible AND screen-reader option name to be unique.
 */
export type LabRow = Readonly<{
  id: FixtureProjectId;
  name: string;
  /** Server-provided, permission-safe. Never an internal id (plan §5). */
  disambiguator: string | null;
  subtitle: string;
  accessibleName: string;
  archived: boolean;
  role: FixtureProjectSummary["role"];
  capabilities: FixtureProjectSummary["capabilities"];
  activeRootTaskCount: number;
  /** Two initials, used by variants that lean on recognition over reading. */
  monogram: string;
  summary: FixtureProjectSummary;
}>;

export type LabGroup = Readonly<{
  id: string;
  kind: LabGroupKind;
  label: string;
  rows: readonly LabRow[];
}>;

export type LabCatalog = Readonly<{
  groups: readonly LabGroup[];
  /** Flat, in visual order. Arrow-key navigation walks this. */
  rows: readonly LabRow[];
  activeCount: number;
  archivedCount: number;
  /**
   * Plan §7.3: under 8 active Projects a listbox with character typeahead;
   * at 8 or more a real combobox controlling the listbox.
   */
  mode: "listbox" | "combobox";
}>;

// ── Ordering ────────────────────────────────────────────────────────────────

/**
 * Plan §5: derive stable order from period dates/position and Project
 * position/name/id, with deterministic tie-breaks. Never recent use — that
 * destroys the spatial memory the whole control depends on.
 */
function comparePeriods(
  a: FixtureProjectSummary["planningPeriod"],
  b: FixtureProjectSummary["planningPeriod"],
): number {
  const aStart = a?.startDate ?? "";
  const bStart = b?.startDate ?? "";
  if (aStart !== bStart) return aStart < bStart ? -1 : 1;
  const aName = a?.name ?? "";
  const bName = b?.name ?? "";
  if (aName !== bName) return aName < bName ? -1 : 1;
  return (a?.id ?? "").localeCompare(b?.id ?? "");
}

function compareRows(a: FixtureProjectSummary, b: FixtureProjectSummary) {
  if (a.position !== b.position) return a.position - b.position;
  if (a.name !== b.name) return a.name < b.name ? -1 : 1;
  return a.id.localeCompare(b.id);
}

// ── Derivation ──────────────────────────────────────────────────────────────

/**
 * Mirrors `FixtureProjectContent.expectedGroup`. Derived rather than read so
 * the rule is stated once as logic; `catalogAgreesWithFixture()` below proves
 * the two still agree, and the lab index renders that proof.
 */
function groupKindOf(project: FixtureProjectSummary): LabGroupKind {
  if (project.archivedAt !== null) return "archived";
  if (project.role !== "primary-owner") return "shared";
  return project.planningPeriod ? "period" : "loose";
}

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

function roleLabel(role: FixtureProjectSummary["role"]) {
  if (role === "member") return "You're a member";
  if (role === "owner") return "You're a co-owner";
  return "You own this";
}

function monogramOf(name: string) {
  const words = name.split(/[\s·—–-]+/).filter(Boolean);
  const letters = words
    .map((word) => [...word][0] ?? "")
    .filter((ch) => /\p{L}|\p{N}/u.test(ch));
  return (letters.slice(0, 2).join("") || "··").toUpperCase();
}

/**
 * The subtitle carries what the group heading does not. Inside a period group
 * the period is already on screen, so the subtitle spends its room on the
 * count; a duplicate name spends it on the disambiguator first.
 */
function subtitleFor(
  project: FixtureProjectSummary,
  kind: LabGroupKind,
  grouped: boolean,
): string {
  const count = taskCountLabel(project.activeRootTaskCount);
  if (kind === "archived") {
    const on = project.archivedAt ? ARCHIVED_ON.format(project.archivedAt) : "";
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
  project: FixtureProjectSummary,
  kind: LabGroupKind,
  grouped: boolean,
): LabRow {
  const subtitle = subtitleFor(project, kind, grouped);
  const disambiguated = project.disambiguator
    ? `${project.name}, ${project.disambiguator}`
    : project.name;
  return Object.freeze({
    id: project.id,
    name: project.name,
    disambiguator: project.disambiguator,
    subtitle,
    accessibleName: `${disambiguated}. ${subtitle}.`,
    archived: project.archivedAt !== null,
    role: project.role,
    capabilities: project.capabilities,
    activeRootTaskCount: project.activeRootTaskCount,
    monogram: monogramOf(project.name),
    summary: project,
  });
}

// ── The catalog ─────────────────────────────────────────────────────────────

export const LOOSE_GROUP_LABEL = "Other projects";
export const SHARED_GROUP_LABEL = "Shared with you";
export const ARCHIVED_GROUP_LABEL = "Archived";

/**
 * Builds the grouped, ordered catalog for one scenario.
 *
 * `omit` removes a Project the way losing access removes one: it simply is not
 * in the catalog any more. Nothing falls back in its place (ADR §4).
 */
export function buildCatalog(
  scenarioId: FixtureScenarioId,
  options: {
    omit?: readonly FixtureProjectId[];
    downgradeToMember?: FixtureProjectId | null;
  } = {},
): LabCatalog {
  const wanted = new Set(projectTruthScenario(scenarioId).projectIds);
  const omitted = new Set(options.omit ?? []);
  const projects = PROJECT_TRUTH_PROJECTS.filter(
    (project) => wanted.has(project.id) && !omitted.has(project.id),
  ).map((project) => {
    if (project.id !== options.downgradeToMember) return project;
    // A downgrade is not a greyed-out button. The Project is now someone
    // else's: the role changes, the capabilities collapse to a member's, and
    // the owner's Planning Period stops being visible (plan §5 — never expose
    // another owner's period to a shared member), so it moves group as well.
    return {
      ...project,
      role: "member" as const,
      capabilities: fixtureCapabilitiesFor("member"),
      planningPeriod: null,
    };
  });

  const owned = projects.filter((p) => groupKindOf(p) === "period");
  const loose = projects.filter((p) => groupKindOf(p) === "loose");
  const shared = projects.filter((p) => groupKindOf(p) === "shared");
  const archived = projects.filter((p) => groupKindOf(p) === "archived");

  // Plan §5: group owned Projects by Planning Period only when more than one
  // meaningful group exists. One period is not a grouping, it is a heading
  // with nothing to distinguish.
  const periodIds = new Set(owned.map((p) => p.planningPeriod?.id));
  const grouped = periodIds.size > 1;

  const groups: LabGroup[] = [];

  if (grouped) {
    const periods = [...owned]
      .map((p) => p.planningPeriod)
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .filter((p, i, all) => all.findIndex((o) => o.id === p.id) === i)
      .sort(comparePeriods);
    for (const period of periods) {
      const rows = owned
        .filter((p) => p.planningPeriod?.id === period.id)
        .sort(compareRows)
        .map((p) => toRow(p, "period", true));
      if (rows.length > 0) {
        groups.push({ id: period.id, kind: "period", label: period.name, rows });
      }
    }
  } else if (owned.length > 0) {
    groups.push({
      id: "owned",
      kind: "period",
      label: LOOSE_GROUP_LABEL,
      rows: owned.sort(compareRows).map((p) => toRow(p, "period", false)),
    });
  }

  if (loose.length > 0) {
    groups.push({
      id: "loose",
      kind: "loose",
      label: LOOSE_GROUP_LABEL,
      rows: loose.sort(compareRows).map((p) => toRow(p, "loose", grouped)),
    });
  }
  if (shared.length > 0) {
    groups.push({
      id: "shared",
      kind: "shared",
      label: SHARED_GROUP_LABEL,
      rows: shared.sort(compareRows).map((p) => toRow(p, "shared", grouped)),
    });
  }
  if (archived.length > 0) {
    groups.push({
      id: "archived",
      kind: "archived",
      label: ARCHIVED_GROUP_LABEL,
      rows: archived.sort(compareRows).map((p) => toRow(p, "archived", grouped)),
    });
  }

  const activeCount = projects.filter((p) => p.archivedAt === null).length;

  return Object.freeze({
    groups,
    rows: groups.flatMap((group) => group.rows),
    activeCount,
    archivedCount: archived.length,
    mode: activeCount >= 8 ? "combobox" : "listbox",
  });
}

/**
 * The single-group case is flat: no heading earns its room when every row sits
 * under it. Variants ask this rather than counting groups themselves.
 */
export function showsGroupHeadings(catalog: LabCatalog) {
  return catalog.groups.length > 1;
}

// ── Filtering, typeahead, and the archived disclosure ────────────────────────

function normalise(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
}

/** Substring match over name and disambiguator. Order is never disturbed. */
export function filterCatalog(catalog: LabCatalog, query: string): LabCatalog {
  const trimmed = query.trim();
  if (trimmed === "") return catalog;
  const needle = normalise(trimmed);
  const groups = catalog.groups
    .map((group) => ({
      ...group,
      rows: group.rows.filter(
        (row) =>
          normalise(row.name).includes(needle) ||
          normalise(row.disambiguator ?? "").includes(needle),
      ),
    }))
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
 * Character typeahead for the listbox variant: jump to the next row whose name
 * starts with the buffer, wrapping from the current position.
 */
export function typeaheadIndex(
  rows: readonly LabRow[],
  buffer: string,
  fromIndex: number,
): number | null {
  if (buffer === "") return null;
  const needle = normalise(buffer);
  const count = rows.length;
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

// ── Content, so a wrong-Project render fails loudly ─────────────────────────

export function contentFor(id: FixtureProjectId) {
  return projectTruthContentFor(id);
}

export function rowFor(catalog: LabCatalog, id: FixtureProjectId | null) {
  if (id === null) return null;
  return catalog.rows.find((row) => row.id === id) ?? null;
}

// ── Self-proof, rendered on the lab index ───────────────────────────────────

/**
 * The fixture states each Project's `expectedGroup`; this file derives it.
 * If the two ever disagree the lab is arguing from a catalog the rest of the
 * programme does not recognise, so the index shows this rather than trusting
 * it silently. No test wiring, no hidden assumption — a visible receipt.
 */
export function catalogAgreementReport() {
  const rows = PROJECT_TRUTH_PROJECTS.map((project) => {
    const derived = groupKindOf(project);
    const expected = projectTruthContentFor(project.id).expectedGroup;
    return { name: project.name, derived, expected, agrees: derived === expected };
  });
  return {
    rows,
    total: rows.length,
    disagreements: rows.filter((row) => !row.agrees),
  };
}
