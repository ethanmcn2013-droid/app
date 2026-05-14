import type { TemplateEssay } from "./types";
import { essay as weddingPlanningWorkspace } from "./wedding-planning-workspace";
import { essay as weddingThreeMonth } from "./wedding-3-month-countdown";
import { essay as weddingDayOfRunOfShow } from "./wedding-day-of-run-of-show";
import { essay as finalPaperPush } from "./final-paper-push";
import { essay as midtermWeek } from "./midterm-week";
import { essay as taxSeason } from "./tax-season";
import { essay as newClientOnboarding } from "./new-client-onboarding";
import { essay as quarterlyReviewPrep } from "./quarterly-review-prep";
import { essay as productLaunch } from "./product-launch";
import { essay as conferenceBoothPrep } from "./conference-booth-prep";
import { essay as apartmentMove } from "./apartment-move";
import { essay as tripPlanning } from "./trip-planning";
import { essay as jobApplicationPush } from "./job-application-push";
import { essay as jobsitePunchlist } from "./jobsite-punchlist";

/**
 * Per-template essays, keyed by template id. Templates not in this
 * map render a lighter card-style page at `/templates/[slug]`. As
 * waves 2 and 3 land, more essays show up here without changes
 * elsewhere.
 *
 * New template cycles can add long-form copy here without changing
 * the route layer.
 */
export const TEMPLATE_ESSAYS: Record<string, TemplateEssay> = {
  [weddingPlanningWorkspace.templateId]: weddingPlanningWorkspace,
  [weddingThreeMonth.templateId]: weddingThreeMonth,
  [weddingDayOfRunOfShow.templateId]: weddingDayOfRunOfShow,
  [finalPaperPush.templateId]: finalPaperPush,
  [midtermWeek.templateId]: midtermWeek,
  [taxSeason.templateId]: taxSeason,
  [newClientOnboarding.templateId]: newClientOnboarding,
  [quarterlyReviewPrep.templateId]: quarterlyReviewPrep,
  [productLaunch.templateId]: productLaunch,
  [conferenceBoothPrep.templateId]: conferenceBoothPrep,
  [apartmentMove.templateId]: apartmentMove,
  [tripPlanning.templateId]: tripPlanning,
  [jobApplicationPush.templateId]: jobApplicationPush,
  [jobsitePunchlist.templateId]: jobsitePunchlist,
};

/** Convenience lookup. Returns `undefined` for templates that don't
 *  have a deep essay yet. */
export function getTemplateEssay(
  templateId: string,
): TemplateEssay | undefined {
  return TEMPLATE_ESSAYS[templateId];
}

export type { TemplateEssay } from "./types";
