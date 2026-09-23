import "server-only";

import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { meta, workspaces } from "./db/schema";
import { applyTemplateInTransaction, requireTemplateRequestId } from "./db/apply-template";
import { authorizeStoredProject } from "./actions/project-authz";
import { hasAccountDeletionStartedWith } from "./account-deletion-lifecycle";
import { assertProjectNotDeleting } from "./projects/project-deletion-fence";
import { getSegment, isPrimaryUseCase, type PrimaryUseCase } from "@/lib/onboarding/segments";
import { TEMPLATES } from "@/lib/templates";
import type { DomainId } from "@/lib/domains";

export type OnboardingSubmission = {
  workspaceId: string;
  requestId: string;
  primaryUseCase: PrimaryUseCase;
  secondaryContext?: string | null;
  seedMode: "starter" | "blank" | "metadata" | "existing";
};
type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Receipt = { fingerprint: string; state: "domain-started" | "complete" };
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** One first-run operation for this actor and canonical Project, never a
 * template-wide dedupe key. Settings always supplies a new submission id. */
export function venueFirstRunRequestId(workspaceId: string, actorUserId: string): string {
  return `venue-welcome.v1:${digest([workspaceId, actorUserId])}`;
}

/** Template tasks, completion metadata and submission receipt commit together.
 * The legacy domain reset remains a separately bounded, non-replayable path. */
export async function persistOnboardingSubmission(
  input: OnboardingSubmission,
  actorUserId: string,
  dependencies: {
    database?: Database;
    seedDomain?: (domain: DomainId, workspaceId: string) => Promise<unknown>;
  } = {},
): Promise<void> {
  requireTemplateRequestId(input.requestId);
  if (!isPrimaryUseCase(input.primaryUseCase) || !["starter", "blank", "metadata", "existing"].includes(input.seedMode)) {
    throw new Error("Choose a coordination type and starting point.");
  }
  const database = dependencies.database ?? db;
  const segment = getSegment(input.primaryUseCase);
  const templateId = segment.templateId;
  if (input.seedMode === "starter" && templateId && !TEMPLATES.some(t => t.id === templateId)) {
    throw new Error("That starter is unavailable.");
  }
  const domainSeed = input.seedMode === "starter" && !templateId;
  const key = `board:${input.workspaceId}:onboarding-submission:${digest([actorUserId, input.requestId])}`;
  const fingerprint = digest([input.primaryUseCase, input.secondaryContext ?? null, input.seedMode, templateId]);
  // Non-secret recovery identity; this board namespace follows Project erasure.
  const recovery = { requestId: input.requestId, actorUserId, submission: {
    workspaceId: input.workspaceId, primaryUseCase: input.primaryUseCase,
    secondaryContext: input.secondaryContext ?? null, seedMode: input.seedMode,
  } };
  async function prove(tx: Transaction) {
    const grant = await authorizeStoredProject({
      storedProjectId: input.workspaceId, actorUserId,
      // Completion changes shared Project settings, not just editable tasks.
      capability: "manageProject",
      archivePolicy: "enforce", executor: tx,
    });
    if (!grant.ok || grant.archived || await hasAccountDeletionStartedWith(tx, actorUserId)) throw new Error("That project isn’t available.");
    await assertProjectNotDeleting(tx, input.workspaceId);
  }
  async function writeCompletion(tx: Transaction) {
    await prove(tx);
    await tx.update(workspaces).set({
      ...(input.seedMode === "existing" ? {
        // Confirm an already seeded Project without replacing its choices.
        activeDomain: sql`coalesce(${workspaces.activeDomain}, 'marketing')`,
      } : {
        activeDomain: segment.domainId,
        primaryUseCase: input.primaryUseCase,
        secondaryContext: input.secondaryContext ?? null,
        ...(input.seedMode === "starter" ? { templateId } : {}),
      }),
      onboardingCompletedAt: new Date(),
    }).where(eq(workspaces.id, input.workspaceId));
    await tx.insert(meta).values({
      key, value: JSON.stringify({ ...recovery, fingerprint, state: "complete" }), updatedAt: new Date(),
    }).onConflictDoUpdate({ target: meta.key, set: { value: JSON.stringify({ ...recovery, fingerprint, state: "complete" }), updatedAt: new Date() } });
  }
  const complete = await database.transaction(async tx => {
    await prove(tx);
    const [row] = await tx.select().from(meta).where(eq(meta.key, key));
    if (row) {
      const receipt = JSON.parse(row.value) as Receipt;
      if (receipt.fingerprint !== fingerprint) throw new Error("Finish the previous setup before changing its choices.");
      if (receipt.state === "complete") return true;
      throw new Error("Check your project before starting this pack again.");
    }
    if (!domainSeed) {
      if (input.seedMode === "starter" && templateId) {
        await applyTemplateInTransaction(tx, templateId, input.workspaceId, actorUserId, { requestId: input.requestId });
      }
      await writeCompletion(tx);
      return true;
    }
    // This legacy reset has no atomic request receipt. Fence an ambiguous
    // outcome; never repeat a possibly committed destructive reset on retry.
    await tx.insert(meta).values({ key, value: JSON.stringify({ ...recovery, fingerprint, state: "domain-started" }), updatedAt: new Date() });
    return false;
  }, { behavior: "immediate" });
  if (complete) return;
  if (!dependencies.seedDomain) throw new Error("That starter is unavailable.");
  await dependencies.seedDomain(segment.domainId, input.workspaceId);
  await database.transaction(writeCompletion, { behavior: "immediate" });
}
