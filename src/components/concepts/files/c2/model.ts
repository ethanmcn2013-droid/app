import { type FileState, type KitFile, type Milestone, TODAY } from "./data";

const DAY = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Day number since the epoch, in UTC, so no timezone can shift a date. */
export function dayOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
}

export function isoOf(day: number): string {
  return new Date(day * DAY).toISOString().slice(0, 10);
}

export const TODAY_DAY = dayOf(TODAY);

function parts(day: number) {
  const date = new Date(day * DAY);
  return { wd: date.getUTCDay(), d: date.getUTCDate(), m: date.getUTCMonth() };
}

/** "Thu 1 Oct" */
export function short(day: number): string {
  const { wd, d, m } = parts(day);
  return `${WEEKDAYS[wd]} ${d} ${MONTHS[m]}`;
}

/** "Thursday 1 October" style, month kept short for width. */
export function long(day: number): string {
  const { wd, d, m } = parts(day);
  return `${WEEKDAYS_LONG[wd]} ${d} ${MONTHS[m]}`;
}

export function dayNum(day: number) {
  return parts(day).d;
}

export function weekday(day: number) {
  return WEEKDAYS[parts(day).wd];
}

export function monthName(day: number) {
  return MONTHS[parts(day).m];
}

export function isMonday(day: number) {
  return parts(day).wd === 1;
}

/** "in 6 days", "tomorrow", "3 days ago" */
export function countdown(day: number, from = TODAY_DAY): string {
  const diff = day - from;
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff > 0 && diff < 14) return `in ${diff} days`;
  if (diff >= 14) return `in ${Math.round(diff / 7)} weeks`;
  return `${-diff} days ago`;
}

export type Readiness = {
  total: number;
  ready: number;
  draft: number;
  waiting: number;
  missing: number;
  complete: boolean;
};

export function readiness(files: KitFile[]): Readiness {
  const r = { total: files.length, ready: 0, draft: 0, waiting: 0, missing: 0 };
  for (const f of files) r[f.state] += 1;
  return { ...r, complete: r.total > 0 && r.ready === r.total };
}

export type KitTone = "done" | "set" | "overdue" | "open";

export function kitTone(m: Milestone, files: KitFile[], today = TODAY_DAY): KitTone {
  const r = readiness(files);
  const day = dayOf(m.date);
  if (day < today) return r.complete ? "done" : "overdue";
  return r.complete ? "set" : "open";
}

/** The one line that tells you where a kit stands. */
export function kitLine(m: Milestone, files: KitFile[]): string {
  const r = readiness(files);
  const day = dayOf(m.date);
  const tone = kitTone(m, files);
  if (tone === "done") return "Done and filed";
  if (tone === "set") return `All set for ${m.kitName}`;
  const bits: string[] = [];
  if (r.missing) bits.push(`${r.missing} missing`);
  if (r.waiting) bits.push(`${r.waiting} waiting`);
  if (r.draft) bits.push(`${r.draft} in draft`);
  if (tone === "overdue") return `${TODAY_DAY - day} days late, ${bits.join(", ")}`;
  return `Still to come: ${bits.join(", ")}`;
}

export const STATE_ORDER: Record<FileState, number> = { missing: 0, waiting: 1, draft: 2, ready: 3 };

export const STATE_LABEL: Record<FileState, string> = {
  ready: "Ready",
  draft: "Draft",
  waiting: "Waiting",
  missing: "Missing",
};

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function cx(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

/* ── View models ─────────────────────────────────────────────────────── */

export type FileView = KitFile & {
  /** A request has gone out for this missing file. */
  asked?: boolean;
  /** Original name of a file dropped onto a placeholder. */
  droppedAs?: string;
};

export type KitView = Omit<Milestone, "files"> & {
  files: FileView[];
  day: number;
  tone: KitTone;
  r: Readiness;
};

export type PackMode = "link" | "offline" | "print";

export type PackResult = {
  mode: PackMode;
  count: number;
  url: string;
  expires?: string;
  size: string;
};

/** Rough total of "1.2 MB" / "84 KB" strings, for the download size. */
export function totalSize(files: KitFile[]): string {
  let kb = 0;
  for (const f of files) {
    const m = f.size?.match(/([\d.]+)\s*(KB|MB)/);
    if (!m) continue;
    kb += Number(m[1]) * (m[2] === "MB" ? 1024 : 1);
  }
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  return `${(kb / 1024).toFixed(kb > 10240 ? 0 : 1)} MB`;
}

/** Name used in buttons: "Ask Mara", "Ask the parents". */
export function askLabel(who?: string) {
  if (!who || who === "you") return null;
  return `Ask ${who}`;
}
