import type { AudienceTimelineDto, AudienceTimelineItemDto } from "../../lib/audience-timeline";
import type { Master3ItemPresentation, Master3Presentation } from "../../lib/master3-presentation";
import { master3TimelineTitle } from "../../lib/master3-labels";

const DAY = 86_400_000;

function day(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError("Invalid Master 3 calendar date");
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new TypeError("Invalid Master 3 calendar date");
  }
  return timestamp;
}

export type Master3Milestone = Readonly<{
  publicId: string; title: string; date: string | null;
  /** Original source state is never rewritten by date passage. */
  sourceState: AudienceTimelineItemDto["state"];
  presentation: Master3ItemPresentation;
  datePassed: boolean; isToday: boolean; daysUntil: number | null;
  isFinal: boolean; isNext: boolean; isPostFinal: boolean;
  displayState: "done" | "passed" | "today" | "next" | "upcoming" | "undated";
}>;

export type Master3Hero = Readonly<{
  kind: "soon" | "countdown" | "today" | "after" | "during";
  value: string; line1: string; line2: string; targetDate: string | null;
}>;

export type Master3Model = Readonly<{
  title: string; presentation: Master3Presentation; today: string;
  milestones: readonly Master3Milestone[];
  undated: readonly Master3Milestone[];
  final: Readonly<{ publicId: string | null; title: string; date: string }> | null;
  next: Master3Milestone | null; postFinal: readonly Master3Milestone[];
  hero: Master3Hero; noDates: boolean; after: boolean; onDay: boolean;
  dayBefore: boolean; duringNow: boolean; allDone: boolean;
  comingUp: readonly Master3Milestone[];
  then: readonly Master3Milestone[];
  returningHint: Readonly<{ items: readonly Master3Milestone[]; text: string; showInComingUp: boolean }> | null;
  phone: Readonly<{ visible: readonly Master3Milestone[]; hidden: readonly Master3Milestone[];
    earlier: readonly Master3Milestone[]; hiddenRange: Readonly<{ from: string; to: string }> | null }>;
  progress: Readonly<{ passed: number; completed: number; total: number; percent: number; show: boolean }>;
  updated: string | null;
  /** Projected schedule only, never evidence that an email was sent. */
  reminders: readonly Readonly<{ date: string; milestoneId: string | null; kind: "for-you" | "final" | "post-final"; daysBefore: number }>[];
}>;

type InputItem = AudienceTimelineItemDto & { presentation?: Master3ItemPresentation };
type Input = AudienceTimelineDto & { presentation?: Master3Presentation };

/** Pure presentation projection. Caller supplies an authorized DTO and explicit calendar today. */
export function buildMaster3Model(dto: Input, options: {
  lastVisit?: string; expanded?: boolean; viewer?: "guest" | "owner";
} = {}): Master3Model {
  const today = day(dto.today), p = dto.presentation ?? {};
  const raw = dto.sections.flatMap(section => section.items as readonly InputItem[])
    .filter(item => item.state !== "cancelled");
  if (new Set(raw.map(item => item.publicId)).size !== raw.length) throw new TypeError("Duplicate Master 3 milestone");
  if (raw.filter(item => item.presentation?.final).length > 1) throw new TypeError("Multiple Master 3 final milestones");
  const entries = raw.map((item, index) => ({ item, index, timestamp: item.date ? day(item.date) : null }))
    .sort((a, b) => (a.timestamp ?? Infinity) - (b.timestamp ?? Infinity) || a.index - b.index);
  const dated = entries.filter(entry => entry.timestamp !== null);
  const flagged = entries.find(entry => entry.item.presentation?.final);
  const primaryTimestamp = dto.primaryDate ? day(dto.primaryDate.date) : null;
  const finalEntry = flagged ?? (primaryTimestamp !== null ? dated.find(entry => entry.timestamp === primaryTimestamp) : undefined)
    ?? (primaryTimestamp === null ? dated.at(-1) : undefined);
  const finalTimestamp = flagged ? flagged.timestamp : primaryTimestamp ?? finalEntry?.timestamp ?? null;
  const final = finalTimestamp === null ? null : {
    publicId: finalEntry?.item.publicId ?? null,
    title: finalEntry?.item.title ?? dto.primaryDate?.label ?? p.panelLabel ?? "Final milestone",
    date: new Date(finalTimestamp).toISOString().slice(0, 10),
  };
  const after = finalTimestamp !== null && finalTimestamp < today;
  const onDay = finalTimestamp === today;
  const dayBefore = finalTimestamp !== null && finalTimestamp - today === DAY;
  const nextEntry = dated.find(entry => entry.timestamp! >= today &&
    (after || finalTimestamp === null || entry.timestamp! <= finalTimestamp));
  const milestones: Master3Milestone[] = entries.map(({ item, timestamp }) => {
    const datePassed = timestamp !== null && timestamp < today;
    const isToday = timestamp === today, isNext = nextEntry?.item.publicId === item.publicId;
    const presentation = item.presentation ?? {};
    return { publicId: item.publicId, title: item.title, date: item.date ?? null,
      sourceState: item.state, presentation, datePassed, isToday,
      daysUntil: timestamp === null ? null : (timestamp - today) / DAY,
      isFinal: (flagged?.item.publicId ?? final?.publicId) === item.publicId,
      isNext, isPostFinal: finalTimestamp !== null && timestamp !== null && timestamp > finalTimestamp,
      displayState: timestamp === null ? "undated" : datePassed ? presentation.forYou || item.state !== "covered" ? "passed" : "done"
        : isToday ? "today" : isNext ? "next" : "upcoming" };
  });
  const undated = milestones.filter(item => item.date === null);
  const next = milestones.find(item => item.isNext) ?? null;
  const postFinal = milestones.filter(item => item.isPostFinal);
  const noDates = dated.length === 0 && final === null;
  const duringNow = after && !!p.during && today - finalTimestamp! <= p.during.days * DAY;
  const countNext = p.countTo === "next" && !after && next && !next.isFinal;
  const target = countNext ? { date: next.date!, title: next.title } : final;
  const noun = countNext ? next.title : p.unitNoun ?? p.panelLabel ?? final?.title ?? "the next milestone";
  let hero: Master3Hero;
  if (!target) hero = { kind: "soon", value: "Soon", line1: flagged ? "final date to follow" : "dates to follow", line2: "", targetDate: null };
  else if (duringNow) hero = { kind: "during", value: p.during!.word, line1: p.during!.l1 ?? "", line2: p.during!.l2 ?? "", targetDate: final!.date };
  else if (after) hero = { kind: "after", value: p.after?.word ?? "Past", line1: p.after?.l1 ?? "The final date has passed", line2: p.after?.l2 ?? "", targetDate: final!.date };
  else {
    const remaining = (day(target.date) - today) / DAY;
    hero = remaining === 0 ? { kind: "today", value: "Today", line1: `is ${noun}`, line2: "", targetDate: target.date }
      : { kind: "countdown", value: String(remaining), line1: remaining === 1 ? "day until" : "days until", line2: noun, targetDate: target.date };
  }
  const active = milestones.filter(item => item.date !== null && !item.datePassed);
  const then = postFinal.filter(item => !item.datePassed);
  let upcoming = active.filter(item => !item.isFinal && !item.isPostFinal);
  if (p.countTo === "next" && upcoming.length === 0 && !after) upcoming = active.filter(item => item.isFinal);
  const protect = [upcoming.find(item => item.isNext), upcoming.find(item => item.presentation.forYou)]
    .filter((item): item is Master3Milestone => !!item);
  const since = options.lastVisit ? day(options.lastVisit) : null;
  const sinceItems = since !== null && since <= today && options.viewer !== "owner" && !after && !onDay && !dayBefore
    ? milestones.filter(item => item.datePassed && day(item.date!) >= since).reverse() : [];
  const rowBudget = 3 - (then.length ? 1 : 0);
  const showSince = sinceItems.length > 0 && rowBudget - 1 >= new Set(protect.map(item => item.publicId)).size;
  const limit = rowBudget - (showSince ? 1 : 0);
  const chosen = new Set(upcoming.slice(0, limit).map(item => item.publicId));
  for (const item of protect) {
    if (chosen.has(item.publicId)) continue;
    const replace = [...chosen].reverse().find(id => !protect.some(value => value.publicId === id));
    if (replace) chosen.delete(replace);
    chosen.add(item.publicId);
  }
  const comingUp = after || onDay || dayBefore ? [] : upcoming.filter(item => chosen.has(item.publicId));
  const returningHint = sinceItems.length ? {
    items: sinceItems,
    text: `${sinceItems[0].presentation.short ?? sinceItems[0].title}${sinceItems.length > 1 ? ` and ${sinceItems.length - 1} more have passed.` : " has passed."}`,
    showInComingUp: showSince,
  } : null;
  const finalIndex = milestones.findIndex(item => item.isFinal);
  const lastPassed = milestones.findLastIndex(item => item.datePassed);
  const start = (after || onDay || dayBefore) && finalIndex >= 0 ? finalIndex : lastPassed >= 2 ? lastPassed : 0;
  const earlier = milestones.slice(0, start), candidates = milestones.slice(start);
  const dense = milestones.length > 10 && !options.expanded && !after;
  const nextIndex = Math.max(0, candidates.findIndex(item => item.isNext));
  const phoneKeep = new Set<number>();
  if (dense) candidates.forEach((item, index) => {
    if (index < nextIndex + 5 || item.isFinal || item.date === null || index === candidates.length - 1) phoneKeep.add(index);
    if (item.presentation.forYou) {
      phoneKeep.add(index);
      // Keep at most three immediately preceding plain dates, never the whole
      // gap to a distant required date. The final filter preserves chronology.
      for (let prior = index - 1, count = 0; prior >= 0 && count < 3; prior--) {
        if (candidates[prior].presentation.forYou || candidates[prior].isFinal) break;
        phoneKeep.add(prior); count++;
      }
    }
  });
  const visible = dense ? candidates.filter((_, index) => phoneKeep.has(index)) : candidates;
  const visibleIds = new Set(visible.map(item => item.publicId));
  const hidden = candidates.filter(item => !visibleIds.has(item.publicId));
  const passed = milestones.filter(item => item.datePassed).length;
  const updateDay = Date.parse(dto.lastUpdatedAt);
  const updateDate = Number.isFinite(updateDay) ? new Date(updateDay).toISOString().slice(0, 10) : null;
  const updateAge = updateDate ? today - day(updateDate) : -1;
  const reminders: Master3Model["reminders"][number][] = [];
  const addReminder = (timestamp: number, id: string | null, kind: "for-you" | "final" | "post-final", daysBefore: number) => {
    const scheduled = timestamp - daysBefore * DAY;
    if (scheduled >= today) reminders.push({ date: new Date(scheduled).toISOString().slice(0, 10), milestoneId: id, kind, daysBefore });
  };
  const weddingAfterFinal = after && (dto.audienceKind === "couple" || p.market === "wedding");
  for (const item of weddingAfterFinal ? [] : active) {
    if (item.sourceState === "covered") continue;
    const postFinalReminder = item.isPostFinal && (p.market === "launch" || p.market === "school");
    if (postFinalReminder) addReminder(day(item.date!), item.publicId, "post-final", 7);
    else if (item.presentation.forYou) addReminder(day(item.date!), item.publicId, "for-you", 7);
  }
  if (final && !weddingAfterFinal) for (const daysBefore of [30, 7, 1]) addReminder(day(final.date), final.publicId, "final", daysBefore);
  reminders.sort((a, b) => a.date.localeCompare(b.date));
  return { title: master3TimelineTitle(dto), presentation: p, today: dto.today, milestones, undated, final, next, postFinal, hero,
    noDates, after, onDay, dayBefore, duringNow,
    allDone: milestones.length > 0 && undated.length === 0 && passed === milestones.length && !duringNow,
    comingUp, then, returningHint,
    phone: { visible, hidden, earlier, hiddenRange: hidden.length ? { from: hidden[0].date!, to: hidden.at(-1)!.date! } : null },
    progress: { passed, completed: milestones.filter(item => item.sourceState === "covered").length,
      total: milestones.length, percent: milestones.length ? Math.round(passed / milestones.length * 100) : 0,
      show: dated.length > 0 && !after && !onDay && !dayBefore },
    updated: updateAge >= 0 && updateAge <= 60 * DAY ? updateDate : null, reminders };
}
