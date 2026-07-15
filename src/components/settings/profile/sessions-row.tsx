"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@clerk/nextjs";
import type {
  SessionWithActivitiesResource,
  UserResource,
} from "@clerk/shared/types";
import { SettingsRow } from "@/components/settings/section";

export function SessionsRow({ user }: { user: UserResource }) {
  const { session: currentSession } = useSession();
  const [sessions, setSessions] = useState<
    SessionWithActivitiesResource[] | null
  >(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const list = await user.getSessions();
      setSessions(
        list.sort(
          (a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime(),
        ),
      );
    } catch (e) {
      setError(extractClerkError(e) ?? "Couldn't load your sessions");
    } finally {
      setPending(false);
    }
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function revoke(s: SessionWithActivitiesResource) {
    try {
      await s.revoke();
      await load();
    } catch (e) {
      setError(extractClerkError(e) ?? "Couldn't sign that device out");
    }
  }

  async function revokeOthers() {
    if (!sessions || !currentSession) return;
    if (
      !confirm(
        "Sign out every other device? You'll stay signed in here.",
      )
    ) {
      return;
    }
    setPending(true);
    try {
      await Promise.all(
        sessions
          .filter((s) => s.id !== currentSession.id)
          .map((s) => s.revoke()),
      );
      await load();
    } catch (e) {
      setError(extractClerkError(e) ?? "Couldn't sign other devices out");
    } finally {
      setPending(false);
    }
  }

  const others = sessions?.filter((s) => s.id !== currentSession?.id) ?? [];

  return (
    <SettingsRow
      label="Active sessions"
      hint="Devices where you're signed in. Sign out anything you don't recognise."
      control={
        <div className="flex w-full flex-col gap-2">
          {sessions === null ? (
            <div className="h-10 w-full animate-pulse rounded-md bg-bg-sunken/60" />
          ) : null}
          {sessions ? (
            <>
              <ul className="space-y-1.5">
                {sessions.map((s) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    isCurrent={s.id === currentSession?.id}
                    onRevoke={() => revoke(s)}
                  />
                ))}
              </ul>
              {others.length > 0 ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={revokeOthers}
                  className="self-end text-[11.5px] text-ink-quiet transition-colors hover:text-ink disabled:opacity-50"
                >
                  Sign out every other device
                </button>
              ) : null}
            </>
          ) : null}
          {error ? (
            <div className="text-[12px] text-rose-700">{error}</div>
          ) : null}
        </div>
      }
    />
  );
}

function SessionItem({
  session,
  isCurrent,
  onRevoke,
}: {
  session: SessionWithActivitiesResource;
  isCurrent: boolean;
  onRevoke: () => void;
}) {
  const a = session.latestActivity;
  const browser = [a?.browserName, a?.browserVersion].filter(Boolean).join(" ");
  const location = [a?.city, a?.country].filter(Boolean).join(", ");
  const ago = relativeTime(session.lastActiveAt);

  return (
    <li className="flex items-start justify-between gap-3 rounded-md border border-line-soft px-3 py-2">
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium text-ink">
          {browser || a?.deviceType || "Unknown device"}
          {isCurrent ? (
            <span className="ml-2 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-emerald-700">
              This device
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 text-[11.5px] text-ink-quiet">
          {location ? `${location} · ` : ""}
          {ago}
        </div>
      </div>
      {!isCurrent ? (
        <button
          type="button"
          onClick={onRevoke}
          className="flex-shrink-0 self-center rounded px-2 py-1 text-[11.5px] text-ink-quiet transition-colors hover:bg-rose-50 hover:text-rose-700"
        >
          Sign out
        </button>
      ) : null}
    </li>
  );
}

function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "moments ago";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString();
}

function extractClerkError(e: unknown): string | null {
  if (!e || typeof e !== "object") return null;
  const obj = e as { errors?: { longMessage?: string; message?: string }[] };
  const first = obj.errors?.[0];
  return first?.longMessage ?? first?.message ?? null;
}
