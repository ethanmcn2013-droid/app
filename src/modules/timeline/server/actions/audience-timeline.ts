"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/timeline/server/auth";
import { getWorkspace } from "@/modules/timeline/server/db/timeline-queries";
import { checkRateLimit, getClientIp } from "@/modules/timeline/lib/rate-limit";
import {
  audienceTimelineEnabled,
  connectSuiteWorkspace,
  createAudiencePublication,
  publishAudiencePublication,
  refreshAudienceDivergence,
  revokeAudienceShares,
  rotateAudienceShare,
  unpublishAudiencePublication,
  updateAudiencePublicationItem,
} from "@/modules/timeline/server/audience-timeline";
import {
  AUDIENCE_ITEM_STATES,
  AUDIENCE_KINDS,
  validateIanaTimezone,
  type AudienceItemState,
  type AudienceKind,
} from "@/modules/timeline/lib/audience-timeline";
import { TIMELINE_URL } from "@/lib/product-urls";
import { getCurrentTasksWorkspaceContext } from "@/modules/timeline/server/sync/tasks-workspace-context";
import { withFreshAudienceMutationAuthority } from "@/modules/timeline/server/audience-authority";
import { isDemoMode } from "@/lib/access-mode";

export type AudienceActionState = Readonly<{
  status: "idle" | "success" | "error";
  message?: string;
  shareUrl?: string;
  publicationId?: string;
}>;

function demoReadOnlyState(formData: FormData): AudienceActionState | null {
  if (!isDemoMode()) return null;
  const rawPublicationId = formData.get("publicationId");
  return {
    status: "error",
    message:
      "Demo mode is read-only. The publication and its controls are review fixtures.",
    ...(typeof rawPublicationId === "string" && rawPublicationId
      ? { publicationId: rawPublicationId }
      : {}),
  };
}

function requiredText(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new TypeError(`${name} is required and must be no longer than ${max} characters`);
  }
  return value.trim();
}

function optionalText(formData: FormData, name: string, max: number): string | null {
  const value = formData.get(name);
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) {
    throw new TypeError(`${name} must be no longer than ${max} characters`);
  }
  return value.trim() || null;
}

function optionalCalendarDate(formData: FormData, name: string): string | null {
  const value = optionalText(formData, name, 10);
  if (value === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError(`${name} must be a calendar date`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new TypeError(`${name} must be a real calendar date`);
  }
  return value;
}

function expiryInstant(formData: FormData): Date | null {
  const date = optionalCalendarDate(formData, "expiresOn");
  return date ? new Date(`${date}T23:59:59.999Z`) : null;
}

async function ownerWorkspace(formData: FormData) {
  const userId = await requireUser();
  const workspaceSlug = requiredText(formData, "workspaceSlug", 120);
  const workspace = await getWorkspace(workspaceSlug);
  if (!workspace || workspace.ownerUserId !== userId) throw new TypeError("Workspace not found");
  return { userId, workspace };
}

async function allowWrite(action: string): Promise<void> {
  // Audience mutations are authenticated and ownership-scoped. Keep the
  // distributed limiter optional so first-party sharing remains available on
  // deployments that have not provisioned Upstash; a partial configuration
  // still enters checkRateLimit() and fails closed.
  if (
    !process.env.UPSTASH_REDIS_REST_URL &&
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return;
  }
  const result = await checkRateLimit(action, await getClientIp(), 12, 60);
  if (!result.allowed) {
    throw new TypeError(
      result.reason === "config-miss"
        ? "Sharing is temporarily unavailable. Try again shortly."
        : "Too many changes at once. Wait a minute and try again.",
    );
  }
}

function errorState(error: unknown): AudienceActionState {
  return {
    status: "error",
    message: error instanceof TypeError ? error.message : "That change could not be saved. Try again.",
  };
}

function shareUrl(rawToken: string): string {
  const base = (process.env.NEXT_PUBLIC_TIMELINE_SITE_URL ?? TIMELINE_URL).replace(/\/$/, "");
  return `${base}/s/${rawToken}`;
}

export async function connectSuiteWorkspaceAction(
  _previous: AudienceActionState,
  formData: FormData,
): Promise<AudienceActionState> {
  const demoState = demoReadOnlyState(formData);
  if (demoState) return demoState;
  try {
    await allowWrite("audience-connect-workspace");
    const { userId, workspace } = await ownerWorkspace(formData);
    const suiteWorkspaceId = requiredText(formData, "suiteWorkspaceId", 120);
    if (
      workspace.suiteWorkspaceId &&
      workspace.suiteWorkspaceId !== suiteWorkspaceId
    ) {
      throw new TypeError(
        "This Timeline workspace is already connected. Use a reviewed migration to change its canonical identity.",
      );
    }
    const currentMembership = await getCurrentTasksWorkspaceContext(
      userId,
      suiteWorkspaceId,
    );
    if (!currentMembership) {
      throw new TypeError(
        "Timeline could not confirm your current membership in that Signal Tasks workspace.",
      );
    }
    const updated = await connectSuiteWorkspace(workspace.slug, userId, suiteWorkspaceId);
    if (!updated) throw new TypeError("Workspace not found");
    revalidatePath("/app/plan/audience");
    return { status: "success", message: "Canonical workspace connected." };
  } catch (error) {
    return errorState(error);
  }
}

export async function createAudiencePublicationAction(
  _previous: AudienceActionState,
  formData: FormData,
): Promise<AudienceActionState> {
  const demoState = demoReadOnlyState(formData);
  if (demoState) return demoState;
  try {
    if (!audienceTimelineEnabled()) throw new TypeError("New Audience Timelines are paused by the feature flag.");
    await allowWrite("audience-create");
    const { userId, workspace } = await ownerWorkspace(formData);
    const publicationId = await withFreshAudienceMutationAuthority(
      userId,
      workspace,
      async (sourceAuthority) => {
        const kindValue = requiredText(formData, "audienceKind", 20);
        if (!AUDIENCE_KINDS.includes(kindValue as AudienceKind)) {
          throw new TypeError("Choose a named audience");
        }
        const selectedSourceIds = formData
          .getAll("sourceId")
          .filter((value): value is string => typeof value === "string" && value.length <= 200);
        const ownerDisplayLabel = optionalText(formData, "ownerDisplayLabel", 80);
        if (ownerDisplayLabel?.includes("@")) {
          throw new TypeError("Use a public display label, not an email address");
        }
        return createAudiencePublication({
          workspaceSlug: workspace.slug,
          sourceAuthority,
          label: requiredText(formData, "label", 120),
          audienceKind: kindValue as AudienceKind,
          ownerDisplayLabel,
          primaryDateLabel: optionalText(formData, "primaryDateLabel", 40),
          primaryDate: optionalCalendarDate(formData, "primaryDate"),
          timezone: validateIanaTimezone(requiredText(formData, "timezone", 80)),
          selectedSourceIds,
        });
      },
    );
    revalidatePath("/app/plan/audience");
    return {
      status: "success",
      message: "Draft created. Preview the exact fields below before sharing.",
      publicationId,
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function publishAudiencePublicationAction(
  _previous: AudienceActionState,
  formData: FormData,
): Promise<AudienceActionState> {
  const demoState = demoReadOnlyState(formData);
  if (demoState) return demoState;
  try {
    await allowWrite("audience-publish");
    const { userId, workspace } = await ownerWorkspace(formData);
    const publicationId = requiredText(formData, "publicationId", 80);
    const rawToken = await withFreshAudienceMutationAuthority(
      userId,
      workspace,
      async () => publishAudiencePublication(
        publicationId,
        workspace.slug,
        expiryInstant(formData),
      ),
    );
    revalidatePath("/app/plan/audience");
    return {
      status: "success",
      message: "Published. Copy this link now; it will not be shown again.",
      shareUrl: shareUrl(rawToken),
      publicationId,
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function rotateAudienceShareAction(
  _previous: AudienceActionState,
  formData: FormData,
): Promise<AudienceActionState> {
  const demoState = demoReadOnlyState(formData);
  if (demoState) return demoState;
  try {
    await allowWrite("audience-rotate");
    const { userId, workspace } = await ownerWorkspace(formData);
    const publicationId = requiredText(formData, "publicationId", 80);
    const rawToken = await withFreshAudienceMutationAuthority(
      userId,
      workspace,
      async () => rotateAudienceShare(
        publicationId,
        workspace.slug,
        expiryInstant(formData),
      ),
    );
    revalidatePath("/app/plan/audience");
    return {
      status: "success",
      message: "Link rotated. Every earlier link is inactive immediately.",
      shareUrl: shareUrl(rawToken),
      publicationId,
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function revokeAudienceShareAction(
  _previous: AudienceActionState,
  formData: FormData,
): Promise<AudienceActionState> {
  const demoState = demoReadOnlyState(formData);
  if (demoState) return demoState;
  try {
    const { workspace } = await ownerWorkspace(formData);
    const publicationId = requiredText(formData, "publicationId", 80);
    await revokeAudienceShares(publicationId, workspace.slug);
    revalidatePath("/app/plan/audience");
    return { status: "success", message: "Every active link is revoked.", publicationId };
  } catch (error) {
    return errorState(error);
  }
}

export async function unpublishAudiencePublicationAction(
  _previous: AudienceActionState,
  formData: FormData,
): Promise<AudienceActionState> {
  const demoState = demoReadOnlyState(formData);
  if (demoState) return demoState;
  try {
    const { workspace } = await ownerWorkspace(formData);
    const publicationId = requiredText(formData, "publicationId", 80);
    await unpublishAudiencePublication(publicationId, workspace.slug);
    revalidatePath("/app/plan/audience");
    return {
      status: "success",
      message: "Timeline unpublished and every active link revoked.",
      publicationId,
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function updateAudiencePublicationItemAction(
  _previous: AudienceActionState,
  formData: FormData,
): Promise<AudienceActionState> {
  const demoState = demoReadOnlyState(formData);
  if (demoState) return demoState;
  try {
    const { workspace } = await ownerWorkspace(formData);
    const publicationId = requiredText(formData, "publicationId", 80);
    const stateValue = requiredText(formData, "state", 20);
    if (!AUDIENCE_ITEM_STATES.includes(stateValue as AudienceItemState)) {
      throw new TypeError("Choose a valid public state");
    }
    await updateAudiencePublicationItem({
      publicationId,
      publicId: requiredText(formData, "publicId", 80),
      workspaceSlug: workspace.slug,
      title: requiredText(formData, "title", 180),
      calendarDate: optionalCalendarDate(formData, "calendarDate"),
      state: stateValue as AudienceItemState,
    });
    revalidatePath("/app/plan/audience");
    return {
      status: "success",
      message: "Public item updated. The source was not changed.",
      publicationId,
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function refreshAudienceDivergenceAction(
  _previous: AudienceActionState,
  formData: FormData,
): Promise<AudienceActionState> {
  const demoState = demoReadOnlyState(formData);
  if (demoState) return demoState;
  try {
    const { workspace } = await ownerWorkspace(formData);
    const publicationId = requiredText(formData, "publicationId", 80);
    const count = await refreshAudienceDivergence(publicationId, workspace.slug);
    revalidatePath("/app/plan/audience");
    return {
      status: "success",
      message: count === 0 ? "No new source changes." : `${count} source change${count === 1 ? "" : "s"} marked. Public fields stayed frozen.`,
      publicationId,
    };
  } catch (error) {
    return errorState(error);
  }
}
