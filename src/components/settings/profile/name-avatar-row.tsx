"use client";

import { useRef, useState } from "react";
import type { UserResource } from "@clerk/shared/types";
import { SettingsRow } from "@/components/settings/section";

export function NameAvatarRow({
  user,
  setPending,
  pending,
}: {
  user: UserResource;
  setPending: (b: boolean) => void;
  pending: boolean;
}) {
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [savedHint, setSavedHint] = useState<"name" | "avatar" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function saveName() {
    const currentFirst = user.firstName ?? "";
    const currentLast = user.lastName ?? "";
    if (firstName === currentFirst && lastName === currentLast) return;
    setPending(true);
    setError(null);
    try {
      await user.update({ firstName, lastName });
      setSavedHint("name");
      setTimeout(() => setSavedHint(null), 1600);
    } catch (e) {
      setError(extractClerkError(e) ?? "Couldn’t save name");
    } finally {
      setPending(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setError("Pick an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Keep avatars under 5MB");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await user.setProfileImage({ file });
      setSavedHint("avatar");
      setTimeout(() => setSavedHint(null), 1600);
    } catch (err) {
      setError(extractClerkError(err) ?? "Couldn’t upload avatar");
    } finally {
      setPending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeAvatar() {
    setPending(true);
    setError(null);
    try {
      await user.setProfileImage({ file: null });
      setSavedHint("avatar");
      setTimeout(() => setSavedHint(null), 1600);
    } catch (err) {
      setError(extractClerkError(err) ?? "Couldn’t remove avatar");
    } finally {
      setPending(false);
    }
  }

  const displayInitials =
    `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "—";

  return (
    <>
      <SettingsRow
        label="Name"
        hint="Shown on tasks you own, comments you leave, and invites you send."
        control={
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onBlur={saveName}
                placeholder="First"
                aria-label="First name"
                disabled={pending}
                className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink outline-none transition-colors focus:border-ink-soft/40"
              />
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                onBlur={saveName}
                placeholder="Last"
                aria-label="Last name"
                disabled={pending}
                className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink outline-none transition-colors focus:border-ink-soft/40"
              />
            </div>
            {savedHint === "name" ? (
              <div className="text-[11px] text-ink-quiet">Saved</div>
            ) : null}
          </div>
        }
      />

      <SettingsRow
        label="Avatar"
        hint="A face beats initials when six people are in the same thread."
        control={
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-bg-sunken">
              {user.hasImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[13px] font-medium text-ink-soft">
                  {displayInitials}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => fileRef.current?.click()}
                className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink disabled:opacity-50"
              >
                {user.hasImage ? "Replace" : "Upload"}
              </button>
              {user.hasImage ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={removeAvatar}
                  className="text-left text-[11.5px] text-ink-quiet transition-colors hover:text-ink-soft disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFile}
              />
              {savedHint === "avatar" ? (
                <div className="text-[11px] text-ink-quiet">Saved</div>
              ) : null}
            </div>
          </div>
        }
      />

      {error ? (
        <div className="mt-1 rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
          {error}
        </div>
      ) : null}
    </>
  );
}

function extractClerkError(e: unknown): string | null {
  if (!e || typeof e !== "object") return null;
  const obj = e as { errors?: { longMessage?: string; message?: string }[] };
  const first = obj.errors?.[0];
  return first?.longMessage ?? first?.message ?? null;
}
