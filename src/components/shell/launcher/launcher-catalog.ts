/**
 * The apps and tools catalogue: one list, three renderings (the top bar
 * popover, the phone sheet and the /app/tools page). Pure data and pure functions, no React, so the
 * order, the copy and the search ranking are tested directly.
 *
 * Honesty rules (docs/design/v3/launcher.md §9):
 * - Google Drive reflects the build flag only. Nothing here ever says
 *   "Connected", because navigation cannot know a Project's Drive state
 *   without a server round trip and manage authority.
 * - Google Sheets and every tool below are "Coming soon". Their pages carry
 *   a promise and real links to what works today, never fake UI.
 * - The only external address is the feedback mailbox.
 */
import type { ShellIconName } from "../shell-icons";

/** Glyphs drawn in launcher-icons.tsx. */
export type ToolGlyph =
  | "rings"
  | "cap"
  | "book"
  | "flow"
  | "canvas"
  | "doc"
  | "form"
  | "drive"
  | "sheet";

export type AppId = "tasks" | "timeline" | "notes" | "files" | "analytics" | "messages" | "projects";

export type AppEntry = Readonly<{
  kind: "app";
  id: AppId;
  label: string;
  href: string;
  icon: ShellIconName;
  description: string;
  /** Paths that make this the current app (aria-current). */
  owns: readonly string[];
  /** Only listed when the viewer can use Messages. */
  requiresMessages?: boolean;
  /** Search synonyms. Never displayed. */
  keywords: readonly string[];
  /**
   * Identity hue, 1 to 8 (--v3-project-n): one fixed colour per app, used
   * as a filled tile everywhere the app is offered, so the apps you can use
   * are the most prominent thing in the launcher.
   */
  identity: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
}>;

export type ConnectedEntry = Readonly<{
  kind: "connected";
  id: "google-drive" | "google-sheets";
  label: string;
  description: string;
  icon: ToolGlyph;
  /** "flag": Drive follows NEXT_PUBLIC_PROJECT_DRIVE_UI. "soon": always Coming soon. */
  state: "flag" | "soon";
  settingsHref?: string;
  keywords: readonly string[];
}>;

export type ToolEntry = Readonly<{
  kind: "tool";
  slug: string;
  name: string;
  oneLiner: string;
  /** Popover line, 26 characters or fewer so it never truncates. */
  shortLine?: string;
  bullets: readonly [string, string, string];
  /** Apps that already help, in order. Messages falls back to Tasks when hidden. */
  untilThen: readonly AppId[];
  /** Identity hue, 1 to 8 (--v3-project-n). */
  identity: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  icon: ToolGlyph;
  keywords: readonly string[];
}>;

export type LauncherEntry = AppEntry | ConnectedEntry | ToolEntry;

export const FEEDBACK_EMAIL = "hello@signalstudio.ie";

/** The launcher's one name: trigger, sidebar row, crumb, page title, dialog. */
export const LAUNCHER_NAME = "Apps and tools";

/** The one status label for anything not built yet. */
export const COMING_SOON_LABEL = "Coming soon";

export const APP_ENTRIES: readonly AppEntry[] = [
  {
    kind: "app",
    id: "tasks",
    identity: 1,
    label: "Tasks",
    href: "/app/tasks",
    icon: "tasks",
    description: "Plan and track work together",
    owns: ["/app/tasks", "/app/task"],
    keywords: ["to do", "todo", "checklist", "board", "list", "jobs"],
  },
  {
    kind: "app",
    id: "timeline",
    identity: 3,
    label: "Timeline",
    href: "/app/timeline",
    icon: "timeline",
    description: "Dates and the run of the day",
    owns: ["/app/timeline"],
    keywords: ["schedule", "roadmap", "calendar", "dates", "run sheet", "milestones"],
  },
  {
    kind: "app",
    id: "notes",
    identity: 5,
    label: "Notes",
    href: "/app/notes",
    icon: "notes",
    description: "Catch a thought before it goes",
    owns: ["/app/notes"],
    keywords: ["note", "memo", "jot", "capture", "ideas", "voice", "dictate"],
  },
  {
    kind: "app",
    id: "files",
    identity: 2,
    label: "Files",
    href: "/app/files",
    icon: "files",
    description: "Every file in one place",
    owns: ["/app/files"],
    keywords: ["attachments", "uploads", "photos", "pdf", "contracts"],
  },
  {
    kind: "app",
    id: "analytics",
    identity: 4,
    label: "Analytics",
    href: "/app/analytics",
    icon: "analytics",
    description: "See how the work is going",
    owns: ["/app/analytics"],
    keywords: ["reports", "charts", "stats", "insights", "numbers", "progress"],
  },
  {
    kind: "app",
    id: "messages",
    identity: 8,
    label: "Messages",
    href: "/app/messages",
    icon: "messages",
    description: "Talk with your team",
    owns: ["/app/messages"],
    requiresMessages: true,
    keywords: ["chat", "conversation", "talk", "dm", "team"],
  },
  {
    kind: "app",
    id: "projects",
    identity: 6,
    label: "Projects",
    href: "/app/project",
    icon: "projects",
    description: "Every project you are part of",
    owns: ["/app/project", "/app/archived"],
    keywords: ["project", "events", "clients", "archive"],
  },
];

export const CONNECTED_ENTRIES: readonly ConnectedEntry[] = [
  {
    kind: "connected",
    id: "google-drive",
    label: "Google Drive",
    description: "Keep Project files in your Drive",
    icon: "drive",
    state: "flag",
    settingsHref: "/app/settings",
    keywords: ["drive", "google", "storage", "folder", "cloud"],
  },
  {
    kind: "connected",
    id: "google-sheets",
    label: "Google Sheets",
    description: "Tables that update from your tasks",
    icon: "sheet",
    state: "soon",
    keywords: ["sheets", "spreadsheet", "excel", "table", "google"],
  },
];

export const TOOL_ENTRIES: readonly ToolEntry[] = [
  {
    kind: "tool",
    slug: "wedding-planner",
    name: "Wedding planner",
    oneLiner: "Guests, suppliers and the day, in order.",
    shortLine: "Guests, suppliers, the day",
    bullets: [
      "Keep the guest list, replies and dietary needs next to the tasks they create",
      "One plan for the day, shared with suppliers",
      "Supplier contacts and deposits due, on your Timeline",
    ],
    untilThen: ["tasks", "timeline"],
    identity: 8,
    icon: "rings",
    keywords: ["wedding", "guest list", "guests", "rsvp", "seating", "supplier", "venue", "marriage"],
  },
  {
    kind: "tool",
    slug: "student-hub",
    name: "Student hub",
    oneLiner: "Deadlines and group work in one place.",
    shortLine: "Deadlines and group work",
    bullets: [
      "Every deadline from every module on one Timeline",
      "Split group work so everyone knows their part",
      "Notes from lectures that turn into tasks",
    ],
    untilThen: ["timeline", "notes"],
    identity: 2,
    icon: "cap",
    keywords: ["student", "school", "college", "university", "assignment", "exam", "study", "module"],
  },
  {
    kind: "tool",
    slug: "teacher-toolkit",
    name: "Teacher toolkit",
    oneLiner: "Lessons, classes and marking, planned.",
    shortLine: "Lessons and classes",
    bullets: [
      "Plan lessons week by week for each class",
      "Keep marking and feedback due dates in view",
      "Share a read-only plan with a colleague",
    ],
    untilThen: ["tasks", "timeline"],
    identity: 4,
    icon: "book",
    keywords: ["teacher", "lesson", "class", "classroom", "marking", "school", "curriculum"],
  },
  {
    kind: "tool",
    slug: "process-map",
    name: "Process map",
    oneLiner: "Draw how work flows, step by step.",
    shortLine: "Map how work flows",
    bullets: [
      "Lay out each step and who does it",
      "Turn any step into a task",
      "Spot the step where work gets stuck",
    ],
    untilThen: ["tasks", "projects"],
    identity: 3,
    icon: "flow",
    keywords: ["process", "flowchart", "flow", "diagram", "workflow", "steps", "procedure"],
  },
  {
    kind: "tool",
    slug: "whiteboard",
    name: "Whiteboard",
    oneLiner: "A shared canvas for rough ideas.",
    shortLine: "A canvas for rough ideas",
    bullets: [
      "Sticky notes, arrows and shapes on an open canvas",
      "Draw together in real time",
      "Turn a sticky note into a task",
    ],
    untilThen: ["notes", "messages"],
    identity: 5,
    icon: "canvas",
    keywords: ["miro", "canvas", "draw", "sketch", "sticky", "brainstorm", "mood board", "mural"],
  },
  {
    kind: "tool",
    slug: "docs",
    name: "Docs",
    oneLiner: "Long writing next to your tasks.",
    shortLine: "Long writing, beside tasks",
    bullets: [
      "Write plans, briefs and minutes in the same place as the work",
      "Link a doc to the tasks it creates",
      "Share a read-only copy",
    ],
    untilThen: ["notes", "files"],
    identity: 1,
    icon: "doc",
    keywords: ["doc", "document", "writing", "wiki", "brief", "minutes", "word"],
  },
  {
    kind: "tool",
    slug: "forms",
    name: "Forms",
    oneLiner: "Answers that arrive as tasks.",
    shortLine: "Answers arrive as tasks",
    bullets: [
      "Build a simple form and share a link",
      "Each answer arrives as a task in your Project",
      "See every answer in one table",
    ],
    untilThen: ["tasks", "analytics"],
    identity: 6,
    icon: "form",
    keywords: ["form", "survey", "questionnaire", "poll", "sign up", "signup", "enquiry"],
  },
];

export function toolBySlug(slug: string): ToolEntry | null {
  return TOOL_ENTRIES.find((tool) => tool.slug === slug) ?? null;
}

export function appById(id: AppId): AppEntry {
  return APP_ENTRIES.find((app) => app.id === id)!;
}

/** The apps a viewer can open, in catalogue order. */
export function visibleApps(messagesEnabled: boolean): AppEntry[] {
  return APP_ENTRIES.filter((app) => !app.requiresMessages || messagesEnabled);
}

/** "Until then" links for a tool. Messages is swapped for Tasks when hidden. */
export function untilThenApps(tool: ToolEntry, messagesEnabled: boolean): AppEntry[] {
  const ids = tool.untilThen.map((id) =>
    id === "messages" && !messagesEnabled ? ("tasks" as const) : id,
  );
  return [...new Set(ids)].map(appById);
}

export type DriveRowState =
  | Readonly<{ status: "setup"; label: string; href: string }>
  | Readonly<{ status: "soon"; label: string }>;

/** What the Drive row says. Reads the build flag only; never "Connected". */
export function driveRowState(flagOn: boolean): DriveRowState {
  return flagOn
    ? { status: "setup", label: "Set up in Settings", href: "/app/settings" }
    : { status: "soon", label: COMING_SOON_LABEL };
}

/** The app that owns a path, for the current-app marker. */
export function currentAppId(pathname: string): AppId | null {
  let best: { id: AppId; length: number } | null = null;
  for (const app of APP_ENTRIES) {
    for (const prefix of app.owns) {
      const owns = pathname === prefix || pathname.startsWith(`${prefix}/`);
      if (owns && (!best || prefix.length > best.length)) best = { id: app.id, length: prefix.length };
    }
  }
  return best?.id ?? null;
}

// ── Search ─────────────────────────────────────────────────────────────

/** Lower case, accents folded, whitespace collapsed (same as Notes search). */
export function normalizeLauncherText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase("en-IE")
    .replace(/\s+/g, " ")
    .trim();
}

export function entryLabel(entry: LauncherEntry): string {
  return entry.kind === "tool" ? entry.name : entry.label;
}

export function entryDescription(entry: LauncherEntry): string {
  return entry.kind === "tool" ? entry.oneLiner : entry.description;
}

export function entryKey(entry: LauncherEntry): string {
  return entry.kind === "tool" ? `tool:${entry.slug}` : `${entry.kind}:${entry.id}`;
}

/**
 * Rank entries for a query. Lower is better:
 * 0 label starts with the query, 1 a word in the label starts with it,
 * 2 a keyword or synonym matches, 3 the description contains it.
 * Ties keep catalogue order. No match, no entry.
 */
export function rankLauncher<T extends LauncherEntry>(query: string, entries: readonly T[]): T[] {
  const needle = normalizeLauncherText(query);
  if (!needle) return [...entries];
  const scored: Array<{ entry: T; score: number; index: number }> = [];
  entries.forEach((entry, index) => {
    const label = normalizeLauncherText(entryLabel(entry));
    let score: number | null = null;
    if (label.startsWith(needle)) score = 0;
    else if (label.split(" ").some((word) => word.startsWith(needle))) score = 1;
    else if (
      entry.keywords.some((keyword) => {
        const normal = normalizeLauncherText(keyword);
        return normal.startsWith(needle) || normal.split(" ").some((word) => word.startsWith(needle));
      })
    ) {
      score = 2;
    } else if (needle.length >= 3 && normalizeLauncherText(entryDescription(entry)).includes(needle)) {
      score = 3;
    }
    if (score !== null) scored.push({ entry, score, index });
  });
  return scored
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((item) => item.entry);
}

// ── Feedback mail ──────────────────────────────────────────────────────

const MAX_QUERY_IN_SUBJECT = 60;

/** Zero-result link: the typed query, and nothing about the viewer. */
export function toolRequestHref(query: string): string {
  const trimmed = query.trim().slice(0, MAX_QUERY_IN_SUBJECT);
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(`Tool request: ${trimmed}`)}`;
}

/** The general "Missing something?" link. */
export function feedbackHref(): string {
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent("Tool request")}&body=${encodeURIComponent("What would you use it for?")}`;
}

/** The placeholder page's primary action. */
export function toolIdeasHref(tool: ToolEntry): string {
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(`${tool.name} ideas`)}&body=${encodeURIComponent("What would you use it for?")}`;
}
