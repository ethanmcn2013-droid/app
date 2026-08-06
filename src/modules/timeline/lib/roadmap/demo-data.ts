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

/**
 * The state-coverage demo workspace.
 *
 * `templateId` is null on purpose, and the null is the fix for a real defect.
 * It claimed "wedding-planning-workspace", which is a workspace-creation fact
 * the artifact reads as permission to frame every plan inside it as a wedding:
 * `defaultAudienceKind` (lib/owner-artifact.ts) turned it into audience kind
 * "couple", which captioned the final date of the coffee roastery and the
 * bakery reopening "Wedding day", counted down "Until wedding day", and
 * introduced both as "A shared wedding timeline".
 *
 * This workspace was never created from that template. It holds eleven plans
 * across weddings, schools, small businesses and student work, deliberately,
 * so the redesign can be judged against more than the case it was designed
 * for. Null is what the column means for a workspace assembled from scratch
 * (timeline-schema.ts), and it is what this one is.
 *
 * The consequence is accepted: the two plans in here that ARE weddings now
 * read in the neutral register too, because nothing at project level can tell
 * the artifact otherwise — audience kind is a workspace fact or an explicit
 * publication choice, and there is no project column between them. Generic and
 * true beats specific and false. The wedding showcase is `demoWorkspace` (The
 * Orchard, three weddings), which is created from the wedding template and is
 * untouched.
 */
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
  templateId: null,
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
  /**
   * Sparse/timing-state fixtures (world-class Timeline redesign).
   *
   * One project per milestone-count/timing state the artifact can render,
   * so every state is reachable in demo/review mode without a QA-only
   * route. These live in the wedding-planning workspace, deliberately NOT
   * the-orchard review-suite workspace: demoProjects there is a pinned,
   * cross-surface contract (exactly three authorised weddings), asserted
   * by owner-artifact.test.ts's "three authorised weddings" test AND by
   * the live project switcher in
   * experience/feature-tests/timeline-project-switcher.spec.ts
   * (`options.toHaveCount(3)`). Adding to it would corrupt both.
   *
   * Dates are hand-picked against the one pinned review clock —
   * REVIEW_SUITE_FIXTURE.reviewToday, equal to
   * PINNED_REVIEW_CALENDAR_FRAME.today (src/lib/calendar-frame.ts) —
   * "2026-07-16", never Date.now(), so "overdue" and "next" stay stable
   * regardless of when this renders. 2026-09-12 is deliberately never used
   * (retired wedding date, see calendar-frame.ts).
   *
   * KNOWN GAP: as of this pass, this workspace is not yet reachable from
   * the live owner route. getCurrentWorkspace()/resolveTimelineContext()
   * in server/auth.ts hard-resolve demo/review mode to demoWorkspace only
   * — see this cycle's report for the precise, minimal change that would
   * close it. The fixture shape below is ready for that route to land.
   */
  {
    workspaceSlug: "wedding-planning",
    sourceTasksWorkspaceId: null,
    slug: "empty-plan",
    name: "Two Sisters Coffee Cart",
    oneLiner: "A brand new plan, ready for its first milestone.",
    accent: "rgb(190 24 93)", // ds-allow: CSS variables cannot safely cross the serialized fixture boundary.
    sortOrder: 1,
    publishedAt: createdAt,
  },
  {
    workspaceSlug: "wedding-planning",
    sourceTasksWorkspaceId: null,
    slug: "one-undated",
    name: "St. Brigid’s Sixth Class Musical",
    oneLiner: "One thing to plan so far, with no date picked yet.",
    accent: "rgb(190 24 93)", // ds-allow: CSS variables cannot safely cross the serialized fixture boundary.
    sortOrder: 2,
    publishedAt: createdAt,
  },
  {
    workspaceSlug: "wedding-planning",
    sourceTasksWorkspaceId: null,
    slug: "one-dated",
    name: "Riverside Wines",
    oneLiner: "One clear date on the calendar so far.",
    accent: "rgb(190 24 93)", // ds-allow: CSS variables cannot safely cross the serialized fixture boundary.
    sortOrder: 3,
    publishedAt: createdAt,
  },
  {
    workspaceSlug: "wedding-planning",
    sourceTasksWorkspaceId: null,
    slug: "two-dated",
    name: "Aoibhinn’s Final-Year Portfolio",
    oneLiner: "Two dates set, with more milestones still to add.",
    accent: "rgb(190 24 93)", // ds-allow: CSS variables cannot safely cross the serialized fixture boundary.
    sortOrder: 4,
    publishedAt: createdAt,
  },
  {
    workspaceSlug: "wedding-planning",
    sourceTasksWorkspaceId: null,
    slug: "five-mixed",
    name: "Hazel & Rye Bakery Reopening",
    oneLiner:
      "What is done, what is next, and what is still ahead before reopening day.",
    accent: "rgb(190 24 93)", // ds-allow: CSS variables cannot safely cross the serialized fixture boundary.
    sortOrder: 5,
    publishedAt: createdAt,
  },
  {
    workspaceSlug: "wedding-planning",
    sourceTasksWorkspaceId: null,
    slug: "five-untimed",
    name: "Year 9 Geography Field Trip",
    oneLiner: "Five things to plan, none scheduled yet.",
    accent: "rgb(190 24 93)", // ds-allow: CSS variables cannot safely cross the serialized fixture boundary.
    sortOrder: 6,
    publishedAt: createdAt,
  },
  {
    workspaceSlug: "wedding-planning",
    sourceTasksWorkspaceId: null,
    slug: "partial-timing",
    name: "Conor’s Leaving Cert Art Project",
    oneLiner: "Some dates are set. Some pieces are still undecided.",
    accent: "rgb(190 24 93)", // ds-allow: CSS variables cannot safely cross the serialized fixture boundary.
    sortOrder: 7,
    publishedAt: createdAt,
  },
  {
    workspaceSlug: "wedding-planning",
    sourceTasksWorkspaceId: null,
    slug: "overdue-plan",
    name: "Fiona & Declan’s Wedding",
    oneLiner: "One thing is overdue and needs attention before the day.",
    accent: "rgb(190 24 93)", // ds-allow: CSS variables cannot safely cross the serialized fixture boundary.
    sortOrder: 8,
    publishedAt: createdAt,
  },
  {
    workspaceSlug: "wedding-planning",
    sourceTasksWorkspaceId: null,
    slug: "twenty-plan",
    name: "Milltown Coffee Roastery, Year One",
    oneLiner: "Twenty-two milestones across the roastery's first year.",
    accent: "rgb(190 24 93)", // ds-allow: CSS variables cannot safely cross the serialized fixture boundary.
    sortOrder: 9,
    publishedAt: createdAt,
  },
  {
    workspaceSlug: "wedding-planning",
    sourceTasksWorkspaceId: null,
    slug: "long-text",
    name: "The Ballyneety and District Community Hall Renovation, Roof Repair and Accessibility Upgrade Committee",
    oneLiner: "A long project name and a long milestone, kept for wrap testing.",
    accent: "rgb(190 24 93)", // ds-allow: CSS variables cannot safely cross the serialized fixture boundary.
    sortOrder: 10,
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

  // empty-plan has zero milestones by design — no tasks reference it.

  // one-undated: exactly one milestone, no timing at all (the headline bug case).
  makeDemoTask({
    id: "fixture-one-undated-1",
    workspaceSlug: "wedding-planning",
    projectSlug: "one-undated",
    title: "Pick the school musical",
    description:
      "The teachers are deciding between two scripts before rehearsals can be scheduled.",
    status: "in-flight",
    targetDate: null,
    sortOrder: 1,
  }),

  // one-dated: exactly one milestone with a real date.
  makeDemoTask({
    id: "fixture-one-dated-1",
    workspaceSlug: "wedding-planning",
    projectSlug: "one-dated",
    title: "Tasting counter opens to the public",
    description: "The new tasting counter at the shop front opens for walk-ins.",
    status: "next",
    targetDate: "2026-08-14",
    sortOrder: 1,
  }),

  // two-dated: two dated milestones.
  makeDemoTask({
    id: "fixture-two-dated-1",
    workspaceSlug: "wedding-planning",
    projectSlug: "two-dated",
    title: "Submit the portfolio draft for review",
    description:
      "A full draft goes to the year tutor for feedback before the final push.",
    status: "next",
    targetDate: "2026-08-10",
    sortOrder: 1,
  }),
  makeDemoTask({
    id: "fixture-two-dated-2",
    workspaceSlug: "wedding-planning",
    projectSlug: "two-dated",
    title: "Submit the final portfolio",
    description: "The finished portfolio is due at the college office.",
    status: "next",
    targetDate: "2026-09-04",
    sortOrder: 2,
  }),

  // five-mixed: five milestones, some complete, one current, some upcoming, all dated.
  makeDemoTask({
    id: "fixture-five-mixed-1",
    workspaceSlug: "wedding-planning",
    projectSlug: "five-mixed",
    title: "Lease renewed for the corner unit",
    description: "The landlord signed off on another three years.",
    status: "shipped",
    targetDate: "2026-05-20",
    sortOrder: 1,
    completedAt: new Date("2026-05-20T09:00:00Z"),
  }),
  makeDemoTask({
    id: "fixture-five-mixed-2",
    workspaceSlug: "wedding-planning",
    projectSlug: "five-mixed",
    title: "Kitchen equipment installed",
    description: "The new oven and proving cabinet are in and plumbed.",
    status: "shipped",
    targetDate: "2026-06-18",
    sortOrder: 2,
    completedAt: new Date("2026-06-18T09:00:00Z"),
  }),
  makeDemoTask({
    id: "fixture-five-mixed-3",
    workspaceSlug: "wedding-planning",
    projectSlug: "five-mixed",
    title: "Health inspection",
    description:
      "The environmental health officer checks the new kitchen before it can open.",
    status: "in-flight",
    targetDate: "2026-07-22",
    sortOrder: 3,
  }),
  makeDemoTask({
    id: "fixture-five-mixed-4",
    workspaceSlug: "wedding-planning",
    projectSlug: "five-mixed",
    title: "Staff hired and trained",
    description: "Two bakers and a counter lead start the week before reopening.",
    status: "next",
    targetDate: "2026-08-05",
    sortOrder: 4,
  }),
  makeDemoTask({
    id: "fixture-five-mixed-5",
    workspaceSlug: "wedding-planning",
    projectSlug: "five-mixed",
    title: "Reopening day",
    description: "Doors open to the public for the first time since the refit.",
    status: "next",
    targetDate: "2026-08-20",
    sortOrder: 5,
  }),

  // five-untimed: five milestones, none dated — the ordered-plan case.
  makeDemoTask({
    id: "fixture-five-untimed-1",
    workspaceSlug: "wedding-planning",
    projectSlug: "five-untimed",
    title: "Choose the destination",
    description:
      "Two sites are shortlisted; the geography department is deciding between them.",
    status: "in-flight",
    targetDate: null,
    sortOrder: 1,
  }),
  makeDemoTask({
    id: "fixture-five-untimed-2",
    workspaceSlug: "wedding-planning",
    projectSlug: "five-untimed",
    title: "Book the coach",
    description: "Waiting on the destination before a coach company can be booked.",
    status: "next",
    targetDate: null,
    sortOrder: 2,
  }),
  makeDemoTask({
    id: "fixture-five-untimed-3",
    workspaceSlug: "wedding-planning",
    projectSlug: "five-untimed",
    title: "Confirm the risk assessment",
    description:
      "The school office needs the finished risk assessment before it can approve the trip.",
    status: "next",
    targetDate: null,
    sortOrder: 3,
  }),
  makeDemoTask({
    id: "fixture-five-untimed-4",
    workspaceSlug: "wedding-planning",
    projectSlug: "five-untimed",
    title: "Collect the permission forms",
    description: "Every pupil needs a signed form back before the trip is confirmed.",
    status: "next",
    targetDate: null,
    sortOrder: 4,
  }),
  makeDemoTask({
    id: "fixture-five-untimed-5",
    workspaceSlug: "wedding-planning",
    projectSlug: "five-untimed",
    title: "Pack the first-aid kits",
    description: "One kit per group, checked and restocked before the trip.",
    status: "next",
    targetDate: null,
    sortOrder: 5,
  }),

  // partial-timing: five milestones, only some dated — must stay an ordered plan.
  makeDemoTask({
    id: "fixture-partial-timing-1",
    workspaceSlug: "wedding-planning",
    projectSlug: "partial-timing",
    title: "Choose the project theme",
    description:
      'Settled on "home" as the theme after three rounds of sketches.',
    status: "shipped",
    targetDate: "2026-06-02",
    sortOrder: 1,
    completedAt: new Date("2026-06-02T09:00:00Z"),
  }),
  makeDemoTask({
    id: "fixture-partial-timing-2",
    workspaceSlug: "wedding-planning",
    projectSlug: "partial-timing",
    title: "Submit the final pieces for marking",
    description: "The finished work is due at the state examiner.",
    status: "next",
    targetDate: "2026-09-18",
    sortOrder: 2,
  }),
  makeDemoTask({
    id: "fixture-partial-timing-3",
    workspaceSlug: "wedding-planning",
    projectSlug: "partial-timing",
    title: "Finish the sketchbook",
    description: "Still filling in studies for two of the final pieces.",
    status: "in-flight",
    targetDate: null,
    sortOrder: 3,
  }),
  makeDemoTask({
    id: "fixture-partial-timing-4",
    workspaceSlug: "wedding-planning",
    projectSlug: "partial-timing",
    title: "Pick the mounting boards",
    description: "Waiting to see the finished pieces before choosing board colours.",
    status: "next",
    targetDate: null,
    sortOrder: 4,
  }),
  makeDemoTask({
    id: "fixture-partial-timing-5",
    workspaceSlug: "wedding-planning",
    projectSlug: "partial-timing",
    title: "Photograph the finished pieces",
    description:
      "A clean set of photos goes in the portfolio alongside the originals.",
    status: "next",
    targetDate: null,
    sortOrder: 5,
  }),

  // overdue-plan: one milestone is dated in the past and not complete.
  makeDemoTask({
    id: "fixture-overdue-plan-1",
    workspaceSlug: "wedding-planning",
    projectSlug: "overdue-plan",
    title: "Book the ceremony venue",
    description: "The registry office confirmed the room for the afternoon.",
    status: "shipped",
    targetDate: "2026-04-10",
    sortOrder: 1,
    completedAt: new Date("2026-04-10T09:00:00Z"),
  }),
  makeDemoTask({
    id: "fixture-overdue-plan-2",
    workspaceSlug: "wedding-planning",
    projectSlug: "overdue-plan",
    title: "Confirm the caterer",
    description: "Signed with the caterer for a sit-down meal for eighty.",
    status: "shipped",
    targetDate: "2026-06-01",
    sortOrder: 2,
    completedAt: new Date("2026-06-01T09:00:00Z"),
  }),
  makeDemoTask({
    id: "fixture-overdue-plan-3",
    workspaceSlug: "wedding-planning",
    projectSlug: "overdue-plan",
    title: "Send the save-the-dates",
    description: "Still sitting with the printer. This was due out before today.",
    status: "in-flight",
    targetDate: "2026-07-03",
    sortOrder: 3,
  }),
  makeDemoTask({
    id: "fixture-overdue-plan-4",
    workspaceSlug: "wedding-planning",
    projectSlug: "overdue-plan",
    title: "Choose the flowers",
    description:
      "A florist visit is booked to settle the bouquet and table arrangements.",
    status: "next",
    targetDate: "2026-08-16",
    sortOrder: 4,
  }),
  makeDemoTask({
    id: "fixture-overdue-plan-5",
    workspaceSlug: "wedding-planning",
    projectSlug: "overdue-plan",
    title: "Confirm final numbers with the venue",
    description: "The venue needs a firm headcount to finish the table plan.",
    status: "next",
    targetDate: "2026-09-20",
    sortOrder: 5,
  }),

  // twenty-plan: twenty-two dated milestones, for collision and performance testing.
  makeDemoTask({
    id: "fixture-twenty-plan-1",
    workspaceSlug: "wedding-planning",
    projectSlug: "twenty-plan",
    title: "Lease signed for the roastery unit",
    description: "The small unit off the Milltown Road is confirmed for five years.",
    status: "shipped",
    targetDate: "2026-02-03",
    sortOrder: 1,
    completedAt: new Date("2026-02-03T09:00:00Z"),
  }),
  makeDemoTask({
    id: "fixture-twenty-plan-2",
    workspaceSlug: "wedding-planning",
    projectSlug: "twenty-plan",
    title: "Roaster ordered",
    description: "A twelve-kilo drum roaster, on order from a supplier in Cork.",
    status: "shipped",
    targetDate: "2026-02-20",
    sortOrder: 2,
    completedAt: new Date("2026-02-20T09:00:00Z"),
  }),
  makeDemoTask({
    id: "fixture-twenty-plan-3",
    workspaceSlug: "wedding-planning",
    projectSlug: "twenty-plan",
    title: "Unit fit-out begins",
    description: "Electrics, extraction, and plumbing work starts on site.",
    status: "shipped",
    targetDate: "2026-03-10",
    sortOrder: 3,
    completedAt: new Date("2026-03-10T09:00:00Z"),
  }),
  makeDemoTask({
    id: "fixture-twenty-plan-4",
    workspaceSlug: "wedding-planning",
    projectSlug: "twenty-plan",
    title: "Roaster delivered",
    description: "Craned in through the side door on a Sunday morning.",
    status: "shipped",
    targetDate: "2026-04-14",
    sortOrder: 4,
    completedAt: new Date("2026-04-14T09:00:00Z"),
  }),
  makeDemoTask({
    id: "fixture-twenty-plan-5",
    workspaceSlug: "wedding-planning",
    projectSlug: "twenty-plan",
    title: "First test roast",
    description: "A small batch of house-blend beans, roasted to check the machine.",
    status: "shipped",
    targetDate: "2026-04-28",
    sortOrder: 5,
    completedAt: new Date("2026-04-28T09:00:00Z"),
  }),
  makeDemoTask({
    id: "fixture-twenty-plan-6",
    workspaceSlug: "wedding-planning",
    projectSlug: "twenty-plan",
    title: "Food safety inspection passed",
    description: "The council's food safety officer signed off on the unit.",
    status: "shipped",
    targetDate: "2026-05-12",
    sortOrder: 6,
    completedAt: new Date("2026-05-12T09:00:00Z"),
  }),
  makeDemoTask({
    id: "fixture-twenty-plan-7",
    workspaceSlug: "wedding-planning",
    projectSlug: "twenty-plan",
    title: "Website goes live",
    description: "A simple site with the blend list and the opening-day date.",
    status: "shipped",
    targetDate: "2026-05-15",
    sortOrder: 7,
    completedAt: new Date("2026-05-15T09:00:00Z"),
  }),
  makeDemoTask({
    id: "fixture-twenty-plan-8",
    workspaceSlug: "wedding-planning",
    projectSlug: "twenty-plan",
    title: "First wholesale account signed",
    description: "A cafe on the Ennis Road takes the house blend on tap.",
    status: "shipped",
    targetDate: "2026-05-18",
    sortOrder: 8,
    completedAt: new Date("2026-05-18T09:00:00Z"),
  }),
  makeDemoTask({
    id: "fixture-twenty-plan-9",
    workspaceSlug: "wedding-planning",
    projectSlug: "twenty-plan",
    title: "Staff hired",
    description: "A roaster's assistant and a Saturday counter hand join the team.",
    status: "shipped",
    targetDate: "2026-06-02",
    sortOrder: 9,
    completedAt: new Date("2026-06-02T09:00:00Z"),
  }),
  makeDemoTask({
    id: "fixture-twenty-plan-10",
    workspaceSlug: "wedding-planning",
    projectSlug: "twenty-plan",
    title: "Opening day",
    description: "Doors open to the public for the first time.",
    status: "shipped",
    targetDate: "2026-06-20",
    sortOrder: 10,
    completedAt: new Date("2026-06-20T09:00:00Z"),
  }),
  makeDemoTask({
    id: "fixture-twenty-plan-11",
    workspaceSlug: "wedding-planning",
    projectSlug: "twenty-plan",
    title: "First subscription boxes shipped",
    description:
      "The first round of monthly bag subscriptions goes out this week.",
    status: "in-flight",
    targetDate: "2026-07-25",
    sortOrder: 11,
  }),
  makeDemoTask({
    id: "fixture-twenty-plan-12",
    workspaceSlug: "wedding-planning",
    projectSlug: "twenty-plan",
    title: "Second wholesale account signed",
    description: "A second cafe, this one in the city centre, places its first order.",
    status: "next",
    targetDate: "2026-08-01",
    sortOrder: 12,
  }),
  makeDemoTask({
    id: "fixture-twenty-plan-13",
    workspaceSlug: "wedding-planning",
    projectSlug: "twenty-plan",
    title: "Farmers' market stall begins",
    description: "A Saturday stall at the market, selling bags and cups by the roast.",
    status: "next",
    targetDate: "2026-08-02",
    sortOrder: 13,
  }),
  makeDemoTask({
    id: "fixture-twenty-plan-14",
    workspaceSlug: "wedding-planning",
    projectSlug: "twenty-plan",
    title: "Autumn blend launches",
    description: "A darker seasonal blend, timed for the turn in the weather.",
    status: "next",
    targetDate: "2026-08-22",
    sortOrder: 14,
  }),
  makeDemoTask({
    id: "fixture-twenty-plan-15",
    workspaceSlug: "wedding-planning",
    projectSlug: "twenty-plan",
    title: "First roasting workshop hosted",
    description: "Eight seats, a Saturday morning, home roasting basics.",
    status: "next",
    targetDate: "2026-09-05",
    sortOrder: 15,
  }),
  makeDemoTask({
    id: "fixture-twenty-plan-16",
    workspaceSlug: "wedding-planning",
    projectSlug: "twenty-plan",
    title: "Second staff member hired",
    description:
      "Trade is steady enough now to bring on a second full-time roaster.",
    status: "next",
    targetDate: "2026-09-19",
    sortOrder: 16,
  }),
  makeDemoTask({
    id: "fixture-twenty-plan-17",
    workspaceSlug: "wedding-planning",
    projectSlug: "twenty-plan",
    title: "Christmas blend launches",
    description: "Gift bags and the Christmas blend go on the shelf.",
    status: "next",
    targetDate: "2026-11-14",
    sortOrder: 17,
  }),
  makeDemoTask({
    id: "fixture-twenty-plan-18",
    workspaceSlug: "wedding-planning",
    projectSlug: "twenty-plan",
    title: "Christmas trading week begins",
    description: "The busiest week of the year so far, extra hours on the counter.",
    status: "next",
    targetDate: "2026-12-18",
    sortOrder: 18,
  }),
  makeDemoTask({
    id: "fixture-twenty-plan-19",
    workspaceSlug: "wedding-planning",
    projectSlug: "twenty-plan",
    title: "First year's books closed",
    description: "The accountant closes out the roastery's first trading year.",
    status: "next",
    targetDate: "2027-01-10",
    sortOrder: 19,
  }),
  makeDemoTask({
    id: "fixture-twenty-plan-20",
    workspaceSlug: "wedding-planning",
    projectSlug: "twenty-plan",
    title: "Second roaster ordered",
    description: "Demand has outgrown the first machine.",
    status: "next",
    targetDate: "2027-02-08",
    sortOrder: 20,
  }),
  makeDemoTask({
    id: "fixture-twenty-plan-21",
    workspaceSlug: "wedding-planning",
    projectSlug: "twenty-plan",
    title: "First anniversary event",
    description: "An open afternoon for regulars, wholesale partners, and neighbours.",
    status: "next",
    targetDate: "2027-02-20",
    sortOrder: 21,
  }),
  makeDemoTask({
    id: "fixture-twenty-plan-22",
    workspaceSlug: "wedding-planning",
    projectSlug: "twenty-plan",
    title: "Second unit lease signed",
    description:
      "A second, larger unit is confirmed for roasting once the first outgrows its space.",
    status: "next",
    targetDate: "2027-03-15",
    sortOrder: 22,
  }),

  // long-text: a very long project title and a very long milestone title.
  makeDemoTask({
    id: "fixture-long-text-1",
    workspaceSlug: "wedding-planning",
    projectSlug: "long-text",
    title: "Apply for the renovation grant",
    description:
      "The council's community fund covers up to half the cost of the works.",
    status: "shipped",
    targetDate: "2026-03-01",
    sortOrder: 1,
    completedAt: new Date("2026-03-01T09:00:00Z"),
  }),
  makeDemoTask({
    id: "fixture-long-text-2",
    workspaceSlug: "wedding-planning",
    projectSlug: "long-text",
    title:
      "Confirm the wheelchair-accessible ramp specification and drainage plan with the county council's access officer before the autumn planning meeting",
    description: "The longest-running open item on the committee's plan.",
    status: "in-flight",
    targetDate: "2026-08-05",
    sortOrder: 2,
  }),
  makeDemoTask({
    id: "fixture-long-text-3",
    workspaceSlug: "wedding-planning",
    projectSlug: "long-text",
    title: "Reopen the hall to the community",
    description:
      "The hall committee hosts an open evening once the works are signed off.",
    status: "next",
    targetDate: "2026-10-24",
    sortOrder: 3,
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
