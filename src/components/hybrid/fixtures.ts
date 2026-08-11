import type { LabLabel, LabPerson } from "./types";
import { tagDisplayName } from "@/lib/tags";

export const FIXTURE_MANIFEST_ID = "tasks-2026-07-16-v1-48";
export const FIXTURE_SHA256 = "ff72c1e8f0fba3791f5474afc444ae2d2eeb52473d6fdbee4f6fa0d4005fc0be";

export const LAB_PEOPLE: LabPerson[] = [
  { id: "ethan", name: "Ethan", initials: "EC", role: "Founder", color: "var(--accent-hover)" },
  { id: "maya", name: "Maya Chen", initials: "MC", role: "Product", color: "var(--status-done)" },
  { id: "noah", name: "Noah Williams", initials: "NW", role: "Engineering", color: "var(--status-flight)" },
  { id: "aisha", name: "Aisha Khan", initials: "AK", role: "Design", color: "var(--roadmap-rose-fg)" },
  { id: "luca", name: "Luca Moretti", initials: "LM", role: "Growth", color: "color-mix(in srgb, var(--accent) 78%, var(--ink))" },
  { id: "erin", name: "Erin O'Rourke", initials: "EO", role: "Customer", color: "var(--roadmap-violet-fg)" },
  { id: "sam", name: "Sam Reed", initials: "SR", role: "Operations", color: "color-mix(in srgb, var(--status-done) 65%, var(--ink))" },
  { id: "imani", name: "Imani Brooks", initials: "IB", role: "Finance", color: "color-mix(in srgb, var(--status-flight) 60%, var(--ink))" },
];

export const LAB_LABELS: LabLabel[] = [
  { id: "launch", name: "Launch", tone: "accent" },
  { id: "customer", name: "Customer", tone: "success" },
  { id: "platform", name: "Platform", tone: "neutral" },
  { id: "copy", name: "Copy", tone: "neutral" },
  { id: "risk", name: "Risk", tone: "danger" },
  { id: "ops", name: "Operations", tone: "warning" },
];


// Runtime registries. In the design-lab route these are never set and the
// fixed LAB_PEOPLE/LAB_LABELS seeds are used. In production the hybrid mount
// calls setRuntimePeople/setRuntimeLabels on every render, which makes the
// registry AUTHORITATIVE: once set, an id that is not in it does not resolve,
// and an empty registry yields an empty list. Fixture people must never be
// offered or rendered against live data — before this gate, a workspace with
// an unpopulated registry listed eight design-lab people in the real assign
// menu, and choosing one wrote a fixture id into the production database.
const runtimePeople = new Map<string, LabPerson>();
const runtimeLabels = new Map<string, LabLabel>();
let runtimePeopleActive = false;
let runtimeLabelsActive = false;

/**
 * Both setters are IDEMPOTENT: installing a roster that is already
 * installed is a no-op.
 *
 * These registries are module state that card, row and chip render read
 * synchronously, so the install has to have happened before children
 * render — which is why HybridWorkspace calls them from a render-phase
 * initializer rather than an effect. A render-phase write to module state
 * is only safe if repeating it changes nothing: React may abandon a render
 * and start again, and Strict Mode runs every render twice. Comparing
 * before clearing is what makes that true, and it also stops two Maps
 * being torn down and rebuilt on every keystroke in the search box.
 */
function sameRoster<T extends { id: string }>(
  current: Map<string, T>,
  next: readonly T[],
  fields: readonly (keyof T)[],
): boolean {
  if (current.size !== next.length) return false;
  return next.every((entry) => {
    const held = current.get(entry.id);
    // Field-by-field, not id-only: a renamed member or a recoloured tag
    // keeps its id, and an id-only check would pin the stale value.
    return held !== undefined && fields.every((field) => held[field] === entry[field]);
  });
}

const PERSON_FIELDS = ["name", "initials", "color", "role"] as const;
const LABEL_FIELDS = ["name", "tone"] as const;

export function setRuntimePeople(people: LabPerson[]): void {
  if (runtimePeopleActive && sameRoster(runtimePeople, people, PERSON_FIELDS)) return;
  runtimePeopleActive = true;
  runtimePeople.clear();
  for (const person of people) runtimePeople.set(person.id, person);
}

export function setRuntimeLabels(labels: LabLabel[]): void {
  if (runtimeLabelsActive && sameRoster(runtimeLabels, labels, LABEL_FIELDS)) return;
  runtimeLabelsActive = true;
  runtimeLabels.clear();
  for (const label of labels) runtimeLabels.set(label.id, label);
}

export function personById(id: string): LabPerson | undefined {
  if (runtimePeopleActive) return runtimePeople.get(id);
  return LAB_PEOPLE.find((person) => person.id === id);
}

export function listPeople(): LabPerson[] {
  if (runtimePeopleActive) return [...runtimePeople.values()];
  return LAB_PEOPLE;
}

export function labelById(id: string): LabLabel | undefined {
  if (runtimeLabelsActive) {
    // Unknown live tag → neutral chip. The stored id is often a slug
    // ("mara-finn"); people read the humanised form, lookups keep the id.
    return runtimeLabels.get(id) ?? { id, name: tagDisplayName(id), tone: "neutral" };
  }
  return LAB_LABELS.find((label) => label.id === id);
}

/** Test-only: return both registries to the lab-fixture default. */
export function resetRuntimeRegistriesForTests(): void {
  runtimePeopleActive = false;
  runtimeLabelsActive = false;
  runtimePeople.clear();
  runtimeLabels.clear();
}
