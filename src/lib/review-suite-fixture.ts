/**
 * One deterministic story for authenticated-suite review surfaces.
 *
 * This file contains identifiers and public presentation facts only. It is
 * intentionally free of auth, database, and framework imports so each product
 * can consume the same review truth without creating a second data boundary.
 * Production access still resolves through the normal membership checks.
 */
export const REVIEW_SUITE_FIXTURE = {
  user: {
    id: "demo-user",
    name: "Orla",
  },
  workspace: {
    id: "demo-ws",
    slug: "the-orchard",
    name: "The Orchard, events",
    ownerName: "Orla",
    templateId: "wedding-planning-workspace",
    planningPeriodId: "demo-planning-period",
  },
  projects: [
    {
      id: "demo-project-mara-finn",
      slug: "mara-finn",
      name: "Mara & Finn",
      oneLiner: "What is settled, what comes next, and what the couple can share.",
    },
    {
      id: "demo-project-nora-cian",
      slug: "nora-cian",
      name: "Nora & Cian",
      oneLiner: "A spring wedding moving from venue decisions into suppliers.",
    },
    {
      id: "demo-project-aisling-tom",
      slug: "aisling-tom",
      name: "Aisling & Tom",
      oneLiner: "An autumn wedding at the start of its planning timeline.",
    },
  ],
  primaryDate: {
    label: "Wedding day",
    date: "2026-10-03",
  },
  journey: {
    sourceNoteId: "demo-note-menu-tasting",
    audiencePublicationId: "demo-audience-publication",
    evidenceAssociationId: "demo-task-to-timeline-menu-tasting",
  },
  reviewToday: "2026-07-22",
  lastUpdatedAt: "2026-07-21T18:30:00.000Z",
} as const;

export type ReviewTimelineState =
  | "covered"
  | "now"
  | "next"
  | "later"
  | "cancelled";

export type ReviewTimelineMilestone = Readonly<{
  sourceId: string;
  publicId: string;
  title: string;
  date: string | null;
  state: ReviewTimelineState;
}>;

/**
 * The founder-approved Mara & Finn artifact, expressed once so the owner
 * timeline and frozen public share cannot drift apart in review mode.
 */
export const REVIEW_TIMELINE_MILESTONES: readonly ReviewTimelineMilestone[] = [
  {
    sourceId: "demo-milestone-we-said-yes",
    publicId: "demo-audience-item-yes",
    title: "We said yes",
    date: "2026-01-02",
    state: "covered",
  },
  {
    sourceId: "demo-milestone-orchard-reserved",
    publicId: "demo-audience-item-venue",
    title: "The Orchard reserved",
    date: "2026-04-18",
    state: "covered",
  },
  {
    sourceId: "demo-task-menu-tasting",
    publicId: "demo-audience-item-menu",
    title: "Menu tasting at The Orchard",
    date: "2026-08-01",
    state: "now",
  },
  {
    sourceId: "demo-milestone-invitations",
    publicId: "demo-audience-item-invitations",
    title: "Send the invitations",
    date: "2026-08-08",
    state: "next",
  },
  {
    sourceId: "demo-milestone-fitting",
    publicId: "demo-audience-item-fitting",
    title: "Final dress fitting",
    date: "2026-08-22",
    state: "next",
  },
  {
    sourceId: "demo-milestone-music",
    publicId: "demo-audience-item-music",
    title: "Choose the evening music",
    date: "2026-08-29",
    state: "next",
  },
  {
    sourceId: "demo-milestone-guests",
    publicId: "demo-audience-item-guests",
    title: "Final guest numbers",
    date: "2026-09-05",
    state: "later",
  },
  {
    sourceId: "demo-milestone-walkthrough",
    publicId: "demo-audience-item-walkthrough",
    title: "Venue walk-through",
    date: "2026-09-19",
    state: "later",
  },
  {
    sourceId: "demo-milestone-wedding-day",
    publicId: "demo-audience-item-wedding",
    title: "Wedding day",
    date: "2026-10-03",
    state: "later",
  },
  {
    sourceId: "demo-milestone-hotel-shortlist",
    publicId: "demo-audience-item-hotel",
    title: "City hotel shortlist",
    date: null,
    state: "cancelled",
  },
] as const;

export const REVIEW_PRIMARY_PROJECT = REVIEW_SUITE_FIXTURE.projects[0];
export const REVIEW_MENU_MILESTONE = REVIEW_TIMELINE_MILESTONES[2];

export function isReviewSuiteWorkspaceId(value: string): boolean {
  return value.trim() === REVIEW_SUITE_FIXTURE.workspace.id;
}
