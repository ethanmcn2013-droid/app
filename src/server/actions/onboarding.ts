"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { workspaces } from "@/server/db/schema";
import { getActiveWorkspaceOrNull } from "@/server/auth";
import {
  authorizeProjectCandidate,
  type ProjectCapabilityKey,
} from "@/server/actions/project-authz";
import { applyTemplateToWorkspace } from "@/server/db/apply-template";
import { emitTasksChanged } from "@/server/events";
import { assertProjectNotDeleting } from "@/server/projects/project-deletion-fence";
import { TEMPLATES } from "@/lib/templates";
import {
  getSegment,
  isPrimaryUseCase,
  type PrimaryUseCase,
} from "@/lib/onboarding/segments";
import { trackOnboardingEventServer } from "@/lib/onboarding/analytics-server";
import { getCurrentUser } from "@/server/auth";
import { seedDomainAction } from "./seed";

export type CompleteOnboardingInput = {
  primaryUseCase: PrimaryUseCase;
  secondaryContext?: string | null;
  /** Seed starter pack (default) or start blank. */
  seedMode: "starter" | "blank";
};

/**
 * Complete segmented onboarding, persists segment, seeds workspace,
 * marks first-run complete.
 */
/**
 * The Project this action writes into — ADR 0001 §9, create/list.
 *
 * Resolved through the fail-closed accessor so the cookie can no longer decay
 * into LEGACY_WORKSPACE_ID (D-005), then proved against live membership before
 * anything is written. An explicit id may be supplied by a caller that knows
 * its Project; naming one is not a privilege, since it is proved the same way.
 */
async function provedProject(
  candidate: string | null | undefined,
  capability: ProjectCapabilityKey = "createOrEditTasks",
): Promise<string> {
  const grant = await authorizeProjectCandidate({
    candidateProjectId: candidate,
    capability,
  });
  // One neutral message for every refusal (ADR 0001 §4).
  if (!grant.ok) throw new Error("That project isn’t available.");
  return grant.projectId;
}

export async function completeOnboardingAction(
  input: CompleteOnboardingInput,
): Promise<void> {
  if (!isPrimaryUseCase(input.primaryUseCase)) {
    throw new Error(`Unknown use case: ${input.primaryUseCase}`);
  }

  const segment = getSegment(input.primaryUseCase);
  const [ws, userId] = await Promise.all([
    provedProject(await getActiveWorkspaceOrNull()),
    getCurrentUser(),
  ]);
  const now = new Date();

  if (input.seedMode === "starter") {
    await trackOnboardingEventServer(userId, "onboarding_starter_confirmed", {
      primary_use_case: input.primaryUseCase,
      secondary_context: input.secondaryContext ?? undefined,
      domain_id: segment.domainId,
      template_id: segment.templateId,
      seed_mode: input.seedMode,
      workspace_id: ws,
    });
  }

  if (input.seedMode === "starter") {
    const templateId =
      segment.templateId &&
      TEMPLATES.some((t) => t.id === segment.templateId)
        ? segment.templateId
        : null;

    if (templateId) {
      await applyTemplateToWorkspace(templateId, ws);
    } else {
      await seedDomainAction(segment.domainId, ws);
    }

    await db.transaction(
      async (tx) => {
        await assertProjectNotDeleting(tx, ws);
        await tx
          .update(workspaces)
          .set({
            primaryUseCase: input.primaryUseCase,
            secondaryContext: input.secondaryContext ?? null,
            templateId: templateId ?? null,
            activeDomain: segment.domainId,
            onboardingCompletedAt: now,
          })
          .where(eq(workspaces.id, ws));
      },
      { behavior: "immediate" },
    );
  } else {
    await db.transaction(
      async (tx) => {
        await assertProjectNotDeleting(tx, ws);
        await tx
          .update(workspaces)
          .set({
            activeDomain: segment.domainId,
            primaryUseCase: input.primaryUseCase,
            secondaryContext: input.secondaryContext ?? null,
            onboardingCompletedAt: now,
          })
          .where(
            and(
              eq(workspaces.id, ws),
              sql`${workspaces.activeDomain} IS NULL`,
            ),
          );
      },
      { behavior: "immediate" },
    );
  }

  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "seed" });

  await trackOnboardingEventServer(userId, "onboarding_completed", {
    primary_use_case: input.primaryUseCase,
    secondary_context: input.secondaryContext ?? undefined,
    domain_id: segment.domainId,
    template_id: segment.templateId,
    seed_mode: input.seedMode,
    workspace_id: ws,
  });
}

/** Skip onboarding entirely, blank workspace, segment unknown. */
export async function skipOnboardingAction(): Promise<void> {
  const [ws, userId] = await Promise.all([
    provedProject(await getActiveWorkspaceOrNull()),
    getCurrentUser(),
  ]);
  const now = new Date();

  await db.transaction(
    async (tx) => {
      await assertProjectNotDeleting(tx, ws);
      await tx
        .update(workspaces)
        .set({
          activeDomain: "marketing",
          primaryUseCase: "other",
          onboardingCompletedAt: now,
        })
        .where(
          and(eq(workspaces.id, ws), sql`${workspaces.activeDomain} IS NULL`),
        );
    },
    { behavior: "immediate" },
  );

  await trackOnboardingEventServer(userId, "onboarding_skipped", {
    workspace_id: ws,
  });
  await trackOnboardingEventServer(userId, "onboarding_completed", {
    primary_use_case: "other",
    seed_mode: "blank",
    workspace_id: ws,
  });

  revalidatePath("/app", "layout");
}

export type UpdateSegmentInput = {
  primaryUseCase: PrimaryUseCase;
  secondaryContext?: string | null;
  /** When true, wipes tasks and re-seeds for the new segment. */
  reseed: boolean;
};

/**
 * Change coordination type after onboarding, settings surface.
 * Metadata-only by default; optional destructive reseed.
 */
export async function updateSegmentAction(
  input: UpdateSegmentInput,
): Promise<void> {
  if (!isPrimaryUseCase(input.primaryUseCase)) {
    throw new Error(`Unknown use case: ${input.primaryUseCase}`);
  }

  const segment = getSegment(input.primaryUseCase);
  const [ws, userId] = await Promise.all([
    provedProject(await getActiveWorkspaceOrNull()),
    getCurrentUser(),
  ]);
  const now = new Date();

  if (input.reseed) {
    await completeOnboardingAction({
      primaryUseCase: input.primaryUseCase,
      secondaryContext: input.secondaryContext ?? null,
      seedMode: "starter",
    });
    return;
  }

  await db.transaction(
    async (tx) => {
      await assertProjectNotDeleting(tx, ws);
      await tx
        .update(workspaces)
        .set({
          primaryUseCase: input.primaryUseCase,
          secondaryContext: input.secondaryContext ?? null,
          activeDomain: segment.domainId,
          onboardingCompletedAt: now,
        })
        .where(eq(workspaces.id, ws));
    },
    { behavior: "immediate" },
  );

  await trackOnboardingEventServer(userId, "onboarding_segment_selected", {
    primary_use_case: input.primaryUseCase,
    secondary_context: input.secondaryContext ?? undefined,
    source: "settings",
    workspace_id: ws,
  });

  revalidatePath("/app", "layout");
  revalidatePath("/app/settings");
}
