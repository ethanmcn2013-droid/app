import type { ComponentType } from "react";
import { OptionDone } from "./option-done";
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
 * Both directions follow the Signal Hero Playbook: a three-line spoken
 * thesis, one seed-word transmutation, and a rest on the `tasks·` wordmark
 * with the pulse gesture (the one allowed idle loop). Done. is the flagship
 * (open to done, the tick draws through the word). What's Next is the
 * execution-clarity counterpoint (a pile collapses to the three that matter).
 */
export type OptionRole = "flagship" | "counterpoint";

export type LabOption = {
  slug: string;
  name: string;
  role: OptionRole;
  lens: string;
  headline: string;
  blurb: string;
  Component: ComponentType;
};

export const OPTIONS: LabOption[] = [
  {
    slug: "done",
    name: "Done.",
    role: "flagship",
    lens: "Momentum · open to done",
    headline: "Everything's open until it gets done.",
    blurb:
      "The feeling of moving work from open to done. Three plain lines set the tension, then an indigo tick draws through the word done and the live board resolves out of it. A calm Now, Next, Done list with real task lines, two ticked and settled, one carrying the only colour. It rests on the tasks· pulse and one honest tally: six things moved today, two are done, this is next.",
    Component: OptionDone,
  },
  {
    slug: "whats-next",
    name: "What's Next",
    role: "counterpoint",
    lens: "Execution clarity · what matters today",
    headline: "Twelve things are open. Three matter today.",
    blurb:
      "The real promise of Tasks, brought to the Signal standard. A pile of open task chips materialises out of the word next, a sweep reads it, and the ones that can wait dim and collapse aside. The three that matter lift, gain an indigo marker, and settle into a focused Today list. Nine could wait. These three couldn't. It rests on the tasks· pulse.",
    Component: OptionWhatsNext,
  },
];

export function getOption(slug: string): LabOption | undefined {
  return OPTIONS.find((o) => o.slug === slug);
}
