/**
 * Template anchor dates.
 *
 * A template may declare the one date its customer already knows before
 * anything else is planned: a wedding day, an opening night. Its items then
 * carry `anchorOffsetDays`, counted back from that day. When a workspace is
 * created from such a template and the customer supplies the date, every
 * offset becomes a real `targetDate` — which is what earns the shared
 * artifact its countdown, its Today dash, and real calendar spacing instead
 * of flat ordinal order.
 *
 * Pure and UTC-only. These are calendar days, never instants, so no local
 * timezone can shift a milestone across midnight on the way into the seed.
 */

export type AnchoredItem = {
  targetDate?: string;
  anchorOffsetDays?: number;
};

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real YYYY-MM-DD calendar day. Rejects 2026-02-30 and friends. */
export function isCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

/** Shift a calendar day by whole days, staying in UTC. */
export function shiftCalendarDate(date: string, days: number): string | null {
  if (!isCalendarDate(date) || !Number.isInteger(days)) return null;
  const base = new Date(`${date}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/**
 * Resolve each item's target date against the anchor. Without a usable anchor
 * the items come back untouched and undated — exactly the behaviour before
 * templates could declare one, so a customer who skips the question loses
 * nothing they had. An offset always wins over a hardcoded `targetDate`: a
 * template must not state the same timing twice.
 */
export function applyTemplateAnchor<T extends AnchoredItem>(
  items: readonly T[],
  anchorDate: string | null | undefined,
): T[] {
  if (!anchorDate || !isCalendarDate(anchorDate)) {
    return items.map((item) => ({ ...item }));
  }

  return items.map((item) => {
    if (typeof item.anchorOffsetDays !== "number") return { ...item };
    const targetDate = shiftCalendarDate(anchorDate, item.anchorOffsetDays);
    return targetDate ? { ...item, targetDate } : { ...item };
  });
}
