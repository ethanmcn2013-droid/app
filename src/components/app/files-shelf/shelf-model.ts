/**
 * Files, Sources + shelf: the page's model, pure and client-safe.
 *
 * Everything the shelf says about a Project's files is worked out here from
 * the rows `loadProjectFiles` already returns: which source a file lives in,
 * what each source folder says about itself, the summary sentence, the type
 * chips, the newest-first list grouped by calendar date, and why a search
 * matched. No clock, network or DOM, so every word is reproducible and pinned
 * by `shelf-model.test.ts`.
 *
 * Copy register: plain, sentence case, one grammar per fact. Google Drive is
 * where Drive files are kept ("In Google Drive"), never "linked, not copied".
 */

import {
  FILE_KIND_LABEL,
  addedByLabel,
  formatAddedDate,
  formatBytes,
  sourceLabel,
  type ProjectFile,
} from "@/lib/projects/project-files";

// ── Sources ───────────────────────────────────────────────────────────────

export type ShelfSource = "signal" | "drive" | "links";

export const SHELF_SOURCES: readonly ShelfSource[] = ["signal", "drive", "links"];

export const SOURCE_NAME: Readonly<Record<ShelfSource, string>> = {
  signal: "In Signal",
  drive: "Google Drive",
  links: "Links",
};

const SOURCE_BLURB: Readonly<Record<ShelfSource, string>> = {
  signal: "Files uploaded to Signal.",
  drive: "In Google Drive. Opens in Drive.",
  links: "Web pages and tools saved to tasks.",
};

/** `?source=` as the URL spells it, or null for Files home. */
export function parseShelfSource(raw: unknown): ShelfSource | null {
  return raw === "signal" || raw === "drive" || raw === "links" ? raw : null;
}

export function sourceOf(file: Pick<ProjectFile, "storage">): ShelfSource {
  if (file.storage === "google_drive") return "drive";
  if (file.storage === "link") return "links";
  return "signal";
}

function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export type SourceFolder = Readonly<{
  key: ShelfSource;
  name: string;
  blurb: string;
  /** One fact, one grammar for all three: "On 3 tasks", plus the size stored for uploads. */
  fact: string;
  count: number;
}>;

export function describeSources(files: readonly ProjectFile[]): SourceFolder[] {
  return SHELF_SOURCES.map((key) => {
    const own = files.filter((file) => sourceOf(file) === key);
    const tasks = new Set(own.map((file) => file.taskId)).size;
    const stored = key === "signal" ? own.reduce((sum, file) => sum + (file.sizeBytes ?? 0), 0) : 0;
    const fact =
      own.length === 0
        ? "Nothing here yet"
        : `On ${count(tasks, "task")}${stored > 0 ? ` · ${formatBytes(stored)}` : ""}`;
    return { key, name: SOURCE_NAME[key], blurb: SOURCE_BLURB[key], fact, count: own.length };
  });
}

// ── Header ────────────────────────────────────────────────────────────────

const WEEK_SECONDS = 7 * 86_400;

/** One plain sentence: what is here, and how much of it is new. */
export function summarySentence(files: readonly ProjectFile[], projectName: string, nowSeconds: number): string {
  if (files.length === 0) return `Nothing is attached to a task in ${projectName} yet.`;
  const tasks = new Set(files.map((file) => file.taskId)).size;
  const recent = files.filter((file) => nowSeconds - file.addedAt < WEEK_SECONDS).length;
  return `${count(files.length, "file")} on ${count(tasks, "task")} in ${projectName}, ${
    recent > 0 ? `${recent} added` : "none added"
  } in the last 7 days.`;
}

// ── Types and placeholders ────────────────────────────────────────────────

/** The four kinds of placeholder, and the four type chips: one family each. */
export type ShelfType = "document" | "sheet" | "image" | "link";

export const SHELF_TYPE_LABEL: Readonly<Record<ShelfType, string>> = {
  document: "Documents",
  sheet: "Sheets",
  image: "Images",
  link: "Links",
};

const SHELF_TYPE_ORDER: readonly ShelfType[] = ["document", "sheet", "image", "link"];

export function shelfTypeOf(file: Pick<ProjectFile, "kind" | "storage">): ShelfType {
  if (file.kind === "image") return "image";
  if (file.kind === "sheet") return "sheet";
  if (file.storage === "link" || file.kind === "link" || file.kind === "design") return "link";
  return "document";
}

export type TypeChip = Readonly<{ type: ShelfType; label: string; count: number }>;

/** Chips for the types present, in a fixed order. Fewer than two types: no chips at all. */
export function typeChips(files: readonly ProjectFile[]): TypeChip[] {
  const counts = new Map<ShelfType, number>();
  for (const file of files) counts.set(shelfTypeOf(file), (counts.get(shelfTypeOf(file)) ?? 0) + 1);
  if (counts.size < 2) return [];
  return SHELF_TYPE_ORDER.filter((type) => counts.has(type)).map((type) => ({
    type,
    label: SHELF_TYPE_LABEL[type],
    count: counts.get(type)!,
  }));
}

/** "3 images", "1 document": what a type filter leaves on screen. */
export function typeCount(type: ShelfType | null, n: number): string {
  if (type === null) return count(n, "file");
  const one = SHELF_TYPE_LABEL[type].toLowerCase().replace(/s$/, "");
  return count(n, one);
}

// ── Search ────────────────────────────────────────────────────────────────

export function queryWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

export type MatchReason = Readonly<{ kind: "name" | "task" | "person" | "type" | "source"; text: string }>;

function haystack(file: ProjectFile): string {
  return [
    file.title,
    file.taskTitle,
    addedByLabel(file) ?? "",
    FILE_KIND_LABEL[file.kind],
    SOURCE_NAME[sourceOf(file)],
    file.storage === "link" ? sourceLabel(file) : "",
  ]
    .join(" ")
    .toLowerCase();
}

/** Every word must be found in the file's name, task, person, kind or source. */
export function matchesQuery(file: ProjectFile, words: readonly string[]): boolean {
  if (words.length === 0) return true;
  const text = haystack(file);
  return words.every((word) => text.includes(word));
}

/**
 * Why a file matched, said once on its card: the first place that holds a
 * word the name does not. When the name holds every word it is the reason,
 * and the name is lit.
 */
export function matchReason(file: ProjectFile, words: readonly string[]): MatchReason | null {
  if (words.length === 0) return null;
  const title = file.title.toLowerCase();
  const rest = words.filter((word) => !title.includes(word));
  if (rest.length === 0) return { kind: "name", text: file.title };
  const hit = (text: string | null) => Boolean(text) && rest.some((word) => text!.toLowerCase().includes(word));
  if (hit(file.taskTitle)) return { kind: "task", text: file.taskTitle };
  const who = addedByLabel(file);
  if (who && hit(who)) return { kind: "person", text: who };
  if (hit(FILE_KIND_LABEL[file.kind])) return { kind: "type", text: FILE_KIND_LABEL[file.kind] };
  if (hit(SOURCE_NAME[sourceOf(file)]) || (file.storage === "link" && hit(sourceLabel(file)))) {
    return { kind: "source", text: file.storage === "link" ? sourceLabel(file) : SOURCE_NAME[sourceOf(file)] };
  }
  return null;
}

// ── Words on a card ───────────────────────────────────────────────────────

/** Where a file lives, short: "In Signal", "Google Drive", or a link's site. */
export function whereShort(file: ProjectFile): string {
  if (file.storage === "link") return sourceLabel(file);
  return SOURCE_NAME[sourceOf(file)];
}

/** The preview's "Where it lives" fact, in the shelf's words; its size has its own row. */
export function whereLong(file: ProjectFile): string {
  if (file.storage === "google_drive") return "In Google Drive";
  if (file.storage === "link") return `A link to ${sourceLabel(file)}`;
  return "Uploaded to Signal";
}

/** First name only on cards; a former member stays unnamed. */
export function shortWho(file: ProjectFile): string | null {
  if (file.addedByName) return file.addedByName.split(/\s+/)[0] ?? file.addedByName;
  return file.addedByFormer ? "Former member" : null;
}

/** One accessible name for a file, whether drawn as a card or a row. */
export function fileLabel(file: ProjectFile, reason: MatchReason | null = null): string {
  const who = addedByLabel(file);
  const where =
    file.storage === "google_drive" ? "in Google Drive" : file.storage === "link" ? `link to ${sourceLabel(file)}` : "uploaded to Signal";
  return [
    file.title,
    `${FILE_KIND_LABEL[file.kind]}, ${where}`,
    `Task: ${file.taskTitle}${file.taskArchived ? " (archived)" : ""}`,
    `Added ${formatAddedDate(file.addedAt)}${who ? ` by ${who === "A former member" ? "a former member" : who}` : ""}`,
    reason && reason.kind !== "name" ? `Matched ${reason.kind} ${reason.text}` : "",
  ]
    .filter(Boolean)
    .join(". ");
}

/** A name split so the extension never truncates: "Venue contract" + ".pdf". */
export function splitName(title: string): { base: string; ext: string } {
  const match = /^(.+?)(\.[A-Za-z0-9]{1,5})$/.exec(title);
  return match ? { base: match[1]!, ext: match[2]! } : { base: title, ext: "" };
}

// ── Latest additions as a list ────────────────────────────────────────────

export type DateGroup = Readonly<{ label: string; files: readonly ProjectFile[] }>;

const DAY_SECONDS = 86_400;

/**
 * Newest first, in calendar groups counted in UTC like every date on the page:
 * Today, Last 7 days, Earlier this month, Older. "Earlier this month" never
 * holds last month's files.
 */
export function dateGroups(files: readonly ProjectFile[], nowSeconds: number): DateGroup[] {
  const now = new Date(nowSeconds * 1000);
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000;
  const groups: Array<{ label: string; files: ProjectFile[] }> = [
    { label: "Today", files: [] },
    { label: "Last 7 days", files: [] },
    { label: "Earlier this month", files: [] },
    { label: "Older", files: [] },
  ];
  const sorted = [...files].sort((a, b) => b.addedAt - a.addedAt);
  for (const file of sorted) {
    const added = new Date(file.addedAt * 1000);
    const sameMonth = added.getUTCFullYear() === now.getUTCFullYear() && added.getUTCMonth() === now.getUTCMonth();
    if (file.addedAt >= todayStart) groups[0]!.files.push(file);
    else if (file.addedAt >= todayStart - 6 * DAY_SECONDS) groups[1]!.files.push(file);
    else if (sameMonth) groups[2]!.files.push(file);
    else groups[3]!.files.push(file);
  }
  return groups.filter((group) => group.files.length > 0);
}
