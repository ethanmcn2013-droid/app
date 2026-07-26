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
      ? "It's late"
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
  if (att === 0 && risks > 0) {
    return `A quiet day, but ${risks} ${risks === 1 ? "risk" : "risks"} worth watching.`;
  }
  if (att === 1) return "One thing's calling.";
  if (att === 2) return "Two things calling, and a few quieter signals below.";
  return `Three things calling${risks > 0 ? ", more quietly behind them" : ""}.`;
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
 */
export function graceNote(b: Briefing): string {
  if (b.isEmpty) return "That's the read.";
  if (b.suggestedFocus.length === 0) return "That's the read, good day.";
  if (b.needsAttention.length >= 2) return "Take the focus block first. The rest can wait.";
  return "That's the read. Open Tasks when you're ready.";
}
