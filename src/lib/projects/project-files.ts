/**
 * Files: the page's model, pure and client-safe.
 *
 * The server read (`src/server/projects/project-files.ts`) returns one Project's
 * files; everything the page then says about them is worked out here, from
 * those rows and nothing else: what a search matches, how the matches are
 * grouped, what was added lately and by whom. No clock, database or network,
 * so every word on the page is reproducible and pinned by
 * `project-files.test.ts`.
 *
 * The search reads what the product actually knows about a file: its name, its
 * kind, the task it sits on and who added it. It does not read inside files
 * and never answers a question; a query is a set of words, and a file matches
 * when every word is found in one of those four places.
 */

export type ProjectFileKind = "document" | "image" | "sheet" | "slides" | "design" | "code" | "link" | "file";

export type ProjectFile = Readonly<{
  id: string;
  title: string;
  kind: ProjectFileKind;
  storage: "signal" | "google_drive" | "link";
  /** Where opening the file goes; null while an upload is still pending. */
  href: string | null;
  external: boolean;
  mimeType: string | null;
  sizeBytes: number | null;
  taskId: string;
  taskTitle: string;
  /** True when the task this file sits on is archived. */
  taskArchived: boolean;
  /** Named only while the person is a current member of the Project. */
  addedByName: string | null;
  /** Someone added it, and they are no longer a member. Never named. */
  addedByFormer: boolean;
  /** Unix seconds. */
  addedAt: number;
}>;

export type ProjectFilesRead = Readonly<{
  /** Newest first. */
  files: readonly ProjectFile[];
  /** The read hit its row limit, so older files are not listed. */
  truncated: boolean;
  /** Files on archived tasks were asked for and are in the list. */
  includesArchived: boolean;
  /** When the read was made, in Unix seconds: "the last 7 days" counts back from here. */
  readAt: number;
}>;

/** Each of the two file sources is read newest first, up to this many rows. */
export const FILES_READ_LIMIT = 1000;

export const FORMER_MEMBER = "A former member";

/** Who added a file, as the page may say it. Null when nobody is recorded. */
export function addedByLabel(file: Pick<ProjectFile, "addedByName" | "addedByFormer">): string | null {
  return file.addedByName ?? (file.addedByFormer ? FORMER_MEMBER : null);
}

// ── Kinds ──────────────────────────────────────────────────────────────────

export type FileFilter = "all" | "document" | "image" | "sheet" | "link";

export const FILE_FILTERS: ReadonlyArray<Readonly<{ value: FileFilter; label: string }>> = [
  { value: "all", label: "All" },
  { value: "document", label: "Documents" },
  { value: "image", label: "Images" },
  { value: "sheet", label: "Sheets" },
  { value: "link", label: "Links" },
];

export const FILE_KIND_LABEL: Readonly<Record<ProjectFileKind, string>> = {
  document: "Document",
  image: "Image",
  sheet: "Sheet",
  slides: "Slides",
  design: "Design",
  code: "Code",
  link: "Link",
  file: "File",
};

/** Filters group the long tail: slides with sheets, design and code with links. */
export function filterOf(file: Pick<ProjectFile, "kind" | "storage">): Exclude<FileFilter, "all"> {
  if (file.kind === "document") return "document";
  if (file.kind === "image") return "image";
  if (file.kind === "sheet" || file.kind === "slides") return "sheet";
  if (file.storage === "link" || file.kind === "link" || file.kind === "design" || file.kind === "code") return "link";
  return "document";
}

// ── Words ──────────────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "16 Jul", computed in UTC and spelled in code so server and browser agree. */
export function formatAddedDate(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** Where a file lives: "Google Drive", a link's site, or an upload's size. */
export function sourceLabel(file: Pick<ProjectFile, "storage" | "href" | "sizeBytes">): string {
  if (file.storage === "google_drive") return "Google Drive";
  if (file.storage === "link") {
    if (!file.href) return "Link";
    try {
      return new URL(file.href).hostname.replace(/^www\./, "");
    } catch {
      return "Link";
    }
  }
  return file.sizeBytes ? formatBytes(file.sizeBytes) : "Upload";
}

function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

// ── Search ─────────────────────────────────────────────────────────────────

const WEEK_SECONDS = 7 * 86_400;

export type FileScope = Readonly<{
  query: string;
  kind: FileFilter;
  /** An `addedByLabel` value, or null for anyone. */
  person: string | null;
  /** Only files added in the last seven days. */
  recent: boolean;
}>;

export const EMPTY_SCOPE: FileScope = { query: "", kind: "all", person: null, recent: false };

export function scopeIsEmpty(scope: FileScope): boolean {
  return scope.query.trim() === "" && scope.kind === "all" && scope.person === null && !scope.recent;
}

/** The query as lower-case words. */
export function queryTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

export type FileGroupId = "name" | "task" | "person" | "mixed" | "week" | "earlier";
export type FileGroup = Readonly<{ id: FileGroupId; title: string; files: readonly ProjectFile[] }>;

function has(text: string | null, terms: readonly string[]): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return terms.every((term) => lower.includes(term));
}

function whereMatched(file: ProjectFile, terms: readonly string[]): FileGroupId | null {
  if (has(file.title, terms)) return "name";
  if (has(file.taskTitle, terms)) return "task";
  if (has(addedByLabel(file), terms)) return "person";
  const everything = [file.title, file.taskTitle, addedByLabel(file) ?? "", FILE_KIND_LABEL[file.kind], sourceLabel(file)]
    .join(" ")
    .toLowerCase();
  return terms.every((term) => everything.includes(term)) ? "mixed" : null;
}

const GROUP_ORDER: readonly FileGroupId[] = ["name", "task", "person", "mixed", "week", "earlier"];

function groupTitle(id: FileGroupId, query: string): string {
  const quoted = `“${query.trim()}”`;
  switch (id) {
    case "name":
      return `Named ${quoted}`;
    case "task":
      return `On a task matching ${quoted}`;
    case "person":
      return `Added by ${quoted}`;
    case "mixed":
      return "Matches across name, task and person";
    case "week":
      return "Added in the last 7 days";
    default:
      return "Earlier";
  }
}

/**
 * The files a scope keeps, grouped by where the words were found (with a
 * query) or by how lately they were added (without one). Order inside a group
 * is the read's own: newest first.
 */
export function searchFiles(files: readonly ProjectFile[], scope: FileScope, nowSeconds: number): FileGroup[] {
  const terms = queryTerms(scope.query);
  const buckets = new Map<FileGroupId, ProjectFile[]>();
  for (const file of files) {
    if (scope.kind !== "all" && filterOf(file) !== scope.kind) continue;
    if (scope.person !== null && addedByLabel(file) !== scope.person) continue;
    const isRecent = nowSeconds - file.addedAt < WEEK_SECONDS;
    if (scope.recent && !isRecent) continue;
    const id = terms.length > 0 ? whereMatched(file, terms) : isRecent ? "week" : "earlier";
    if (id === null) continue;
    const list = buckets.get(id) ?? [];
    list.push(file);
    buckets.set(id, list);
  }
  return GROUP_ORDER.filter((id) => buckets.has(id)).map((id) => ({
    id,
    title: groupTitle(id, scope.query),
    files: buckets.get(id)!,
  }));
}

export function groupTotal(groups: readonly FileGroup[]): number {
  return groups.reduce((sum, group) => sum + group.files.length, 0);
}

/** Text split into plain and matched runs, for highlighting the query's words. */
export function markRuns(text: string, terms: readonly string[]): Array<{ text: string; hit: boolean }> {
  const needles = [...new Set(terms.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (needles.length === 0) return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const runs: Array<{ text: string; hit: boolean }> = [];
  let index = 0;
  let plainFrom = 0;
  while (index < text.length) {
    const needle = needles.find((candidate) => lower.startsWith(candidate, index));
    if (!needle) {
      index += 1;
      continue;
    }
    if (index > plainFrom) runs.push({ text: text.slice(plainFrom, index), hit: false });
    runs.push({ text: text.slice(index, index + needle.length), hit: true });
    index += needle.length;
    plainFrom = index;
  }
  if (plainFrom < text.length) runs.push({ text: text.slice(plainFrom), hit: false });
  return runs;
}

// ── The page before a search ───────────────────────────────────────────────

export type FileChip = Readonly<{
  key: string;
  label: string;
  count: number;
  scope: Partial<FileScope>;
  icon: "clock" | "person" | Exclude<FileFilter, "all">;
}>;

export type FilesOverview = Readonly<{
  total: number;
  tasks: number;
  /** The line under the title, in parts. */
  summary: readonly string[];
  chips: readonly FileChip[];
  /** What is here, by where it lives. */
  stores: ReadonlyArray<Readonly<{ key: string; label: string; count: number; note: string }>>;
  counts: Readonly<Record<FileFilter, number>>;
}>;

const PEOPLE_CHIPS = 3;

export function describeFiles(files: readonly ProjectFile[], nowSeconds: number): FilesOverview {
  const counts: Record<FileFilter, number> = { all: files.length, document: 0, image: 0, sheet: 0, link: 0 };
  for (const file of files) counts[filterOf(file)] += 1;
  const taskIds = new Set(files.map((file) => file.taskId));

  const thisWeek = files.filter((file) => nowSeconds - file.addedAt < WEEK_SECONDS);

  // Who added what, most first. A former member is one unnamed row.
  const byPerson = new Map<string, number>();
  for (const file of files) {
    const label = addedByLabel(file);
    if (label) byPerson.set(label, (byPerson.get(label) ?? 0) + 1);
  }
  const people = [...byPerson.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en"));

  const chips: FileChip[] = [];
  if (thisWeek.length > 0) {
    chips.push({ key: "recent", label: "Added this week", count: thisWeek.length, scope: { recent: true }, icon: "clock" });
  }
  for (const filter of FILE_FILTERS) {
    if (filter.value === "all" || counts[filter.value] === 0) continue;
    chips.push({ key: filter.value, label: filter.label, count: counts[filter.value], scope: { kind: filter.value }, icon: filter.value });
  }
  if (people.length > 1) {
    for (const [name, total] of people.slice(0, PEOPLE_CHIPS)) {
      chips.push({ key: `by:${name}`, label: `Added by ${name}`, count: total, scope: { person: name }, icon: "person" });
    }
  }

  const uploads = files.filter((file) => file.storage === "signal");
  const stored = uploads.reduce((sum, file) => sum + (file.sizeBytes ?? 0), 0);
  const drive = files.filter((file) => file.storage === "google_drive").length;
  const links = files.filter((file) => file.storage === "link").length;
  const stores = [
    { key: "uploads", label: "Uploaded", count: uploads.length, note: stored > 0 ? `${formatBytes(stored)} stored` : "Nothing stored yet" },
    { key: "drive", label: "Google Drive", count: drive, note: "Linked, not copied" },
    { key: "links", label: "Links", count: links, note: "Web pages and tools" },
  ];

  return {
    total: files.length,
    tasks: taskIds.size,
    summary: [
      `${count(files.length, "file")} across ${count(taskIds.size, "task")}`,
      thisWeek.length > 0 ? `${thisWeek.length} added in the last 7 days` : "none added in the last 7 days",
    ],
    chips,
    stores,
    counts,
  };
}
