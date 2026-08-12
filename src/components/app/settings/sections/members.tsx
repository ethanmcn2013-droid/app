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
import type { SettingsMember } from "../settings-app";
import type { MemberCapacity } from "@/server/db/membership";

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
}: {
  members: SettingsMember[];
  myRole: "owner" | "member" | "none";
  currentUserId: string;
  memberCapacity: MemberCapacity;
  pendingInvites: PendingInvite[];
  recentActivity: ActivityLine[];
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [removeTarget, setRemoveTarget] = useState<SettingsMember | null>(
    null,
  );
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "owner">("member");
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
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
        await setMemberRoleAction(target.userId, nextRole);
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
        await removeMemberAction(target.userId);
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
        const result = await inviteMemberByEmailAction(email, inviteRole);
        if (result.reason === "already-member") {
          setInviteNotice(`${email} is already a member of this workspace.`);
          return;
        }
        if (result.reason === "cooldown") {
          setInviteNotice(
            `An invite was sent to ${email} recently. Wait an hour before resending.`,
          );
          return;
        }
        toast(`Invite sent to ${email}`, {
          tone: "success",
          body: "Good for 7 days. They click the link, sign in with this address, and they’re in.",
        });
        setInviteEmail("");
        setInviteNotice(null);
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
        await revokePendingInviteAction(invite.token);
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
        const result = await inviteMemberByEmailAction(invite.email, invite.role);
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
            body: `${invite.email} has already joined the workspace.`,
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

  return (
    <div>
      <SectionHeader
        eyebrow="Members"
        title="Who’s in this project"
        description="Roles, tenure, and the door. The owner controls who stays, everyone else can look but not touch."
      />

      {/* Invite */}
      <form
        onSubmit={handleInvite}
        className="rounded-xl border border-line-soft bg-bg-elevated p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
              Invite by email
            </div>
            <p className="mt-1 max-w-[520px] text-[12.5px] leading-[1.55] text-ink-soft">
              Drop an email and we send them a link. They click it, sign
              in with that address, and they&apos;re in, no setup, no
              tool tour. Invites are good for seven days.
            </p>
          </div>
          {showCounter ? (
            <span
              className={
                "flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums " +
                (isCapped
                  ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100"
                  : "bg-bg-sunken text-ink-soft")
              }
              title="Free + Pro projects include the owner plus three editing guests."
            >
              {memberCapacity.current} of {memberCapacity.max} used
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => { setInviteEmail(e.target.value); setInviteNotice(null); }}
            placeholder="teammate@yourdomain.com"
            disabled={!canEdit || pending || isCapped}
            className="flex-1 rounded-md border border-line bg-white px-3 py-1.5 text-[13px] text-ink shadow-sm focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-60"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "member" | "owner")}
            disabled={!canEdit || pending || isCapped}
            className="rounded-md border border-line bg-white px-2 py-1.5 text-[13px] text-ink shadow-sm focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-60"
            aria-label="Role for invited member"
          >
            <option value="member">Member</option>
            <option value="owner">Owner</option>
          </select>
          <button
            type="submit"
            disabled={!canEdit || pending || isCapped || !inviteEmail.trim()}
            className="rounded-full bg-ink px-4 py-1.5 text-[12.5px] font-medium text-white shadow-sm hover:bg-ink-soft disabled:opacity-50"
          >
            Send invite
          </button>
        </div>
        {inviteNotice ? (
          <p className="mt-2 text-[12px] leading-[1.5] text-ink-soft">
            {inviteNotice}
          </p>
        ) : null}
        {!canEdit ? (
          <p className="mt-2 text-[11.5px] text-ink-quiet">
            Only the owner can invite. Ask them.
          </p>
        ) : isCapped ? (
          <p className="mt-3 text-[11.5px] leading-[1.55] text-ink-soft">
            All free seats are taken, owner plus three editing guests.{" "}
            <a
              href="https://signalstudio.ie/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand underline-offset-2 hover:underline"
            >
              Upgrade to Workspace
            </a>{" "}
            for unlimited members per workspace, no per-seat tax.
          </p>
        ) : showCounter ? (
          <p className="mt-3 text-[11.5px] leading-[1.55] text-ink-quiet">
            Free includes three editing guests beyond the owner.{" "}
            <a
              href="https://signalstudio.ie/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-soft underline-offset-2 hover:text-ink hover:underline"
            >
              Workspace
            </a>{" "}
            unlocks unlimited members.
          </p>
        ) : null}
      </form>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-line-soft bg-bg-elevated">
          <div className="flex items-center justify-between border-b border-line-soft/70 bg-bg-sunken/30 px-5 py-2.5">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-quiet">
              Pending invites
            </div>
            <div className="text-[11px] text-ink-quiet tabular-nums">
              {pendingInvites.length}{" "}
              {pendingInvites.length === 1 ? "out" : "out"}
            </div>
          </div>
          <ul>
            {pendingInvites.map((invite) => (
              <li
                key={invite.token}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-line-soft/60 px-5 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-ink">
                    {invite.email}
                  </div>
                  <div className="text-[11.5px] text-ink-quiet">
                    Sent {fmtAgo(invite.createdAt)} &middot;{" "}
                    {fmtUntil(invite.expiresAt)}
                  </div>
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => handleResend(invite)}
                    disabled={pending}
                    className="rounded-full border border-line bg-white px-2.5 py-0.5 text-[11.5px] font-medium text-ink-soft hover:border-ink-soft/30 hover:text-ink disabled:opacity-60"
                  >
                    Resend
                  </button>
                ) : (
                  <span />
                )}
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => handleRevoke(invite)}
                    disabled={pending}
                    className="rounded-md p-1.5 text-ink-quiet transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
                    aria-label={`Revoke invite for ${invite.email}`}
                    title="Revoke invite"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                  </button>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Member list */}
      <div className="mt-4 overflow-hidden rounded-xl border border-line-soft bg-bg-elevated">
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-line-soft/70 bg-bg-sunken/30 px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-quiet">
          <div>Person</div>
          <div className="hidden sm:block">Joined</div>
          <div>Role</div>
          <div />
        </div>
        <ul>
          {members.map((m) => {
            const isMe = m.userId === currentUserId;
            const isOwner = m.role === "owner";
            return (
              <li
                key={m.userId}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-line-soft/60 px-5 py-3 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                    style={{
                      background: m.color ?? "var(--ink-quiet)",
                    }}
                    aria-hidden
                  >
                    {m.initials ?? "?"}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
                      <span className="truncate">{displayName(m)}</span>
                      {isMe ? (
                        <span className="rounded bg-bg-sunken px-1.5 py-0.5 text-[10px] font-medium text-ink-quiet">
                          you
                        </span>
                      ) : null}
                    </div>
                    <div className="truncate text-[11.5px] text-ink-quiet">
                      {m.email ?? m.handle ?? m.userId}
                    </div>
                  </div>
                </div>
                <div className="hidden text-[12px] tabular-nums text-ink-quiet sm:block">
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
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium transition-colors " +
                            (isOwner
                              ? "border-brand/30 bg-brand-soft text-brand hover:border-brand/50"
                              : "border-line bg-white text-ink-soft hover:border-ink-soft/30 hover:text-ink")
                          }
                        >
                          {isOwner ? "Owner" : "Member"}
                          <svg
                            width="9"
                            height="9"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.4"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                      )}
                      align="end"
                      width={170}
                      aria-label="Change member role"
                    >
                      {(close) => (
                        <div className="flex flex-col">
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
                    <span
                      className={
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-medium " +
                        (isOwner
                          ? "bg-brand-soft text-brand"
                          : "bg-bg-sunken text-ink-quiet")
                      }
                    >
                      {isOwner ? "Owner" : "Member"}
                    </span>
                  )}
                </div>
                <div>
                  {canEdit && !isMe ? (
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(m)}
                      disabled={pending}
                      className="rounded-md p-1.5 text-ink-quiet transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
                      aria-label={`Remove ${displayName(m)}`}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  ) : (
                    <span className="block w-[26px]" aria-hidden />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Recent activity, Sprint 2 cycle 10.4, plain-English prose */}
      {recentActivity.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border border-line-soft bg-bg-elevated">
          <div className="flex items-center justify-between border-b border-line-soft/70 bg-bg-sunken/30 px-5 py-2.5">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-quiet">
              Recent
            </div>
            <div className="text-[11px] text-ink-quiet">
              Last 10 changes in plain English
            </div>
          </div>
          <ul>
            {recentActivity.map((line) => (
              <li
                key={line.id}
                className="flex items-baseline justify-between gap-4 border-b border-line-soft/60 px-5 py-2.5 last:border-b-0"
              >
                <p className="min-w-0 text-[13px] leading-[1.45] text-ink">
                  {line.sentence}
                </p>
                <span
                  className="flex-shrink-0 text-[11px] tabular-nums text-ink-quiet"
                  title={new Date(line.createdAt).toLocaleString()}
                >
                  {line.relative}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Remove confirmation */}
      <Dialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        labelledBy="remove-member-title"
        width={420}
      >
        <div className="px-5 py-5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-rose-700">
            Confirm
          </div>
          <h3
            id="remove-member-title"
            className="mt-1 text-[17px] font-semibold tracking-tight"
          >
            Remove {removeTarget ? displayName(removeTarget) : "this person"}?
          </h3>
          <p className="mt-2 text-[13px] leading-[1.55] text-ink-soft">
            They lose access to the workspace immediately. Their tasks
            and comments stay; only the membership is revoked.
          </p>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setRemoveTarget(null)}
              className="rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:border-ink-soft/30 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => removeTarget && handleRemove(removeTarget)}
              className="rounded-full bg-rose-600 px-3 py-1.5 text-[12.5px] font-medium text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
            >
              {pending ? "Removing…" : "Remove member"}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
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
        "flex items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors " +
        (active ? "bg-brand-soft" : "hover:bg-bg-sunken")
      }
    >
      <span
        className={
          "mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border " +
          (active
            ? "border-brand bg-brand text-white"
            : "border-line bg-white")
        }
      >
        {active ? (
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : null}
      </span>
      <span className="flex-1">
        <span className="block text-[12.5px] font-medium text-ink">
          {label}
        </span>
        <span className="block text-[11px] text-ink-quiet">
          {description}
        </span>
      </span>
    </button>
  );
}
