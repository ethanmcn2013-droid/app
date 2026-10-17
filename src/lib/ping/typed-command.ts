import { validPingCalendarDate, pingMemberNameKey } from "./command";
import type { PingProposal, PingProposalEffects } from "./proposal";
import { PING_TYPED_MAX_TEXT_POINTS } from "./typed-contract";

/** Whole-input restricted syntax. No partial extraction, model fallback or identity authority. */
export function parsePingTypedCommand(input: unknown): PingProposal {
  const refuse = (reason: "unsupported" | "ambiguous" | "incomplete" = "unsupported"): PingProposal =>
    ({ version: "ping.proposal.v1", outcome: reason === "unsupported" ? "refusal" : "clarification", reason });
  if (typeof input !== "string" || input.length > PING_TYPED_MAX_TEXT_POINTS * 2 ||
    /[\u0000-\u001f\u007f]/.test(input)) return refuse();
  if (Array.from(input).length > PING_TYPED_MAX_TEXT_POINTS) return refuse();
  let remaining = input.trim();
  if (!remaining) return refuse("incomplete");
  let count: number | undefined;
  let title: string | undefined;
  const creating = /^create ([1-9]|10) (tasks?)(?= |$)/i.exec(remaining);
  if (creating) {
    count = Number(creating[1]);
    if (creating[2].toLowerCase() === "task" && count !== 1) return refuse();
    remaining = remaining.slice(creating[0].length);
    if (/^ called /i.test(remaining)) {
      remaining = remaining.slice(8);
      const quoted = /^"(?:[^"\\\u0000-\u001f]|\\["\\/bfnrt]|\\u[0-9a-fA-F]{4})*"/.exec(remaining);
      if (!quoted) return refuse("incomplete");
      title = JSON.parse(quoted[0]) as string;
      if (!title.trim() || title.length > 200 || /[\u0000-\u001f\u007f]/.test(title)) return refuse();
      remaining = remaining.slice(quoted[0].length);
    }
    if (remaining) {
      if (!/^ and /i.test(remaining)) return refuse();
      remaining = remaining.slice(5);
      if (!remaining) return refuse("incomplete");
    }
  }
  const effects: PingProposalEffects = {};
  const mutable = effects as { selfAssignment?: "add" | "remove"; dueDate?: string | null;
    statusColumnKey?: "todo" | "doing" | "review" | "done"; memberName?: string };
  if (remaining) {
    for (const clause of remaining.split(/ and /i)) {
      const value = clause.toLowerCase();
      const selectedAssignment = /^assign (?:these|this|them) to me$/.test(value);
      const selectedStatus = /^mark (?:these|this|them) (done|in progress)$/.exec(value);
      const selectedMove = /^move (?:these|this|them) to (review|a review|done)$/.exec(value);
      // Pronouns name the captured selection, never tasks in a creation prefix.
      if (count !== undefined && (selectedAssignment || selectedStatus || selectedMove)) return refuse();
      const dated = /^(?:due|set due date to|move the deadline to) (\d{4}-\d{2}-\d{2})$/.exec(value);
      const namedAssignment = /^assign(?: these)? to (.+)$/i.exec(clause);
      if (value === "assign me" || value === "assign to me" || value === "unassign me" || selectedAssignment || value === "remove me as an assignee") {
        if (Object.hasOwn(effects, "selfAssignment") || Object.hasOwn(effects, "memberName")) return refuse("ambiguous");
        mutable.selfAssignment = value === "unassign me" || value === "remove me as an assignee" ? "remove" : "add";
      } else if (namedAssignment) {
        if (count !== undefined) return refuse();
        if (Object.hasOwn(effects, "selfAssignment") || Object.hasOwn(effects, "memberName")) return refuse("ambiguous");
        const name = namedAssignment[1];
        // Quoted/separator names need a separate grammar; never extract a supported prefix.
        if (pingMemberNameKey(name) === null || /["\\]/.test(name) || /^me\b/i.test(name)) return refuse();
        mutable.memberName = name;
      } else if (value === "clear due" || value === "clear the due date" || dated) {
        if (Object.hasOwn(effects, "dueDate")) return refuse("ambiguous");
        const date = dated?.[1] ?? null;
        if (date !== null && !validPingCalendarDate(date)) return refuse();
        mutable.dueDate = date;
      } else if (/^status (todo|doing|review|done)$/.test(value) || selectedStatus || selectedMove) {
        if (Object.hasOwn(effects, "statusColumnKey")) return refuse("ambiguous");
        mutable.statusColumnKey = selectedMove ? selectedMove[1] === "done" ? "done" : "review" : selectedStatus
          ? selectedStatus[1] === "done" ? "done" : "doing"
          : value.slice(7) as typeof mutable.statusColumnKey;
      } else return refuse();
    }
  }
  if (count !== undefined) return { version: "ping.proposal.v1", outcome: "plan",
    operation: { kind: "create_placeholders", count, ...(title === undefined ? {} : { title }), effects } };
  if (!Object.keys(effects).length) return refuse("incomplete");
  return { version: "ping.proposal.v1", outcome: "plan", operation: { kind: "edit_selected", effects } };
}
