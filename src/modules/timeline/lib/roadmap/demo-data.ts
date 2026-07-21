import type { Project, Task, Workspace } from "@/modules/timeline/server/db/timeline-schema";

const createdAt = new Date("2026-05-11T07:00:00Z");

export const demoWorkspace: Workspace = {
  slug: "tasks",
  name: "Tasks · Product Roadmap",
  description: "What we're building next, written in plain English.",
  ownerUserId: "seed-demo-user",
  suiteWorkspaceId: "tasks",
  ownerName: "Ethan McNamara",
  ownerEmail: "hello@signalstudio.ie",
  plan: "free",
  createdAt,
  updatedAt: createdAt,
  templateId: null,
  isDemo: true,
};

export const demoProjects: Project[] = [
  {
    workspaceSlug: "tasks",
    sourceTasksWorkspaceId: "tasks",
    slug: "product",
    name: "Product Roadmap",
    oneLiner: "What we're building, and what we said no to.",
    accent: "#4f46e5",
    sortOrder: 0,
    // Demo workspace is always published.
    publishedAt: createdAt,
  },
];

export const demoTasks: Task[] = [
  {
    id: "tasks-product-001",
    projectSlug: "product",
    workspaceSlug: "tasks",
    title: "Workspace onboarding, first-run experience",
    description:
      "First-run experience for new workspaces. Mark tasks as milestones in Signal Tasks and they appear in your plan automatically.",
    status: "in-flight",
    phase: null,
    tier: null,
    assignee: "claude-code",
    cycleLabel: null,
    targetDate: "2026-05-14",
    sortOrder: 1,
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
  },
  {
    id: "tasks-product-002",
    projectSlug: "product",
    workspaceSlug: "tasks",
    title: "Proof card on the marketing homepage",
    description:
      "A live screenshot of the demo workspace embedded in the homepage hero, so the product sells itself without a separate demo page. Blocked on screenshot infra.",
    status: "waiting",
    phase: null,
    tier: null,
    assignee: "claude-code",
    cycleLabel: null,
    targetDate: "2026-05-15",
    sortOrder: 2,
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
  },
  {
    id: "tasks-product-003",
    projectSlug: "product",
    workspaceSlug: "tasks",
    title: "Invite-only beta",
    description:
      "Gated signup behind an invite code. Small cohort, high-signal feedback. No public self-serve until the onboarding is solid.",
    status: "in-flight",
    phase: null,
    tier: null,
    assignee: "claude-code",
    cycleLabel: null,
    targetDate: "2026-05-18",
    sortOrder: 3,
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
  },
  {
    id: "tasks-product-004",
    projectSlug: "product",
    workspaceSlug: "tasks",
    title: "Comment threads on roadmap items",
    description:
      "Not shipping. Conversations belong in the work, not bolted onto a status page. Replying lands in your email, that's the channel.",
    status: "refused",
    phase: null,
    tier: null,
    assignee: "claude-code",
    cycleLabel: null,
    targetDate: null,
    sortOrder: 4,
    kind: "refusal",
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
  },
  {
    id: "tasks-product-005",
    projectSlug: "product",
    workspaceSlug: "tasks",
    title: "Per-workspace project slugs",
    description:
      'Project slugs are now scoped per workspace, two separate plans can each have a "blog" project without colliding. Schema migration shipped cleanly.',
    status: "shipped",
    phase: null,
    tier: null,
    assignee: "claude-code",
    cycleLabel: null,
    targetDate: "2026-05-08",
    sortOrder: 5,
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
    completedAt: new Date("2026-05-08T09:00:00Z"),
  },
  {
    id: "tasks-product-006",
    projectSlug: "product",
    workspaceSlug: "tasks",
    title: "studio. brand integration in nav + footer",
    description:
      "The studio. parent brand whisper is now in the nav and footer, links Tasks and Roadmap under one roof without making it a big deal.",
    status: "shipped",
    phase: null,
    tier: null,
    assignee: "claude-code",
    cycleLabel: null,
    targetDate: "2026-05-10",
    sortOrder: 6,
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
    completedAt: new Date("2026-05-10T09:00:00Z"),
  },
  {
    id: "tasks-product-007",
    projectSlug: "product",
    workspaceSlug: "tasks",
    title: "AI-generated roadmap items",
    description:
      "Not this year. The product's value is structured clarity, not generated content. If we ship AI suggestions before the manual workflow is proven, we're solving the wrong problem.",
    status: "refused",
    phase: null,
    tier: null,
    assignee: "claude-code",
    cycleLabel: null,
    targetDate: null,
    sortOrder: 7,
    kind: "refusal",
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
  },
];

export const demoUpcomingTasks = demoTasks.filter(
  (task) => task.status !== "shipped" && task.status !== "refused",
);

/**
 * Synthetic user id used by access-mode demo/review (see lib/access-mode.ts).
 * In that mode the auth layer resolves to this id and the data layer serves
 * the in-memory demo workspace above, the real DB is never queried.
 */
export const DEMO_USER_ID = "seed-demo-user";

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
    sortOrder: t.sortOrder ?? i,
    lane: demoLane(t.status, t.targetDate ?? null),
    hidden: false,
    laneOverride: null,
    labelOverride: null,
    dateOverride: null,
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
    accent: "#be185d",
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
