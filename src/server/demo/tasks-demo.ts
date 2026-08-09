import "server-only";

import type { DomainId } from "@/lib/domains";
import type { LaneId, Priority, Task, UserId } from "@/lib/data";
import {
  REVIEW_MENU_MILESTONE,
  REVIEW_PRIMARY_PROJECT,
  REVIEW_SUITE_FIXTURE,
} from "@/lib/review-suite-fixture";

/**
 * In-memory demo dataset for Signal Tasks.
 *
 * Active only in access-mode demo/review (see lib/access-mode.ts). The real
 * Turso DB is never read in that mode, getCurrentUser/getActiveWorkspace
 * resolve to the synthetic identity below and the read queries short-circuit
 * here. So a mis-deployed flag can leak nothing: there is no real tenant data
 * on the demo path.
 *
 * Persona (shared across the suite demo): a wedding-venue duty manager
 * coordinating real Saturdays, calm coordination for normal people, not a
 * software team's sprint board.
 */

export const DEMO_USER_ID: UserId = REVIEW_SUITE_FIXTURE.user.id;
export const DEMO_WORKSPACE_ID = REVIEW_SUITE_FIXTURE.workspace.id;
export const DEMO_WORKSPACE_SLUG = REVIEW_SUITE_FIXTURE.workspace.slug;
export const DEMO_WORKSPACE_NAME = REVIEW_SUITE_FIXTURE.workspace.name;
export const DEMO_SPONSOR_NAME = "The Orchard";
export const DEMO_PRIMARY_USE_CASE = "venue";
export const DEMO_DOMAIN: DomainId = "wedding";
export const DEMO_SHARE_TOKEN = "review-the-orchard";
export const DEMO_PRIMARY_PROJECT_ID = REVIEW_PRIMARY_PROJECT.id;
export const DEMO_PRIMARY_PROJECT_SLUG = REVIEW_PRIMARY_PROJECT.slug;
export const DEMO_PRIMARY_PROJECT_NAME = REVIEW_PRIMARY_PROJECT.name;

const HOUR = 60 * 60 * 1000;
const now = () => Date.now();

type Seed = {
  id: string;
  title: string;
  description?: string;
  lane: LaneId;
  priority: Priority;
  due?: string;
  dueAt?: string;
  isMilestone?: boolean;
  sourceNoteId?: string;
  sourceNoteExtractBody?: string;
  tags?: string[];
  estimate?: number;
  comments?: number;
  externalContactName?: string;
  cents?: number;
  editedHoursAgo: number;
};

const SEED: Seed[] = [
  // To do
  {
    id: "demo-t-01",
    title: "Confirm marquee sides with the hire company",
    description:
      "Mara + Finn, Saturday. Terrace plan if dry, marquee if not, they need the call by Thursday.",
    lane: "todo",
    priority: "p1",
    // Deliberately undated: "by Thursday" lives in the description as
    // context, not as a scheduled commitment. A fake weekday label here
    // made the public share board look like it carried real dates.
    tags: ["mara-finn"],
    externalContactName: "County Marquee Hire",
    sourceNoteId: "demo_n_01",
    sourceNoteExtractBody: "Confirm marquee sides with hire company before Thursday",
    editedHoursAgo: 1,
  },
  {
    id: REVIEW_MENU_MILESTONE.sourceId,
    title: REVIEW_MENU_MILESTONE.title,
    description:
      "Mara and Finn confirmed the tasting. The venue team needs the final dietary list before service notes are locked.",
    lane: "doing",
    priority: "p1",
    due: "1 Aug",
    dueAt: REVIEW_MENU_MILESTONE.date ?? undefined,
    // NOTE: editedHoursAgo below is 15 days — the tasting was confirmed,
    // then the final list stalled. This is the story's one long-quiet
    // thread: Signal surfaces it, the inbox nudges it, and the task
    // header honestly reads "edited 1 Jul". One fact, every surface.
    isMilestone: true,
    sourceNoteId: REVIEW_SUITE_FIXTURE.journey.sourceNoteId,
    sourceNoteExtractBody: REVIEW_MENU_MILESTONE.title,
    tags: [REVIEW_PRIMARY_PROJECT.slug],
    externalContactName: "Mara Doyle",
    editedHoursAgo: 15 * 24,
  },
  {
    id: "demo-t-03",
    title: "Reprint the faded welcome sign before the open day",
    lane: "todo",
    priority: "p3",
    // Deliberately undated: loose venue upkeep. An absent date reads
    // calmer than a fake-precise "next week" label with no timestamp.
    tags: ["venue"],
    editedHoursAgo: 6,
  },
  {
    id: "demo-t-04",
    title: "Send midweek rate to the June 2027 walk-in couple",
    description: "~80 guests, budget-conscious. Follow up Friday if no reply.",
    lane: "todo",
    priority: "p2",
    // Undated: the Friday in the description is the follow-up plan, not
    // a due date on this task.
    tags: ["enquiry"],
    cents: 0,
    editedHoursAgo: 9,
  },
  // Doing
  {
    id: "demo-t-05",
    title: "Build the Saturday run-sheet",
    description: "Ceremony 2pm orchard, drinks terrace, dinner 5:30. Share with the floor team.",
    lane: "doing",
    priority: "p1",
    // Due on the review frame's pinned today (2026-07-16) so the board's
    // relative labels ("Due today", warm treatment) are visible in review
    // captures rather than only proven by the dates.test.ts assertions.
    due: "Today",
    dueAt: "2026-07-16",
    tags: ["mara-finn"],
    comments: 2,
    editedHoursAgo: 2,
  },
  {
    id: "demo-t-06",
    title: "Order tonic + the good olives",
    description: "Two extra cases of tonic; last olive delivery was short.",
    lane: "doing",
    priority: "p2",
    // Two days behind the pinned today: the overdue register on a card.
    // 14 Jul 2026 is a Tuesday; the display string states the date rather
    // than guessing a weekday.
    due: "14 Jul",
    dueAt: "2026-07-14",
    tags: ["bar"],
    externalContactName: "Greenfield Wholesale",
    sourceNoteId: "demo_n_06",
    sourceNoteExtractBody: "Order 2 cases tonic + olives before weekend",
    cents: 18400,
    editedHoursAgo: 4,
  },
  // Review
  {
    id: "demo-t-07",
    title: "Approve the final seating plan",
    description: "Top table moved away from the speakers, check sightlines to the arch.",
    lane: "review",
    priority: "p1",
    tags: ["mara-finn"],
    comments: 1,
    editedHoursAgo: 5,
  },
  {
    id: "demo-t-08",
    title: "Sign off the recommended-suppliers list",
    description: "Add Northlight (photography) and County Marquee. Drop the lapsed DJ.",
    lane: "review",
    priority: "p3",
    tags: ["venue"],
    editedHoursAgo: 12,
  },
  // Done
  {
    id: "demo-t-09",
    title: "Open day, nine couples through",
    description: "Three asked for dates. Tea urn was the hero. Repeat the format in spring.",
    lane: "done",
    priority: "p2",
    tags: ["venue"],
    editedHoursAgo: 30,
  },
  {
    id: "demo-t-10",
    title: "Deposit invoice settled, Mara + Finn",
    lane: "done",
    priority: "p1",
    tags: ["mara-finn"],
    externalContactName: "Mara Doyle",
    cents: 150000,
    editedHoursAgo: 48,
  },
  {
    id: "demo_task_checkout",
    title: "Clear Sunday 11am late checkout with housekeeping",
    lane: "done",
    priority: "p2",
    tags: ["mara-finn"],
    sourceNoteId: "demo_n_a1",
    sourceNoteExtractBody: "Clear Sunday 11am late checkout with housekeeping",
    editedHoursAgo: 54,
  },
  {
    id: "demo_task_linen",
    title: "Chase linen order, now shipping Tuesday",
    lane: "done",
    priority: "p2",
    tags: ["venue"],
    sourceNoteId: "demo_n_a2",
    sourceNoteExtractBody: "Chase linen order, now shipping Tuesday",
    editedHoursAgo: 77,
  },
  {
    id: "demo_task_registrar",
    title: "Send registrar paperwork two weeks before the date",
    lane: "done",
    priority: "p1",
    tags: ["mara-finn"],
    sourceNoteId: "demo_n_a3",
    sourceNoteExtractBody: "Send registrar paperwork two weeks before the date",
    editedHoursAgo: 96,
  },
];

function toTask(s: Seed): Task {
  return {
    id: s.id,
    workspaceId: DEMO_WORKSPACE_ID,
    title: s.title,
    description: s.description,
    lane: s.lane,
    priority: s.priority,
    assignees: [DEMO_USER_ID],
    due: s.due,
    dueAt: s.dueAt ? new Date(`${s.dueAt}T09:00:00.000Z`) : undefined,
    isMilestone: s.isMilestone,
    sourceNoteId: s.sourceNoteId ?? null,
    sourceNoteExtractBody: s.sourceNoteExtractBody ?? null,
    tags: s.tags,
    comments: s.comments,
    parentTaskId: null,
    externalContactName: s.externalContactName ?? null,
    externalContactEmail: null,
    cents: s.cents ?? null,
    updatedAt: new Date(now() - s.editedHoursAgo * HOUR),
  };
}

export function demoTasks(): Task[] {
  return SEED.map((s, index) => ({ ...toTask(s), seq: index + 1 }));
}
