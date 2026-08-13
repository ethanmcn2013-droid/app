/**
 * Reading Index · the small pure decisions, kept out of the markup.
 *
 * Nothing here composes a sentence the shell already publishes. It builds
 * ordinals, anchor ids and the seven marginal-note labels, and it decides
 * which sections have something true to say. Pure, so it is readable on its
 * own and cannot drift from the components that use it.
 */

import type {
  Disclosure,
  HomeCandidateProps,
  TodaySection,
} from "@/lib/home-layer/lab-shell";

/**
 * `01`, `02`, `17`. Two digits below a hundred, natural width above it, so a
 * ledger of eighteen projects and a ledger of a hundred and four both stay in
 * one tabular column.
 */
export function ordinal(position: number): string {
  return String(position).padStart(2, "0");
}

/**
 * A fragment-safe id. Row keys carry colons (`Tasks:task:abc`) and Project
 * ids carry whatever the fixture gave them, so both are folded to one
 * grammar rather than trusted.
 */
export function anchorId(prefix: string, key: string): string {
  const safe = key.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `ri-${prefix}-${safe.length > 0 ? safe : "x"}`;
}

/**
 * The marginal label a note is filed under.
 *
 * The tones are the shell's vocabulary; these are the words a reader sees
 * beside them. Plain English, and each one names a fact about the read rather
 * than a judgement about it. `failure` is "Not answering" and not "Error",
 * because the reader's question is what the surface could not see.
 */
const TONE_LABELS: Readonly<Record<Disclosure["tone"], string>> = Object.freeze({
  coverage: "Coverage",
  permission: "Access",
  freshness: "Last read",
  scope: "Scope",
  failure: "Not answering",
  setup: "Not connected",
  scale: "Size",
});

export function toneLabel(tone: Disclosure["tone"]): string {
  return TONE_LABELS[tone];
}

/**
 * A Today or briefing section renders when it has rows, or when it has
 * something to say about rows it is not showing. An empty section with
 * nothing held back is furniture, and HOME_EXPERIENCE §3.1 rule 7 already
 * settled that it does not render.
 */
export function sectionSpeaks(section: TodaySection): boolean {
  return section.rows.length > 0 || section.suppressedLine !== null;
}

/**
 * The state each of the four modes is in, in the shell's own words, for the
 * index leader lines. This is the whole reason the index earns its height:
 * the contents page reports the condition of every chapter before the reader
 * commits to one.
 */
export function modeStateLine(
  props: HomeCandidateProps,
  mode: HomeCandidateProps["chrome"]["modes"][number]["mode"],
): string {
  const { copy, today, inbox, myWork, analytics } = props;
  if (mode === "inbox") return copy.states[inbox.state];
  if (mode === "my-work") return copy.states[myWork.state];
  if (mode === "analytics") return copy.states[analytics.state];
  return copy.states[today.state];
}
