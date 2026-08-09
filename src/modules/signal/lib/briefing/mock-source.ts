import type { BriefingSource } from "./source";
import type { TaskSignal } from "./types";
import {
  REVIEW_MENU_MILESTONE,
  REVIEW_SUITE_FIXTURE,
} from "@/lib/review-suite-fixture";
import { PINNED_REVIEW_CALENDAR_FRAME } from "@/lib/calendar-frame";

const DAY = 86_400_000;

/**
 * All mock briefings run on the suite's pinned review clock. A wall-clock
 * default here would let the demo story drift away from the "today" that
 * Tasks and Timeline review surfaces narrate.
 */
const PINNED_REVIEW_NOW = Date.parse(PINNED_REVIEW_CALENDAR_FRAME.nowIso);

/**
 * Mock signals shaped to match the suite-wide The Orchard / Mara & Finn
 * review story. Used in development and as a fallback when the Tasks
 * read token isn't set. Phase B.2 will replace this with a real
 * Tasks DB read; the interface (BriefingSource) won't change.
 */
function makeMockSignals(
  now: number,
  workspaceId: string = REVIEW_SUITE_FIXTURE.workspace.id,
  sourceLabel: string =
    `Tasks · ${REVIEW_SUITE_FIXTURE.workspace.name} · Mara & Finn`,
): TaskSignal[] {
  const scoped = (
    signal: Omit<TaskSignal, "sourceLabel" | "workspaceId">,
  ): TaskSignal => ({
    ...signal,
    sourceLabel,
    workspaceId,
  });

  // One story, one set of facts. Every field below restates
  // src/server/demo/tasks-demo.ts for the same task ids, as read at the
  // pinned review instant. Signal's flagship promise is "from Tasks" —
  // a fixture that invents a due date or an idle streak the board
  // disproves one click away breaks the product's core claim.
  return [
    scoped({
      id: "demo-t-01",
      title: "Confirm marquee sides with the hire company",
      // Undated and touched within the hour — present in the read,
      // nothing to surface. The board says exactly the same.
      lane: "in-flight",
      priority: 0,
      dueAt: null,
      idleDays: 0,
      commentCount: 0,
      blockedBy: [],
      movedToShippedAt: null,
    }),
    scoped({
      id: REVIEW_MENU_MILESTONE.sourceId,
      title: REVIEW_MENU_MILESTONE.title,
      // The shared review journey's current milestone: due 1 Aug and
      // quiet since the start of July — tasks-demo says the same, to the
      // day. The long-quiet thread is what Signal surfaces.
      lane: "in-flight",
      priority: 1,
      dueAt: Date.parse(`${REVIEW_MENU_MILESTONE.date}T09:00:00.000Z`),
      idleDays: 15,
      commentCount: 0,
      blockedBy: [],
      movedToShippedAt: null,
    }),
    scoped({
      id: "demo-t-07",
      title: "Approve the final seating plan",
      // In review, no due date — the board says the same.
      lane: "review",
      priority: 1,
      dueAt: null,
      idleDays: 0,
      commentCount: 1,
      blockedBy: [],
      movedToShippedAt: null,
    }),
    scoped({
      id: "demo-t-05",
      title: "Build the Saturday run-sheet",
      // Due on the pinned today, worked this morning.
      lane: "in-flight",
      priority: 1,
      dueAt: Date.parse("2026-07-16T09:00:00.000Z"),
      idleDays: 0,
      commentCount: 2,
      blockedBy: [],
      movedToShippedAt: null,
    }),
    scoped({
      id: "demo-t-06",
      title: "Order tonic + the good olives",
      // Due Tuesday 14 Jul: two days overdue at the pinned today —
      // exactly what the board's card says.
      lane: "in-flight",
      priority: 2,
      dueAt: Date.parse("2026-07-14T09:00:00.000Z"),
      idleDays: 2,
      commentCount: 0,
      blockedBy: [],
      movedToShippedAt: null,
    }),
    scoped({
      id: "demo-t-04",
      title: "Send midweek rate to the June 2027 walk-in couple",
      // Undated: the Friday in the task description is a follow-up plan.
      lane: "next",
      priority: 2,
      dueAt: null,
      idleDays: 0,
      commentCount: 0,
      blockedBy: [],
      movedToShippedAt: null,
    }),
    // Moving well
    scoped({
      id: "demo-t-09",
      title: "Open day, nine couples through",
      lane: "shipped",
      priority: 1,
      dueAt: null,
      idleDays: 0,
      commentCount: 8,
      blockedBy: [],
      movedToShippedAt: now - 0.5 * DAY,
    }),
    scoped({
      id: "demo-t-10",
      title: "Deposit invoice settled, Mara & Finn",
      lane: "shipped",
      priority: 0,
      dueAt: null,
      idleDays: 0,
      commentCount: 4,
      blockedBy: [],
      movedToShippedAt: now - 1.2 * DAY,
    }),
  ];
}

export function createMockBriefingSource(input?: {
  now?: number;
  workspaceId?: string;
  sourceLabel?: string;
}): BriefingSource {
  return {
    async getSignalsForUser() {
      return makeMockSignals(
        input?.now ?? PINNED_REVIEW_NOW,
        input?.workspaceId,
        input?.sourceLabel,
      );
    },
  };
}

export const mockBriefingSource: BriefingSource =
  createMockBriefingSource();

function makePlanningPeriodMockSignals(now: number): TaskSignal[] {
  return [
    {
      id: "t-mock-paper",
      title: "Mock paper preparation",
      lane: "in-flight",
      priority: 0,
      dueAt: now - 2 * DAY,
      idleDays: 4,
      commentCount: 0,
      blockedBy: [],
      sourceLabel: "Tasks · 6th Year Geography",
      movedToShippedAt: null,
    },
    {
      id: "t-revision-guide",
      title: "Revision guide",
      lane: "next",
      priority: 1,
      dueAt: now + 4 * DAY,
      idleDays: 2,
      commentCount: 0,
      blockedBy: [],
      sourceLabel: "Tasks · 5th Year History",
      movedToShippedAt: null,
    },
    {
      id: "t-fieldwork-maps",
      title: "Order fieldwork maps",
      lane: "in-flight",
      priority: 1,
      dueAt: null,
      idleDays: 11,
      commentCount: 0,
      blockedBy: [],
      sourceLabel: "Tasks · Leaving Cert Politics",
      movedToShippedAt: null,
    },
  ];
}

export const mockPlanningPeriodBriefingSource: BriefingSource = {
  async getSignalsForUser() {
    return makePlanningPeriodMockSignals(PINNED_REVIEW_NOW);
  },
};
