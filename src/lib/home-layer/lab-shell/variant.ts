/**
 * Where the candidate is put back into the links, and nowhere else.
 *
 * ── The problem this solves ────────────────────────────────────────────────
 *
 * Two things have to be true at once and they pull against each other.
 *
 * 1. THE FOUR CANDIDATES MUST BE HANDED IDENTICAL DATA. That is the whole
 *    point of a shared scaffold: a director comparing four directions is
 *    comparing composition, rhythm, hierarchy and disclosure, and any per
 *    candidate variation in the props means they are comparing something else
 *    as well. `assembleCandidateProps` therefore takes a `LabViewState`, which
 *    has no `v` in it, so the assembly cannot see which candidate is on screen.
 *
 * 2. A LINK CLICKED INSIDE CANDIDATE 3 MUST LAND IN CANDIDATE 3. A reviewer
 *    stepping through the sixteen journeys cannot be thrown back to candidate 1
 *    by opening the full briefing.
 *
 * So the assembly writes every lab href WITHOUT a candidate, and this function
 * puts one in afterwards. It runs in the page, after the data exists, on the
 * way to the render. It changes navigation, never a number, never a sentence.
 *
 * ── Why it walks the whole tree ────────────────────────────────────────────
 *
 * Hrefs are not gathered in one place. They sit on rows, on actions, on scope
 * options, on evidence links, on mode links, five levels down, and a direction
 * is free to use any of them. Rewriting only the ones a list happened to name
 * would leave the others pointing at candidate 1, which is exactly the kind of
 * quiet half-working control the lab brief bans.
 *
 * The walk is identity-preserving: a node that appears twice in the tree, such
 * as the selected row that is also in its section, comes out as one object on
 * the other side, so a direction can still compare by reference.
 */

import type { HomeCandidateProps } from "./contract";
import { labHrefWithVariant, type LabVariantNumber } from "./lab-url";

function decorate<T>(node: T, v: LabVariantNumber, seen: Map<object, unknown>): T {
  if (typeof node === "string") return labHrefWithVariant(node, v) as unknown as T;
  if (typeof node === "function") {
    const held = seen.get(node as unknown as object);
    if (held !== undefined) return held as T;
    const wrapped = (...args: readonly unknown[]) =>
      decorate((node as (...a: readonly unknown[]) => unknown)(...args), v, seen);
    seen.set(node as unknown as object, wrapped);
    return wrapped as unknown as T;
  }
  if (node === null || typeof node !== "object") return node;

  const held = seen.get(node as unknown as object);
  if (held !== undefined) return held as T;

  if (Array.isArray(node)) {
    const out: unknown[] = [];
    seen.set(node as unknown as object, out);
    for (const entry of node) out.push(decorate(entry, v, seen));
    Object.freeze(out);
    return out as unknown as T;
  }

  const out: Record<string, unknown> = {};
  seen.set(node as unknown as object, out);
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    out[key] = decorate(value, v, seen);
  }
  Object.freeze(out);
  return out as unknown as T;
}

/**
 * The assembled props with every lab href carrying `v`. Total, and a no-op on
 * every string that is not a lab link, so no caller has to know which is which.
 */
export function withCandidateVariant(
  props: HomeCandidateProps,
  v: LabVariantNumber,
): HomeCandidateProps {
  return decorate(props, v, new Map<object, unknown>());
}
