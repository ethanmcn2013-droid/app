import { validPingCalendarDate, type PingEffects } from "./command";
import type { PingProposal } from "./proposal";
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
  const creating = /^create ([1-9]|10) tasks(?= |$)/i.exec(remaining);
  if (creating) {
    count = Number(creating[1]); remaining = remaining.slice(creating[0].length);
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
  const effects: PingEffects = {};
  const mutable = effects as { selfAssignment?: "add" | "remove"; dueDate?: string | null;
    statusColumnKey?: "todo" | "doing" | "review" | "done" };
  if (remaining) {
    for (const clause of remaining.split(/ and /i)) {
      const value = clause.toLowerCase();
      if (value === "assign me" || value === "unassign me") {
        if (Object.hasOwn(effects, "selfAssignment")) return refuse("ambiguous");
        mutable.selfAssignment = value === "assign me" ? "add" : "remove";
      } else if (value === "clear due" || /^due \d{4}-\d{2}-\d{2}$/.test(value)) {
        if (Object.hasOwn(effects, "dueDate")) return refuse("ambiguous");
        const date = value === "clear due" ? null : value.slice(4);
        if (date !== null && !validPingCalendarDate(date)) return refuse();
        mutable.dueDate = date;
      } else if (/^status (todo|doing|review|done)$/.test(value)) {
        if (Object.hasOwn(effects, "statusColumnKey")) return refuse("ambiguous");
        mutable.statusColumnKey = value.slice(7) as typeof mutable.statusColumnKey;
      } else return refuse();
    }
  }
  if (count !== undefined) return { version: "ping.proposal.v1", outcome: "plan",
    operation: { kind: "create_placeholders", count, ...(title === undefined ? {} : { title }), effects } };
  if (!Object.keys(effects).length) return refuse("incomplete");
  return { version: "ping.proposal.v1", outcome: "plan", operation: { kind: "edit_selected", effects } };
}
