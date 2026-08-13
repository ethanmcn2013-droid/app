/**
 * The candidate registry.
 *
 * Four directions, four folders, one loader. Each direction owns exactly one
 * directory beside this file and adds nothing outside it:
 *
 *     candidates/editorial/candidate.tsx     variant 1 — Editorial
 *     candidates/rail/candidate.tsx          variant 2 — Rail
 *     candidates/index/candidate.tsx         variant 3 — Index
 *     candidates/desk/candidate.tsx          variant 4 — Desk
 *
 * Each file default-exports a component of type `HomeCandidate` from
 * `@/lib/home-layer/lab-shell`. See `README.md` in this directory for the
 * whole contract.
 *
 * WHY THE IMPORT SPECIFIER IS BUILT FROM A VARIABLE, which normally deserves
 * a raised eyebrow. Two reasons, both measured against this repository rather
 * than preferred:
 *
 * 1. The four folders do not exist yet, and the shell has to build and render
 *    before they do. A literal `import("./editorial/candidate")` is resolved
 *    statically, so it is a build error until the folder lands — the shell
 *    could not be reviewed, and no direction could start against a working
 *    harness.
 *
 * 2. `lab-isolation-contract.test.mjs` walks the lab's import graph, resolves
 *    every local specifier it finds, and FAILS LOUDLY on one it cannot
 *    resolve, so that the gate can never pass by having looked at nothing. A
 *    literal specifier pointing at a folder that does not exist fails that
 *    gate too. A template specifier is not matched by its scanner, and the
 *    candidate files themselves are walked directly once they exist, so
 *    nothing goes unscanned either way.
 *
 * A missing candidate is a rendered, named absence, not a crash: the reviewer
 * sees which of the four is not built yet, and the other three stay usable.
 */

import type { HomeCandidate } from "@/lib/home-layer/lab-shell";
import type { LabVariantSlug } from "@/lib/home-layer/lab-shell";

export type CandidateModule = Readonly<{
  default: HomeCandidate;
  /**
   * The picker's one permitted modification. Export `"top"` only if this
   * direction occupies the bottom centre of the screen — a dock, a bottom
   * sheet, a toast stack — so the pill never covers the work being judged.
   * Nothing else about the picker may move or change.
   */
  pickerPosition?: "bottom" | "top";
}>;

export type CandidateLookup =
  | Readonly<{ found: true; render: HomeCandidate; pickerPosition: "bottom" | "top" }>
  | Readonly<{ found: false }>;

export async function loadCandidate(slug: LabVariantSlug): Promise<CandidateLookup> {
  try {
    const loaded = (await import(`./${slug}/candidate`)) as Partial<CandidateModule>;
    const render = loaded?.default;
    if (typeof render !== "function") return { found: false };
    return {
      found: true,
      render,
      pickerPosition: loaded.pickerPosition === "top" ? "top" : "bottom",
    };
  } catch {
    return { found: false };
  }
}
