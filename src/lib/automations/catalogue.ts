/**
 * Automations: the steps a person can place, and the starters they can open.
 *
 * Every step is named for something Signal Studio already has (tasks, dates,
 * people, nudges, files, the project chat, the daily briefing). Nothing here
 * runs: there is no service behind Automations yet, so this file is words and
 * shapes only. Pure, no React, no browser.
 */

export type StepKind = "trigger" | "action" | "branch";

export type StepIcon =
  | "taskNew"
  | "late"
  | "done"
  | "calendar"
  | "person"
  | "file"
  | "nudge"
  | "assign"
  | "column"
  | "due"
  | "tag"
  | "chat"
  | "briefing"
  | "followUp"
  | "split";

export type StepField =
  | Readonly<{ id: string; label: string; kind: "choice"; options: readonly string[] }>
  | Readonly<{ id: string; label: string; kind: "text"; placeholder: string; max: number }>;

export type StepType = Readonly<{
  id: string;
  kind: StepKind;
  title: string;
  icon: StepIcon;
  /** Extra words the picker's search also matches. */
  find: string;
  fields: readonly StepField[];
  defaults: Readonly<Record<string, string>>;
  /** Branch only: the paths it starts with. */
  conditions?: readonly string[];
  /** The line under the title, written from the choices made. */
  summary: (values: Readonly<Record<string, string>>) => string;
}>;

export const KIND_LABEL: Readonly<Record<StepKind, string>> = {
  trigger: "Trigger",
  action: "Action",
  branch: "Branch",
};

/** Section headings in the picker. */
export const KIND_GROUP: Readonly<Record<StepKind, string>> = {
  trigger: "Starts when",
  action: "Then do",
  branch: "Split the path",
};

export const KIND_ORDER: readonly StepKind[] = ["trigger", "action", "branch"];

const choice = (id: string, label: string, options: readonly string[]): StepField => ({ id, label, kind: "choice", options });
const text = (id: string, label: string, placeholder: string, max = 80): StepField => ({ id, label, kind: "text", placeholder, max });
const lower = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);

export const STEP_TYPES: readonly StepType[] = [
  // ── Triggers ─────────────────────────────────────────────────────────
  {
    id: "task-created",
    kind: "trigger",
    title: "A task is created",
    icon: "taskNew",
    find: "new add start",
    fields: [choice("by", "Created by", ["Anyone", "Me", "Someone else"])],
    defaults: { by: "Anyone" },
    summary: (v) => `When ${lower(v.by || "Anyone")} adds a task`,
  },
  {
    id: "task-late",
    kind: "trigger",
    title: "A task becomes late",
    icon: "late",
    find: "overdue past date missed",
    fields: [choice("after", "How late", ["As soon as its date passes", "1 day late", "3 days late", "A week late"])],
    defaults: { after: "As soon as its date passes" },
    summary: (v) => (v.after && v.after !== "As soon as its date passes" ? `Once it is ${lower(v.after)}` : "As soon as its date passes"),
  },
  {
    id: "task-done",
    kind: "trigger",
    title: "A task moves to Done",
    icon: "done",
    find: "finished complete closed",
    fields: [choice("which", "Which tasks", ["Any task", "Tasks with a date", "Big dates only"])],
    defaults: { which: "Any task" },
    summary: (v) => (v.which === "Tasks with a date" ? "When a task with a date is finished" : v.which === "Big dates only" ? "When a big date is finished" : "When any task is finished"),
  },
  {
    id: "date-week-away",
    kind: "trigger",
    title: "A date is a week away",
    icon: "calendar",
    find: "reminder upcoming seven days before",
    fields: [choice("which", "Which dates", ["Any task date", "Big dates only", "The project's target date"])],
    defaults: { which: "Any task date" },
    summary: (v) => `Seven days before ${lower(v.which || "Any task date")}`.replace("big dates only", "a big date"),
  },
  {
    id: "person-joins",
    kind: "trigger",
    title: "Someone joins a project",
    icon: "person",
    find: "invite new member people welcome",
    fields: [choice("who", "Who", ["Anyone", "Someone I invited"])],
    defaults: { who: "Anyone" },
    summary: (v) => (v.who === "Someone I invited" ? "When someone I invited accepts" : "When anyone accepts an invite"),
  },
  {
    id: "file-added",
    kind: "trigger",
    title: "A file is added",
    icon: "file",
    find: "upload attach document link",
    fields: [choice("kind", "Kind of file", ["Any file", "Documents", "Images", "Links"])],
    defaults: { kind: "Any file" },
    summary: (v) => (v.kind && v.kind !== "Any file" ? `When ${lower(v.kind)} are attached to a task` : "When any file is attached to a task"),
  },

  // ── Actions ──────────────────────────────────────────────────────────
  {
    id: "nudge-owner",
    kind: "action",
    title: "Nudge the owner",
    icon: "nudge",
    find: "remind chase ping",
    fields: [choice("when", "When", ["Straight away", "The next morning"])],
    defaults: { when: "Straight away" },
    summary: (v) => `Send a nudge ${lower(v.when || "Straight away")}`,
  },
  {
    id: "assign",
    kind: "action",
    title: "Assign to someone",
    icon: "assign",
    find: "give owner person hand over",
    fields: [choice("who", "Give it to", ["The project lead", "Whoever created the task", "Whoever has the fewest open tasks"])],
    defaults: { who: "The project lead" },
    summary: (v) => `Give it to ${lower(v.who || "The project lead")}`,
  },
  {
    id: "move-column",
    kind: "action",
    title: "Move to a column",
    icon: "column",
    find: "status board to do in progress waiting to check done",
    fields: [choice("column", "Column", ["To do", "In progress", "Waiting", "To check", "Done"])],
    defaults: { column: "Waiting" },
    summary: (v) => `Move it to ${v.column || "Waiting"}`,
  },
  {
    id: "set-due",
    kind: "action",
    title: "Set the due date",
    icon: "due",
    find: "date deadline when",
    fields: [choice("when", "Due", ["Tomorrow", "In 3 days", "In a week", "The next working day"])],
    defaults: { when: "In 3 days" },
    summary: (v) => `Due ${lower(v.when || "In 3 days")}`,
  },
  {
    id: "add-tag",
    kind: "action",
    title: "Add a tag",
    icon: "tag",
    find: "label mark",
    fields: [text("tag", "Tag", "Late", 24)],
    defaults: { tag: "Late" },
    summary: (v) => (v.tag?.trim() ? `Tag it “${v.tag.trim()}”` : "Choose a tag"),
  },
  {
    id: "post-chat",
    kind: "action",
    title: "Post in the project chat",
    icon: "chat",
    find: "message tell everyone say",
    fields: [text("message", "Message", "What should it say", 120)],
    defaults: { message: "This one needs a look." },
    summary: (v) => v.message?.trim() || "Write the message",
  },
  {
    id: "add-briefing",
    kind: "action",
    title: "Add to the daily briefing",
    icon: "briefing",
    find: "morning summary today",
    fields: [choice("under", "Under", ["Needs a look", "Coming up"])],
    defaults: { under: "Needs a look" },
    summary: (v) => `Under ${v.under || "Needs a look"}`,
  },
  {
    id: "follow-up",
    kind: "action",
    title: "Create a follow-up task",
    icon: "followUp",
    find: "new task next",
    fields: [text("title", "Task name", "Check in on this", 60), choice("who", "For", ["The owner", "The project lead"])],
    defaults: { title: "Check in on this", who: "The owner" },
    summary: (v) => `“${v.title?.trim() || "Check in on this"}” for ${lower(v.who || "The owner")}`,
  },

  // ── Branches ─────────────────────────────────────────────────────────
  {
    id: "split-project",
    kind: "branch",
    title: "Split by project",
    icon: "split",
    find: "branch if path each",
    fields: [],
    defaults: {},
    conditions: ["Harbour Street fit-out", "Autumn menu launch", "Everything else"],
    summary: () => "A path for each project",
  },
  {
    id: "split-lateness",
    kind: "branch",
    title: "Split by how late it is",
    icon: "split",
    find: "branch if path overdue days",
    fields: [],
    defaults: {},
    conditions: ["1 to 2 days", "3 to 7 days", "More than a week", "No date yet"],
    summary: () => "A path for each length of delay",
  },
];

const BY_ID = new Map(STEP_TYPES.map((type) => [type.id, type]));

export function stepType(id: string): StepType | null {
  return BY_ID.get(id) ?? null;
}

/**
 * The picker's search: every word typed must appear in the step's name, its
 * kind or its extra words. Empty text lists everything, grouped by kind.
 */
export function searchStepTypes(query: string, kinds: readonly StepKind[] = KIND_ORDER): StepType[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const allowed = new Set(kinds);
  return STEP_TYPES.filter((type) => {
    if (!allowed.has(type.kind)) return false;
    const hay = `${type.title} ${KIND_LABEL[type.kind]} ${type.find}`.toLowerCase();
    return words.every((word) => hay.includes(word));
  });
}

// ── Starters ───────────────────────────────────────────────────────────

export type TemplateStep = Readonly<{
  key: string;
  type: string;
  col: number;
  row: number;
  values?: Readonly<Record<string, string>>;
}>;

/** `port` is the index of a branch's path; left out for a plain step. */
export type TemplateLink = Readonly<{ from: string; to: string; port?: number }>;

export type Template = Readonly<{
  id: string;
  name: string;
  about: string;
  steps: readonly TemplateStep[];
  links: readonly TemplateLink[];
}>;

export const TEMPLATES: readonly Template[] = [
  {
    id: "chase-late-tasks",
    name: "Chase late tasks",
    about: "A gentle nudge at first, then a louder one the longer a task waits.",
    steps: [
      { key: "late", type: "task-late", col: 0, row: 1 },
      { key: "split", type: "split-lateness", col: 1, row: 1 },
      { key: "nudge", type: "nudge-owner", col: 2, row: 0 },
      { key: "brief", type: "add-briefing", col: 2, row: 1 },
      { key: "chat", type: "post-chat", col: 2, row: 2, values: { message: "More than a week late. Who can take it?" } },
      { key: "due", type: "set-due", col: 2, row: 3, values: { when: "In a week" } },
    ],
    links: [
      { from: "late", to: "split" },
      { from: "split", port: 0, to: "nudge" },
      { from: "split", port: 1, to: "brief" },
      { from: "split", port: 2, to: "chat" },
      { from: "split", port: 3, to: "due" },
    ],
  },
  {
    id: "welcome-someone-new",
    name: "Welcome someone new to a project",
    about: "Say hello in the chat and give the lead a task to show them around.",
    steps: [
      { key: "joins", type: "person-joins", col: 0, row: 0 },
      { key: "chat", type: "post-chat", col: 1, row: 0, values: { message: "Welcome. Here is where to start." } },
      { key: "task", type: "follow-up", col: 2, row: 0, values: { title: "Show them around", who: "The project lead" } },
      { key: "brief", type: "add-briefing", col: 3, row: 0, values: { under: "Coming up" } },
    ],
    links: [
      { from: "joins", to: "chat" },
      { from: "chat", to: "task" },
      { from: "task", to: "brief" },
    ],
  },
  {
    id: "week-before-reminders",
    name: "Week-before reminders",
    about: "Seven days out, remind the right people, project by project.",
    steps: [
      { key: "week", type: "date-week-away", col: 0, row: 1, values: { which: "Big dates only" } },
      { key: "split", type: "split-project", col: 1, row: 1 },
      { key: "chat", type: "post-chat", col: 2, row: 0, values: { message: "One week to go on this." } },
      { key: "nudge", type: "nudge-owner", col: 2, row: 1, values: { when: "The next morning" } },
      { key: "brief", type: "add-briefing", col: 2, row: 2, values: { under: "Coming up" } },
    ],
    links: [
      { from: "week", to: "split" },
      { from: "split", port: 0, to: "chat" },
      { from: "split", port: 1, to: "nudge" },
      { from: "split", port: 2, to: "brief" },
    ],
  },
  {
    id: "tidy-up-when-done",
    name: "Tidy up when a task is done",
    about: "Tag it, tell the project, and line up whatever comes next.",
    steps: [
      { key: "done", type: "task-done", col: 0, row: 0 },
      { key: "tag", type: "add-tag", col: 1, row: 0, values: { tag: "Finished" } },
      { key: "chat", type: "post-chat", col: 2, row: 0, values: { message: "Done. One more off the list." } },
      { key: "next", type: "follow-up", col: 3, row: 0, values: { title: "Check nothing was missed", who: "The owner" } },
    ],
    links: [
      { from: "done", to: "tag" },
      { from: "tag", to: "chat" },
      { from: "chat", to: "next" },
    ],
  },
];

export function templateById(id: string): Template | null {
  return TEMPLATES.find((template) => template.id === id) ?? null;
}
