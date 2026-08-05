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

export function setRuntimePeople(people: LabPerson[]): void {
  runtimePeopleActive = true;
  runtimePeople.clear();
  for (const person of people) runtimePeople.set(person.id, person);
}

export function setRuntimeLabels(labels: LabLabel[]): void {
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
