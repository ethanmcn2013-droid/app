/**
 * Quick-create shorthand for priority and people, read before the date and
 * label parser sees the title.
 *
 * - Priority: `!urgent`, `!high`, `!normal`, `!low`, or `p0` to `p3`
 *   (with or without `!`), on the product's own scale: p0 is Urgent, p1 High,
 *   p2 Normal, p3 Low. The first one wins; later ones stay in the title.
 * - People: `@name` matches a project member by the start of their first
 *   name or by their initials, ignoring case. A token that matches no one,
 *   or more than one person, stays in the title as written.
 *
 * Matched tokens come out of the title. Skipped tokens (a chip the person
 * removed) stay in, so removing a chip gives the words back.
 */

import type { TaskPriority } from "@/components/hybrid/types";

export type QuickMember = { id: string; name: string; initials?: string };

export type QuickTokens = {
  /** The title with every matched token taken out, spaces tidied. */
  title: string;
  priority: { value: TaskPriority; token: string } | null;
  people: { id: string; token: string }[];
};

const WORDS: Record<string, TaskPriority> = {
  urgent: "urgent",
  high: "high",
  normal: "normal",
  low: "low",
  p0: "urgent",
  p1: "high",
  p2: "normal",
  p3: "low",
};

function matchPerson(token: string, members: readonly QuickMember[]): QuickMember | null {
  const needle = token.toLowerCase();
  if (!needle) return null;
  const hits = members.filter((member) => {
    const first = member.name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    const initials = (member.initials ?? "").toLowerCase();
    return first.startsWith(needle) || (initials.length > 0 && initials === needle);
  });
  // An exact first-name or initials match beats a longer prefix match.
  const exact = hits.filter((member) => {
    const first = member.name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    return first === needle || (member.initials ?? "").toLowerCase() === needle;
  });
  if (exact.length === 1) return exact[0];
  return hits.length === 1 ? hits[0] : null;
}

export function parseQuickTokens(
  input: string,
  members: readonly QuickMember[],
  skip: { priority?: boolean; people?: readonly string[] } = {},
): QuickTokens {
  let priority: QuickTokens["priority"] = null;
  const people: QuickTokens["people"] = [];
  const kept: string[] = [];
  for (const word of input.split(/\s+/).filter(Boolean)) {
    const bang = /^!([a-z0-9]+)$/i.exec(word);
    const bare = /^(p[0-3])$/i.exec(word);
    const level = bang ? WORDS[bang[1].toLowerCase()] : bare ? WORDS[bare[1].toLowerCase()] : undefined;
    if (level && !priority && !skip.priority) {
      priority = { value: level, token: word };
      continue;
    }
    const at = /^@([\p{L}\p{N}'-]+)$/u.exec(word);
    if (at) {
      const person = matchPerson(at[1], members);
      if (person && !skip.people?.includes(person.id) && !people.some((p) => p.id === person.id)) {
        people.push({ id: person.id, token: word });
        continue;
      }
    }
    kept.push(word);
  }
  return { title: kept.join(" "), priority, people };
}
