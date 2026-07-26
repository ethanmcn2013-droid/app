import type { Project, Task, Workspace } from "@/modules/timeline/server/db/timeline-schema";
import {
  REVIEW_PRIMARY_PROJECT,
  REVIEW_SUITE_FIXTURE,
  REVIEW_TIMELINE_MILESTONES,
  type ReviewTimelineState,
} from "@/lib/review-suite-fixture";

const createdAt = new Date(REVIEW_SUITE_FIXTURE.lastUpdatedAt);

/**
 * Synthetic user id used by access-mode demo/review (see lib/access-mode.ts).
 * The Tasks and Timeline fixtures deliberately share this immutable identity.
 */
export const DEMO_USER_ID = REVIEW_SUITE_FIXTURE.user.id;

export const demoWorkspace: Workspace = {
  slug: REVIEW_SUITE_FIXTURE.workspace.slug,
  name: REVIEW_SUITE_FIXTURE.workspace.name,
  description:
    "One venue workspace for the weddings being planned at The Orchard.",
  ownerUserId: DEMO_USER_ID,
  suiteWorkspaceId: REVIEW_SUITE_FIXTURE.workspace.id,
  ownerName: REVIEW_SUITE_FIXTURE.workspace.ownerName,
  ownerEmail: "orla@theorchard.example",
  plan: "free",
  createdAt,
  updatedAt: createdAt,
  templateId: REVIEW_SUITE_FIXTURE.workspace.templateId,
  isDemo: true,
};

export const demoProjects: Project[] = REVIEW_SUITE_FIXTURE.projects.map(
  (project, index) => ({
    workspaceSlug: demoWorkspace.slug,
    sourceTasksWorkspaceId: REVIEW_SUITE_FIXTURE.workspace.id,
    slug: project.slug,
    name: project.name,
    oneLiner: project.oneLiner,
    accent: "rgb(79 70 229)", // ds-allow: CSS variables cannot safely cross the serialized fixture boundary.
    sortOrder: index,
    // Review projects are deliberately available to the authorised demo owner.
    publishedAt: createdAt,
  }),
);

function statusForReviewState(state: ReviewTimelineState): Task["status"] {
  if (state === "covered") return "shipped";
  if (state === "now") return "in-flight";
  if (state === "cancelled") return "refused";
  return "next";
}

export const demoTasks: Task[] = REVIEW_TIMELINE_MILESTONES.map(
  (milestone, index) =>
    makeDemoTask({
      id: milestone.sourceId,
      workspaceSlug: demoWorkspace.slug,
      projectSlug: REVIEW_PRIMARY_PROJECT.slug,
      title: milestone.title,
      description:
        "A curated milestone from the authorised The Orchard wedding workspace.",
      status: statusForReviewState(milestone.state),
      targetDate: milestone.date,
      sortOrder: index,
      kind: milestone.state === "cancelled" ? "refusal" : "cycle",
      completedAt:
        milestone.state === "covered"
          ? new Date(`${milestone.date}T09:00:00.000Z`)
          : null,
    }),
);

export const demoUpcomingTasks = demoTasks.filter(
  (task) => task.status !== "shipped" && task.status !== "refused",
);

/**
 * Demo plan nodes for the /app curation surface. Maps the demo tasks to the
 * EffectiveNode shape the plan editor expects, so the authenticated dashboard
 * and plan page render fully in demo mode without touching the DB. Lane logic
 * mirrors `statusToLane` in queries.ts (kept inline to avoid an import cycle).
 */
function demoLane(
  status: string,
  targetDate: string | null,
): "Next" | "In flight" | "Shipped" | "Later" {
  if (status === "shipped") return "Shipped";
  if (status === "in-flight") return "In flight";
  if (!targetDate) return "Later";
  return "Next";
}

const reviewAudienceStateBySourceId = new Map(
  REVIEW_TIMELINE_MILESTONES.map((milestone) => [
    milestone.sourceId,
    milestone.state,
  ]),
);

function demoAudienceState(
  sourceId: string,
  status: string,
  targetDate: string | null,
): "covered" | "now" | "next" | "later" | "cancelled" {
  const curatedState = reviewAudienceStateBySourceId.get(sourceId);
  if (curatedState) return curatedState;
  if (status === "shipped") return "covered";
  if (status === "refused") return "cancelled";
  if (status === "in-flight" || status === "waiting") return "now";
  return targetDate ? "next" : "later";
}

export function demoEffectiveNodes(workspaceSlug = demoWorkspace.slug) {
  const dataset = getDemoSharedUpdateDataset(workspaceSlug);
  if (!dataset) return [];

  return dataset.tasks.map((t, i) => ({
    id: t.id,
    projectSlug: t.projectSlug,
    workspaceSlug: t.workspaceSlug,
    title: t.title,
    status: t.status,
    targetDate: t.targetDate ?? null,
    sourceTargetDate: t.targetDate ?? null,
    sortOrder: t.sortOrder ?? i,
    lane: demoLane(t.status, t.targetDate ?? null),
    audienceState: demoAudienceState(t.id, t.status, t.targetDate ?? null),
    sourceAudienceState: demoAudienceState(t.id, t.status, t.targetDate ?? null),
    audienceStateOverride: null,
    hidden: false,
    laneOverride: null,
    labelOverride: null,
    dateOverride: null,
    dateOverrideMode: "inherit" as const,
    source: "synced" as const,
    driftDetected: false,
    updatedAt: t.updatedAt,
  }));
}

export const weddingDemoWorkspace: Workspace = {
  slug: "wedding-planning",
  name: "Harbour House wedding",
  description:
    "A planning update for a venue, couple, and suppliers who need the next steps in plain English.",
  ownerUserId: "seed-wedding-demo-user",
  suiteWorkspaceId: null,
  ownerName: "Aoife Murphy",
  ownerEmail: "aoife@harbourhouse.example",
  plan: "free",
  createdAt,
  updatedAt: createdAt,
  templateId: "wedding-planning-workspace",
  isDemo: false,
};

export const weddingDemoProjects: Project[] = [
  {
    workspaceSlug: "wedding-planning",
    sourceTasksWorkspaceId: null,
    slug: "planning",
    name: "Planning Roadmap",
    oneLiner: "What is decided, what is moving, and what needs attention before the day.",
    accent: "rgb(190 24 93)", // ds-allow: CSS variables cannot safely cross the serialized fixture boundary.
    sortOrder: 0,
    // Wedding demo workspace is always published.
    publishedAt: createdAt,
  },
];

export const weddingDemoTasks: Task[] = [
  makeDemoTask({
    id: "wedding-planning-001",
    workspaceSlug: "wedding-planning",
    projectSlug: "planning",
    title: "Confirm final guest numbers",
    description:
      "Couple to confirm the final headcount before the venue locks table layout and catering quantities.",
    status: "in-flight",
    targetDate: "2026-05-14",
    sortOrder: 1,
  }),
  makeDemoTask({
    id: "wedding-planning-002",
    workspaceSlug: "wedding-planning",
    projectSlug: "planning",
    title: "Supplier arrival times need confirmation",
    description:
      "Photographer, florist, and band arrival times are not all confirmed yet. This is the main planning risk.",
    status: "waiting",
    targetDate: "2026-05-15",
    sortOrder: 2,
  }),
  makeDemoTask({
    id: "wedding-planning-003",
    workspaceSlug: "wedding-planning",
    projectSlug: "planning",
    title: "Menu tasting notes sent to catering",
    description:
      "Venue has sent the couple's menu decisions to catering and is waiting for final dietary notes.",
    status: "in-flight",
    targetDate: "2026-05-16",
    sortOrder: 3,
  }),
  makeDemoTask({
    id: "wedding-planning-004",
    workspaceSlug: "wedding-planning",
    projectSlug: "planning",
    title: "Final-week walkthrough",
    description:
      "Venue, planner, and couple walk through room setup, ceremony flow, supplier access, and backup weather plan.",
    status: "next",
    targetDate: "2026-05-20",
    sortOrder: 4,
  }),
  makeDemoTask({
    id: "wedding-planning-005",
    workspaceSlug: "wedding-planning",
    projectSlug: "planning",
    title: "Ceremony room layout agreed",
    description:
      "The couple and venue agreed the ceremony layout, aisle placement, and reserved family seating.",
    status: "shipped",
    targetDate: "2026-05-08",
    sortOrder: 5,
    completedAt: new Date("2026-05-08T09:00:00Z"),
  }),
  makeDemoTask({
    id: "wedding-planning-006",
    workspaceSlug: "wedding-planning",
    projectSlug: "planning",
    title: "Outdoor drinks reception",
    description:
      "Not relying on an outdoor-only reception. The weather backup is now the default plan.",
    status: "refused",
    kind: "refusal",
    targetDate: null,
    sortOrder: 6,
  }),
];

export const weddingDemoUpcomingTasks = weddingDemoTasks.filter(
  (task) => task.status !== "shipped" && task.status !== "refused",
);

export function getDemoSharedUpdateDataset(workspaceSlug: string) {
  if (workspaceSlug === demoWorkspace.slug) {
    return {
      workspace: demoWorkspace,
      projects: demoProjects,
      tasks: demoTasks,
      upcoming: demoUpcomingTasks,
    };
  }

  if (workspaceSlug === weddingDemoWorkspace.slug) {
    return {
      workspace: weddingDemoWorkspace,
      projects: weddingDemoProjects,
      tasks: weddingDemoTasks,
      upcoming: weddingDemoUpcomingTasks,
    };
  }

  return null;
}

/**
 * Lookup helpers for the demo/review data boundary.
 *
 * Every demo-mode query goes through these fixtures before it can reach the
 * database. Unknown slugs intentionally resolve to null/empty so App Router
 * can render its normal not-found state without probing tenant tables.
 */
export function getDemoWorkspaceFixture(
  workspaceSlug: string,
): Workspace | null {
  return getDemoSharedUpdateDataset(workspaceSlug)?.workspace ?? null;
}

export function getDemoProjectsFixture(workspaceSlug: string): Project[] {
  return getDemoSharedUpdateDataset(workspaceSlug)?.projects ?? [];
}

export function getDemoTasksFixture(workspaceSlug: string): Task[] {
  return getDemoSharedUpdateDataset(workspaceSlug)?.tasks ?? [];
}

export function getDemoProjectFixture(
  workspaceSlug: string,
  projectSlug: string,
): Project | null {
  return (
    getDemoProjectsFixture(workspaceSlug).find(
      (project) => project.slug === projectSlug,
    ) ?? null
  );
}

export function getDemoTaskFixture(
  workspaceSlug: string,
  projectSlug: string,
  taskId: string,
): Task | null {
  return (
    getDemoTasksFixture(workspaceSlug).find(
      (task) =>
        task.projectSlug === projectSlug && task.id === taskId,
    ) ?? null
  );
}

function makeDemoTask(
  task: Pick<
    Task,
    | "id"
    | "workspaceSlug"
    | "projectSlug"
    | "title"
    | "description"
    | "status"
    | "targetDate"
    | "sortOrder"
  > &
    Partial<Task>,
): Task {
  return {
    phase: null,
    tier: null,
    assignee: "claude-code",
    cycleLabel: null,
    kind: "cycle",
    category: null,
    priority: null,
    blockerId: null,
    unblocks: null,
    weekHeading: null,
    channel: null,
    isLaunch: false,
    day: null,
    postingTime: null,
    createdAt,
    updatedAt: createdAt,
    completedAt: null,
    ...task,
  };
}
