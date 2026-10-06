/**
 * Home's small words: the greeting, the long date and a first name. Pure and
 * import-free, so the browser can read them without Home's whole model.
 */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Monday 5 October". Spelled here so the server and the browser agree. */
export function formatLongDay(isoDate: string): string {
  const ms = Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(ms)) return isoDate;
  const date = new Date(ms);
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** The greeting for an hour of the reader's own day, 0 to 23. */
export function greetingForHour(hour: number): string {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function hourIn(timeZone: string, ms: number): number {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(new Date(ms)));
  return Number.isFinite(hour) ? hour % 24 : 12;
}

export function firstNameOf(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0] ?? "";
  // An email's local part or a handle is not a name to greet someone by.
  return first && !first.includes("@") ? first : null;
}
