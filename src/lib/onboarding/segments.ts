import type { DomainId } from "@/lib/domains";

/**
 * Primary coordination segments, config-driven onboarding source of truth.
 *
 * Strategy: SignalHQ/brand/docs/SEGMENTED_ONBOARDING.md
 *
 * Maps user-facing "what are you coordinating?" choices to:
 * - existing domain packs (seed structure)
 * - workspace templates (four-layer seed)
 * - personalized copy (empty states, welcome)
 * - pricing tier hints (checkout routing, future)
 */

export type PrimaryUseCase =
  | "venue"
  | "wedding"
  | "student"
  | "small-business"
  | "event-management"
  | "creative-studio"
  | "internal-team"
  | "other";

export type ContextOption = {
  id: string;
  label: string;
};

export type SegmentConfig = {
  id: PrimaryUseCase;
  label: string;
  description: string;
  /** CSS variable from brand tokens, e.g. var(--aud-wedding) */
  accent: string;
  /** Maps to tasks/src/lib/domains.ts for seed overlay */
  domainId: DomainId;
  /** Canonical workspace template id, if any */
  templateId: string | null;
  /** Optional second-step question */
  contextQuestion: string | null;
  contextOptions: ContextOption[];
  /** Shown on starter confirmation step */
  starterItems: string[];
  /** Overrides domain pack empty-state when set */
  emptyState: {
    headline: string;
    body: string;
    firstTaskExample: string;
  };
  /** Workspace title shown in chrome after seed */
  workspaceTitle: string;
  /** Entitlement / pricing routing hint */
  pricingTier: "venue" | "event" | "workspace" | "student" | "free";
  /** Analytics + marketing attribution */
  trackingSegment: string;
};

export const ONBOARDING_HEADLINE = "Let's shape Signal around the way you work.";
export const ONBOARDING_SUBHEAD =
  "A few quiet choices now, so your workspace feels relevant from day one.";

export const SEGMENTS: Record<PrimaryUseCase, SegmentConfig> = {
  venue: {
    id: "venue",
    label: "Venue operations",
    description: "Events, couples, suppliers, one calm pipeline",
    accent: "var(--aud-wedding)",
    domainId: "wedding",
    templateId: "wedding-planning-workspace",
    contextQuestion: "What type of venue are you managing?",
    contextOptions: [
      { id: "wedding-venue", label: "Wedding venue" },
      { id: "hotel", label: "Hotel" },
      { id: "restaurant", label: "Restaurant / hospitality" },
      { id: "event-space", label: "Event space" },
      { id: "other", label: "Other" },
    ],
    starterItems: [
      "Event pipeline",
      "Upcoming events",
      "Client notes",
      "Supplier checklist",
      "Internal tasks",
    ],
    emptyState: {
      headline: "This is where your events live.",
      body: "Bookings, couples, suppliers, and the day's run-of-show, without another spreadsheet.",
      firstTaskExample: "Confirm June tasting menu with catering",
    },
    workspaceTitle: "Venue operations",
    pricingTier: "venue",
    trackingSegment: "venue",
  },

  wedding: {
    id: "wedding",
    label: "Wedding or private event",
    description: "Vendors, timeline, guests, the day in one place",
    accent: "var(--aud-wedding)",
    domainId: "wedding",
    templateId: "wedding-planning-workspace",
    contextQuestion: "What are you planning?",
    contextOptions: [
      { id: "wedding", label: "Wedding" },
      { id: "engagement", label: "Engagement party" },
      { id: "family-event", label: "Family event" },
      { id: "private-event", label: "Private event" },
      { id: "other", label: "Other" },
    ],
    starterItems: [
      "Timeline",
      "Guest & vendor notes",
      "Tasks",
      "Venue checklist",
      "Day-of plan",
    ],
    emptyState: {
      headline: "This is where the day comes together.",
      body: "Vendors, run-of-show, RSVPs, every detail in one place.",
      firstTaskExample: "Confirm catering tasting menu by Friday",
    },
    workspaceTitle: "Your event",
    pricingTier: "event",
    trackingSegment: "wedding",
  },

  student: {
    id: "student",
    label: "Student society / academic year",
    description: "Committee work, events, deadlines, without the chaos",
    accent: "var(--aud-student)",
    domainId: "student",
    templateId: null,
    contextQuestion: "What are you coordinating?",
    contextOptions: [
      { id: "society", label: "Society" },
      { id: "club", label: "Club" },
      { id: "class-group", label: "Class group" },
      { id: "student-event", label: "Student event" },
      { id: "academic-year", label: "Academic year" },
      { id: "other", label: "Other" },
    ],
    starterItems: [
      "Society roadmap",
      "Committee tasks",
      "Event planning",
      "Member notes",
      "Sponsorship tracker",
    ],
    emptyState: {
      headline: "This is where your semester comes together.",
      body: "Papers, events, committee work, stop losing things at 2am.",
      firstTaskExample: "Submit society budget by next Friday",
    },
    workspaceTitle: "Society · Spring term",
    pricingTier: "student",
    trackingSegment: "student",
  },

  "small-business": {
    id: "small-business",
    label: "Small business",
    description: "Customers, ops, marketing, visibility without jargon",
    accent: "var(--aud-small-business)",
    domainId: "marketing",
    templateId: "local-business-monthly-rhythm",
    contextQuestion: "What do you want more visibility over?",
    contextOptions: [
      { id: "tasks", label: "Tasks" },
      { id: "customers", label: "Customers" },
      { id: "projects", label: "Projects" },
      { id: "operations", label: "Operations" },
      { id: "marketing", label: "Marketing" },
      { id: "other", label: "Other" },
    ],
    starterItems: [
      "Operations board",
      "Customer follow-ups",
      "Content & marketing tasks",
      "Internal notes",
    ],
    emptyState: {
      headline: "This is where the week comes together.",
      body: "Orders, invoices, follow-ups, one calm place instead of five apps.",
      firstTaskExample: "Follow up with Tuesday's enquiry",
    },
    workspaceTitle: "Operations",
    pricingTier: "workspace",
    trackingSegment: "small-business",
  },

  "event-management": {
    id: "event-management",
    label: "Event management",
    description: "Run-of-show, vendors, timelines, for any event",
    accent: "var(--aud-wedding)",
    domainId: "wedding",
    templateId: "wedding-planning-workspace",
    contextQuestion: "What kind of events?",
    contextOptions: [
      { id: "corporate", label: "Corporate" },
      { id: "festival", label: "Festival / live" },
      { id: "private", label: "Private celebrations" },
      { id: "conference", label: "Conference" },
      { id: "other", label: "Other" },
    ],
    starterItems: [
      "Event timeline",
      "Vendor contacts",
      "Run-of-show",
      "Day-of checklist",
      "Post-event follow-up",
    ],
    emptyState: {
      headline: "This is where the event takes shape.",
      body: "Timelines, vendors, and the day's plan, calm visibility for everyone involved.",
      firstTaskExample: "Confirm AV setup time with venue",
    },
    workspaceTitle: "Upcoming event",
    pricingTier: "event",
    trackingSegment: "event-management",
  },

  "creative-studio": {
    id: "creative-studio",
    label: "Creative studio / agency",
    description: "Briefs, edits, deliveries, client work that ships",
    accent: "var(--aud-freelance)",
    domainId: "freelance",
    templateId: null,
    contextQuestion: null,
    contextOptions: [],
    starterItems: [
      "Active client briefs",
      "Edit rounds",
      "Deliveries & invoices",
      "Pipeline notes",
    ],
    emptyState: {
      headline: "This is where the client work ships.",
      body: "Briefs, edit rounds, deliveries, three clients, one inbox.",
      firstTaskExample: "Send gallery delivery by Friday at 3pm",
    },
    workspaceTitle: "Client work",
    pricingTier: "workspace",
    trackingSegment: "creative-studio",
  },

  "internal-team": {
    id: "internal-team",
    label: "Internal team",
    description: "Projects, handoffs, visibility, without sprint theatre",
    accent: "var(--aud-marketing)",
    domainId: "marketing",
    templateId: null,
    contextQuestion: null,
    contextOptions: [],
    starterItems: [
      "Team priorities",
      "Project board",
      "Handoff notes",
      "Weekly sync items",
    ],
    emptyState: {
      headline: "This is where the team stays aligned.",
      body: "Plain tasks, clear status, no jargon, coordination that respects everyone's time.",
      firstTaskExample: "Review Q3 priorities with the team",
    },
    workspaceTitle: "Team workspace",
    pricingTier: "workspace",
    trackingSegment: "internal-team",
  },

  other: {
    id: "other",
    label: "Something else",
    description: "A calm starting point, shape it as you go",
    accent: "var(--aud-marketing)",
    domainId: "marketing",
    templateId: null,
    contextQuestion: null,
    contextOptions: [],
    starterItems: ["Tasks", "Notes", "Timeline", "Shared plan"],
    emptyState: {
      headline: "This is where your plan goes.",
      body: "Drop in what matters. Rename, reorder, or clear anything later.",
      firstTaskExample: "Add your first task",
    },
    workspaceTitle: "My workspace",
    pricingTier: "free",
    trackingSegment: "other",
  },
};

/** Card order on step 2, venue first (commercial wedge). */
export const SEGMENT_ORDER: PrimaryUseCase[] = [
  "venue",
  "wedding",
  "student",
  "small-business",
  "event-management",
  "creative-studio",
  "internal-team",
  "other",
];

const SEGMENT_IDS = new Set<PrimaryUseCase>(
  Object.keys(SEGMENTS) as PrimaryUseCase[],
);

export function isPrimaryUseCase(value: string): value is PrimaryUseCase {
  return SEGMENT_IDS.has(value as PrimaryUseCase);
}

export function getSegment(id: PrimaryUseCase): SegmentConfig {
  return SEGMENTS[id];
}

/** Resolve segment from URL/marketing pre-selection. */
/** Marketing → sign-up deep link with segment pre-selection. */
export function buildSignUpUrl(useCase?: PrimaryUseCase | null): string {
  if (!useCase) return "/sign-up";
  return `/sign-up?use=${encodeURIComponent(useCase)}`;
}

/** Post-auth onboarding entry with optional segment pre-selection. */
export function buildWelcomeUrl(useCase?: PrimaryUseCase | null): string {
  if (!useCase) return "/welcome";
  return `/welcome?use=${encodeURIComponent(useCase)}`;
}

export function segmentFromParam(
  param: string | null | undefined,
): PrimaryUseCase | null {
  if (!param) return null;
  const normalized = param.toLowerCase().replace(/_/g, "-");
  if (isPrimaryUseCase(normalized)) return normalized;
  const aliases: Record<string, PrimaryUseCase> = {
    venues: "venue",
    weddings: "wedding",
    students: "student",
    business: "small-business",
    events: "event-management",
    creative: "creative-studio",
    team: "internal-team",
  };
  return aliases[normalized] ?? null;
}
