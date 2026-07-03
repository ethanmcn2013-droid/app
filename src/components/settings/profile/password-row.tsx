"use client";

import { useState } from "react";
import type { UserResource } from "@clerk/shared/types";
import { Dialog } from "@/components/primitives/dialog";
import { SettingsRow } from "@/components/settings/section";

export function PasswordRow({ user }: { user: UserResource }) {
  const [open, setOpen] = useState(false);

  const has = user.passwordEnabled;

  return (
    <>
      <SettingsRow
        label="Password"
        hint={
          has
            ? "Used when sign-in codes aren't reaching you."
            : "You don't have a password, you sign in with a code or a connected account. Add one below if you'd like a fallback."
        }
        control={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
          >
            {has ? "Change" : "Set a password"}
          </button>
        }
      />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        labelledBy="pwd-change-title"
      >
        <PasswordChangeFlow
          user={user}
          existing={has}
          onClose={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}

function PasswordChangeFlow({
  user,
  existing,
  onClose,
}: {
  user: UserResource;
  existing: boolean;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);

  async function save() {
    if (next.length < 8) {
      setError("Use at least eight characters");
      return;
    }
    if (next !== confirm) {
      setError("The two new passwords don't match");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await user.updatePassword({
        currentPassword: existing ? current : undefined,
        newPassword: next,
        signOutOfOtherSessions: true,
      });
      setDone(true);
    } catch (e) {
      setError(extractClerkError(e) ?? "Couldn't update your password");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="p-6">
        <h2 className="text-[16px] font-semibold tracking-tight text-ink">
          Password updated.
        </h2>
        <p className="mt-2 text-[13px] leading-[1.55] text-ink-soft">
          Other devices were signed out. They'll need the new password (or a
          fresh sign-in code) to come back in.
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-ink-soft"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2
        id="pwd-change-title"
        className="text-[16px] font-semibold tracking-tight text-ink"
      >
        {existing ? "Change your password" : "Set a password"}
      </h2>
      <p className="mt-2 text-[12.5px] leading-[1.55] text-ink-soft">
        At least eight characters. Saving signs out every other device.
      </p>

      <div className="mt-4 space-y-3">
        {existing ? (
          <PasswordField
            id="current-pwd"
            label="Current password"
            value={current}
            onChange={setCurrent}
            show={showCurrent}
            toggleShow={() => setShowCurrent((v) => !v)}
            disabled={pending}
            autoComplete="current-password"
          />
        ) : null}
        <PasswordField
          id="new-pwd"
          label="New password"
          value={next}
          onChange={setNext}
          show={showNext}
          toggleShow={() => setShowNext((v) => !v)}
          disabled={pending}
          autoComplete="new-password"
        />
        <PasswordField
          id="confirm-pwd"
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          show={showNext}
          toggleShow={() => setShowNext((v) => !v)}
          disabled={pending}
          autoComplete="new-password"
        />
      </div>

      {error ? (
        <div className="mt-3 text-[12px] text-rose-700">{error}</div>
      ) : null}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-[12.5px] text-ink-quiet transition-colors hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-ink-soft disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  toggleShow,
  disabled,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  toggleShow: () => void;
  disabled: boolean;
  autoComplete: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-[11px] uppercase tracking-[0.12em] text-ink-faint"
      >
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded-md border border-line bg-white px-3 py-2 pr-12 text-[13.5px] text-ink outline-none transition-colors focus:border-ink-soft/40"
        />
        <button
          type="button"
          onClick={toggleShow}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] text-ink-quiet transition-colors hover:text-ink"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

function extractClerkError(e: unknown): string | null {
  if (!e || typeof e !== "object") return null;
  const obj = e as { errors?: { longMessage?: string; message?: string }[] };
  const first = obj.errors?.[0];
  return first?.longMessage ?? first?.message ?? null;
}
