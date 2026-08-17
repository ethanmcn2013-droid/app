import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users, workspaceMembers, workspaces } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth";
import { requireRouteProjectId } from "@/server/projects/route-authz";
import { getEffectiveTier } from "@/server/db/entitlements";
import { getMemberCapacity } from "@/server/db/membership";
import {
  getMyRoleInProject,
  getNotificationPrefs,
  listPendingInvitesAction,
  listWorkspaceActivityAction,
} from "@/server/actions/settings";
import { getSecurityData } from "@/server/actions/security";
import { getUserPreferences } from "@/server/db/preferences";
import { getWorkspaceStorageUsage } from "@/server/actions/attachments";
import { SettingsApp } from "@/components/app/settings/settings-app";
import { AppPageHeader } from "@/components/app/page-header";
import { TasksRuntimePageMount } from "@/components/app/tasks-runtime-mount";
import { isDemoMode } from "@/lib/access-mode";
import {
  DEMO_USER_ID,
  DEMO_WORKSPACE_ID,
  DEMO_WORKSPACE_SLUG,
  DEMO_WORKSPACE_NAME,
} from "@/server/demo/tasks-demo";
import { readPersonalityPrefs } from "@/server/personality-read";
import { PERSONALITY_DEFAULTS } from "@/lib/personality-prefs";

export const dynamic = "force-dynamic";

/**
 * Single-page settings surface, tabbed sub-views. NOT split into
 * /app/settings/billing etc., owner-gated mutations would have to
 * re-resolve role in every nested layout, and the v1.0 spec is small
 * enough that one client-rendered tab switcher beats nine layouts.
 *
 * All sub-views (workspace, members, notifications, appearance,
 * security, storage, billing, privacy, danger) read their server-side
 * state at this top level so the client shell stays a pure UI
 * orchestrator. New data fetches are folded into the existing
 * Promise.all — never serial.
 */
export default async function SettingsPage() {
  // Demo/Review: render a coherent settings surface from the synthetic
  // workspace instead of the real DB (whose tables aren't present on a
  // keyless preview). Interactions are inert in demo; the surface is for
  // visual review.
  if (isDemoMode()) {
    const nowIso = new Date().toISOString();
    return (
      <TasksRuntimePageMount>
        <AppPageHeader />
        <p
          role="status"
          className="border-b border-line-soft bg-brand-soft px-4 py-2 text-center text-xs font-medium text-brand"
        >
          Review preview, settings are read-only.
        </p>
        <SettingsApp
            readOnly
            currentUserId={DEMO_USER_ID}
            currentUserEmail="you@theorchard.example"
            myRole="owner"
            workspace={{
              id: DEMO_WORKSPACE_ID,
              slug: DEMO_WORKSPACE_SLUG,
              name: DEMO_WORKSPACE_NAME,
              activeDomain: "wedding",
              primaryUseCase: "venue",
              secondaryContext: null,
              currency: null,
              budgetCents: null,
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
              nudges: true,
            }}
            pendingInvites={[]}
            recentActivity={[]}
            securityData={{ clerkAvailable: false, signInMethods: [], sessions: [], recentActivity: [] }}
            initialThemeMode="system"
            storageUsageBytes={0}
            initialPersonalityPrefs={PERSONALITY_DEFAULTS}
          />
      </TasksRuntimePageMount>
    );
  }

  // WP3-C: was `getActiveWorkspace()`, whose third fallback hands back
  // LEGACY_WORKSPACE_ID — a workspace the caller has proved no membership of
  // (DECISIONS D-005) — and would have rendered a stranger's members list and
  // Danger Zone. `requireRouteProjectId` fails closed instead. The runtime
  // mounts with no explicit `workspaceId` on purpose (D-022): every read
  // below — members, roles, the Danger Zone's target — is ambient, so handing
  // the chrome an explicit Project would let the URL and the content disagree
  // (ADR 0001 §2). Both halves stay ambient. Same policy as /app/inbox,
  // /app/archived and /app/import.
  const [me, ws] = await Promise.all([
    getCurrentUser(),
    requireRouteProjectId(),
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

  // All remaining fetches run in parallel — no serial reads after this point.
  const [
    myRole,
    tier,
    prefs,
    memberCapacity,
    pendingInvites,
    recentActivity,
    securityData,
    userPreferences,
    storageUsageBytes,
    personalityPrefs,
  ] = await Promise.all([
    // The gate and the surface it gates now name the same Project. This used
    // to resolve one ambiently of its own accord, so the role shown could in
    // principle have been held in a different Project from the one rendered.
    getMyRoleInProject(ws, me),
    getEffectiveTier(me, ws),
    getNotificationPrefs(),
    getMemberCapacity(ws),
    listPendingInvitesAction(ws),
    listWorkspaceActivityAction(ws),
    getSecurityData(),
    getUserPreferences(me),
    getWorkspaceStorageUsage(ws),
    readPersonalityPrefs(me),
  ]);

  // Resolve the current user's email from the member rows (already fetched).
  const myMember = memberRows.find((m) => m.userId === me);
  const currentUserEmail = myMember?.email ?? "";

  return (
    <TasksRuntimePageMount>
      <AppPageHeader />
      <SettingsApp
        currentUserId={me}
        currentUserEmail={currentUserEmail}
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
                currency: workspaceRow.currency ?? null,
                budgetCents: workspaceRow.budgetCents ?? null,
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
        securityData={securityData}
        initialThemeMode={userPreferences.themeMode}
        storageUsageBytes={storageUsageBytes}
        initialPersonalityPrefs={personalityPrefs}
      />
    </TasksRuntimePageMount>
  );
}
