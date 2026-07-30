import { capitalise, numberWord } from "./prose";
import type { Briefing, TriggerKind } from "./types";

/**
 * Single source of truth for the briefing's voice helpers. Used by:
 *   - `src/lib/email/briefing-email.tsx` (HTML email)
 *   - `src/lib/email/plain-text.ts`      (text/plain email body)
 *   - `components/brief/quiet-briefing-ledger.tsx` through the protected DTO
 *
 * Previously these three callers each carried verbatim copies of
 * greeting/summaryLine/graceNote, voice changes drifted between them.
 */

/**
 * `forEmail`, when true, always returns "Good morning." regardless of
 * hour. The cron fires at 06:00 UTC; non-EU users would receive
 * "Good evening" in their morning email until per-TZ cron exists.
 * Time-of-day variants are reserved for the web view where the browser
 * supplies the correct local time.
 */
export function greeting(
  hour: number,
  firstName?: string | null,
  forEmail?: boolean,
): string {
  const base = forEmail
    ? "Good morning"
    : hour < 5
      ? "It’s late"
      : hour < 12
        ? "Good morning"
        : hour < 17
          ? "Good afternoon"
          : "Good evening";
  return firstName ? `${base}, ${firstName}.` : `${base}.`;
}

/**
 * Calm one-line summary under the greeting. Shape of the day in
 * plain English, no numbers without a "so what".
 *
 * Silence is the signal. On a brief with nothing to flag,
 * `summaryLine` returns the empty string and lets the EmptyState
 * frame the page. The function speaks only when there is something
 * to summarise.
 */
export function summaryLine(b: Briefing): string {
  const att = b.needsAttention.length;
  const risks = b.quietRisks.length;
  if (att === 0 && risks === 0) {
    // Nothing pulling. The summary line says nothing. EmptyState
    // QuietBriefingLedger carries the frame on these days.
    return "";
  }
  // Every branch has to account for the quiet risks, because they
  // render directly below this line and the meta line counts them.
  // "One thing's calling." above two visible risks and a "3 signals"
  // count was the page contradicting itself in three places.
  //
  // The tail is singular-aware in every branch. "A few quieter signals"
  // over exactly one risk row was the line miscounting what the reader
  // could see, one row down.
  const tail =
    risks === 1 ? "and one quieter signal below" : "and a few quieter signals below";
  if (att === 0) {
    return `A quiet day. ${capitalise(numberWord(risks))} ${risks === 1 ? "risk" : "risks"} worth watching.`;
  }
  if (att === 1) {
    return risks > 0 ? `One thing’s calling, ${tail}.` : "One thing’s calling.";
  }
  if (att === 2) {
    return risks > 0 ? `Two things calling, ${tail}.` : "Two things calling.";
  }
  // "more quietly behind them" parsed as an adverb on "calling", which
  // said the three things were calling more quietly than themselves.
  if (risks === 0) return "Three things calling.";
  return risks === 1
    ? "Three things calling, and one quieter signal below them."
    : "Three things calling, and quieter signals below them.";
}

/**
 * The all-clear's accounting sentence, or null when the engine could
 * not report a denominator. A clear day is only a receipt if the reader
 * can see what was read to reach it; "nothing needs you" on its own is
 * an assertion. Never guessed: no count in, no sentence out.
 *
 * `triggeredCount` is not optional decoration. A page with no rows is not
 * proof that nothing crossed a rule: a lone just-shipped item crosses one
 * and lands in a bucket that renders nowhere, so the sentence used to read
 * "Signal read two items in this scope. Nothing crossed Signal's attention
 * rules." over a day where something had. When something crossed, the
 * sentence says so and says the true thing about it instead, which is that
 * it is not asking for the reader.
 */
export function readCountSentence(
  readCount: number | null | undefined,
  triggeredCount?: number | null,
): string | null {
  if (typeof readCount !== "number" || !Number.isFinite(readCount)) return null;
  const read = Math.floor(readCount);
  if (read <= 0) return null;
  const denominator = `Signal read ${numberWord(read)} ${read === 1 ? "item" : "items"} in this scope.`;
  const triggered =
    typeof triggeredCount === "number" && Number.isFinite(triggeredCount)
      ? Math.min(read, Math.max(0, Math.floor(triggeredCount)))
      : 0;
  if (triggered > 0) {
    return `${denominator} ${capitalise(numberWord(triggered))} of them crossed a rule without asking anything of you.`;
  }
  return `${denominator} Nothing crossed Signal’s attention rules.`;
}

/**
 * Honest carry-over age, rendered in the item's quiet meta line
 * ("from Tasks · Wedding 2026 · still waiting, day 3"). Only called
 * for items at day ≥ 2. The wording bends to the trigger: waiting
 * language for stalled work, open language for deadline pressure.
 */
export function ageNote(trigger: TriggerKind, days: number): string {
  switch (trigger) {
    case "stuck-work":
    case "blocked-too-long":
      return `still waiting, day ${days}`;
    case "due-soon":
      return `still open, day ${days}`;
    default:
      return `still here, day ${days}`;
  }
}

/**
 * Soft sign-off. Adjusts to the shape of the brief without ever
 * becoming chatty. Read aloud, if it sounds like a friend, keep it.
 *
 * It may only describe things the reader can see. The old copy named a
 * "focus block" that renders in no component, told the reader what to
 * do first (DESIGN.md §11: observational, never prescriptive), and
 * branched on an empty `suggestedFocus`, a state with no surface at
 * all. Shared with the ledger adapters so the page and the DTO sign off
 * with the same sentence.
 *
 * Two later repairs:
 *
 *  - the multi-row line claimed an order the page does not use. Rows sort
 *    by focus weight (due-soon 1000, crowded-week 800, stuck-work 700,
 *    blocked-too-long 600), not by age, so "the top one is the one that's
 *    waiting longest" was reliably describing the LAST row. The line now
 *    states the sort the page actually runs.
 *  - the single-row line said "Open Tasks when you're ready", which every
 *    row already carries as a "Review in Tasks" control, and which §11
 *    refuses as an instruction. It says nothing now.
 */
export function closingLine(needsAttention: number, isEmpty: boolean): string {
  if (isEmpty) return "That’s the read.";
  if (needsAttention >= 2) {
    return "That’s the read. Dates came first, then the quiet ones.";
  }
  return "That’s the read.";
}

export function graceNote(b: Briefing): string {
  return closingLine(b.needsAttention.length, b.isEmpty);
}
