import "server-only";

/**
 * All projects in review mode (v3 redesign, 24 Sep 2026).
 *
 * Review has exactly one Project, and one bar cannot show what a view of
 * every Project is for. So review adds six sample Projects, made up and
 * labelled as such everywhere they appear: a "Sample" chip on each row, a
 * review-only note above the view, and a toast instead of navigation when
 * one is pressed. They cover every case the bar vocabulary has (spec 5.2):
 * at risk with late tasks and a dense cluster of milestones, on track with an
 * overdue milestone, paused with no target, no status and open-ended, past
 * its target and started before the drawn range (so the range is clipped),
 * and complete. That is what the view needs to be judged honestly.
 *
 * Nothing here reads a database and nothing here exists outside demo and
 * review: `reviewPortfolioRows()` returns an empty list whenever
 * `isDemoMode()` is false, which a unit test pins.
 */

import { isDemoMode } from "@/lib/access-mode";
import { isTaskDone } from "@/lib/board-columns";
import { PINNED_REVIEW_CALENDAR_FRAME } from "@/lib/calendar-frame";
import { monogramOf } from "@/lib/projects/project-chooser";
import {
  assemblePortfolioRows,
  MILESTONES_PER_ROW,
  type PortfolioMilestone,
  type PortfolioRow,
} from "@/lib/projects/project-portfolio";
import { REVIEW_PRIMARY_PROJECT, REVIEW_SUITE_FIXTURE, REVIEW_TIMELINE_MILESTONES } from "@/lib/review-suite-fixture";
import { DEMO_WORKSPACE_ID, DEMO_WORKSPACE_NAME, demoTasks } from "@/server/demo/tasks-demo";

/** Every sample id starts with this, so none can ever collide with a real Project. */
export const SAMPLE_ID_PREFIX = "sample-";

type SampleSpec = Readonly<{
  slug: string;
  name: string;
  status: PortfolioRow["status"];
  purpose: string;
  start: string;
  target: string | null;
  complete: number;
  total: number;
  overdue: number;
  timelineName: string | null;
  milestones: ReadonlyArray<readonly [title: string, date: string, done: boolean]>;
}>;

const SAMPLES: readonly SampleSpec[] = [
  {
    slug: "kavanagh-wedding",
    name: "Kavanagh wedding",
    status: "at-risk",
    purpose: "A November wedding with a lot landing in the last six weeks.",
    start: "2026-03-09",
    target: "2026-11-12",
    complete: 4,
    total: 10,
    overdue: 2,
    timelineName: "Aoife & Rory",
    milestones: [
      ["Venue deposit paid", "2026-04-02", true],
      ["Save the dates sent", "2026-05-20", true],
      ["Florist confirmed", "2026-09-18", false],
      ["Final fitting", "2026-10-04", false],
      ["Menu tasting", "2026-10-09", false],
      ["Seating plan", "2026-10-16", false],
      ["Hair and make-up trial", "2026-10-21", false],
      ["Wedding day", "2026-11-12", false],
    ],
  },
  {
    slug: "year-9-history",
    name: "Year 9 history, autumn term",
    status: "on-track",
    purpose: "Lessons, trips and assessments for the autumn term.",
    start: "2026-06-08",
    target: "2026-12-18",
    complete: 11,
    total: 20,
    overdue: 0,
    timelineName: "Autumn term",
    milestones: [
      ["Summer reading list out", "2026-06-19", true],
      ["Mock exams marked", "2026-07-10", false],
      ["Term starts", "2026-08-31", false],
      ["Museum trip", "2026-10-08", false],
      ["Essay deadline", "2026-11-20", false],
      ["End of term", "2026-12-18", false],
    ],
  },
  {
    slug: "harvest-supper-club",
    name: "Harvest supper club",
    status: "paused",
    purpose: "A monthly supper club, on hold until the new kitchen is in.",
    start: "2026-05-04",
    target: null,
    complete: 3,
    total: 10,
    overdue: 0,
    timelineName: null,
    milestones: [
      ["Menu drafted", "2026-05-22", true],
      ["Supplier tasting", "2026-06-26", true],
    ],
  },
  {
    slug: "kitchen-renovation",
    name: "Kitchen renovation",
    status: null,
    purpose: "New kitchen for the café, done between services.",
    start: "2026-06-22",
    target: null,
    complete: 1,
    total: 10,
    overdue: 0,
    timelineName: null,
    milestones: [
      ["Quote accepted", "2026-07-02", true],
      ["Cabinets ordered", "2026-08-14", false],
    ],
  },
  {
    // Past its target and started long ago: the bar stops at the target with
    // a hatched run to today, and it starts before the drawn range, so its
    // left edge carries "from 6 Mar 2023".
    slug: "community-garden",
    name: "Community garden, phase one",
    status: "on-track",
    purpose: "Raised beds, a polytunnel and a rota, built with volunteers since 2023.",
    start: "2023-03-06",
    target: "2026-07-07",
    complete: 21,
    total: 24,
    overdue: 1,
    timelineName: "Phase one",
    milestones: [
      ["Planning permission", "2023-09-14", true],
      ["Beds built", "2025-05-10", true],
      ["Polytunnel up", "2026-04-18", true],
      ["Open day", "2026-07-04", false],
    ],
  },
  {
    slug: "cafe-relaunch",
    name: "Café relaunch",
    status: "complete",
    purpose: "New menu, new hours, one relaunch weekend.",
    start: "2026-02-02",
    target: "2026-06-30",
    complete: 18,
    total: 18,
    overdue: 0,
    timelineName: "Relaunch",
    milestones: [
      ["New menu signed off", "2026-04-10", true],
      ["Soft opening", "2026-06-20", true],
      ["Relaunch weekend", "2026-06-30", true],
    ],
  },
];

function sampleRow(spec: SampleSpec): PortfolioRow {
  const id = `${SAMPLE_ID_PREFIX}${spec.slug}`;
  const milestones: PortfolioMilestone[] = spec.milestones.map(([title, date, done], index) => ({
    id: `${id}-m${index + 1}`,
    title,
    date,
    done,
  }));
  return Object.freeze({
    id,
    name: spec.name,
    monogram: monogramOf(spec.name),
    role: "primary-owner",
    selectable: true,
    blockedReason: null,
    archived: false,
    status: spec.status,
    statusTone: spec.status === "at-risk" ? "warning" : spec.status === "on-track" ? "success" : spec.status === "paused" ? "neutral" : spec.status === "complete" ? "accent" : "none",
    purpose: spec.purpose,
    start: spec.start,
    startSource: "first-task",
    target: spec.target,
    complete: spec.complete,
    total: spec.total,
    overdue: spec.overdue,
    statsKnown: true,
    milestones: Object.freeze(milestones.slice(0, MILESTONES_PER_ROW)),
    milestoneOverflow: Math.max(0, milestones.length - MILESTONES_PER_ROW),
    timelineName: spec.timelineName,
    href: null,
    overviewHref: null,
    sample: true,
  } satisfies PortfolioRow);
}

/** The made-up rows. Empty outside demo and review. */
export function reviewSampleRows(): readonly PortfolioRow[] {
  if (!isDemoMode()) return [];
  return SAMPLES.map(sampleRow);
}

/**
 * The review Project itself, built from the same fixture its board, overview
 * and timeline read, on the pinned review clock. Its milestones are the
 * Mara & Finn plan's own; "not going ahead" ones are left off the bar.
 */
function reviewProjectRow(): PortfolioRow {
  const todayMs = Date.parse(`${PINNED_REVIEW_CALENDAR_FRAME.today}T00:00:00.000Z`);
  const tasks = demoTasks();
  const open = tasks.filter((task) => !isTaskDone(task, null));
  const [row] = assemblePortfolioRows(
    [
      {
        id: DEMO_WORKSPACE_ID,
        name: DEMO_WORKSPACE_NAME,
        monogram: monogramOf(DEMO_WORKSPACE_NAME),
        role: "primary-owner",
        selectable: true,
        blockedReason: null,
        archived: false,
      },
    ],
    {
      stats: new Map([
        [
          DEMO_WORKSPACE_ID,
          {
            status: "on-track",
            targetDate: REVIEW_SUITE_FIXTURE.primaryDate.date,
            purpose: `Run ${REVIEW_PRIMARY_PROJECT.name}'s wedding from one place, with every supplier, date and decision accounted for.`,
            total: tasks.length,
            complete: tasks.length - open.length,
            overdue: open.filter((task) => task.dueAt && task.dueAt.getTime() < todayMs).length,
          },
        ],
      ]),
      starts: new Map([[DEMO_WORKSPACE_ID, { firstTaskCreated: null, firstTaskDue: null, projectCreated: "2026-01-01" }]]),
      milestones: new Map([
        [
          DEMO_WORKSPACE_ID,
          REVIEW_TIMELINE_MILESTONES.filter((m) => m.date !== null && m.state !== "cancelled").map((m) => ({
            id: m.sourceId,
            title: m.title,
            date: m.date as string,
            done: m.state === "covered",
          })),
        ],
      ]),
      timelineNames: new Map([[DEMO_WORKSPACE_ID, REVIEW_PRIMARY_PROJECT.name]]),
      statsAvailable: true,
    },
  );
  return row;
}

/** Review's whole All projects: the real review Project first, then the samples. */
export function reviewPortfolioRows(): readonly PortfolioRow[] {
  if (!isDemoMode()) return [];
  return [reviewProjectRow(), ...reviewSampleRows()];
}
