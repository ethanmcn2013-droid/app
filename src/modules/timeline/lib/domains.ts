/**
 * Roadmap audience packs, the same pattern as Tasks's `lib/domains.ts`.
 * Drives the AudienceToggle and reseeds the cinematic demo when switched.
 *
 * Order is positional priority per BRAND.md §2.1, wedge first.
 */

export type DomainId = "wedding" | "construction" | "launch" | "startup";

export type DemoRowStatus = "shipped" | "doing" | "held" | "next";

export type DemoRow = {
  id: string;
  title: string;
  status: DemoRowStatus;
  date: string;
  /** Month index (0=Jan ... 11=Dec) the item began. Used by Timeline view. */
  startMonth: number;
  /** Month index the item ends or is projected to end. */
  endMonth: number;
};

export type DomainPack = {
  id: DomainId;
  label: string;
  /** One-line "Built for" description shown above the toggle. */
  description: string;
  /** Workspace slug used in the demo's URL bar. */
  workspaceUrl: string;
  /** Workspace title shown above the rows. */
  workspaceTitle: string;
  /** Eyebrow shown above the workspace title. */
  workspaceEyebrow: string;
  /** Timeline window, first and last month shown on the timeline axis. */
  timelineStart: number;
  timelineEnd: number;
  /** Month index that "today" sits on, used to draw the Today line. */
  todayMonth: number;
  /** Seed rows for the demo. The orchestrator picks two to transition. */
  rows: DemoRow[];
  /** Which row ids move during the loop (first → second status). */
  transitions: { id: string; to: DemoRowStatus; movedAt: string }[];
};

// Phase 1 unification: lead with the weddings/events wedge per BRAND.md §10.
// "Startup plan" and "Product launch" presets removed, they read as
// generic-SaaS and undercut the 80%-non-tech positioning. Construction
// (trades/contractor) is kept as the supporting example.
export const DOMAIN_ORDER: DomainId[] = [
  "wedding",
  "construction",
];

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const DOMAINS: Record<DomainId, DomainPack> = {
  wedding: {
    id: "wedding",
    label: "Wedding plan",
    description:
      "a planner sharing the build-up with the couple and the venue",
    workspaceUrl: "timeline.signalstudio.ie/the-wedding",
    workspaceTitle: "The plan, in plain English.",
    workspaceEyebrow: "Spring wedding",
    timelineStart: 0, // Jan
    timelineEnd: 5, // Jun
    todayMonth: 2, // March
    rows: [
      { id: "venue", title: "Venue contract signed", status: "shipped", date: "Jan 12", startMonth: 0, endMonth: 0 },
      { id: "save-dates", title: "Save-the-date sent", status: "shipped", date: "Feb 04", startMonth: 0, endMonth: 1 },
      { id: "catering", title: "Catering tasting Friday", status: "doing", date: "This week", startMonth: 1, endMonth: 2 },
      { id: "honeymoon", title: "Honeymoon flights", status: "doing", date: "Mar 18", startMonth: 2, endMonth: 2 },
      { id: "florist", title: "Florist deposit", status: "held", date: "Held since Mar 02", startMonth: 1, endMonth: 2 },
      { id: "invitations", title: "Invitations", status: "next", date: "Apr", startMonth: 3, endMonth: 3 },
      { id: "timeline", title: "Day-of timeline", status: "next", date: "May", startMonth: 4, endMonth: 5 },
    ],
    transitions: [
      { id: "catering", to: "shipped", movedAt: "12:30pm" },
      { id: "invitations", to: "doing", movedAt: "1:08pm" },
      { id: "florist", to: "doing", movedAt: "1:42pm" },
    ],
  },
  construction: {
    id: "construction",
    label: "Building project",
    description: "a contractor keeping the owner and the trades on the same page",
    workspaceUrl: "timeline.signalstudio.ie/oak-house-build",
    workspaceTitle: "Where the build is.",
    workspaceEyebrow: "Oak House extension",
    timelineStart: 0,
    timelineEnd: 5,
    todayMonth: 2,
    rows: [
      { id: "demo", title: "Demolition complete", status: "shipped", date: "Jan 22", startMonth: 0, endMonth: 0 },
      { id: "foundation", title: "Foundation poured", status: "shipped", date: "Feb 09", startMonth: 0, endMonth: 1 },
      { id: "frame", title: "Frame raising this week", status: "doing", date: "This week", startMonth: 1, endMonth: 2 },
      { id: "electrical", title: "Electrical first-fix", status: "doing", date: "Mar 21", startMonth: 2, endMonth: 2 },
      { id: "windows", title: "Windows on backorder", status: "held", date: "Held since Mar 03", startMonth: 1, endMonth: 2 },
      { id: "plumbing", title: "Plumbing rough-in", status: "next", date: "Apr", startMonth: 3, endMonth: 3 },
      { id: "plaster", title: "Plaster + paint", status: "next", date: "May", startMonth: 4, endMonth: 5 },
    ],
    transitions: [
      { id: "frame", to: "shipped", movedAt: "Thu 4:15pm" },
      { id: "plumbing", to: "doing", movedAt: "Fri 9:02am" },
      { id: "windows", to: "doing", movedAt: "Fri 11:48am" },
    ],
  },
  launch: {
    id: "launch",
    label: "Product launch",
    description:
      "a founder or maker telling customers what shipped, what's next, what's held up",
    workspaceUrl: "timeline.signalstudio.ie/april-release",
    workspaceTitle: "What's shipping this quarter.",
    workspaceEyebrow: "April release",
    timelineStart: 2, // Mar
    timelineEnd: 7, // Aug
    todayMonth: 3, // Apr
    rows: [
      { id: "perf", title: "Performance pass", status: "shipped", date: "Mar 04", startMonth: 2, endMonth: 2 },
      { id: "billing", title: "Billing rewrite", status: "shipped", date: "Mar 18", startMonth: 2, endMonth: 2 },
      { id: "search", title: "Search across views", status: "doing", date: "This week", startMonth: 2, endMonth: 3 },
      { id: "share", title: "Public share links", status: "doing", date: "Apr 02", startMonth: 3, endMonth: 3 },
      { id: "exports", title: "PDF export", status: "held", date: "Held since Mar 11", startMonth: 2, endMonth: 4 },
      { id: "api", title: "Public API v1", status: "next", date: "May", startMonth: 4, endMonth: 5 },
      { id: "mobile", title: "Mobile read-only", status: "next", date: "Jun", startMonth: 5, endMonth: 7 },
    ],
    transitions: [
      { id: "search", to: "shipped", movedAt: "Wed 3:22pm" },
      { id: "api", to: "doing", movedAt: "Wed 4:01pm" },
      { id: "exports", to: "doing", movedAt: "Thu 10:14am" },
    ],
  },
  startup: {
    id: "startup",
    label: "Startup plan",
    description: "a founder telling investors and collaborators what's actually being built",
    workspaceUrl: "timeline.signalstudio.ie/q2-plan",
    workspaceTitle: "Where we're going.",
    workspaceEyebrow: "Q2 plan",
    timelineStart: 0,
    timelineEnd: 5,
    todayMonth: 2,
    rows: [
      { id: "seed", title: "Seed round closed", status: "shipped", date: "Jan 28", startMonth: 0, endMonth: 0 },
      { id: "hire1", title: "First engineer hired", status: "shipped", date: "Feb 14", startMonth: 0, endMonth: 1 },
      { id: "alpha", title: "Alpha with 10 customers", status: "doing", date: "Now", startMonth: 1, endMonth: 2 },
      { id: "pricing", title: "Pricing decision", status: "doing", date: "Apr 02", startMonth: 2, endMonth: 3 },
      { id: "compliance", title: "SOC 2 readiness", status: "held", date: "Held since Mar 08", startMonth: 1, endMonth: 4 },
      { id: "beta", title: "Public beta", status: "next", date: "May", startMonth: 4, endMonth: 4 },
      { id: "series-a", title: "Series A conversations", status: "next", date: "Jun", startMonth: 5, endMonth: 5 },
    ],
    transitions: [
      { id: "alpha", to: "shipped", movedAt: "Tue 5:30pm" },
      { id: "beta", to: "doing", movedAt: "Wed 9:15am" },
      { id: "compliance", to: "doing", movedAt: "Wed 11:02am" },
    ],
  },
};
