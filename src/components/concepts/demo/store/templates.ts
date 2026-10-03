/**
 * Project templates: what a new project starts with. `seedProject` turns a
 * template, a name and a date into a real project and real starter tasks,
 * with owners from the team and due dates counted back from the day.
 *
 * Server-safe and pure: the client store's `addProject` calls it.
 */

import { TODAY, addDays, daysBetween } from "./dates";
import type { IsoDate, Priority, Project, ProjectKind, Room, Task, TeamPersonId, Workstream } from "./types";

export type TemplateId = "wedding" | "party" | "corporate" | "works" | "school" | "campaign";

/** Who on the team does a kind of work. "lead" is the project's lead. */
type Role = "lead" | "owner" | "coordinator" | "kitchen" | "venue" | "front" | "ops" | "marketing";

const ROLE: Record<Exclude<Role, "lead">, TeamPersonId> = {
  owner: "orla",
  coordinator: "aoife",
  kitchen: "dev",
  venue: "tomas",
  front: "niamh",
  ops: "dara",
  marketing: "siobhan",
};

export type TemplateTask = {
  title: string;
  ws: string;
  role: Role;
  /** Days from the project's date: -14 is two weeks before, 3 is three days after. */
  offset: number;
  /** Minutes. */
  estimate: number;
  priority?: Priority;
  room?: Room;
};

export type ProjectTemplate = {
  id: TemplateId;
  name: string;
  kind: ProjectKind;
  blurb: string;
  workstreams: Workstream[];
  tasks: TemplateTask[];
};

const t = (title: string, ws: string, role: Role, offset: number, estimate: number, extra: Partial<TemplateTask> = {}): TemplateTask => ({
  title,
  ws,
  role,
  offset,
  estimate,
  ...extra,
});

export const TEMPLATES: readonly ProjectTemplate[] = [
  {
    id: "wedding",
    name: "Wedding",
    kind: "wedding",
    blurb: "Run sheet, suppliers, seating",
    workstreams: [
      { id: "food", name: "Food and drink" },
      { id: "venue", name: "Venue and hire" },
      { id: "guests", name: "Guests and seating" },
      { id: "suppliers", name: "Suppliers" },
      { id: "admin", name: "Admin" },
    ],
    tasks: [
      t("Send the contract and deposit invoice", "admin", "owner", -180, 30, { priority: "high" }),
      t("First planning call with the couple", "admin", "coordinator", -150, 60),
      t("Book the florist", "suppliers", "coordinator", -120, 30),
      t("Book the band", "suppliers", "ops", -120, 30),
      t("Menu tasting with the couple", "food", "kitchen", -60, 120),
      t("Collect RSVPs and dietary needs", "guests", "coordinator", -30, 60),
      t("Draft the seating plan", "guests", "coordinator", -21, 90, { room: "Long barn" }),
      t("Confirm the marquee and the wet-weather plan", "venue", "venue", -14, 60, { room: "Orchard marquee" }),
      t("Final numbers to the kitchen", "food", "coordinator", -7, 30, { priority: "urgent" }),
      t("Build the run-sheet for the day", "admin", "coordinator", -7, 120, { priority: "high" }),
      t("Brief the whole team on the day", "admin", "lead", -1, 60, { priority: "high" }),
      t("Send the couple a thank-you card", "guests", "coordinator", 4, 15),
    ],
  },
  {
    id: "party",
    name: "Private party",
    kind: "event",
    blurb: "Menu, music, guest list",
    workstreams: [
      { id: "guests", name: "Guests" },
      { id: "food", name: "Food" },
      { id: "music", name: "Music" },
      { id: "room", name: "Room" },
    ],
    tasks: [
      t("Agree the quote with the host", "guests", "owner", -60, 30, { priority: "high" }),
      t("Guest list from the host", "guests", "coordinator", -35, 30),
      t("Send the invitations", "guests", "lead", -28, 30),
      t("Menu choices to the kitchen", "food", "kitchen", -21, 60),
      t("Book the music", "music", "ops", -21, 30),
      t("Agree the bar tab", "food", "ops", -14, 15),
      t("Final numbers to the kitchen", "food", "coordinator", -5, 30, { priority: "high" }),
      t("Dress the room", "room", "venue", -1, 120, { room: "Long barn" }),
    ],
  },
  {
    id: "corporate",
    name: "Corporate day",
    kind: "event",
    blurb: "Headcount, AV, agenda",
    workstreams: [
      { id: "plan", name: "Plan" },
      { id: "av", name: "AV" },
      { id: "food", name: "Food" },
    ],
    tasks: [
      t("Contract and deposit", "plan", "owner", -60, 30, { priority: "high" }),
      t("Two AV quotes", "av", "venue", -28, 60),
      t("Book rooms in town for overnight guests", "plan", "front", -21, 30),
      t("Headcount from the client", "plan", "lead", -21, 15, { priority: "high" }),
      t("Agenda and room plan", "plan", "lead", -14, 60, { room: "Orchard hall" }),
      t("Lunch and break menus", "food", "kitchen", -14, 60),
      t("Test the projector and the mics", "av", "venue", -1, 60, { room: "Orchard hall" }),
      t("Send the final invoice", "plan", "owner", 3, 30),
    ],
  },
  {
    id: "works",
    name: "Venue works",
    kind: "works",
    blurb: "Quotes, contractor, sign-off",
    workstreams: [
      { id: "quotes", name: "Quotes" },
      { id: "works", name: "Works" },
      { id: "signoff", name: "Sign-off" },
    ],
    tasks: [
      t("Get three quotes", "quotes", "venue", -45, 60, { priority: "high" }),
      t("Pick the contractor", "quotes", "lead", -35, 30),
      t("Tell the bookings it affects", "works", "ops", -30, 30),
      t("Check the contractor's insurance", "works", "venue", -28, 15),
      t("Site meeting with the contractor", "works", "venue", -21, 90),
      t("Snag list and sign-off", "signoff", "lead", 0, 90),
    ],
  },
  {
    id: "school",
    name: "School event",
    kind: "event",
    blurb: "Risk assessment, letters",
    workstreams: [
      { id: "plan", name: "Plan" },
      { id: "letters", name: "Letters" },
      { id: "day", name: "The day" },
    ],
    tasks: [
      t("Risk assessment", "plan", "ops", -30, 90, { priority: "high" }),
      t("Letters home to parents", "letters", "lead", -21, 60),
      t("Check vetting for every volunteer", "plan", "owner", -14, 30),
      t("Collect the consent forms", "letters", "front", -10, 30),
      t("Allergy list to the kitchen", "day", "kitchen", -7, 30),
      t("Set out the walled garden trail", "day", "venue", -1, 120, { room: "Walled garden" }),
    ],
  },
  {
    id: "campaign",
    name: "Marketing campaign",
    kind: "marketing",
    blurb: "Plan, shoot, launch",
    workstreams: [
      { id: "plan", name: "Plan" },
      { id: "shoot", name: "Shoot" },
      { id: "launch", name: "Launch" },
    ],
    tasks: [
      t("Agree the campaign plan", "plan", "lead", -42, 60, { priority: "high" }),
      t("Write the shot list", "shoot", "marketing", -30, 60),
      t("Book the photographer", "shoot", "marketing", -28, 30),
      t("Write the copy", "plan", "marketing", -14, 120),
      t("Schedule the social posts", "launch", "marketing", -5, 60),
      t("Launch day check", "launch", "lead", 0, 30),
    ],
  },
];

/** A template by id. Accepts the projects page's "tpl-wedding" ids too. */
export function templateById(id: string): ProjectTemplate | undefined {
  const bare = id.replace(/^tpl-/, "");
  return TEMPLATES.find((x) => x.id === bare);
}

export type NewProject = {
  name: string;
  /** The day itself, or when it is due. */
  date: IsoDate;
  /** A template id ("wedding", or "tpl-wedding"). Without one, the project starts empty. */
  template?: string;
  lead?: TeamPersonId;
  short?: string;
  hue?: number;
  note?: string;
  kind?: ProjectKind;
  end?: IsoDate;
};

/** Hues a new project may take: never amber, orange or red (5 to 7). */
const SAFE_HUES = [1, 2, 3, 4, 8, 9];

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "project"
  );
}

function unique(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/**
 * Due date for a template task. When the project is too close for the
 * template's full lead time, the before-the-day offsets are squeezed into the
 * days that are left, in order, so nothing starts life late.
 */
function dueFor(offset: number, date: IsoDate, span: number, today: IsoDate): IsoDate {
  if (offset >= 0) return addDays(date, offset);
  const room = daysBetween(today, date);
  if (room >= span) return addDays(date, offset);
  return addDays(date, Math.round((offset * Math.max(0, room)) / span));
}

/**
 * Build a project and its starter tasks from a template. Pure: the caller
 * passes the projects and tasks that exist, so ids and prefixes stay unique.
 */
export function seedProject(
  input: NewProject,
  existing: { projects: readonly Project[]; tasks: readonly Task[] },
  viewer: TeamPersonId,
  today: IsoDate = TODAY,
): { project: Project; tasks: Task[] } {
  const tpl = input.template ? templateById(input.template) : undefined;
  const lead = input.lead ?? viewer;
  const id = unique(slug(input.name), new Set(existing.projects.map((p) => p.id)));
  const words = slug(input.name).split("-").filter((w) => w && w !== "and" && w !== "the");
  const prefixBase = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "np").slice(0, 2)) || "np";
  const prefix = unique(prefixBase, new Set(existing.projects.map((p) => p.prefix)));
  const usedHues = existing.projects.filter((p) => !p.wrapped).map((p) => p.hue);
  const hue = input.hue ?? SAFE_HUES.reduce((best, h) => (usedHues.filter((x) => x === h).length < usedHues.filter((x) => x === best).length ? h : best), SAFE_HUES[0]);

  const span = Math.max(1, ...(tpl?.tasks ?? []).map((x) => -x.offset));
  const tasks: Task[] = (tpl?.tasks ?? []).map((x, i) => {
    const owner = x.role === "lead" ? lead : ROLE[x.role];
    const task: Task = {
      id: `${prefix}-${i + 1}`,
      title: x.title,
      project: id as Project["id"],
      workstream: x.ws,
      status: "todo",
      owner,
      due: dueFor(x.offset, input.date, span, today),
      created: today,
      since: today,
      priority: x.priority ?? "none",
      estimate: x.estimate,
    };
    if (x.offset > 0) task.afterEvent = true;
    if (x.room) task.room = x.room;
    return task;
  });

  const people = [...new Set<TeamPersonId>([lead, viewer, ...tasks.map((x) => x.owner)])];
  const project: Project = {
    id: id as Project["id"],
    name: input.name,
    short: input.short ?? input.name,
    hue,
    date: input.date,
    start: today,
    health: "on_track",
    lead,
    people,
    kind: input.kind ?? tpl?.kind ?? "event",
    note: input.note ?? (tpl ? `New ${tpl.name.toLowerCase()}, ${tasks.length} starter tasks` : "New project"),
    milestones: [{ id: `${prefix}-m1`, title: input.name, date: input.date, done: false }],
    workstreams: tpl?.workstreams.map((w) => ({ ...w })) ?? [{ id: "plan", name: "Plan" }],
    prefix,
    canon: false,
    tooEarly: true,
  };
  if (input.end) project.end = input.end;
  if (tpl) project.template = tpl.id;
  return { project, tasks };
}
