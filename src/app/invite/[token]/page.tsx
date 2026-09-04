import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { currentUser as clerkCurrentUser } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { pendingInvites, workspaces, workspaceMembers, users } from "@/server/db/schema";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { AcceptInviteButton } from "./accept-button";
import { isDemoMode } from "@/lib/access-mode";
import { inviteAuthUrl } from "@/lib/auth/invite-intent";
import { MY_WORK_APP_PATH } from "@/lib/product-urls";
import { parseProjectId } from "@/lib/projects/project-ref";
import { withActiveProject } from "@/lib/projects/project-url";
import { isActiveProjectV3Enabled } from "@/lib/projects/flags";

export const dynamic = "force-dynamic";

/**
 * `/invite/[token]`, workspace-invite landing page.
 *
 * Server-renders the invite context (workspace name + inviter name +
 * the email it was sent to). The actual accept action is gated by
 * Clerk auth: the user must be signed in with the email address the
 * invite was sent to. If they're not signed in yet, they hit the
 * sign-in flow first; if they're signed in with the wrong email,
 * we say so plainly.
 *
 * The accept itself is a client-island button (`<AcceptInviteButton>`)
 * that calls `acceptInviteAction` and opens the joined project's My work.
 * GET only previews state: it never consumes an invite or selects a project.
 */

type InvitePreview =
  | { state: "ok"; workspaceName: string; inviterName: string; email: string; expiresLabel: string }
  | { state: "missing" }
  | { state: "expired" }
  | { state: "accepted"; workspaceId?: string; acceptedByUserId?: string | null };

async function loadInvitePreview(token: string): Promise<InvitePreview> {
  if (isDemoMode()) {
    if (token === "review-valid") {
      return {
        state: "ok",
        workspaceName: "The Orchard, events",
        inviterName: "Niamh O’Connell",
        email: "orla@theorchard.ie",
        expiresLabel: "July 22, 2026",
      };
    }
    if (token === "review-expired") return { state: "expired" };
    if (token === "review-accepted") return { state: "accepted" };
    return { state: "missing" };
  }
  const [invite] = await db
    .select({
      token: pendingInvites.token,
      workspaceId: pendingInvites.workspaceId,
      email: pendingInvites.email,
      expiresAt: pendingInvites.expiresAt,
      acceptedAt: pendingInvites.acceptedAt,
      acceptedByUserId: pendingInvites.acceptedByUserId,
      invitedByUserId: pendingInvites.invitedByUserId,
    })
    .from(pendingInvites)
    .where(eq(pendingInvites.token, token));
  if (!invite) return { state: "missing" };
  if (invite.acceptedAt) return {
    state: "accepted", workspaceId: invite.workspaceId, acceptedByUserId: invite.acceptedByUserId,
  };
  if (invite.expiresAt <= new Date()) return { state: "expired" };

  const [workspace] = await db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, invite.workspaceId));
  const [inviter] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, invite.invitedByUserId));

  return {
    state: "ok",
    workspaceName: workspace?.name ?? "a workspace",
    inviterName: inviter?.name ?? inviter?.email ?? "a teammate",
    email: invite.email,
    expiresLabel: invite.expiresAt.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  };
}

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const demoMode = isDemoMode();
  const preview = await loadInvitePreview(token);

  // Previewing must not provision a user or consume state. The shared auth
  // helper provisions on read, so use Clerk identity plus a read-only lookup.
  const user = demoMode ? null : await clerkCurrentUser();
  const [actor] = user ? await db.select({ id: users.id }).from(users)
    .where(eq(users.clerkId, user.id)) : [];
  const me = actor?.id ?? user?.id ?? null;
  let myEmail: string | null = null;
  let emailVerified = false;
  let acceptedProjectUrl: string | null = null;
  if (demoMode) {
    myEmail = "orla@theorchard.ie";
    emailVerified = true;
  } else if (me) {
    const primary = user?.emailAddresses.find((email) => email.id === user.primaryEmailAddressId);
    myEmail = primary?.emailAddress ?? null;
    emailVerified = primary?.verification?.status === "verified";

    // A used token is not an access grant. Only its accepting account with
    // current membership gets a contextual link; a removed member gets none.
    // Flag-off My work still reads the legacy cookie. A contextual GET must
    // not select a Project, so only offer this link when its URL is honoured.
    if (isActiveProjectV3Enabled() && preview.state === "accepted" && preview.acceptedByUserId === me) {
      const projectId = parseProjectId(preview.workspaceId);
      if (projectId) {
        const [membership] = await db.select({ id: workspaceMembers.workspaceId })
          .from(workspaceMembers)
          .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
          .where(and(
            eq(workspaceMembers.userId, me),
            eq(workspaceMembers.workspaceId, projectId),
            isNull(workspaces.archivedAt),
          ));
        if (membership) acceptedProjectUrl = withActiveProject(MY_WORK_APP_PATH, projectId);
      }
    }
  }

  return (
    <>
      <SiteNav isAuthed={Boolean(me)} />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-[640px] px-6 py-20">
          <div className="rounded-2xl border border-line-soft bg-bg-elevated px-8 py-10">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
              Workspace invite
            </div>

            {preview.state === "accepted" ? (
              <>
                <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
                  This invite has already been accepted.
                </h1>
                <p className="mt-3 text-[14.5px] leading-[1.55] text-ink-soft">
                  {acceptedProjectUrl
                    ? "You can open your assigned work in this project."
                    : me
                      ? "Choose the project from your project menu. If it is missing, ask the owner for a fresh invite."
                      : "Sign in with the account that accepted it, or ask the owner for a fresh invite."}
                </p>
                {acceptedProjectUrl ? (
                  <Link href={acceptedProjectUrl} className="mt-6 inline-flex text-[13px] font-medium text-ink">
                    Open My work
                  </Link>
                ) : !me ? (
                  <Link href={inviteAuthUrl("sign-in", `/invite/${token}`)} className="mt-6 inline-flex text-[13px] font-medium text-ink">
                    Sign in
                  </Link>
                ) : null}
              </>
            ) : preview.state === "missing" ? (
              <>
                <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
                  This invite link doesn&rsquo;t exist.
                </h1>
                <p className="mt-3 text-[14.5px] leading-[1.55] text-ink-soft">
                  The token doesn&rsquo;t match any pending invite. The owner
                  may have revoked it, or the link was mistyped. Ask for a
                  fresh one.
                </p>
                <div className="mt-6">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-soft hover:text-ink"
                  >
                    Back home
                  </Link>
                </div>
              </>
            ) : preview.state === "expired" ? (
              <>
                <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
                  This invite has expired.
                </h1>
                <p className="mt-3 text-[14.5px] leading-[1.55] text-ink-soft">
                  Invites are good for 7 days. Ask the owner to send a new
                  one, you&rsquo;ll get a fresh link.
                </p>
                <div className="mt-6">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-soft hover:text-ink"
                  >
                    Back home
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
                  {preview.inviterName} added you to {preview.workspaceName}.
                </h1>
                {/* E05.10: this page is the first thing a couple's spouse,
                    planner or family member sees, and a sponsored wedding
                    workspace reaches it too. It states what accepting grants
                    and nothing about plans, prices or seat counts (D-020). It
                    also says plainly that a member can edit everything,
                    because today there is only one collaborator role. */}
                <p className="mt-3 text-[14.5px] leading-[1.55] text-ink-soft">
                  Accepting adds you to this workspace. You will see the same
                  views, tasks and daily briefing the owner sees, and you can
                  edit them.
                </p>
                <div className="mt-5 grid gap-2 rounded-xl border border-line-soft bg-white px-4 py-3 text-[12.5px]">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-quiet">Sent to</span>
                    {/* Security: only reveal the invited email once the signed-in
                        user's email matches. Pre-auth, show a placeholder so the
                        page cannot be used to enumerate email addresses. */}
                    {emailVerified && myEmail &&
                    myEmail.toLowerCase() === preview.email.toLowerCase() ? (
                      <span className="font-mono text-ink">{preview.email}</span>
                    ) : (
                      <span className="text-ink-soft">Sign in to confirm</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-quiet">Expires</span>
                    <span className="text-ink">{preview.expiresLabel}</span>
                  </div>
                </div>

                {emailVerified && myEmail &&
                myEmail.toLowerCase() === preview.email.toLowerCase() ? (
                  <div className="mt-7">
                    {demoMode ? (
                      <>
                        <button
                          type="button"
                          disabled
                          className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-[14px] font-medium text-white opacity-55"
                        >
                          Accept invite
                        </button>
                        <p className="mt-3 text-[12px] text-ink-quiet">
                          Disabled in review mode. No workspace will be changed.
                        </p>
                      </>
                    ) : (
                      <AcceptInviteButton token={token} />
                    )}
                  </div>
                ) : me ? (
                  <div className="mt-7 rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3 text-[13px] leading-[1.55] text-amber-800">
                    <p>
                      You&rsquo;re signed in as{" "}
                      <span className="font-medium">{myEmail ?? "an account without a verified email"}</span>.
                      {emailVerified
                        ? " Use the email address this invite was sent to."
                        : " Verify the invited email address before accepting."}
                    </p>
                    <SignOutButton redirectUrl={inviteAuthUrl("sign-in", `/invite/${token}`)}>
                      <button type="button" className="mt-3 min-h-11 font-medium underline">
                        Sign out and use the invited account
                      </button>
                    </SignOutButton>
                  </div>
                ) : (
                  <div className="mt-7">
                    <Link
                      href={inviteAuthUrl("sign-in", `/invite/${token}`)}
                      className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(20,21,26,0.4)]"
                    >
                      Sign in to accept
                    </Link>
                    <p className="mt-3 text-[12px] text-ink-quiet">
                      Sign in with the email address this invite was sent to.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
