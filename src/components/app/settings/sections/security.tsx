"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/primitives/toast";
import { Dialog } from "@/components/primitives/dialog";
import {
  revokeSessionAction,
  revokeOtherSessionsAction,
} from "@/server/actions/security";
import { SectionHeader } from "../settings-app";
import type { SecurityData, SignInMethod, ActiveSession, SecurityActivityLine } from "@/server/actions/security";

// ── Helpers ──────────────────────────────────────────────────────────

function fmtLastActive(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / (60 * 1000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Provider icons — inline SVG, no new deps ──────────────────────

function ProviderIcon({ kind }: { kind: SignInMethod["kind"] }) {
  if (kind === "google") {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        aria-hidden
        className="flex-shrink-0"
      >
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
    );
  }
  if (kind === "github") {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
        className="flex-shrink-0 text-ink"
      >
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    );
  }
  if (kind === "apple") {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
        className="flex-shrink-0 text-ink"
      >
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
    );
  }
  // email
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
      className="flex-shrink-0 text-ink-soft"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

// ── Sign-in methods block ────────────────────────────────────────────

function SignInMethodsBlock({ methods }: { methods: SignInMethod[] }) {
  const connectedCount = methods.filter((m) => m.connected).length;
  const anyProviderConnected = methods.some(
    (m) => m.kind !== "email" && m.connected,
  );
  const noProvidersEnabledYet = !anyProviderConnected && connectedCount <= 1;

  return (
    <div className="overflow-hidden rounded-xl border border-line-soft bg-bg-elevated">
      <div className="flex items-center justify-between border-b border-line-soft/70 bg-bg-sunken/30 px-5 py-2.5">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-quiet">
          How you sign in
        </div>
      </div>
      <ul>
        {methods.map((method) => (
          <li
            key={method.kind}
            className="flex items-center gap-4 border-b border-line-soft/60 px-5 py-3.5 last:border-b-0"
          >
            <ProviderIcon kind={method.kind} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-ink">
                {method.label}
              </div>
              {method.connected && method.identifier ? (
                <div className="mt-0.5 truncate text-[11.5px] text-ink-quiet">
                  {method.identifier}
                </div>
              ) : null}
            </div>
            {method.connected ? (
              <span className="flex-shrink-0 rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-medium text-brand">
                Connected
                {method.verified ? "" : " (unverified)"}
              </span>
            ) : (
              <span className="flex-shrink-0 text-[12px] text-ink-quiet">
                Not connected
              </span>
            )}
          </li>
        ))}
      </ul>
      {noProvidersEnabledYet ? (
        <div className="border-t border-line-soft/60 px-5 py-3 text-[12px] leading-[1.55] text-ink-quiet">
          Adding and removing sign-in methods arrives with provider
          enablement.
        </div>
      ) : null}
    </div>
  );
}

// ── Active sessions block ────────────────────────────────────────────

function ActiveSessionsBlock({
  initialSessions,
}: {
  initialSessions: ActiveSession[];
}) {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ActiveSession[]>(initialSessions);
  const [pending, startTransition] = useTransition();
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);

  const otherSessions = sessions.filter((s) => !s.isCurrent);

  function handleRevoke(sessionId: string) {
    const snapshot = sessions;
    // Optimistic removal.
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    startTransition(async () => {
      try {
        await revokeSessionAction(sessionId);
        toast("Signed out of that session", { tone: "success" });
      } catch (e) {
        setSessions(snapshot);
        toast("Couldn't sign out", {
          tone: "error",
          body: (e as Error).message,
        });
      }
    });
  }

  function handleRevokeAll() {
    setRevokeAllOpen(false);
    const snapshot = sessions;
    // Optimistically remove all non-current sessions.
    setSessions((prev) => prev.filter((s) => s.isCurrent));
    startTransition(async () => {
      try {
        const result = await revokeOtherSessionsAction();
        if (result.count === 0) {
          toast("No other sessions to sign out of", { tone: "info" });
        } else {
          toast(
            result.count === 1
              ? "Signed out of 1 other session"
              : `Signed out of ${result.count} other sessions`,
            { tone: "success" },
          );
        }
      } catch (e) {
        setSessions(snapshot);
        toast("Couldn't sign out", {
          tone: "error",
          body: (e as Error).message,
        });
      }
    });
  }

  return (
    <>
      <div className="mt-4 overflow-hidden rounded-xl border border-line-soft bg-bg-elevated">
        <div className="flex items-center justify-between border-b border-line-soft/70 bg-bg-sunken/30 px-5 py-2.5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-quiet">
            Active sessions
          </div>
          <div className="text-[11px] tabular-nums text-ink-quiet">
            {sessions.length}{" "}
            {sessions.length === 1 ? "device" : "devices"}
          </div>
        </div>
        {sessions.length === 0 ? (
          <div className="px-5 py-4 text-[13px] text-ink-quiet">
            No active sessions.
          </div>
        ) : (
          <ul>
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-4 border-b border-line-soft/60 px-5 py-3.5 last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-ink truncate">
                      {s.isCurrent ? "This device" : s.deviceHint}
                    </span>
                    {s.isCurrent ? (
                      <span className="flex-shrink-0 rounded bg-bg-sunken px-1.5 py-0.5 text-[10px] font-medium text-ink-quiet">
                        current
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-ink-quiet">
                    {s.locationHint
                      ? `${s.locationHint} · `
                      : null}
                    Last active {fmtLastActive(s.lastActiveAt)}
                  </div>
                </div>
                {!s.isCurrent ? (
                  <button
                    type="button"
                    onClick={() => handleRevoke(s.id)}
                    disabled={pending}
                    className="flex-shrink-0 rounded-full border border-line bg-white px-3 py-1 text-[12px] font-medium text-ink-soft hover:border-ink-soft/30 hover:text-ink disabled:opacity-60"
                  >
                    Sign out
                  </button>
                ) : (
                  <span className="block w-[72px]" aria-hidden />
                )}
              </li>
            ))}
          </ul>
        )}
        {otherSessions.length > 0 ? (
          <div className="border-t border-line-soft/60 px-5 py-3">
            <button
              type="button"
              onClick={() => setRevokeAllOpen(true)}
              disabled={pending}
              className="text-[12.5px] font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline disabled:opacity-60"
            >
              Sign out all other sessions
            </button>
          </div>
        ) : null}
      </div>

      {/* Confirm sign-out-all dialog */}
      <Dialog
        open={revokeAllOpen}
        onClose={() => setRevokeAllOpen(false)}
        labelledBy="revoke-all-title"
        width={420}
      >
        <div className="px-5 py-5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-quiet">
            Confirm
          </div>
          <h3
            id="revoke-all-title"
            className="mt-1 text-[17px] font-semibold tracking-tight"
          >
            Sign out everywhere else?
          </h3>
          <p className="mt-2 text-[13px] leading-[1.55] text-ink-soft">
            Every other active session — other browsers, devices, or
            apps — will be ended immediately. You stay signed in here.
          </p>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setRevokeAllOpen(false)}
              className="rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:border-ink-soft/30 hover:text-ink"
            >
              Never mind
            </button>
            <button
              type="button"
              onClick={handleRevokeAll}
              disabled={pending}
              className="rounded-full bg-ink px-3 py-1.5 text-[12.5px] font-medium text-white shadow-sm hover:bg-ink-soft disabled:opacity-60"
            >
              {pending ? "Signing out…" : "Sign out other sessions"}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

// ── Recent security activity block ───────────────────────────────────

function RecentSecurityActivityBlock({
  lines,
}: {
  lines: SecurityActivityLine[];
}) {
  if (lines.length === 0) {
    return (
      <div className="mt-4 overflow-hidden rounded-xl border border-line-soft bg-bg-elevated">
        <div className="border-b border-line-soft/70 bg-bg-sunken/30 px-5 py-2.5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-quiet">
            Recent security activity
          </div>
        </div>
        <div className="px-5 py-4 text-[13px] leading-[1.55] text-ink-quiet">
          Nothing yet. Security-relevant events will appear here.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-line-soft bg-bg-elevated">
      <div className="border-b border-line-soft/70 bg-bg-sunken/30 px-5 py-2.5">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-quiet">
          Recent security activity
        </div>
      </div>
      <ul>
        {lines.map((line) => (
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
  );
}

// ── Main section export ──────────────────────────────────────────────

export function SecuritySection({ data }: { data: SecurityData }) {
  if (!data.clerkAvailable) {
    return (
      <div>
        <SectionHeader
          eyebrow="Security"
          title="Security and sign-in"
          description="Manage how you sign in and which devices have access to your account."
        />
        <div className="rounded-xl border border-line-soft bg-bg-elevated p-5 text-[13px] leading-[1.55] text-ink-quiet">
          Sign-in management is unavailable in this environment.
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Security"
        title="Security and sign-in"
        description="Manage how you sign in and which devices have access to your account."
      />

      <SignInMethodsBlock methods={data.signInMethods} />
      <ActiveSessionsBlock initialSessions={data.sessions} />
      <RecentSecurityActivityBlock lines={data.recentActivity} />
    </div>
  );
}
