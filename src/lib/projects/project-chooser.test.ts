import { test } from "node:test";
import assert from "node:assert/strict";
import { assertProjectId, type ProjectSummary } from "@/lib/projects/project-ref";
import type { ProjectCatalog, ProjectCatalogGroup } from "@/server/projects/catalog";
import {
  AMBIGUOUS_REASON,
  COMBOBOX_THRESHOLD,
  buildChooserCatalog,
  filterChooserCatalog,
  monogramOf,
  resultCountMessage,
  rowFor,
  showsGroupHeadings,
  typeaheadIndex,
} from "@/lib/projects/project-chooser";

// ── Fixtures ────────────────────────────────────────────────────────────────

type ProjectOverrides = Omit<Partial<ProjectSummary>, "id"> & {
  id: string;
  name: string;
};

function project(over: ProjectOverrides): ProjectSummary {
  return {
    id: assertProjectId(over.id),
    slug: over.slug ?? over.id,
    name: over.name,
    role: over.role ?? "primary-owner",
    capabilities: over.capabilities ?? ({} as ProjectSummary["capabilities"]),
    planningPeriod: over.planningPeriod ?? null,
    position: over.position ?? 0,
    revision: over.revision ?? 1,
    archivedAt: over.archivedAt ?? null,
    activeRootTaskCount: over.activeRootTaskCount ?? 0,
    disambiguator: over.disambiguator ?? null,
  };
}

function group(over: Partial<ProjectCatalogGroup> & { id: string; name: string }): ProjectCatalogGroup {
  return {
    kind: over.kind ?? "planning-period",
    id: over.id,
    planningPeriodId: over.planningPeriodId ?? null,
    name: over.name,
    startDate: over.startDate ?? null,
    endDate: over.endDate ?? null,
    collapsed: over.collapsed ?? false,
    readOnly: over.readOnly ?? false,
    projects: over.projects ?? [],
  };
}

function catalog(over: Partial<ProjectCatalog> = {}): ProjectCatalog {
  const groups = over.groups ?? [];
  return {
    groups,
    allProjects: over.allProjects ?? groups.flatMap((g) => g.projects),
    ambiguousProjectIds: over.ambiguousProjectIds ?? [],
    truncated: over.truncated ?? false,
  };
}

// ── Group order and membership are the server's ─────────────────────────────

test("group order, labels and membership are preserved exactly", () => {
  const built = buildChooserCatalog(
    catalog({
      groups: [
        group({
          id: "period:q3",
          name: "Q3",
          projects: [project({ id: "b", name: "Bravo" }), project({ id: "a", name: "Alpha" })],
        }),
        group({ id: "shared", kind: "shared", name: "Shared with you", projects: [project({ id: "c", name: "Charlie", role: "member" })] }),
      ],
    }),
  );

  assert.deepEqual(
    built.groups.map((g) => g.id),
    ["period:q3", "shared"],
  );
  assert.deepEqual(built.groups[0].rows.map((r) => r.name), ["Bravo", "Alpha"]);
  assert.deepEqual(built.rows.map((r) => r.name), ["Bravo", "Alpha", "Charlie"]);
});

test("an empty group is dropped rather than rendered as a bare heading", () => {
  const built = buildChooserCatalog(
    catalog({
      groups: [
        group({ id: "period:q3", name: "Q3", projects: [project({ id: "a", name: "Alpha" })] }),
        group({ id: "shared", kind: "shared", name: "Shared with you", projects: [] }),
      ],
    }),
  );
  assert.deepEqual(built.groups.map((g) => g.id), ["period:q3"]);
  assert.equal(showsGroupHeadings(built), false);
});

// ── The two production facts the lab fixture did not carry ──────────────────

test("an ambiguous Project stays listed, is not selectable, and says why", () => {
  const built = buildChooserCatalog(
    catalog({
      groups: [
        group({
          id: "loose",
          kind: "loose",
          name: "Active work",
          projects: [project({ id: "a", name: "Wedding" }), project({ id: "b", name: "Wedding" })],
        }),
      ],
      ambiguousProjectIds: [assertProjectId("a"), assertProjectId("b")],
    }),
  );

  assert.equal(built.rows.length, 2, "both remain visible — hiding a membership is its own lie");
  for (const row of built.rows) {
    assert.equal(row.selectable, false);
    assert.equal(row.blockedReason, AMBIGUOUS_REASON);
    assert.ok(
      row.accessibleName.includes(AMBIGUOUS_REASON),
      "the reason must be heard before Enter, not after",
    );
  }
});

test("truncation is carried through rather than swallowed", () => {
  const built = buildChooserCatalog(catalog({ truncated: true }));
  assert.equal(built.truncated, true);
});

// ── Counts and the mode threshold ───────────────────────────────────────────

test("archived rows are excluded from the count that picks the mode", () => {
  const active = Array.from({ length: COMBOBOX_THRESHOLD - 1 }, (_, i) =>
    project({ id: `a${i}`, name: `Active ${i}` }),
  );
  const archived = Array.from({ length: 5 }, (_, i) =>
    project({ id: `z${i}`, name: `Old ${i}`, archivedAt: Date.UTC(2026, 0, 2) }),
  );
  const built = buildChooserCatalog(
    catalog({
      groups: [
        group({ id: "loose", kind: "loose", name: "Active work", projects: active }),
        group({ id: "archived", kind: "archived", name: "Archived", readOnly: true, projects: archived }),
      ],
    }),
  );

  assert.equal(built.activeCount, COMBOBOX_THRESHOLD - 1);
  assert.equal(built.archivedCount, 5);
  assert.equal(built.mode, "listbox", "7 active + 5 archived is still a listbox");

  const built2 = buildChooserCatalog(
    catalog({
      groups: [
        group({
          id: "loose",
          kind: "loose",
          name: "Active work",
          projects: [...active, project({ id: "one-more", name: "One more" })],
        }),
      ],
    }),
  );
  assert.equal(built2.mode, "combobox", "the 8th active Project earns the input");
});

// ── Subtitles ───────────────────────────────────────────────────────────────

test("subtitle spends its room on the disambiguator, then the count", () => {
  const built = buildChooserCatalog(
    catalog({
      groups: [
        group({
          id: "loose",
          kind: "loose",
          name: "Active work",
          projects: [
            project({ id: "a", name: "Wedding", disambiguator: "Created 4 March", activeRootTaskCount: 3 }),
            project({ id: "b", name: "Retreat", activeRootTaskCount: 1 }),
            project({ id: "c", name: "Fresh", activeRootTaskCount: 0 }),
          ],
        }),
      ],
    }),
  );
  assert.equal(built.rows[0].subtitle, "Created 4 March · 3 open tasks");
  assert.equal(built.rows[1].subtitle, "1 open task");
  assert.equal(built.rows[2].subtitle, "Nothing open yet");
});

test("a shared Project leads with the role, not a period it may not see", () => {
  const built = buildChooserCatalog(
    catalog({
      groups: [
        group({
          id: "shared",
          kind: "shared",
          name: "Shared with you",
          projects: [
            project({ id: "a", name: "Theirs", role: "member", activeRootTaskCount: 2 }),
            project({ id: "b", name: "Ours", role: "owner", activeRootTaskCount: 0 }),
          ],
        }),
      ],
    }),
  );
  assert.equal(built.rows[0].subtitle, "You're a member · 2 open tasks");
  assert.equal(built.rows[1].subtitle, "You're a co-owner · Nothing open yet");
});

test("an archived Project reads as archived and read-only, never as a count", () => {
  const built = buildChooserCatalog(
    catalog({
      groups: [
        group({
          id: "archived",
          kind: "archived",
          name: "Archived",
          readOnly: true,
          projects: [
            project({
              id: "a",
              name: "Last year",
              archivedAt: Date.UTC(2026, 2, 4),
              activeRootTaskCount: 9,
            }),
          ],
        }),
      ],
    }),
  );
  assert.equal(built.rows[0].subtitle, "Archived 4 March 2026 · read-only");
  assert.equal(built.rows[0].archived, true);
  assert.ok(!built.rows[0].subtitle.includes("9"), "an archived count invites work that cannot happen");
});

test("with one period group the subtitle carries the period; with two it does not", () => {
  const q3 = {
    id: "q3",
    name: "Q3",
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    contextType: "general" as const,
  };
  const one = buildChooserCatalog(
    catalog({
      groups: [
        group({
          id: "period:q3",
          name: "Q3",
          projects: [project({ id: "a", name: "Alpha", planningPeriod: q3, activeRootTaskCount: 1 })],
        }),
      ],
    }),
  );
  assert.equal(one.rows[0].subtitle, "Q3 · 1 open task");

  const two = buildChooserCatalog(
    catalog({
      groups: [
        group({
          id: "period:q3",
          name: "Q3",
          projects: [project({ id: "a", name: "Alpha", planningPeriod: q3, activeRootTaskCount: 1 })],
        }),
        group({
          id: "period:q4",
          name: "Q4",
          projects: [project({ id: "b", name: "Bravo", activeRootTaskCount: 2 })],
        }),
      ],
    }),
  );
  assert.equal(two.rows[0].subtitle, "1 open task", "the heading already says Q3");
});

// ── Accessible names ────────────────────────────────────────────────────────

test("a duplicate name is disambiguated in the accessible name", () => {
  const built = buildChooserCatalog(
    catalog({
      groups: [
        group({
          id: "loose",
          kind: "loose",
          name: "Active work",
          projects: [project({ id: "a", name: "Wedding", disambiguator: "Created 4 March" })],
        }),
      ],
    }),
  );
  assert.equal(built.rows[0].accessibleName, "Wedding, Created 4 March. Created 4 March · Nothing open yet.");
});

// ── Filtering ───────────────────────────────────────────────────────────────

const filterable = buildChooserCatalog(
  catalog({
    groups: [
      group({
        id: "loose",
        kind: "loose",
        name: "Active work",
        projects: [
          project({ id: "a", name: "Ómra Wedding" }),
          project({ id: "b", name: "Retreat", disambiguator: "Created 4 March" }),
          project({ id: "c", name: "Summer" }),
        ],
      }),
    ],
  }),
);

test("filtering is diacritic-insensitive and case-insensitive", () => {
  assert.deepEqual(
    filterChooserCatalog(filterable, "omra").rows.map((r) => r.name),
    ["Ómra Wedding"],
  );
  assert.deepEqual(
    filterChooserCatalog(filterable, "SUMM").rows.map((r) => r.name),
    ["Summer"],
  );
});

test("filtering matches the disambiguator too, and never reorders", () => {
  assert.deepEqual(
    filterChooserCatalog(filterable, "4 march").rows.map((r) => r.name),
    ["Retreat"],
  );
  assert.deepEqual(
    filterChooserCatalog(filterable, "e").rows.map((r) => r.name),
    ["Ómra Wedding", "Retreat", "Summer"],
  );
});

test("an empty query returns the catalog itself, and a no-match returns no groups", () => {
  assert.equal(filterChooserCatalog(filterable, "   "), filterable);
  const none = filterChooserCatalog(filterable, "zzzz");
  assert.equal(none.rows.length, 0);
  assert.equal(none.groups.length, 0, "an empty group must not render as a bare heading");
});

// ── Typeahead ───────────────────────────────────────────────────────────────

test("typeahead wraps forward from the current row", () => {
  const rows = filterable.rows;
  assert.equal(typeaheadIndex(rows, "r", 0), 1);
  assert.equal(typeaheadIndex(rows, "o", 1), 0, "wraps past the end");
  assert.equal(typeaheadIndex(rows, "z", 0), null);
  assert.equal(typeaheadIndex(rows, "", 0), null);
  assert.equal(typeaheadIndex([], "a", 0), null);
});

test("a repeated character matches the row already active", () => {
  assert.equal(typeaheadIndex(filterable.rows, "s", 2), 2);
});

// ── Small helpers ───────────────────────────────────────────────────────────

test("count messages are singular, plural and empty-aware", () => {
  assert.equal(resultCountMessage(0), "No projects match.");
  assert.equal(resultCountMessage(1), "1 project.");
  assert.equal(resultCountMessage(4), "4 projects.");
});

test("monograms take two initials and survive punctuation and emptiness", () => {
  assert.equal(monogramOf("Ómra Wedding"), "ÓW");
  assert.equal(monogramOf("Retreat"), "R");
  assert.equal(monogramOf("Q3 · Launch"), "QL");
  assert.equal(monogramOf("—"), "··");
});

test("rowFor finds a row by id and answers null for nothing", () => {
  assert.equal(rowFor(filterable, null), null);
  assert.equal(rowFor(filterable, assertProjectId("b"))?.name, "Retreat");
  assert.equal(rowFor(filterable, assertProjectId("nope")), null);
});
