/**
 * Search across the demo's one world for the Ctrl/⌘ K menu: projects,
 * people, tasks, suppliers and files from the shared store, each with the
 * address that opens it.
 */

import { getDemoState } from "./store/client";
import { projectIn, search, type SearchHit } from "./store";
import { HEALTH_WORDS, healthKey } from "./health";

export type DemoHit = { kind: SearchHit["kind"]; id: string; group: string; label: string; meta?: string; href: string };

const GROUP: Record<SearchHit["kind"], string> = {
  project: "Projects",
  person: "People",
  task: "Tasks",
  supplier: "Suppliers",
  file: "Files",
};

function hrefFor(hit: SearchHit): string {
  switch (hit.kind) {
    case "project":
      return `/demo/projects/${hit.id}`;
    case "task":
      return `/demo/tasks/board?task=${encodeURIComponent(hit.id)}`;
    case "person":
      return `/demo/tasks/list?owner=${encodeURIComponent(hit.id)}`;
    case "file":
    case "supplier":
      return `/demo/files?q=${encodeURIComponent(hit.title)}`;
  }
}

export function searchDemo(query: string): DemoHit[] {
  const order: SearchHit["kind"][] = ["project", "task", "person", "supplier", "file"];
  const state = getDemoState();
  // A project says its health in the same words as everywhere else.
  const detailOf = (hit: SearchHit) => {
    if (hit.kind !== "project") return hit.detail;
    const p = projectIn(state, hit.id);
    return p && !p.wrapped ? HEALTH_WORDS[healthKey(p.health, p.tooEarly)] : hit.detail;
  };
  return search(state, query, 14)
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || b.score - a.score)
    .map((hit) => ({ kind: hit.kind, id: hit.id, group: GROUP[hit.kind], label: hit.title, meta: detailOf(hit), href: hrefFor(hit) }));
}
