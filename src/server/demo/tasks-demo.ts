import "server-only";

import type { DomainId } from "@/lib/domains";
import type { LaneId, Priority, Task, UserId } from "@/lib/data";

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

export const DEMO_USER_ID: UserId = "demo-user";
export const DEMO_WORKSPACE_ID = "demo-ws";
export const DEMO_WORKSPACE_SLUG = "the-orchard";
export const DEMO_WORKSPACE_NAME = "The Orchard, events";
export const DEMO_SPONSOR_NAME = "The Orchard";
export const DEMO_PRIMARY_USE_CASE = "venue";
export const DEMO_DOMAIN: DomainId = "wedding";
export const DEMO_SHARE_TOKEN = "review-the-orchard";

const HOUR = 60 * 60 * 1000;
const now = () => Date.now();

type Seed = {
  id: string;
  title: string;
  description?: string;
  lane: LaneId;
  priority: Priority;
  due?: string;
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
      "Maria + James, Saturday. Terrace plan if dry, marquee if not, they need the call by Thursday.",
    lane: "todo",
    priority: "p1",
    due: "Thu",
    tags: ["maria-james"],
    externalContactName: "County Marquee Hire",
    editedHoursAgo: 1,
  },
  {
    id: "demo-t-02",
    title: "Final stem count to the florist",
    description: "Looser, wilder look, fewer roses, more foliage. Florist wants it Monday.",
    lane: "todo",
    priority: "p2",
    due: "Mon",
    tags: ["maria-james"],
    externalContactName: "Aoife · Northlight Flowers",
    editedHoursAgo: 3,
  },
  {
    id: "demo-t-03",
    title: "Reprint the faded welcome sign before the open day",
    lane: "todo",
    priority: "p3",
    due: "next week",
    tags: ["venue"],
    editedHoursAgo: 6,
  },
  {
    id: "demo-t-04",
    title: "Send midweek rate to the June 2027 walk-in couple",
    description: "~80 guests, budget-conscious. Follow up Friday if no reply.",
    lane: "todo",
    priority: "p2",
    due: "Fri",
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
    due: "Fri",
    tags: ["maria-james"],
    comments: 2,
    editedHoursAgo: 2,
  },
  {
    id: "demo-t-06",
    title: "Order tonic + the good olives",
    description: "Two extra cases of tonic; last olive delivery was short.",
    lane: "doing",
    priority: "p2",
    due: "Thu",
    tags: ["bar"],
    externalContactName: "Greenfield Wholesale",
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
    tags: ["maria-james"],
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
    title: "Deposit invoice settled, Maria + James",
    lane: "done",
    priority: "p1",
    tags: ["maria-james"],
    externalContactName: "Maria Doyle",
    cents: 150000,
    editedHoursAgo: 48,
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
  return SEED.map(toTask);
}
