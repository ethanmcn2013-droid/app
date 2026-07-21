/**
 * Roadmap dashboard empty-state copy keyed by Tasks primary_use_case
 * or Studio template id.
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

const SEGMENT_IDS = new Set<string>([
  "venue",
  "wedding",
  "student",
  "small-business",
  "event-management",
  "creative-studio",
  "internal-team",
  "other",
]);

export function isPrimaryUseCase(v: string): v is PrimaryUseCase {
  return SEGMENT_IDS.has(v);
}

type ProjectEmptyCopy = { headline: string; body: string };

const BY_SEGMENT: Record<PrimaryUseCase, ProjectEmptyCopy> = {
  venue: {
    headline: "Add your first event roadmap",
    body: "One plan per booking or couple. Mark milestones in Signal Tasks and share a public link the team can forward.",
  },
  wedding: {
    headline: "Add your first project",
    body: "One roadmap for the day, vendors, timeline, and updates in a link anyone can read. Mark milestones in Tasks to fill it in.",
  },
  student: {
    headline: "Add your society's first roadmap",
    body: "One plan per event or term. Committee tasks marked as milestones in Signal Tasks appear here automatically.",
  },
  "small-business": {
    headline: "Add your first project",
    body: "One roadmap per initiative. Mark milestones in Tasks and share a calm update link with clients or your team.",
  },
  "event-management": {
    headline: "Add your first event plan",
    body: "Run-of-show and supplier timing in one shareable roadmap. Milestones sync from Signal Tasks.",
  },
  "creative-studio": {
    headline: "Add your first client roadmap",
    body: "Deliverables and review dates in one plan. Mark milestones in Tasks to keep clients aligned without another deck.",
  },
  "internal-team": {
    headline: "Add your first team roadmap",
    body: "One initiative, one public plan. Milestones from Signal Tasks land here so everyone sees what's next.",
  },
  other: {
    headline: "Add your first project",
    body: "A project is one roadmap, one plan, one slice of work. Name it, mark tasks as milestones in Signal Tasks, and share the link.",
  },
};

const TEMPLATE_TO_SEGMENT: Record<string, PrimaryUseCase> = {
  "wedding-planning-workspace": "wedding",
  "wedding-3-month-countdown": "wedding",
  "wedding-day-of-run-of-show": "wedding",
  "local-business-monthly-rhythm": "small-business",
  "new-client-onboarding": "small-business",
  "product-launch": "small-business",
  "jobsite-punchlist": "creative-studio",
  "conference-booth-prep": "event-management",
  "quarterly-review-prep": "internal-team",
  "apartment-move": "other",
  "trip-planning": "other",
  "tax-season": "other",
};

const DEFAULT: ProjectEmptyCopy = BY_SEGMENT.other;

export function getProjectEmptyCopy(input: {
  primaryUseCase?: string | null;
  templateId?: string | null;
}): ProjectEmptyCopy {
  if (input.primaryUseCase && isPrimaryUseCase(input.primaryUseCase)) {
    return BY_SEGMENT[input.primaryUseCase];
  }
  if (input.templateId && input.templateId in TEMPLATE_TO_SEGMENT) {
    const seg = TEMPLATE_TO_SEGMENT[input.templateId];
    if (isPrimaryUseCase(seg)) return BY_SEGMENT[seg];
  }
  return DEFAULT;
}
