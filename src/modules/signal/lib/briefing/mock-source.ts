import type { BriefingSource } from "./source";
import type { TaskSignal } from "./types";

const DAY = 86_400_000;

/**
 * Mock signals shaped to match the marketing demo (Wedding 2026
 * workspace). Used in development and as a fallback when the Tasks
 * read token isn't set. Phase B.2 will replace this with a real
 * Tasks DB read; the interface (BriefingSource) won't change.
 */
function makeMockSignals(now: number): TaskSignal[] {
  const sourceLabel = "Tasks · Wedding 2026";
  return [
    {
      id: "t-florist",
      title: "Florist deposit",
      lane: "in-flight",
      priority: 0,
      dueAt: null,
      idleDays: 18,
      commentCount: 2,
      blockedBy: [],
      sourceLabel,
      movedToShippedAt: null,
    },
    {
      id: "t-catering-headcount",
      title: "Catering headcount",
      lane: "next",
      priority: 1,
      dueAt: now + 3 * DAY, // due Friday-ish
      idleDays: 4,
      commentCount: 5,
      blockedBy: [],
      sourceLabel,
      movedToShippedAt: null,
    },
    {
      id: "t-invitations",
      title: "Send invitations",
      lane: "in-flight",
      priority: 1,
      dueAt: now - 14 * DAY, // 14 days overdue
      idleDays: 6,
      commentCount: 1,
      blockedBy: [],
      sourceLabel,
      movedToShippedAt: null,
    },
    {
      id: "t-music-supplier",
      title: "Music supplier",
      lane: "in-flight",
      priority: 2,
      dueAt: null,
      idleDays: 9,
      commentCount: 0,
      blockedBy: [],
      sourceLabel,
      movedToShippedAt: null,
    },
    {
      id: "t-hmu-overlap",
      title: "Hair-and-makeup trial",
      lane: "in-flight",
      priority: 2,
      dueAt: now + 12 * DAY,
      idleDays: 2,
      commentCount: 3,
      blockedBy: [],
      sourceLabel,
      movedToShippedAt: null,
    },
    {
      id: "t-honeymoon-flights",
      title: "Honeymoon flights",
      lane: "next",
      priority: 2,
      dueAt: now + 47 * DAY,
      idleDays: 12,
      commentCount: 0,
      blockedBy: [],
      sourceLabel,
      movedToShippedAt: null,
    },
    // Moving well
    {
      id: "t-save-the-dates",
      title: "Save-the-dates",
      lane: "shipped",
      priority: 1,
      dueAt: null,
      idleDays: 0,
      commentCount: 8,
      blockedBy: [],
      sourceLabel,
      movedToShippedAt: now - 0.5 * DAY,
    },
    {
      id: "t-venue-signed",
      title: "Venue contract",
      lane: "shipped",
      priority: 0,
      dueAt: null,
      idleDays: 0,
      commentCount: 4,
      blockedBy: [],
      sourceLabel,
      movedToShippedAt: now - 1.2 * DAY,
    },
  ];
}

export const mockBriefingSource: BriefingSource = {
  async getSignalsForUser() {
    return makeMockSignals(Date.now());
  },
};

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
