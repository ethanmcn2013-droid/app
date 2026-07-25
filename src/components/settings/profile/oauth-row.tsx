"use client";

import { useState } from "react";
import type { UserResource } from "@clerk/shared/types";
import { SettingsRow } from "@/components/settings/section";
import {
  enabledSocialProviders,
  type SocialProviderId,
} from "@/lib/auth/social-providers";

export function OAuthRow({ user }: { user: UserResource }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const providers = enabledSocialProviders();

  const hasPassword = user.passwordEnabled;
  const accounts = user.externalAccounts;
  const onlyAuthMethod = !hasPassword && accounts.length <= 1;

  async function connect(p: (typeof providers)[number]) {
    setPending(p.id);
    setError(null);
    try {
      await user.createExternalAccount({
        strategy: p.id,
        redirectUrl: `${window.location.origin}/settings/profile`,
      });
    } catch (e) {
      setError(extractClerkError(e) ?? `Couldn't connect ${p.label}`);
      setPending(null);
    }
  }

  async function disconnect(accountId: string, label: string) {
    if (onlyAuthMethod) {
      setError(
        `${label} is your only way to sign in. Add another method before disconnecting it.`,
      );
      return;
    }
    setPending(accountId);
    setError(null);
    try {
      const account = accounts.find((a) => a.id === accountId);
      await account?.destroy();
    } catch (e) {
      setError(extractClerkError(e) ?? `Couldn't disconnect ${label}`);
    } finally {
      setPending(null);
    }
  }

  return (
    <SettingsRow
      label="Connected accounts"
      hint={
        accounts.length === 0
          ? "None yet. Connect an enabled sign-in method if you'd rather not type passwords."
          : "Sign-in shortcuts. Disconnect any you don't use."
      }
      control={
        <div className="flex w-full flex-col gap-2">
          {providers.map((p) => {
            const linked = accounts.find((a) => a.provider === providerSlug(p.id));
            const isPending = pending === p.id || pending === linked?.id;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-md border border-line-soft px-3 py-2"
              >
                <div className="flex items-center gap-2.5">
                  <ProviderGlyph id={p.id} />
                  <div>
                    <div className="text-[12.5px] font-medium text-ink">
                      {p.label}
                    </div>
                    {linked ? (
                      <div className="text-[11px] text-ink-quiet">
                        {linked.emailAddress}
                      </div>
                    ) : null}
                  </div>
                </div>
                {linked ? (
                  <button
                    type="button"
                    disabled={isPending || onlyAuthMethod}
                    onClick={() => disconnect(linked.id, p.label)}
                    title={
                      onlyAuthMethod
                        ? "Add another sign-in method before disconnecting this one."
                        : undefined
                    }
                    className="rounded px-2 py-1 text-[11.5px] text-ink-quiet transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => connect(p)}
                    className="rounded-md border border-line bg-white px-2 py-1 text-[11.5px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink disabled:opacity-50"
                  >
                    {isPending ? "Connecting…" : "Connect"}
                  </button>
                )}
              </div>
            );
          })}
          {error ? (
            <div className="text-[12px] text-rose-700">{error}</div>
          ) : null}
        </div>
      }
    />
  );
}

function providerSlug(id: SocialProviderId): string {
  return id.replace(/^oauth_/, "");
}

function ProviderGlyph({ id }: { id: SocialProviderId }) {
  if (id === "oauth_google") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    );
  }
  if (id === "oauth_apple") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12-1.13.42-2.31 1.16-3.1.72-.79 2.02-1.49 3.005-1.55zM21.06 17.05c-.34.78-.5 1.13-.93 1.81-.61.96-1.47 2.16-2.55 2.17-.96.01-1.21-.62-2.51-.62-1.3.01-1.57.63-2.54.62-1.08-.01-1.89-1.09-2.51-2.05-1.73-2.71-1.92-5.89-.84-7.59.76-1.19 1.96-1.89 3.1-1.89 1.15 0 1.88.63 2.84.63.93 0 1.5-.63 2.83-.63 1 0 2.07.55 2.83 1.5-2.5 1.37-2.1 4.93.28 6.05z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.83-.26.83-.57v-2c-3.34.72-4.04-1.4-4.04-1.4-.55-1.4-1.34-1.77-1.34-1.77-1.09-.74.09-.73.09-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.31-.54-1.52.12-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.87.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.21.69.83.57A12 12 0 0 0 12 .3" />
    </svg>
  );
}

function extractClerkError(e: unknown): string | null {
  if (!e || typeof e !== "object") return null;
  const obj = e as { errors?: { longMessage?: string; message?: string }[] };
  const first = obj.errors?.[0];
  return first?.longMessage ?? first?.message ?? null;
}
