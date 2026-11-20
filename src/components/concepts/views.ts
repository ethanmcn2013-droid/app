import type { ConceptMeta, ConceptView } from "./types";

/** Gallery sections, in review order. */
export const CONCEPT_VIEWS: readonly { key: ConceptView; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "projects", label: "Projects" },
  { key: "board", label: "Tasks board" },
  { key: "list", label: "Tasks list" },
  { key: "calendar", label: "Tasks calendar" },
  { key: "files", label: "Files" },
  { key: "analytics", label: "Analytics" },
  { key: "apps", label: "Apps and tools" },
  { key: "whiteboard", label: "Whiteboard, for later" },
];

/**
 * The final review, 30 September 2026. Sections follow the product from the
 * top down: Overview, Projects, the three Tasks views, Files, Analytics, Apps,
 * then the whiteboard kept for later. Within each, the top choice comes first.
 * Board 4 now lives inside board 1, and apps 3 and 4 inside apps 5, so they
 * are out of the review set; their folders stay for reference.
 */
const PREFERENCE: readonly string[] = [
  "overview/2", "overview/3",
  "projects/2", "projects/4", "projects/1",
  "board/1",
  "list/3", "list/1",
  "calendar/1", "calendar/2", "calendar/4",
  "files/5", "files/3",
  "analytics/5", "analytics/6", "analytics/4",
  "apps/5",
  "whiteboard/1",
];

export const viewLabel = (view: ConceptView) => CONCEPT_VIEWS.find((entry) => entry.key === view)?.label ?? view;
export const conceptKey = (concept: Pick<ConceptMeta, "view" | "n">) => `${concept.view}/${concept.n}`;
export const conceptHref = (concept: Pick<ConceptMeta, "view" | "n">) => `/app/concepts/${concept.view}/${concept.n}`;

/** Every concept in review order: view by view, then by preference, then by number. */
export function orderConcepts(concepts: readonly ConceptMeta[]): ConceptMeta[] {
  const rank = new Map(CONCEPT_VIEWS.map((entry, index) => [entry.key, index]));
  const pref = (concept: ConceptMeta) => {
    const at = PREFERENCE.indexOf(conceptKey(concept));
    return at < 0 ? 99 : at;
  };
  return [...concepts].sort((a, b) => (rank.get(a.view) ?? 99) - (rank.get(b.view) ?? 99) || pref(a) - pref(b) || a.n - b.n);
}
