import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { pendingInvites, workspaces, users } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { AcceptInviteButton } from "./accept-button";

export const dynamic = "force-dynamic";

/**
 * `/invite/[token]` — workspace-invite landing page.
 *
 * Server-renders the invite context (workspace name + inviter name +
 * the email it was sent to). The actual accept action is gated by
 * Clerk auth: the user must be signed in with the email address the
 * invite was sent to. If they're not signed in yet, they hit the
 * sign-in flow first; if they're signed in with the wrong email,
 * we say so plainly.
 *
 * The accept itself is a client-island button (`<AcceptInviteButton>`)
 * that calls `acceptInviteAction` and routes to `/app/board` on success.
 */

type InvitePreview =
  | { state: "ok"; workspaceName: string; inviterName: string; email: string; expiresLabel: string }
  | { state: "missing" }
  | { state: "expired" }
  | { state: "accepted" };

async function loadInvitePreview(token: string): Promise<InvitePreview> {
  const [invite] = await db
    .select({
      token: pendingInvites.token,
      workspaceId: pendingInvites.workspaceId,
      email: pendingInvites.email,
      expiresAt: pendingInvites.expiresAt,
      acceptedAt: pendingInvites.acceptedAt,
      invitedByUserId: pendingInvites.invitedByUserId,
    })
    .from(pendingInvites)
    .where(eq(pendingInvites.token, token));
  if (!invite) return { state: "missing" };
  if (invite.acceptedAt) return { state: "accepted" };
  if (invite.expiresAt < new Date()) return { state: "expired" };

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
  const preview = await loadInvitePreview(token);

  // If the invite is already accepted, send the user straight to the app.
  if (preview.state === "accepted") {
    redirect("/app/board?invite=already-accepted");
  }

  const me = await getCurrentUser();
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, me));
  const myEmail = user?.email ?? null;

  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-[640px] px-6 py-20">
          <div className="rounded-2xl border border-line-soft bg-bg-elevated px-8 py-10">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
              Workspace invite
            </div>

            {preview.state === "missing" ? (
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
                  one — you&rsquo;ll get a fresh link.
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
                <p className="mt-3 text-[14.5px] leading-[1.55] text-ink-soft">
                  One workspace, every view, the daily digest. Three editing
                  guests on Free, unlimited members on Team. No card, no
                  trial.
                </p>
                <div className="mt-5 grid gap-2 rounded-xl border border-line-soft bg-white px-4 py-3 text-[12.5px]">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-quiet">Sent to</span>
                    <span className="font-mono text-ink">{preview.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-quiet">Expires</span>
                    <span className="text-ink">{preview.expiresLabel}</span>
                  </div>
                </div>

                {myEmail &&
                myEmail.toLowerCase() === preview.email.toLowerCase() ? (
                  <div className="mt-7">
                    <AcceptInviteButton token={token} />
                  </div>
                ) : myEmail ? (
                  <p className="mt-7 rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3 text-[13px] leading-[1.55] text-amber-800">
                    You&rsquo;re signed in as{" "}
                    <span className="font-medium">{myEmail}</span>, but this
                    invite was sent to{" "}
                    <span className="font-medium">{preview.email}</span>. Sign
                    out and sign in with the invited address.
                  </p>
                ) : (
                  <div className="mt-7">
                    <Link
                      href={`/sign-in?redirect_url=${encodeURIComponent(`/invite/${token}`)}`}
                      className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(20,21,26,0.4)]"
                    >
                      Sign in to accept
                    </Link>
                    <p className="mt-3 text-[12px] text-ink-quiet">
                      Use the email this was sent to:{" "}
                      <span className="font-mono">{preview.email}</span>.
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
