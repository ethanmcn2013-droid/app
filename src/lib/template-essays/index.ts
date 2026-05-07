import type { TemplateEssay } from "./types";
import { essay as weddingThreeMonth } from "./wedding-3-month-countdown";
import { essay as weddingDayOfRunOfShow } from "./wedding-day-of-run-of-show";
import { essay as finalPaperSprint } from "./final-paper-sprint";
import { essay as midtermWeek } from "./midterm-week";
import { essay as taxSeason } from "./tax-season";
import { essay as newClientOnboarding } from "./new-client-onboarding";
import { essay as quarterlyReviewPrep } from "./quarterly-review-prep";
import { essay as productLaunch } from "./product-launch";
import { essay as conferenceBoothPrep } from "./conference-booth-prep";
import { essay as apartmentMove } from "./apartment-move";
import { essay as tripPlanning } from "./trip-planning";
import { essay as jobApplicationSprint } from "./job-application-sprint";

/**
 * Per-template essays, keyed by template id. Templates not in this
 * map render a lighter card-style page at `/templates/[slug]`. As
 * waves 2 and 3 land, more essays show up here without changes
 * elsewhere.
 *
 * Wave 2 of cycle 19 fills out the remaining eight essays so all
 * twelve templates ship with manifesto-voiced long-form copy.
 */
export const TEMPLATE_ESSAYS: Record<string, TemplateEssay> = {
  [weddingThreeMonth.templateId]: weddingThreeMonth,
  [weddingDayOfRunOfShow.templateId]: weddingDayOfRunOfShow,
  [finalPaperSprint.templateId]: finalPaperSprint,
  [midtermWeek.templateId]: midtermWeek,
  [taxSeason.templateId]: taxSeason,
  [newClientOnboarding.templateId]: newClientOnboarding,
  [quarterlyReviewPrep.templateId]: quarterlyReviewPrep,
  [productLaunch.templateId]: productLaunch,
  [conferenceBoothPrep.templateId]: conferenceBoothPrep,
  [apartmentMove.templateId]: apartmentMove,
  [tripPlanning.templateId]: tripPlanning,
  [jobApplicationSprint.templateId]: jobApplicationSprint,
};

/** Convenience lookup. Returns `undefined` for templates that don't
 *  have a deep essay yet. */
export function getTemplateEssay(
  templateId: string,
): TemplateEssay | undefined {
  return TEMPLATE_ESSAYS[templateId];
}

export type { TemplateEssay } from "./types";
