const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const DAY_MS = 86_400_000;

export const dayIndex = (ms: number) => Math.floor(ms / DAY_MS);

/** Whole calendar days from a to b (positive when b is later). */
export const daysBetween = (a: number, b: number) => dayIndex(b) - dayIndex(a);

export const monthShort = (ms: number) => MONTHS[new Date(ms).getUTCMonth()].slice(0, 3);
export const monthLong = (ms: number) => MONTHS[new Date(ms).getUTCMonth()];

/** "3 Nov" */
export const dShort = (ms: number) => `${new Date(ms).getUTCDate()} ${monthShort(ms)}`;
/** "3 November" */
export const dLong = (ms: number) => `${new Date(ms).getUTCDate()} ${monthLong(ms)}`;
/** "Tue 3 Nov" */
export const dWeek = (ms: number) => `${DAYS[new Date(ms).getUTCDay()].slice(0, 3)} ${dShort(ms)}`;
/** "Tuesday 3 November" */
export const dWeekLong = (ms: number) => `${DAYS[new Date(ms).getUTCDay()]} ${dLong(ms)}`;

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "in 9 days", "today", "83 days ago" */
export function relDays(from: number, to: number): string {
  const d = daysBetween(from, to);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
}

export type Parts = { d: number; h: number; m: number; s: number };

export function split(ms: number): Parts {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

export const pad = (n: number) => String(n).padStart(2, "0");

/** Year-month-day-hour-minute in the compact calendar format. */
export function icsStamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
