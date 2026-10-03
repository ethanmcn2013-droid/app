"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/primitives/toast";
import { Dialog } from "@/components/primitives/dialog";
import { Popover } from "@/components/app/detail-panel/popover";
import {
  inviteMemberByEmailAction,
  removeMemberAction,
  revokePendingInviteAction,
  setMemberRoleAction,
} from "@/server/actions/settings";
import { SectionHeader } from "../settings-app";
import { Avatar, Badge, Callout, DialogBody, Hint, Segmented, SettingsGroup, SettingsListRow, cx, ui } from "../settings-ui";
import type { SettingsMember } from "../settings-app";
import type { MemberCapacity } from "@/server/db/membership";

const ROLE_OPTIONS = [
  { value: "member", label: "Member" },
  { value: "owner", label: "Owner" },
] as const;

function fmtJoined(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = Date.now();
  const days = Math.floor((now - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 1) return "Today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function displayName(m: SettingsMember): string {
  return m.name ?? m.handle ?? m.email ?? m.userId.slice(0, 10);
}

type PendingInvite = {
  token: string;
  email: string;
  role: "member" | "owner";
  createdAt: string;
  expiresAt: string;
  invitedByUserId: string;
  lastSentAt: number | null;
};

type ActivityLine = {
  id: string;
  sentence: string;
  relative: string;
  createdAt: string;
};

function fmtAgo(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtUntil(iso: string): string {
  const d = new Date(iso);
  const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "expired";
  if (days === 1) return "expires tomorrow";
  return `expires in ${days} days`;
}

export function MembersSection({
  members,
  myRole,
  currentUserId,
  memberCapacity,
  pendingInvites,
  recentActivity,
  projectId,
}: {
  members: SettingsMember[];
  myRole: "owner" | "member" | "none";
  currentUserId: string;
  memberCapacity: MemberCapacity;
  pendingInvites: PendingInvite[];
  recentActivity: ActivityLine[];
  /**
   * The Project this roster was rendered from. Every membership mutation names
   * it, so a removal or a role change lands in the Project whose member list
   * the operator is actually looking at rather than wherever the ambient
   * cookie has since moved (ADR 0001 §9).
   */
  projectId: string | null;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [removeTarget, setRemoveTarget] = useState<SettingsMember | null>(
    null,
  );
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "owner">("member");
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [manualInvite, setManualInvite] = useState<{ email: string; url: string } | null>(null);
  const canEdit = myRole === "owner";
  const isCapped =
    memberCapacity.max !== null &&
    memberCapacity.current >= memberCapacity.max;
  const showCounter = memberCapacity.max !== null;

  function handleRoleChange(
    target: SettingsMember,
    nextRole: "owner" | "member",
    close: () => void,
  ) {
    close();
    startTransition(async () => {
      try {
        await setMemberRoleAction(target.userId, nextRole, projectId ?? undefined);
        toast(
          nextRole === "owner"
            ? `${displayName(target)} is now an owner`
            : `${displayName(target)} demoted to member`,
          { tone: "success" },
        );
      } catch (e) {
        toast("Couldn’t change role", {
          tone: "error",
          body: (e as Error).message,
        });
      }
    });
  }

  function handleRemove(target: SettingsMember) {
    setRemoveTarget(null);
    startTransition(async () => {
      try {
        await removeMemberAction(target.userId, projectId ?? undefined);
        toast(`${displayName(target)} removed`, { tone: "success" });
      } catch (e) {
        toast("Couldn’t remove", {
          tone: "error",
          body: (e as Error).message,
        });
      }
    });
  }

  function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    setInviteNotice(null);
    startTransition(async () => {
      try {
        const result = await inviteMemberByEmailAction(
          email,
          inviteRole,
          projectId ?? undefined,
        );
        if (result.reason === "already-member") {
          setInviteNotice(`${email} is already a member of this project.`);
          return;
        }
        if (result.reason === "cooldown") {
          setInviteNotice(
            `An invite was sent to ${email} recently. Wait an hour before resending.`,
          );
          return;
        }
        if ((result.reason === "email-unavailable" || result.reason === "delivery-unconfirmed") && result.acceptUrl) {
          setManualInvite({ email: result.email, url: result.acceptUrl });
          setInviteEmail("");
          setInviteNotice(result.reason === "email-unavailable"
            ? "Invite created. Email isn’t available right now, so no message was sent."
            : "Invite created. We couldn’t confirm email delivery; check with them before sending again.");
          return;
        }
        if (result.reason === "delivery-unconfirmed") {
          setManualInvite(null);
          setInviteNotice("We couldn’t confirm email delivery or verify the invite link. Check with them before trying again.");
          return;
        }
        if (result.reason === "invite-no-longer-active") {
          setManualInvite(null);
          setInviteNotice("The invite is no longer active. Email delivery wasn’t confirmed; check with them before trying again.");
          return;
        }
        toast(`Invite sent to ${email}`, {
          tone: "success",
          body: "Good for 7 days. They click the link, sign in with this address, and they’re in.",
        });
        setInviteEmail("");
        setInviteNotice(null);
        setManualInvite(null);
      } catch (err) {
        toast("Couldn’t invite", {
          tone: "error",
          body: (err as Error).message,
        });
      }
    });
  }

  function handleRevoke(invite: PendingInvite) {
    startTransition(async () => {
      try {
        await revokePendingInviteAction(invite.token, projectId ?? undefined);
        setManualInvite((current) => current?.url.endsWith(`/invite/${encodeURIComponent(invite.token)}`) ? null : current);
        toast(`Invite to ${invite.email} revoked`, { tone: "success" });
      } catch (err) {
        toast("Couldn’t revoke", {
          tone: "error",
          body: (err as Error).message,
        });
      }
    });
  }

  function handleResend(invite: PendingInvite) {
    startTransition(async () => {
      try {
        const result = await inviteMemberByEmailAction(
          invite.email,
          invite.role,
          projectId ?? undefined,
        );
        if (result.reason === "cooldown") {
          toast("Resend skipped", {
            tone: "info",
            body: "An invite was sent recently. Wait an hour before resending.",
          });
          return;
        }
        if (result.reason === "already-member") {
          toast("Already a member", {
            tone: "info",
            body: `${invite.email} has already joined the project.`,
          });
          return;
        }
        if ((result.reason === "email-unavailable" || result.reason === "delivery-unconfirmed") && result.acceptUrl) {
          setManualInvite({ email: result.email, url: result.acceptUrl });
          toast("Invite ready to share", {
            tone: "info",
            body: result.reason === "email-unavailable"
              ? "Email isn’t available right now. No message was sent; copy the link below instead."
              : "We couldn’t confirm email delivery. Check with them before sending again, or copy the link below.",
          });
          return;
        }
        if (result.reason === "delivery-unconfirmed") {
          setManualInvite(null);
          toast("Email delivery unconfirmed", {
            tone: "info",
            body: "We couldn’t verify the invite link. Check with them before trying again.",
          });
          return;
        }
        if (result.reason === "invite-no-longer-active") {
          setManualInvite(null);
          toast("Invite no longer active", {
            tone: "info",
            body: "Email delivery wasn’t confirmed. Check with them before trying again.",
          });
          return;
        }
        toast(`Resent to ${invite.email}`, {
          tone: "success",
          body: "Same link, same expiry. Worth a follow-up if it’s been days.",
        });
      } catch (err) {
        toast("Couldn’t resend", {
          tone: "error",
          body: (err as Error).message,
        });
      }
    });
  }

  async function handleCopyLink(invite: PendingInvite) {
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const url = new URL(`/invite/${encodeURIComponent(invite.token)}`, origin).toString();
    setManualInvite({ email: invite.email, url });
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      toast("Invite link copied", { tone: "success" });
    } catch {
      toast("Select and copy the link below", { tone: "info" });
    }
  }

  return (
    <div>
      <SectionHeader
        title="Members"
        description="Who can open this project. Owners invite people, change roles and remove access. Everyone else can see the list."
      />

      {/* Invite */}
      <SettingsGroup
        title="Invite people"
        description="Each invite lasts seven days. Only the email address it names can accept it."
        aside={
          showCounter ? (
            <Badge
              tone={isCapped ? "danger" : "neutral"}
              title="Free + Pro projects include the owner plus three editing guests."
            >
              {memberCapacity.current} of {memberCapacity.max} used
            </Badge>
          ) : null
        }
      >
        <form onSubmit={handleInvite} className="px-4 py-4 md:px-5">
          <label htmlFor="invite-email" className="text-[13.5px] font-medium leading-5 text-[color:var(--v3-text)]">
            Email address
          </label>
          <p className="mt-0.5 text-[12.5px] leading-[1.5] text-[color:var(--v3-text-2)]">
            If email delivery is available, we send the link. Otherwise, copy it
            below and share it with them.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setInviteNotice(null); }}
              placeholder="teammate@yourdomain.com"
              disabled={!canEdit || pending || isCapped}
              className={cx(ui.input, "sm:flex-1")}
            />
            <Segmented
              value={inviteRole}
              onChange={setInviteRole}
              disabled={!canEdit || pending || isCapped}
              label="Role for invited member"
              options={ROLE_OPTIONS}
            />
            <button
              type="submit"
              disabled={!canEdit || pending || isCapped || !inviteEmail.trim()}
              className={ui.primary}
            >
              Create invite
            </button>
          </div>
          {inviteNotice ? (
            <p className="mt-2.5 text-[12.5px] leading-[1.5] text-[color:var(--v3-text-2)]">
              {inviteNotice}
            </p>
          ) : null}
          {canEdit && manualInvite ? (
            <div className="mt-3">
              <Callout>
                <label htmlFor="manual-invite-link" className="block text-[12.5px] font-medium text-[color:var(--v3-text)]">
                  Link for {manualInvite.email}
                </label>
                <p className="mt-0.5">
                  Only someone signed in with this verified email can accept. The link expires with the invite.
                </p>
                <input id="manual-invite-link" type="text" readOnly value={manualInvite.url}
                  onFocus={(event) => event.currentTarget.select()}
                  aria-label={`Invite link for ${manualInvite.email}`}
                  className={cx(ui.input, "mt-2 font-mono text-[12px]")} />
              </Callout>
            </div>
          ) : null}
          {!canEdit ? (
            <div className="mt-3">
              <Hint>Only the owner can invite people. Ask them.</Hint>
            </div>
          ) : isCapped ? (
            <p className="mt-3 text-[12.5px] leading-[1.55] text-[color:var(--v3-text-2)]">
              All free seats are taken: the owner plus three editing guests.{" "}
              <a
                href="https://signalstudio.ie/pricing"
                target="_blank"
                rel="noopener noreferrer"
                className={ui.link}
              >
                Compare plans
              </a>
            </p>
          ) : showCounter ? (
            <p className="mt-3 text-[12.5px] leading-[1.55] text-[color:var(--v3-text-3)]">
              Free includes three editing guests beyond the owner.{" "}
              <a
                href="https://signalstudio.ie/pricing"
                target="_blank"
                rel="noopener noreferrer"
                className={ui.link}
              >
                Compare plans
              </a>
            </p>
          ) : null}
        </form>
      </SettingsGroup>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <SettingsGroup
          title="Pending invites"
          aside={
            <span className="text-[12px] tabular-nums text-[color:var(--v3-text-3)]">
              {pendingInvites.length} waiting
            </span>
          }
        >
          {pendingInvites.map((invite) => (
            <SettingsListRow key={invite.token} className="flex-wrap">
              <div className="min-w-[180px] flex-1">
                <div className="truncate text-[13px] font-medium text-[color:var(--v3-text)]">
                  {invite.email}
                </div>
                <div className="text-[12px] text-[color:var(--v3-text-3)]">
                  {invite.lastSentAt === null ? "Created" : "Sent"}{" "}
                  {fmtAgo(invite.lastSentAt === null ? invite.createdAt : new Date(invite.lastSentAt).toISOString())} &middot;{" "}
                  {fmtUntil(invite.expiresAt)}
                </div>
              </div>
              {canEdit ? (
                <button type="button" onClick={() => void handleCopyLink(invite)} className={ui.button}>
                  Copy link
                </button>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => handleResend(invite)}
                  disabled={pending}
                  className={ui.button}
                >
                  {invite.lastSentAt === null ? "Send email" : "Resend"}
                </button>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => handleRevoke(invite)}
                  disabled={pending}
                  className={ui.icon}
                  aria-label={`Revoke invite for ${invite.email}`}
                  title="Revoke invite"
                >
                  <TrashIcon />
                </button>
              ) : null}
            </SettingsListRow>
          ))}
        </SettingsGroup>
      )}

      {/* Member list: a table from sm up (name, joined, role, remove), a
          two-line list below it. The header row is visual only; each row
          still says "Joined …" to assistive technology. */}
      <SettingsGroup
        title="People"
        aside={
          <span className="text-[12px] tabular-nums text-[color:var(--v3-text-3)]">
            {members.length} {members.length === 1 ? "person" : "people"}
          </span>
        }
      >
        <div
          aria-hidden
          className="hidden grid-cols-[minmax(0,1fr)_120px_116px_32px] items-center gap-4 rounded-t-[var(--v3-radius-lg)] bg-[var(--v3-sunken)] px-5 py-2 text-[12px] font-medium text-[color:var(--v3-text-3)] sm:grid"
        >
          <span>Name</span>
          <span>Joined</span>
          <span>Role</span>
          <span />
        </div>
        <ul className="divide-y divide-[color:var(--v3-border)]">
          {members.map((m) => {
            const isMe = m.userId === currentUserId;
            const isOwner = m.role === "owner";
            return (
              <li
                key={m.userId}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_120px_116px_32px] sm:gap-4 md:px-5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar initials={m.initials} color={m.color} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[13.5px] font-medium text-[color:var(--v3-text)]">
                      <span className="truncate">{displayName(m)}</span>
                      {isMe && displayName(m).trim().toLowerCase() !== "you" ? <Badge>You</Badge> : null}
                    </div>
                    <div className="truncate text-[12px] text-[color:var(--v3-text-3)]">
                      {m.email ?? m.handle ?? m.userId}
                      <span className="sm:hidden"> &middot; {joinedLabel(m.joinedAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="hidden text-[12.5px] tabular-nums text-[color:var(--v3-text-2)] sm:block">
                  <span className="sr-only">Joined </span>
                  {fmtJoined(m.joinedAt)}
                </div>
                <div>
                  {canEdit && !isMe ? (
                    <Popover
                      trigger={({ onClick, ref }) => (
                        <button
                          ref={ref}
                          onClick={onClick}
                          className={
                            "inline-flex h-[26px] items-center gap-1 rounded-full py-0 pl-2.5 pr-2 text-[12px] font-medium transition-[background-color,box-shadow] focus-visible:rounded-full! pointer-coarse:h-[44px] " +
                            (isOwner
                              ? "bg-[var(--v3-accent-soft)] text-[color:var(--v3-accent)] hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--v3-accent)_45%,transparent)]"
                              : "bg-[var(--v3-sunken)] text-[color:var(--v3-text-2)] shadow-[0_0_0_1px_var(--v3-border)] hover:text-[color:var(--v3-text)] hover:shadow-[0_0_0_1px_var(--v3-border-strong)]")
                          }
                        >
                          {isOwner ? "Owner" : "Member"}
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
                          </svg>
                        </button>
                      )}
                      align="end"
                      width={200}
                      aria-label="Change member role"
                    >
                      {(close) => (
                        <div className="flex flex-col gap-0.5">
                          <RolePopoverItem
                            active={isOwner}
                            label="Owner"
                            description="Full control"
                            onClick={() =>
                              handleRoleChange(m, "owner", close)
                            }
                          />
                          <RolePopoverItem
                            active={!isOwner}
                            label="Member"
                            description="Read + write"
                            onClick={() =>
                              handleRoleChange(m, "member", close)
                            }
                          />
                        </div>
                      )}
                    </Popover>
                  ) : (
                    <Badge tone={isOwner ? "accent" : "neutral"}>
                      {isOwner ? "Owner" : "Member"}
                    </Badge>
                  )}
                </div>
                <div className="flex justify-end">
                  {canEdit && !isMe ? (
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(m)}
                      disabled={pending}
                      className={ui.icon}
                      aria-label={`Remove ${displayName(m)}`}
                      title="Remove"
                    >
                      <TrashIcon />
                    </button>
                  ) : (
                    <span className="block w-[30px]" aria-hidden />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </SettingsGroup>

      {/* Recent activity, Sprint 2 cycle 10.4, plain-English prose */}
      {recentActivity.length > 0 && (
        <SettingsGroup
          title="Recent changes"
          description="The last 10 changes, in plain English."
        >
          {recentActivity.map((line) => (
            <SettingsListRow key={line.id} className="items-baseline justify-between gap-4 py-2.5">
              <p className="min-w-0 text-[13px] leading-[1.45] text-[color:var(--v3-text)]">
                {line.sentence}
              </p>
              <span
                className="shrink-0 text-[12px] tabular-nums text-[color:var(--v3-text-3)]"
                title={new Date(line.createdAt).toLocaleString()}
              >
                {line.relative}
              </span>
            </SettingsListRow>
          ))}
        </SettingsGroup>
      )}

      {/* Remove confirmation */}
      <Dialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        labelledBy="remove-member-title"
        width={420}
      >
        <DialogBody
          titleId="remove-member-title"
          tone="danger"
          title={<>Remove {removeTarget ? displayName(removeTarget) : "this person"}?</>}
          actions={
            <>
              <button
                type="button"
                onClick={() => setRemoveTarget(null)}
                className={ui.button}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => removeTarget && handleRemove(removeTarget)}
                className={ui.dangerSolid}
              >
                {pending ? "Removing…" : "Remove member"}
              </button>
            </>
          }
        >
          They lose access to this project straight away. Their tasks and
          comments stay; only the membership ends.
        </DialogBody>
      </Dialog>
    </div>
  );
}

function joinedLabel(iso: string | null): string {
  const joined = fmtJoined(iso);
  if (joined === "—") return "Joined date unknown";
  return joined === "Today" ? "Joined today" : `Joined ${joined}`;
}

function TrashIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.75 4.25h10.5M6.25 4.25V3a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 .75.75v1.25" />
      <path d="M4 4.25 4.6 12.6a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8.35" />
      <path d="M6.75 7v3.75M9.25 7v3.75" />
    </svg>
  );
}

function RolePopoverItem({
  active,
  label,
  description,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-start gap-2.5 rounded-[var(--v3-radius-sm)] px-2 py-1.5 text-left transition-colors " +
        (active ? "bg-[var(--v3-accent-soft)]" : "hover:bg-[var(--v3-hover)]")
      }
    >
      <span
        className={
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border " +
          (active
            ? "border-[color:var(--v3-accent)] bg-[var(--v3-accent)] text-[color:var(--v3-on-accent)]"
            : "border-[color:var(--v3-border-strong)] bg-[var(--v3-surface)]")
        }
      >
        {active ? (
          <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m3.5 8.5 3 3 6-7" />
          </svg>
        ) : null}
      </span>
      <span className="flex-1">
        <span className="block text-[13px] font-medium text-[color:var(--v3-text)]">
          {label}
        </span>
        <span className="block text-[12px] text-[color:var(--v3-text-3)]">
          {description}
        </span>
      </span>
    </button>
  );
}
