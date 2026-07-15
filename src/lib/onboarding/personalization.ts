import type { DomainId } from "@/lib/domains";
import { DOMAINS } from "@/lib/domains";
import {
  getSegment,
  isPrimaryUseCase,
} from "./segments";

export type WorkspacePersonalization = {
  headline: string;
  body: string;
  firstTaskExample: string;
  workspaceTitle: string;
};

/**
 * Resolve empty-state and chrome copy for a workspace.
 * Prefers segment-specific copy when primary_use_case is set;
 * falls back to domain pack defaults.
 */
export function getWorkspacePersonalization(input: {
  primaryUseCase: string | null | undefined;
  activeDomain: DomainId | null | undefined;
}): WorkspacePersonalization {
  if (
    input.primaryUseCase &&
    isPrimaryUseCase(input.primaryUseCase)
  ) {
    const seg = getSegment(input.primaryUseCase);
    return {
      headline: seg.emptyState.headline,
      body: seg.emptyState.body,
      firstTaskExample: seg.emptyState.firstTaskExample,
      workspaceTitle: seg.workspaceTitle,
    };
  }

  const domain = input.activeDomain ?? "marketing";
  const pack = DOMAINS[domain];
  return {
    headline: pack.emptyStateHeadline,
    body: pack.emptyStateBody,
    firstTaskExample: pack.firstTaskExample,
    workspaceTitle: pack.workspaceTitle,
  };
}
