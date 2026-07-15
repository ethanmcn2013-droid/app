import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users, workspaceMembers, workspaces } from "@/server/db/schema";
import { getActiveWorkspace, getCurrentUser } from "@/server/auth";
import { getEffectiveTier } from "@/server/db/entitlements";
import { getMemberCapacity } from "@/server/db/membership";
import {
  getMyRoleInActiveWorkspace,
  getNotificationPrefs,
  listPendingInvitesAction,
  listWorkspaceActivityAction,
} from "@/server/actions/settings";
import { SettingsApp } from "@/components/app/settings/settings-app";
import { AppPageHeader } from "@/components/app/page-header";
import { isDemoMode } from "@/lib/access-mode";
import {
  DEMO_USER_ID,
  DEMO_WORKSPACE_ID,
  DEMO_WORKSPACE_SLUG,
  DEMO_WORKSPACE_NAME,
} from "@/server/demo/tasks-demo";

export const dynamic = "force-dynamic";

/**
 * Single-page settings surface, tabbed sub-views. NOT split into
 * /app/settings/billing etc., owner-gated mutations would have to
 * re-resolve role in every nested layout, and the v1.0 spec is small
 * enough that one client-rendered tab switcher beats five layouts.
 *
 * All five sub-views (workspace, members, billing, notifications,
 * danger) read their server-side state at this top level so the
 * client shell stays a pure UI orchestrator.
 */
export default async function SettingsPage() {
  // Demo/Review: render a coherent settings surface from the synthetic
  // workspace instead of the real DB (whose tables aren't present on a
  // keyless preview). Interactions are inert in demo; the surface is for
  // visual review.
  if (isDemoMode()) {
    const nowIso = new Date().toISOString();
    return (
      <>
        <AppPageHeader />
        <p
          role="status"
          className="border-b border-line-soft bg-brand-soft px-4 py-2 text-center text-xs font-medium text-brand"
        >
          Review preview, settings are read-only.
        </p>
        <div inert aria-disabled="true">
          <SettingsApp
            currentUserId={DEMO_USER_ID}
            myRole="owner"
            workspace={{
              id: DEMO_WORKSPACE_ID,
              slug: DEMO_WORKSPACE_SLUG,
              name: DEMO_WORKSPACE_NAME,
              activeDomain: "wedding",
              primaryUseCase: "venue",
              secondaryContext: null,
              createdAt: nowIso,
              ownerUserId: DEMO_USER_ID,
              publishedAt: null,
            }}
            members={[
              {
                userId: DEMO_USER_ID,
                role: "owner",
                joinedAt: nowIso,
                name: "You",
                email: "you@theorchard.example",
                handle: "you",
                color: null,
                initials: "YO",
              },
            ]}
            tier="free"
            memberCapacity={{ current: 1, max: 3, tier: "free" }}
            notificationPrefs={{
              dailyDigest: true,
              mentions: true,
              commentReplies: true,
            }}
            pendingInvites={[]}
            recentActivity={[]}
          />
        </div>
      </>
    );
  }

  const [me, ws, myRole] = await Promise.all([
    getCurrentUser(),
    getActiveWorkspace(),
    getMyRoleInActiveWorkspace(),
  ]);

  const [workspaceRow] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, ws));

  const memberRows = await db
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.joinedAt,
      name: users.name,
      email: users.email,
      handle: users.handle,
      color: users.color,
      initials: users.initials,
    })
    .from(workspaceMembers)
    .leftJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, ws));

  const [tier, prefs, memberCapacity, pendingInvites, recentActivity] =
    await Promise.all([
      getEffectiveTier(me, ws),
      getNotificationPrefs(),
      getMemberCapacity(ws),
      listPendingInvitesAction(),
      listWorkspaceActivityAction(),
    ]);

  return (
    <>
      <AppPageHeader />
      <SettingsApp
        currentUserId={me}
        myRole={myRole}
        workspace={
          workspaceRow
            ? {
                id: workspaceRow.id,
                slug: workspaceRow.slug,
                name: workspaceRow.name,
                activeDomain: workspaceRow.activeDomain ?? null,
                primaryUseCase: workspaceRow.primaryUseCase ?? null,
                secondaryContext: workspaceRow.secondaryContext ?? null,
                createdAt: workspaceRow.createdAt
                  ? workspaceRow.createdAt.toISOString()
                  : null,
                ownerUserId: workspaceRow.ownerUserId ?? null,
                publishedAt: workspaceRow.publishedAt
                  ? workspaceRow.publishedAt.toISOString()
                  : null,
              }
            : null
        }
        members={memberRows.map((m) => ({
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
          name: m.name,
          email: m.email,
          handle: m.handle,
          color: m.color,
          initials: m.initials,
        }))}
        tier={tier}
        memberCapacity={memberCapacity}
        notificationPrefs={prefs}
        pendingInvites={pendingInvites}
        recentActivity={recentActivity}
      />
    </>
  );
}
