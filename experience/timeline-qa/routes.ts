/**
 * State manifest for the Timeline visual-QA harness.
 *
 * Every entry is a REAL route in the running app -- no synthetic harness
 * pages, per the brief. Paths are relative to the Playwright baseURL
 * (default http://localhost:3520, review-mode access, no login wall).
 *
 * Fixture slugs and their one-line descriptions are copied from
 * src/modules/timeline/lib/roadmap/demo-data.ts (weddingDemoProjects), the
 * wedding-planning workspace built specifically to cover every milestone
 * count and timing state the artifact can render. Do not edit that file
 * from here -- it is owned by src/, this manifest only reads its shape.
 */

export type TimelineQaAction =
  | { kind: "none" }
  /** Click the Share button (accessible name "Share") and wait for the
   *  dialog to open before capturing. */
  | { kind: "open-share-dialog" };

export type TimelineQaState = {
  id: string;
  description: string;
  path: string;
  category: "fixture" | "review" | "public";
  action: TimelineQaAction;
  /** HTTP status the initial navigation should return. Almost everything is
   *  200; recorded explicitly so a route that starts silently 404-ing or
   *  500-ing is a diffable fact, not something you have to notice by eye. */
  expectedStatus: number;
};

const FIXTURE_WORKSPACE_ID = "wedding-planning";

type FixtureSlug = {
  slug: string;
  projectName: string;
  description: string;
};

// Order and names mirror weddingDemoProjects in demo-data.ts exactly.
const FIXTURE_SLUGS: FixtureSlug[] = [
  {
    slug: "empty-plan",
    projectName: "Two Sisters Coffee Cart",
    description: "Zero milestones -- the empty state.",
  },
  {
    slug: "one-undated",
    projectName: "St. Brigid Sixth Class Musical",
    description: "One milestone, no date at all -- the headline halfway-placement case.",
  },
  {
    slug: "one-dated",
    projectName: "Riverside Wines",
    description: "One milestone with a real date.",
  },
  {
    slug: "two-dated",
    projectName: "Aoibhinn Final-Year Portfolio",
    description: "Two dated milestones.",
  },
  {
    slug: "five-mixed",
    projectName: "Hazel and Rye Bakery Reopening",
    description: "Five milestones, dated, mixed complete/current/upcoming states.",
  },
  {
    slug: "five-untimed",
    projectName: "Year 9 Geography Field Trip",
    description: "Five milestones, none dated -- the ordered-plan case.",
  },
  {
    slug: "partial-timing",
    projectName: "Conor Leaving Cert Art Project",
    description: "Five milestones, only some dated -- must stay an ordered plan.",
  },
  {
    slug: "overdue-plan",
    projectName: "Fiona and Declan Wedding",
    description: "One milestone is dated in the past and not complete.",
  },
  {
    slug: "twenty-plan",
    projectName: "Milltown Coffee Roastery, Year One",
    description: "Twenty-two dated milestones -- collision and density stress test.",
  },
  {
    slug: "long-text",
    projectName: "Ballyneety Community Hall Renovation Committee",
    description: "A long project title and a long milestone title -- wrap testing.",
  },
];

const REVIEW_PROJECT_SLUG = "mara-finn";
const PUBLIC_BEARER_TOKEN = "DemoAudienceTimelineToken2026Fixed000000000";

export const TIMELINE_QA_STATES: TimelineQaState[] = [
  {
    id: "review-timeline",
    description:
      "Review project (Mara and Finn, nine dated milestones) -- Timeline tab, owner view mode. Also the bare /app/timeline landing route.",
    path: "/app/timeline",
    category: "review",
    action: { kind: "none" },
    expectedStatus: 200,
  },
  {
    id: "review-milestones",
    description: "Review project -- Milestones tab (edit mode, CurationSurface).",
    path: "/app/timeline?mode=edit",
    category: "review",
    action: { kind: "none" },
    expectedStatus: 200,
  },
  {
    id: "review-preview",
    description:
      "Review project -- Preview route. Chrome-free, renders the frozen publication rather than live nodes.",
    path: "/app/timeline/" + REVIEW_PROJECT_SLUG + "/preview",
    category: "review",
    action: { kind: "none" },
    expectedStatus: 200,
  },
  {
    id: "review-share-dialog",
    description: "Review project -- Share dialog opened from the Timeline tab.",
    path: "/app/timeline",
    category: "review",
    action: { kind: "open-share-dialog" },
    expectedStatus: 200,
  },
  {
    id: "public-bearer",
    description:
      "Public bearer artifact at /s/[token] -- no login, no app shell, the exact page an audience receives.",
    path: "/s/" + PUBLIC_BEARER_TOKEN,
    category: "public",
    action: { kind: "none" },
    expectedStatus: 200,
  },
  ...FIXTURE_SLUGS.map(
    (fixture): TimelineQaState => ({
      id: "fixture-" + fixture.slug,
      description: fixture.projectName + " -- " + fixture.description,
      path:
        "/app/timeline?workspaceId=" +
        FIXTURE_WORKSPACE_ID +
        "&projectSlug=" +
        fixture.slug,
      category: "fixture",
      action: { kind: "none" },
      expectedStatus: 200,
    }),
  ),
];
