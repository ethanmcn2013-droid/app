/**
 * A busy Project, for judging Files and Analytics with real volume. Review
 * mode has eight sample files and thirteen tasks, so this fixture stands in
 * for a full account in the unit tests and in the rendered review harness
 * (`experience/files-analytics/`). It is never imported by product code.
 *
 * Everything is fixed, nothing random: forty-two files across fourteen tasks
 * from four people (one of whom has left), and a board of sixty-odd tasks
 * with late work, unassigned work, a busy week and six months of history.
 */

import type { ProjectFile, ProjectFileKind, ProjectFilesRead } from "@/lib/projects/project-files";
import type { AnalyticsColumn, AnalyticsInput, AnalyticsTask } from "@/lib/projects/project-analytics";
import type { ProjectStanding } from "@/lib/projects/project-analytics-questions";

/** Monday 5 October 2026, 11:00 in Dublin. */
export const FIXTURE_NOW_MS = Date.parse("2026-10-05T10:00:00.000Z");
export const FIXTURE_NOW_SECONDS = Math.floor(FIXTURE_NOW_MS / 1000);
export const FIXTURE_TIME_ZONE = "Europe/Dublin";

const HOUR = 3600;
const DAY_MS = 86_400_000;

const TASKS: ReadonlyArray<readonly [string, string]> = [
  ["t-seating", "Draft the seating plan"],
  ["t-marquee", "Confirm the marquee with Lawlor Hire"],
  ["t-menu", "Agree the menu with the caterer"],
  ["t-florist", "Chase the florist for the final quote"],
  ["t-coach", "Book the guest coach from Kinsale"],
  ["t-sign", "Reprint the faded welcome sign"],
  ["t-band", "Send the band the running order"],
  ["t-photos", "Shot list for the photographer"],
  ["t-licence", "Renew the bar licence"],
  ["t-rota", "Staff rota for Saturday"],
  ["t-deposit", "Reconcile the deposits"],
  ["t-insurance", "Send the insurer the event details"],
  ["t-cake", "Collect the cake on Friday"],
  ["t-wetplan", "Wet weather plan for the ceremony"],
];

type Seed = readonly [title: string, kind: ProjectFileKind, storage: ProjectFile["storage"], size: number | null, task: number, hoursAgo: number, by: string | null];

const FILE_SEEDS: readonly Seed[] = [
  ["Seating plan v4", "sheet", "google_drive", null, 0, 5, "Aoife Brennan"],
  ["Marquee layout, clear sides.pdf", "document", "signal", 612_000, 1, 9, "Orla Byrne"],
  ["Terrace at golden hour.jpg", "image", "signal", 2_400_000, 7, 20, "Tom Reilly"],
  ["Menu, tasting notes", "document", "google_drive", null, 2, 26, "Aoife Brennan"],
  ["Florist quote, revised.pdf", "document", "signal", 188_000, 3, 30, "Orla Byrne"],
  ["Coach timetable", "sheet", "google_drive", null, 4, 44, null],
  ["Welcome sign artwork.png", "image", "signal", 1_150_000, 5, 52, "Tom Reilly"],
  ["Running order, Saturday v3.pdf", "document", "signal", 412_000, 6, 70, "Orla Byrne"],
  ["Lawlor Hire, confirmation.pdf", "document", "signal", 96_000, 1, 94, "Orla Byrne"],
  ["Shot list", "document", "google_drive", null, 7, 118, "Tom Reilly"],
  ["Bar licence renewal form.pdf", "document", "signal", 240_000, 8, 140, "FORMER"],
  ["Staff rota, w/c 28 Sep", "sheet", "google_drive", null, 9, 160, "Aoife Brennan"],
  ["Seating plan v3", "sheet", "google_drive", null, 0, 190, "Aoife Brennan"],
  ["Deposit list export.csv", "sheet", "signal", 38_000, 10, 214, "Orla Byrne"],
  ["Insurer checklist", "link", "link", null, 11, 236, "Orla Byrne"],
  ["Long barn, east wall.jpg", "image", "signal", 3_100_000, 7, 260, "Tom Reilly"],
  ["Cake design, final.png", "image", "signal", 880_000, 12, 284, "Aoife Brennan"],
  ["Wet weather plan.docx", "document", "signal", 74_000, 13, 300, "Orla Byrne"],
  ["Recommended suppliers", "link", "link", null, 3, 330, "FORMER"],
  ["Marquee quote, Hireco.pdf", "document", "signal", 188_000, 1, 360, "Orla Byrne"],
  ["Menu costings", "sheet", "google_drive", null, 2, 400, "Aoife Brennan"],
  ["Ceremony mood board", "design", "link", null, 13, 430, "Tom Reilly"],
  ["Orchard at dusk.jpg", "image", "signal", 2_750_000, 7, 470, "Tom Reilly"],
  ["Coach quote, Kinsale Coaches.pdf", "document", "signal", 132_000, 4, 500, null],
  ["Band rider.pdf", "document", "signal", 58_000, 6, 540, "Orla Byrne"],
  ["Seating plan v2", "sheet", "google_drive", null, 0, 580, "Aoife Brennan"],
  ["Table numbers artwork.png", "image", "signal", 640_000, 5, 620, "Tom Reilly"],
  ["Insurance schedule 2026.pdf", "document", "signal", 310_000, 11, 660, "Orla Byrne"],
  ["Rota template", "sheet", "google_drive", null, 9, 700, "Aoife Brennan"],
  ["Venue floor plan, long barn and the orchard marquee with the service corridor marked.pdf", "document", "signal", 1_900_000, 1, 760, "Orla Byrne"],
  ["Florist brief", "document", "google_drive", null, 3, 820, "Aoife Brennan"],
  ["Launch deck, winter season", "slides", "google_drive", null, 12, 880, "Aoife Brennan"],
  ["Deposit invoice, Mara & Finn.pdf", "document", "signal", 96_000, 10, 940, "Orla Byrne"],
  ["Signage sizes", "sheet", "google_drive", null, 5, 1000, "Tom Reilly"],
  ["Photographer contract.pdf", "document", "signal", 204_000, 7, 1080, "FORMER"],
  ["Cake tasting photo.jpg", "image", "signal", 1_480_000, 12, 1160, "Aoife Brennan"],
  ["Coach pick-up map", "link", "link", null, 4, 1240, "Orla Byrne"],
  ["Menu, dietary list", "sheet", "google_drive", null, 2, 1320, "Aoife Brennan"],
  ["Wet weather, marquee heaters quote.pdf", "document", "signal", 86_000, 13, 1400, "Orla Byrne"],
  ["Booking form repo", "code", "link", null, 10, 1480, "Tom Reilly"],
  ["Licence, premises plan.pdf", "document", "signal", 520_000, 8, 1560, "Orla Byrne"],
  ["Upload still on its way.pdf", "document", "signal", 1_000_000, 6, 2, "Orla Byrne"],
];

const LINK_HOSTS = ["https://www.notion.so/insurer-checklist", "https://suppliers.example/recommended", "https://www.figma.com/file/abc", "https://maps.example/coach", "https://github.com/example/booking-form"];

export function filesFixture(): ProjectFile[] {
  let links = 0;
  return FILE_SEEDS.map(([title, kind, storage, size, taskIndex, hoursAgo, by], index): ProjectFile => {
    const [taskId, taskTitle] = TASKS[taskIndex]!;
    const pending = title.startsWith("Upload still");
    const href =
      storage === "signal"
        ? pending
          ? null
          : `/api/attachments/fx-${index}`
        : storage === "google_drive"
          ? `https://docs.google.com/document/d/fx-${index}`
          : LINK_HOSTS[links++ % LINK_HOSTS.length]!;
    return {
      id: `fx-file-${index}`,
      title,
      kind,
      storage,
      href,
      external: storage !== "signal",
      mimeType: kind === "image" ? (title.endsWith(".png") ? "image/png" : "image/jpeg") : storage === "signal" ? "application/pdf" : null,
      sizeBytes: size,
      taskId,
      taskTitle,
      taskArchived: false,
      addedByName: by === "FORMER" ? null : by,
      addedByFormer: by === "FORMER",
      addedAt: FIXTURE_NOW_SECONDS - hoursAgo * HOUR,
    };
  }).sort((a, b) => b.addedAt - a.addedAt);
}

export function filesReadFixture(over: Partial<ProjectFilesRead> = {}): ProjectFilesRead {
  return { files: filesFixture(), truncated: false, includesArchived: false, readAt: FIXTURE_NOW_SECONDS, ...over };
}

// ── Analytics ──────────────────────────────────────────────────────────────

export const ANALYTICS_FIXTURE_COLUMNS: readonly AnalyticsColumn[] = [
  { key: "todo", name: "To do", isDone: false, tone: "neutral" },
  { key: "doing", name: "In progress", isDone: false, tone: "progress" },
  { key: "waiting", name: "Waiting", isDone: false, tone: "neutral" },
  { key: "review", name: "To check", isDone: false, tone: "review" },
  { key: "done", name: "Done", isDone: true, tone: "done" },
];

export const ANALYTICS_FIXTURE_PEOPLE = [
  { id: "u-orla", name: "Orla Byrne" },
  { id: "u-aoife", name: "Aoife Brennan" },
  { id: "u-tom", name: "Tom Reilly" },
];

export const ANALYTICS_FIXTURE_STANDING: ProjectStanding = { status: "at-risk", targetDate: "2026-10-17" };

function at(daysFromNow: number, hour = 12): number {
  return FIXTURE_NOW_MS + daysFromNow * DAY_MS + (hour - 11) * 3_600_000;
}

export function analyticsTasksFixture(): AnalyticsTask[] {
  const out: AnalyticsTask[] = [];
  const open = (
    id: string,
    title: string,
    columnKey: string,
    dueIn: number | null,
    assigneeIds: string[],
    priority: AnalyticsTask["priority"] = "p2",
    addedDaysAgo = 12,
  ) =>
    out.push({ id, title, columnKey, done: false, archived: false, priority, assigneeIds, createdAt: at(-addedDaysAgo), completedAt: null, dueAt: dueIn == null ? null : at(dueIn) });

  // Late: four, the oldest by twelve days, one with nobody on it, one with someone who has left.
  open("a-price", "Agree the winter price list", "doing", -12, ["u-aoife"], "p0", 30);
  open("a-sign", "Reprint the faded welcome sign", "todo", -3, ["u-tom", "u-orla"], "p1", 9);
  open("a-florist", "Chase the florist for the final quote", "waiting", -2, [], "p1", 14);
  open("a-licence", "Renew the bar licence", "todo", -1, ["u-gone"], "p2", 20);
  // Due soon and later.
  open("a-seating", "Approve the seating plan", "review", 0, ["u-orla"], "p1", 6);
  open("a-menu", "Agree the menu with the caterer", "doing", 1, ["u-aoife"], "p1", 8);
  open("a-coach", "Book the guest coach from Kinsale", "todo", 2, ["u-orla"], "p2", 5);
  open("a-band", "Send the band the running order", "todo", 2, ["u-orla"], "p2", 4);
  open("a-rota", "Staff rota for Saturday", "doing", 4, ["u-aoife"], "p2", 3);
  open("a-cake", "Collect the cake on Friday", "todo", 4, ["u-tom"], "p3", 2);
  open("a-wet", "Wet weather plan for the ceremony", "waiting", 6, ["u-orla"], "p1", 11);
  open("a-photo", "Shot list for the photographer", "todo", 9, ["u-tom"], "p2", 7);
  open("a-insure", "Send the insurer the event details", "todo", 11, ["u-orla"], "p2", 10);
  open("a-thanks", "Draft the thank-you notes", "todo", 20, ["u-orla"], "p3", 1);
  open("a-nodate-1", "Tidy the shared drive", "todo", null, [], "p3", 40);
  open("a-nodate-2", "Review supplier list for next season", "todo", null, ["u-orla"], "p3", 25);
  open("a-nodate-3", "Ask Mara about the first dance", "waiting", null, ["u-aoife"], "p2", 3);

  // Finished: a busy last week, a quieter one before, and six months behind them.
  const finishedDays = [0, 0, 1, 1, 1, 2, 3, 3, 4, 5, 6, 6, 7, 8, 9, 11, 12, 13];
  const titles = [
    "Confirm the marquee with Lawlor Hire", "Send the save-the-dates", "Pay the band deposit", "Order the table linen", "Walk the venue with Mara",
    "Book the registrar", "Agree the bar order", "Print the place cards", "Confirm the cake flavours", "Send invitations",
    "Brief the photographer", "Order the welcome drinks", "Book the hair and make-up", "Reserve the guest rooms", "Agree the ceremony music",
    "Choose the flowers", "Sign the venue contract", "Set the guest list",
  ];
  finishedDays.forEach((daysAgo, index) => {
    const completedAt = at(-daysAgo, 9 + (index % 6));
    const took = [0.5, 2, 4, 1.5, 6, 3, 9, 2.5, 13, 5][index % 10]!;
    const dueOffset = [1, 0, null, 2, -1, 0, null, 3][index % 8];
    out.push({
      id: `a-done-${index}`,
      title: titles[index]!,
      columnKey: "done",
      done: true,
      archived: false,
      priority: "p2",
      assigneeIds: [["u-orla"], ["u-aoife"], ["u-tom"]][index % 3]!,
      createdAt: completedAt - took * DAY_MS,
      completedAt,
      dueAt: dueOffset == null ? null : completedAt + dueOffset * DAY_MS,
    });
  });
  const perWeek = [3, 5, 2, 4, 6, 3, 2, 4, 1, 3, 2, 2, 3, 1, 2, 2, 1, 3, 2, 1, 1, 2, 1, 2];
  let n = 0;
  perWeek.forEach((count, weekIndex) => {
    for (let slot = 0; slot < count; slot += 1) {
      const completedAt = at(-(14 + weekIndex * 7 + ((slot * 2 + weekIndex) % 7)), 10 + (n % 5));
      const took = [1, 3, 0.4, 7, 2, 16, 5, 30, 2.2][n % 9]!;
      const dueOffset = [2, null, 0, -3, 1, null][n % 6];
      out.push({
        id: `a-old-${n}`,
        title: "Earlier task",
        columnKey: "done",
        done: true,
        archived: true,
        priority: "p2",
        assigneeIds: [["u-orla"], ["u-aoife"]][n % 2]!,
        createdAt: completedAt - took * DAY_MS,
        completedAt,
        dueAt: dueOffset == null ? null : completedAt + dueOffset * DAY_MS,
      });
      n += 1;
    }
  });
  return out;
}

export function analyticsInputFixture(over: Partial<AnalyticsInput> = {}): AnalyticsInput {
  return {
    tasks: analyticsTasksFixture(),
    columns: ANALYTICS_FIXTURE_COLUMNS,
    people: ANALYTICS_FIXTURE_PEOPLE,
    now: FIXTURE_NOW_MS,
    timeZone: FIXTURE_TIME_ZONE,
    range: "12w",
    dueChanges: DUE_CHANGES_FIXTURE,
    ...over,
  };
}

/** The founder's own account, near enough: one project, nine tasks, little history. */
export function sparseAnalyticsInput(): AnalyticsInput {
  const mk = (id: string, title: string, done: boolean, dueIn: number | null, completedDaysAgo: number | null): AnalyticsTask => ({
    id,
    title,
    columnKey: done ? "done" : "todo",
    done,
    archived: false,
    priority: "p2",
    assigneeIds: [],
    createdAt: at(-4),
    completedAt: completedDaysAgo == null ? null : at(-completedDaysAgo),
    dueAt: dueIn == null ? null : at(dueIn),
  });
  return {
    tasks: [
      mk("s-1", "Test task one", false, null, null),
      mk("s-2", "Test task two", false, null, null),
      mk("s-3", "Try the board", false, 3, null),
      mk("s-4", "Invite someone", false, null, null),
      mk("s-5", "Add a due date", false, -1, null),
      mk("s-6", "Test task six", false, null, null),
      mk("s-7", "Test task seven", false, null, null),
      mk("s-8", "First finished task", true, null, 2),
      mk("s-9", "Second finished task", true, null, 1),
    ],
    columns: ANALYTICS_FIXTURE_COLUMNS,
    people: [{ id: "u-ethan", name: "Ethan" }],
    now: FIXTURE_NOW_MS,
    timeZone: FIXTURE_TIME_ZONE,
    range: "12w",
    dueChanges: ["s-5", "s-3"],
  };
}

// ── Recorded date changes, and the same tasks spread over four projects ────

/** One entry per recorded change to a due date in the last 12 weeks. */
export const DUE_CHANGES_FIXTURE: readonly string[] = [
  "a-price", "a-price", "a-price", "a-price",
  "a-florist", "a-florist", "a-florist",
  "a-done-3", "a-done-3",
  "a-seating", "a-menu", "a-coach", "a-wet", "a-rota",
];

const PORTFOLIO_PROJECTS = [
  { id: "p-mara", name: "Mara & Finn’s wedding", role: "member", status: "at-risk", targetDate: "2026-10-17", lead: { name: "Aoife Brennan", initials: "AB" }, big: { title: "Menu tasting", date: "2026-10-06" } },
  { id: "p-winter", name: "Winter season launch", role: "owner", status: "on-track", targetDate: "2026-09-28", lead: { name: "Seán Kavanagh", initials: "SK" }, big: null },
  { id: "p-barn", name: "Barn roof and heating works", role: "primary-owner", status: "on-track", targetDate: "2026-11-06", lead: { name: "Orla Byrne", initials: "OB" }, big: { title: "Slates delivered", date: "2026-10-20" } },
  { id: "p-keane", name: "Keane Legal retreat", role: "primary-owner", status: null, targetDate: null, lead: { name: "Orla Byrne", initials: "OB" }, big: null },
] as const;

const OPEN_HOME: Readonly<Record<string, number>> = {
  "a-price": 1, "a-licence": 2, "a-rota": 2, "a-insure": 2, "a-thanks": 3, "a-nodate-1": 3, "a-nodate-2": 1,
};

function homeOf(task: AnalyticsTask, index: number): number {
  if (!task.done) return OPEN_HOME[task.id] ?? 0;
  return [0, 0, 1, 0, 2, 0, 3][index % 7]!;
}

/**
 * Four projects made of the busy fixture's own tasks, so the wall, the
 * header line and every answer count the same work: what "All projects"
 * looks like for someone who runs several.
 */
export function portfolioFixture(): {
  input: AnalyticsInput;
  today: string;
  projects: Array<{
    id: string;
    name: string;
    role: "member" | "owner" | "primary-owner";
    selectable: boolean;
    blockedReason: null;
    openCount: number;
    stats: { status: "at-risk" | "on-track" | null; targetDate: string | null; purpose: null; total: number; complete: number; overdue: number };
    facts: {
      lead: { name: string; initials: string };
      nextDate: { title: string; date: string } | null;
      oldestLate: { id: string; title: string; dueDate: string } | null;
      nudge: null;
      doneByDay: number[];
    };
  }>;
} {
  const base = analyticsTasksFixture();
  const homes = base.map((task, index) => homeOf(task, index));
  const tasks = base.map((task, index) => ({ ...task, project: PORTFOLIO_PROJECTS[homes[index]!]!.name }));
  const today = "2026-10-05";
  const dayOf = (ms: number) => new Date(ms + 3_600_000).toISOString().slice(0, 10); // Dublin is UTC+1 in early October
  const projects = PORTFOLIO_PROJECTS.map((project, home) => {
    const mine = base.filter((_, index) => homes[index] === home);
    const live = mine.filter((task) => !task.archived);
    const late = live
      .filter((task) => !task.done && task.dueAt != null && dayOf(task.dueAt) < today)
      .sort((a, b) => a.dueAt! - b.dueAt!);
    const doneByDay = Array.from({ length: 14 }, () => 0);
    for (const task of mine) {
      if (!task.done || task.completedAt == null) continue;
      const ago = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dayOf(task.completedAt)}T00:00:00Z`)) / DAY_MS);
      if (ago >= 0 && ago < 14) doneByDay[13 - ago]! += 1;
    }
    const complete = live.filter((task) => task.done).length;
    return {
      id: project.id,
      name: project.name,
      role: project.role,
      selectable: true,
      blockedReason: null,
      openCount: live.length - complete,
      stats: { status: project.status, targetDate: project.targetDate, purpose: null, total: live.length, complete, overdue: late.length },
      facts: {
        lead: project.lead,
        nextDate: project.big,
        oldestLate: late[0] ? { id: late[0].id, title: late[0].title, dueDate: dayOf(late[0].dueAt!) } : null,
        nudge: null,
        doneByDay,
      },
    };
  });
  return {
    input: { ...analyticsInputFixture(), tasks, dueChanges: DUE_CHANGES_FIXTURE },
    today,
    projects,
  };
}
