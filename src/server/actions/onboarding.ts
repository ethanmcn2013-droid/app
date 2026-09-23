"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth";
import { emitTasksChanged } from "@/server/events";
import { getSegment, type PrimaryUseCase } from "@/lib/onboarding/segments";
import { trackOnboardingEventServer } from "@/lib/onboarding/analytics-server";
import { persistOnboardingSubmission, type OnboardingSubmission } from "@/server/onboarding-completion";
import { isDemoMode } from "@/lib/access-mode";
import { seedDomainAction } from "./seed";

export type CompleteOnboardingInput = Omit<OnboardingSubmission, "seedMode"> & {
  seedMode: "starter" | "blank";
};

/** The caller retains the Project and request through every retry. The DB-only
 * completion service re-proves both seed and metadata writes independently. */
export async function completeOnboardingAction(input: CompleteOnboardingInput): Promise<void> {
  if (isDemoMode()) throw new Error("Setup changes are unavailable in this preview.");
  const actorUserId = await getCurrentUser();
  await persistOnboardingSubmission(input, actorUserId, { seedDomain: seedDomainAction });
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "seed" });
  const segment = getSegment(input.primaryUseCase);
  await trackOnboardingEventServer(actorUserId, "onboarding_completed", {
    primary_use_case: input.primaryUseCase,
    secondary_context: input.secondaryContext ?? undefined,
    domain_id: segment.domainId,
    template_id: segment.templateId,
    seed_mode: input.seedMode,
    workspace_id: input.workspaceId,
  });
}

export async function skipOnboardingAction(input: { workspaceId: string; requestId: string }): Promise<void> {
  await completeOnboardingAction({ ...input, primaryUseCase: "other", seedMode: "blank" });
}

/** Confirm an existing starter without reseeding or rewriting its metadata. */
export async function confirmExistingSetupAction(input: { workspaceId: string; requestId: string }): Promise<void> {
  if (isDemoMode()) throw new Error("Setup changes are unavailable in this preview.");
  const actorUserId = await getCurrentUser();
  await persistOnboardingSubmission({ ...input, primaryUseCase: "other", seedMode: "existing" }, actorUserId);
  revalidatePath("/app", "layout");
}

export type UpdateSegmentInput = {
  workspaceId: string;
  requestId: string;
  primaryUseCase: PrimaryUseCase;
  secondaryContext?: string | null;
  /** Template starters append; legacy domain packs retain their reset behavior. */
  reseed: boolean;
};

export async function updateSegmentAction(input: UpdateSegmentInput): Promise<void> {
  if (input.reseed) {
    await completeOnboardingAction({ ...input, seedMode: "starter" });
    return;
  }
  if (isDemoMode()) throw new Error("Setup changes are unavailable in this preview.");
  const actorUserId = await getCurrentUser();
  await persistOnboardingSubmission({ ...input, seedMode: "metadata" }, actorUserId);
  revalidatePath("/app", "layout");
  revalidatePath("/app/settings");
  await trackOnboardingEventServer(actorUserId, "onboarding_segment_selected", {
    primary_use_case: input.primaryUseCase,
    secondary_context: input.secondaryContext ?? undefined,
    source: "settings",
    workspace_id: input.workspaceId,
  });
}
