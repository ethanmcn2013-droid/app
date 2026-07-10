import type { ComponentType } from "react";
import { OptionDone } from "./option-done";
import { OptionOwned } from "./option-owned";
import { OptionWhatsNext } from "./option-whats-next";

/**
 * Tasks hero showroom — registry.
 *
 * Review-only. Dev route (`/lab`). Never linked from shipped surfaces,
 * never promoted to `/`. Each option is a fully scoped hero: its rest
 * state is the settled work board, the intro plays once on mount inside
 * `@media (prefers-reduced-motion: no-preference)` only, so SSR, no-JS,
 * and reduced-motion all render the finished frame.
 *
 * Active directions follow the Signal proof-first playbook without borrowing
 * its attention-clarity mechanism. The artifact is visible from frame one,
 * the product gesture is the pulse, and the work settles quickly. What's Next
 * remains addressable as archived research, but is no longer an active
 * candidate because its distillation concept belongs to Signal.
 */
export type OptionRole = "flagship" | "counterpoint" | "archived";

export type LabOption = {
  slug: string;
  name: string;
  role: OptionRole;
  lens: string;
  headline: string;
  blurb: string;
  Component: ComponentType;
};

export const ACTIVE_OPTIONS: LabOption[] = [
  {
    slug: "done",
    name: "Done.",
    role: "flagship",
    lens: "Momentum · commitment to completion",
    headline: "The work is visible while it moves.",
    blurb:
      "A real Today ledger is present from frame one. One owner locks in, two commitments complete with drawn ticks, and the live item takes the single Tasks pulse. Five visible commitments earn the closing receipt: two cleared, one needs you.",
    Component: OptionDone,
  },
  {
    slug: "owned",
    name: "Owned.",
    role: "counterpoint",
    lens: "Ownership clarity · no ambiguous handoff",
    headline: "Every commitment says who has it.",
    blurb:
      "An ownership ledger begins with three unclear handoffs and resolves each one to a named person, a due moment and a ready state. The final live commitment carries the pulse. Five commitments, five owners, nothing unclear.",
    Component: OptionOwned,
  },
];

export const ARCHIVED_OPTIONS: LabOption[] = [
  {
    slug: "whats-next",
    name: "What's Next",
    role: "archived",
    lens: "Archived research · Signal-like distillation",
    headline: "Twelve things are open. Three matter today.",
    blurb:
      "Kept for comparison only. The pile-to-three mechanism is legible, but it duplicates Signal's attention-clarity job instead of proving accountable movement inside Tasks.",
    Component: OptionWhatsNext,
  },
];

export const OPTIONS: LabOption[] = [...ACTIVE_OPTIONS, ...ARCHIVED_OPTIONS];

export function getOption(slug: string): LabOption | undefined {
  return OPTIONS.find((o) => o.slug === slug);
}
