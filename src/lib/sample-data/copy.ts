/**
 * Words for the Sample data section: what each confirmation says will be
 * created or removed, and what each outcome reports. Pure, so the exact
 * promises are testable.
 */

import type {
  RemoveSampleResult,
  SampleSetStatus,
  SampleSetSummary,
  SeedSampleResult,
} from "./model";

export function sampleSetLabel(summary: Pick<SampleSetSummary, "name">): string {
  return summary.name.charAt(0).toUpperCase() + summary.name.slice(1);
}

export type SampleSetState =
  | { kind: "none" }
  | { kind: "partial"; present: number; total: number }
  | { kind: "added" };

export function sampleSetState(set: SampleSetStatus): SampleSetState {
  if (set.present.length === 0) return { kind: "none" };
  if (set.present.length < set.summary.projects) {
    return { kind: "partial", present: set.present.length, total: set.summary.projects };
  }
  return { kind: "added" };
}

function count(value: number, one: string, many: string): string {
  return `${value} ${value === 1 ? one : many}`;
}

export type SampleConfirmation = Readonly<{
  title: string;
  lead: string;
  names: readonly string[];
  detail: string;
  confirm: string;
}>;

export function addConfirmation(set: SampleSetStatus): SampleConfirmation {
  const { summary } = set;
  const present = new Set(set.present.map((project) => project.name));
  const missing = summary.projectNames.filter((name) => !present.has(name));
  const whole = missing.length === summary.projects;
  const s = summary.byStatus;
  return {
    title: `Add the ${summary.name} set?`,
    lead: whole
      ? `This creates ${count(summary.projects, "project", "projects")} in your account, owned by you:`
      : `This creates the ${count(missing.length, "project", "projects")} still missing from this set, owned by you:`,
    names: missing,
    detail: whole
      ? `Together they hold ${count(summary.tasks, "task", "tasks")} (${s.todo} to do, ${s.doing} in progress, ${s.review} in review, ${s.waiting} waiting, ${s.done} done), ${count(summary.steps, "step", "steps")}, ${count(summary.bigDates, "big date", "big dates")} and ${count(summary.links, "link", "links")}. Dates count from today. Nobody is invited or emailed, and nothing is shared or published.`
      : "Projects already added are left as they are. Dates count from today. Nobody is invited or emailed, and nothing is shared or published.",
    confirm: whole ? "Add set" : "Finish adding",
  };
}

export function removeConfirmation(set: SampleSetStatus): SampleConfirmation {
  const names = set.present.map((project) => project.name);
  return {
    title: `Remove the ${set.summary.name} set?`,
    lead: `This permanently deletes ${names.length === 1 ? "this sample project" : `these ${names.length} sample projects`} and everything in ${names.length === 1 ? "it" : "them"}, including anything you added since:`,
    names,
    detail: "Nothing else in your account is touched. There is no undo.",
    confirm: "Remove set",
  };
}

export function removeAllConfirmation(sets: readonly SampleSetStatus[]): SampleConfirmation {
  const names = sets.flatMap((set) => set.present.map((project) => project.name));
  return {
    title: "Remove all sample data?",
    lead: `This permanently deletes ${names.length === 1 ? "this sample project" : `these ${names.length} sample projects`} and everything in ${names.length === 1 ? "it" : "them"}, including anything you added since:`,
    names,
    detail: "Nothing else in your account is touched. There is no undo.",
    confirm: "Remove all",
  };
}

export type SampleOutcome = Readonly<{ tone: "success" | "warning" | "danger"; title: string; body: string }>;

const DEMO: SampleOutcome = {
  tone: "warning",
  title: "Not available in review",
  body: "Sample data is turned off in review and demo mode. Nothing was changed.",
};

export function seedOutcome(result: SeedSampleResult | { ok: false; reason: "demo" }): SampleOutcome {
  if (!result.ok && result.reason === "demo") return DEMO;
  if (result.ok) {
    if (result.created.length === 0) {
      return { tone: "success", title: "Already added", body: "Every project in this set is already in your account. Nothing new was created." };
    }
    return {
      tone: "success",
      title: "Sample set added",
      body: `Created ${count(result.created.length, "project", "projects")} with ${count(result.tasks, "task", "tasks")}, ${count(result.steps, "step", "steps")} and ${count(result.links, "link", "links")}.${result.alreadyPresent.length > 0 ? ` ${count(result.alreadyPresent.length, "project was", "projects were")} already there.` : ""}`,
    };
  }
  if (result.reason === "busy") {
    return { tone: "warning", title: "Already running", body: "This set is being added or removed right now. Give it a minute, then look again." };
  }
  return {
    tone: "danger",
    title: "Stopped part way",
    body: `${result.created.length === 0 ? "No new project was created" : `Created ${count(result.created.length, "whole project", "whole projects")}`}${result.failedAt ? `, then stopped at ${result.failedAt}` : ""}. Nothing is half made. Run it again to finish.`,
  };
}

export function removeOutcome(
  results: ReadonlyArray<RemoveSampleResult | { ok: false; reason: "demo" }>,
): SampleOutcome {
  if (results.some((result) => !result.ok && result.reason === "demo")) return DEMO;
  const real = results as readonly RemoveSampleResult[];
  const removed = real.reduce((total, result) => total + result.removed.length, 0);
  const failed = real.find((result) => !result.ok);
  if (!failed) {
    return removed === 0
      ? { tone: "success", title: "Nothing to remove", body: "There was no sample data in your account." }
      : { tone: "success", title: "Sample data removed", body: `Deleted ${count(removed, "sample project", "sample projects")}. Nothing else was touched.` };
  }
  if (!failed.ok && failed.reason === "busy") {
    return { tone: "warning", title: "Already running", body: "This set is being added or removed right now. Give it a minute, then try again." };
  }
  return {
    tone: "danger",
    title: "Stopped part way",
    body: `Deleted ${count(removed, "sample project", "sample projects")}${!failed.ok && failed.failedAt ? `, then stopped at ${failed.failedAt}` : ""}. Run it again to remove the rest.`,
  };
}
