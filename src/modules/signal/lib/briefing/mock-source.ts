import type { BriefingSource } from "./source";
import type { TaskSignal } from "./types";
import {
  REVIEW_MENU_MILESTONE,
  REVIEW_SUITE_FIXTURE,
} from "@/lib/review-suite-fixture";

const DAY = 86_400_000;

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

  return [
    scoped({
      id: "demo-t-01",
      title: "Confirm marquee sides with the hire company",
      lane: "in-flight",
      priority: 0,
      dueAt: null,
      idleDays: 18,
      commentCount: 2,
      blockedBy: [],
      movedToShippedAt: null,
    }),
    scoped({
      id: REVIEW_MENU_MILESTONE.sourceId,
      title: REVIEW_MENU_MILESTONE.title,
      // This is the shared review journey's current milestone. Keeping its
      // stalled in-flight state here makes Signal surface the same grounded
      // work object the user just visited in Tasks and Timeline.
      lane: "in-flight",
      priority: 1,
      dueAt: Date.parse(`${REVIEW_MENU_MILESTONE.date}T09:00:00.000Z`),
      idleDays: 11,
      commentCount: 5,
      blockedBy: [],
      movedToShippedAt: null,
    }),
    scoped({
      id: "demo-t-07",
      title: "Approve the final seating plan",
      lane: "in-flight",
      priority: 1,
      dueAt: now - 2 * DAY,
      idleDays: 6,
      commentCount: 1,
      blockedBy: [],
      movedToShippedAt: null,
    }),
    scoped({
      id: "demo-t-05",
      title: "Build the Saturday run-sheet",
      lane: "in-flight",
      priority: 2,
      dueAt: null,
      idleDays: 9,
      commentCount: 0,
      blockedBy: [],
      movedToShippedAt: null,
    }),
    scoped({
      id: "demo-t-06",
      title: "Order tonic + the good olives",
      lane: "in-flight",
      priority: 2,
      dueAt: now + 12 * DAY,
      idleDays: 2,
      commentCount: 3,
      blockedBy: [],
      movedToShippedAt: null,
    }),
    scoped({
      id: "demo-t-04",
      title: "Send midweek rate to the June 2027 walk-in couple",
      lane: "next",
      priority: 2,
      dueAt: now + 47 * DAY,
      idleDays: 12,
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
      title: "Deposit invoice settled, Mara + Finn",
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
        input?.now ?? Date.now(),
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
    return makePlanningPeriodMockSignals(Date.now());
  },
};
