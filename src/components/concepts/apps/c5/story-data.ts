/* Ideas from teams like yours: short true-to-life stories, each with a page you can try on. */

import { fmtTime, PEOPLE, POSTS, projectById, type ProjectId, type ToolId } from "./data";
import type { Live } from "./sources";

export type StoryId = "orchard" | "students" | "launch";

export type Row = { a: string; b: string; c: string; tone?: "late" | "done" };
export type Section = { heading: string; body: string[]; quote?: { text: string; who: string } };

export type Story = {
  id: StoryId;
  headline: string;
  dek: string;
  byline: string;
  mark: string;
  hue: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  minutes: number;
  tools: ToolId[];
  /** The tool you can try on and add. */
  primary: ToolId;
  sections: [Section, Section, Section];
  columns: [string, string, string];
  theirs: { title: string; rows: Row[] };
};

export const STORIES: Story[] = [
  {
    id: "orchard",
    headline: "How The Orchard runs a 180‑guest Saturday on one page",
    dek: "Five people, twelve suppliers and a walled garden. Dara stopped printing the run-sheet in March, and nobody has asked for paper since.",
    byline: "The Orchard, events team of 5",
    mark: "O",
    hue: 4,
    minutes: 3,
    tools: ["dayplan", "suppliers"],
    primary: "dayplan",
    sections: [
      {
        heading: "The sheet that was always out of date",
        body: [
          "Until this spring The Orchard ran every wedding from a printed run-sheet. Dara Hegarty printed twelve copies on Friday afternoon. By eleven on Saturday at least one time had moved, and the copies in the kitchen, the bar and the florist's van no longer agreed.",
        ],
        quote: { text: "I used to spend the first hour of every wedding walking round with a pen, correcting paper.", who: "Dara Hegarty, events manager" },
      },
      {
        heading: "Every step has a time and a name",
        body: [
          "The Day plan is one page: a time, what happens, and who makes it happen. Suppliers get a link that shows only their own steps. When a step runs late, every phone shows it at once, so the kitchen knows the speeches have slipped before anyone walks over to tell them.",
        ],
        quote: { text: "Chef stopped asking me what time it is. He just looks at his phone.", who: "Cian Moloney, front of house" },
      },
      {
        heading: "Saturday, by the numbers",
        body: ["A Saturday now has 31 steps, 12 suppliers and one page. Dara starts it on Wednesday from the last wedding's plan and has it done by lunchtime. The printer mostly does place cards now."],
      },
    ],
    columns: ["Time", "What happens", "Who"],
    theirs: {
      title: "Saturday 19 September at The Orchard",
      rows: [
        { a: fmtTime(9 * 60 + 30), b: "Florists dress the long barn", c: "Fern & Furrow", tone: "done" },
        { a: fmtTime(12 * 60), b: "Staff briefing in the barn", c: "Dara", tone: "done" },
        { a: fmtTime(14 * 60), b: "Ceremony in the orchard", c: "Celebrant", tone: "done" },
        { a: fmtTime(17 * 60), b: "Starters served", c: "Kitchen", tone: "done" },
        { a: fmtTime(19 * 60 + 30), b: "Speeches", c: "Best man", tone: "late" },
        { a: fmtTime(20 * 60 + 15), b: "First dance", c: "The Low Tides" },
        { a: fmtTime(25 * 60), b: "Close, taxis at the gate", c: "Kinsale Cabs" },
      ],
    },
  },
  {
    id: "students",
    headline: "Four students, one deadline, no group chat arguments",
    dek: "An essay on the 2009 flood, split four ways and kept fair, without a single late-night message thread.",
    byline: "A class group of 4, Cork",
    mark: "C",
    hue: 2,
    minutes: 2,
    tools: ["split", "outline"],
    primary: "split",
    sections: [
      {
        heading: "Who was doing what",
        body: ["Every group project starts the same way: someone makes a list in the chat, it scrolls away, and by week two nobody is sure who took the conclusion."],
        quote: { text: "We spent more time arguing about who had what than writing it.", who: "Ella, second year" },
      },
      {
        heading: "One page that keeps it fair",
        body: ["Group split shows each person, their part, and how far along it is. When one part falls behind, anyone can offer to take a piece of it, and the page shows the change to everyone."],
      },
      {
        heading: "Hand-in week",
        body: ["They handed in a day early. The group chat was mostly photos of the library cat."],
      },
    ],
    columns: ["Who", "Their part", "Share"],
    theirs: {
      title: "Essay on the 2009 flood",
      rows: [
        { a: "Ella", b: "Introduction and the city's history", c: "1 of 4 parts", tone: "done" },
        { a: "Rory", b: "The flood, hour by hour", c: "1 of 4 parts", tone: "done" },
        { a: "Aoibhe", b: "Interviews on the Mardyke", c: "1 of 4 parts" },
        { a: "Kofi", b: "Costs, and the conclusion", c: "1 of 4 parts" },
      ],
    },
  },
  {
    id: "launch",
    headline: "The launch week a small studio planned backwards",
    dek: "Start with the morning the doors open, then ask what has to be true the day before. Repeat until today.",
    byline: "Brightwater, a studio of 3",
    mark: "B",
    hue: 9,
    minutes: 2,
    tools: ["social", "press"],
    primary: "social",
    sections: [
      {
        heading: "Start at the end",
        body: ["Brightwater plan a launch from its last day. The opening post goes in first, then everything it depends on: the photos, the press morning, the teaser the week before."],
      },
      {
        heading: "One week, one view",
        body: ["The Social calendar lays the week out day by day, with each post marked ready or still a draft. A draft two days out is easy to spot."],
        quote: { text: "We stopped finding out on Thursday that Tuesday's post never went.", who: "Noel, Brightwater" },
      },
      {
        heading: "After the launch",
        body: ["The same week becomes the plan for the next client, with the dates moved and the names changed."],
      },
    ],
    columns: ["Day", "Post", "Channel"],
    theirs: {
      title: "Launch week for a bakery in Kinsale",
      rows: [
        { a: "Mon", b: "Teaser: the oven arrives", c: "Instagram", tone: "done" },
        { a: "Tue", b: "Meet the bakers", c: "Newsletter", tone: "done" },
        { a: "Thu", b: "Press morning, in pictures", c: "Instagram" },
        { a: "Sat", b: "Doors open at 8am", c: "Instagram" },
      ],
    },
  },
];

export const storyById = (id: StoryId) => STORIES.find((s) => s.id === id)!;

/** The same page, filled in from one of your Projects. */
export function yoursFor(story: Story, project: ProjectId, live: Live): { title: string; rows: Row[] } | { empty: string } {
  const p = projectById(project);
  const tasks = live.tasks.filter((t) => t.project === project);

  if (story.primary === "dayplan") {
    if (project === "mf") {
      const pick = ["Load-in: marquee crew and furniture", "Ceremony in the orchard", "Starters served", "Cake cutting", "First dance", "Close, taxis at the gate"];
      const rows: Row[] = live.mfSteps.filter((s) => pick.includes(s.title)).map((s) => ({ a: fmtTime(s.at), b: s.title, c: s.who }));
      const placed = tasks.filter((t) => t.at !== undefined).map((t) => ({ a: fmtTime(t.at!), b: t.title, c: PEOPLE[t.who].name.split(" ")[0] }));
      return { title: "Saturday 3 October, Mara & Finn", rows: [...rows, ...placed].sort((x, y) => toMin(x.a) - toMin(y.a)).slice(0, 7) };
    }
    if (project === "orchard") {
      const pick = ["Staff briefing in the barn", "Ceremony in the orchard", "Starters served", "Speeches", "First dance", "Close, taxis at the gate"];
      return { title: "Saturday 26 September at The Orchard", rows: live.orchardSteps.filter((s) => pick.includes(s.title)).map((s) => ({ a: fmtTime(s.at), b: s.title, c: s.who })) };
    }
    return { empty: `Nothing in ${p.name} has a time yet. Yours would start with its first step.` };
  }

  if (story.primary === "split") {
    const by = new Map<string, string[]>();
    if (project === "riverside") live.sections.forEach((s) => by.set(s.who, [...(by.get(s.who) ?? []), s.title]));
    else tasks.forEach((t) => by.set(t.who, [...(by.get(t.who) ?? []), t.title]));
    const total = [...by.values()].reduce((a, v) => a + v.length, 0);
    if (!total) return { empty: `No one in ${p.name} has a part yet.` };
    return {
      title: `Who has what in ${p.name}`,
      rows: [...by.entries()].map(([who, parts]) => ({
        a: who,
        b: parts.length > 1 ? `${parts[0]}, and ${parts.length - 1} more` : parts[0],
        c: project === "riverside" ? `${parts.length} of ${total} parts` : `${parts.length} of ${total} tasks`,
      })),
    };
  }

  if (story.primary === "social" && project === "hollis") {
    const days = ["Mon 28", "Tue 29", "Wed 30", "Thu 1", "Fri 2", "Sat 3", "Sun 4"];
    return {
      title: "Launch week, Hollis",
      rows: POSTS.slice(0, 6).map((x) => ({ a: `${days[x.day]} ${x.time}`, b: x.title, c: x.channel, tone: x.state === "posted" ? "done" : undefined })),
    };
  }
  return { empty: `${p.name} has no posts planned yet. Yours would start with the first one.` };
}

function toMin(t: string) {
  const m = t.match(/(\d+)(?::(\d+))?(am|pm)/);
  if (!m) return 0;
  let h = Number(m[1]) % 12;
  if (m[3] === "pm") h += 12;
  const mins = h * 60 + Number(m[2] ?? 0);
  return mins < 6 * 60 ? mins + 24 * 60 : mins;
}
