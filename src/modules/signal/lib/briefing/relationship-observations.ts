import type { TaskSignal } from "./types";
import type { Triggered } from "./triggers";
import { deadlineDayDifference, deadlineIsOverdue, signalDeadline } from "./calendar-time";

const relationships = new Set(["blocking-due-work", "blocked-too-long", "prerequisites-complete", "prerequisites-unverified"]);

/** Enrich existing observations using only the already inspected source read. */
export function enrichRelationshipCandidates(candidates: Triggered[], signals: TaskSignal[], now: number, timezone: string): Triggered[] {
  const visibleByWorkspace = new Map<string, Map<string, TaskSignal>>();
  const dependentsByWorkspace = new Map<string, Map<string, TaskSignal>>();
  for (const task of signals) {
    if (!task.workspaceId) continue;
    let visible = visibleByWorkspace.get(task.workspaceId);
    let dependents = dependentsByWorkspace.get(task.workspaceId);
    if (!visible || !dependents) {
      visible = new Map();
      dependents = new Map();
      visibleByWorkspace.set(task.workspaceId, visible);
      dependentsByWorkspace.set(task.workspaceId, dependents);
    }
    visible.set(task.id, task);
    if (!dependents.has(task.id)) dependents.set(task.id, task);
  }
  type Facts = { representedTaskIds: string[]; detail?: string; summary?: string; namedEvidence?: string[]; totalFacts?: number };
  const factsByDependent = new Map<TaskSignal, Facts>();
  const factsFor = (dependent: TaskSignal): Facts => {
    const cached = factsByDependent.get(dependent);
    if (cached) return cached;
    const visible = visibleByWorkspace.get(dependent.workspaceId!) ?? new Map<string, TaskSignal>();
    const records = new Map((dependent.prerequisiteEvidence ?? [])
      .filter(record => record.workspaceId === dependent.workspaceId && record.id !== dependent.id)
      .map(record => [record.id, { id: record.id, complete: record.complete }]));
    // Older reads can supply a known-open visible edge without a fetched record.
    for (const id of dependent.blockedBy) {
      const task = visible.get(id);
      if (!records.has(id) && id !== dependent.id && task && !(task.stage?.complete ?? (task.lane === "shipped"))) {
        records.set(id, { id, complete: false });
      }
    }
    const representedTaskIds = [...new Set([dependent.id, ...records.keys()])].sort();
    const unknownCount = new Set(dependent.blockedBy.filter(id => id !== dependent.id && !records.has(id))).size;
    const partial = dependent.dependencyCoverage === "partial" || unknownCount > 0;
    const ordered = [...records.values()].sort((a, b) => a.id.localeCompare(b.id));
    const open = ordered.filter(record => !record.complete);
    const complete = ordered.filter(record => record.complete);
    const facts: Facts = { representedTaskIds };
    factsByDependent.set(dependent, facts);
    if (ordered.length <= 1 && !partial) return facts;
    const describe = (group: typeof ordered): string => {
      const titles = group.flatMap(record => visible.get(record.id) ? [`“${visible.get(record.id)!.title}”`] : []);
      const hidden = group.length - titles.length;
      if (hidden) titles.push(`${hidden} prerequisite${hidden === 1 ? "" : "s"} outside this visible task list`);
      return titles.join(", ");
    };
    const sentences: string[] = [];
    if (open.length) sentences.push(`Listed prerequisites still open: ${describe(open)}.`);
    if (complete.length) sentences.push(`Listed prerequisites ${!open.length && !partial ? "are complete" : "verified complete"}: ${describe(complete)}.`);
    if (complete.length && !open.length && !partial) sentences.push("It is no longer held up by that listed work.");
    if (partial) sentences.push("Its prerequisites could not be fully verified. It is not confirmed clear to move ahead on that work. The unverified prerequisites' state is unknown.");
    facts.detail = sentences.join(" ");
    const count = (amount: number, state: string) => `${amount} prerequisite${amount === 1 ? "" : "s"} ${state}.`;
    facts.summary = [count(open.length, "open"), count(complete.length, "complete"),
      ...(partial ? [unknownCount ? count(unknownCount, "unverified") : "Further prerequisite state is unknown.",
        "Its prerequisites could not be fully verified. It is not confirmed clear to move ahead on that work."] : []),
      ...(!open.length && complete.length && !partial ? ["Its listed prerequisites are complete. It is no longer held up by that listed work."] : [])].join(" ");
    facts.namedEvidence = ordered.flatMap(record => {
      const title = visible.get(record.id)?.title;
      return title === undefined ? [] : [`${record.complete ? "Complete" : "Open"} prerequisite: “${title}”.`];
    });
    facts.totalFacts = ordered.length + unknownCount;
    return facts;
  };
  return candidates.map(candidate => {
    if (!relationships.has(candidate.trigger)) return candidate;
    const dependent = candidate.trigger === "blocking-due-work"
      ? dependentsByWorkspace.get(candidate.task.workspaceId ?? "")?.get(candidate.relatedTaskId ?? "")
      : candidate.task;
    if (!dependent?.workspaceId) return candidate;
    const facts = factsFor(dependent);
    const enriched = { ...candidate, representedTaskIds: facts.representedTaskIds };
    let fullDetail = facts.detail;
    let summary = facts.summary;
    if (candidate.trigger === "blocking-due-work") {
      // Keep the chosen open prerequisite as the navigation anchor, while the
      // explanation represents every inspected state in its dependent's list.
      const days = deadlineDayDifference(signalDeadline(dependent), now, timezone);
      const due = days !== null && deadlineIsOverdue(signalDeadline(dependent), now, timezone) ? "past its saved deadline"
        : days === 0 ? "due today" : days === 1 ? "due tomorrow" : days === 2 ? "due in two days" : "open";
      const date = `“${dependent.title}” is ${due}.`;
      if (fullDetail === undefined) {
        const detail = `${date} Listed prerequisite still open: “${candidate.task.title}”.`;
        return { ...enriched,
          detailOverride: detail.length <= 520 ? detail : `The dependent task is ${due}. This inspected listed prerequisite remains open.`,
          reasons: detail.length <= 520 ? candidate.reasons : [...candidate.reasons,
            ...[`Dependent: “${dependent.title}”.`, `Open prerequisite: “${candidate.task.title}”.`].filter(reason => reason.length <= 280)].slice(0, 6) };
      }
      fullDetail = `${date} ${fullDetail}`;
      summary = `The dependent task is ${due}. ${summary}`;
    }
    if (fullDetail === undefined) return enriched;
    if (fullDetail.length <= 520) return { ...enriched, detailOverride: fullDetail };
    // Keep certainty ahead of names at the receiving boundary. Evidence names
    // enter only as complete facts, never as a clipped title or partial word.
    const reasons = candidate.reasons.filter(reason => reason.length <= 280).slice(0, 4);
    let named = 0;
    for (const evidence of facts.namedEvidence ?? []) {
      if (reasons.length >= 5) break;
      if (evidence.length > 280) continue;
      reasons.push(evidence);
      named += 1;
    }
    const remaining = (facts.totalFacts ?? 0) - named;
    if (remaining > 0) reasons.push(`${remaining} remaining prerequisite facts are represented in the state counts; their names or states are not individually shown here.`);
    return { ...enriched, reasons, detailOverride: summary };
  });
}
