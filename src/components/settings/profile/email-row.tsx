"use client";

import { useState } from "react";
import type { EmailAddressResource, UserResource } from "@clerk/shared/types";
import { Dialog } from "@/components/primitives/dialog";
import { SettingsRow } from "@/components/settings/section";

type Step = "input" | "verify" | "done";

export function EmailRow({ user }: { user: UserResource }) {
  const primary = user.primaryEmailAddress;
  const [open, setOpen] = useState(false);

  return (
    <>
      <SettingsRow
        label="Email"
        hint={
          primary?.verification.status === "verified"
            ? "Verified. We send sign-in codes here."
            : "Pending verification, check your inbox."
        }
        control={
          <div className="flex items-center justify-between gap-3">
            <div className="truncate text-[13px] text-ink-soft">
              {primary?.emailAddress ?? "—"}
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex-shrink-0 rounded-md border border-line bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
            >
              Change
            </button>
          </div>
        }
      />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        labelledBy="email-change-title"
      >
        <EmailChangeFlow user={user} onClose={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

function EmailChangeFlow({
  user,
  onClose,
}: {
  user: UserResource;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("input");
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<"send" | "verify" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] =
    useState<EmailAddressResource | null>(null);

  async function sendCode() {
    if (!/^\S+@\S+\.\S+$/.test(newEmail)) {
      setError("That doesn’t look like an email");
      return;
    }
    setPending("send");
    setError(null);
    try {
      const created = await user.createEmailAddress({ email: newEmail });
      await created.prepareVerification({ strategy: "email_code" });
      setPendingEmail(created);
      setStep("verify");
    } catch (e) {
      setError(extractClerkError(e) ?? "Couldn’t send the code");
    } finally {
      setPending(null);
    }
  }

  async function verifyCode() {
    if (!pendingEmail) return;
    if (!/^\d{6}$/.test(code)) {
      setError("Codes are six digits");
      return;
    }
    setPending("verify");
    setError(null);
    try {
      const verified = await pendingEmail.attemptVerification({ code });
      await user.update({ primaryEmailAddressId: verified.id });
      // Clean up the old primary if any (leave verified addresses, drop unverified extras).
      await Promise.allSettled(
        user.emailAddresses
          .filter(
            (e) =>
              e.id !== verified.id &&
              e.verification?.status !== "verified",
          )
          .map((e) => e.destroy()),
      );
      setStep("done");
    } catch (e) {
      setError(extractClerkError(e) ?? "That code didn’t match");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="p-6">
      <h2
        id="email-change-title"
        className="text-[16px] font-semibold tracking-tight text-ink"
      >
        {step === "done" ? "Email updated." : "Change your email"}
      </h2>

      {step === "input" ? (
        <>
          <p className="mt-2 text-[12.5px] leading-[1.55] text-ink-soft">
            We&apos;ll send a six-digit code to confirm you own the new address.
            Your sign-in keeps working at the old address until you confirm.
          </p>
          <div className="mt-4">
            <label
              htmlFor="new-email"
              className="text-[11px] uppercase tracking-[0.12em] text-ink-faint"
            >
              New email
            </label>
            <input
              id="new-email"
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendCode();
              }}
              disabled={pending !== null}
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-[13.5px] text-ink outline-none transition-colors focus:border-ink-soft/40"
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
              onClick={sendCode}
              disabled={pending !== null}
              className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-ink-soft disabled:opacity-50"
            >
              {pending === "send" ? "Sending…" : "Send code"}
            </button>
          </div>
        </>
      ) : null}

      {step === "verify" ? (
        <>
          <p className="mt-2 text-[12.5px] leading-[1.55] text-ink-soft">
            We sent a code to{" "}
            <strong className="text-ink">{newEmail}</strong>.
            Paste it below.
          </p>
          <div className="mt-4">
            <label
              htmlFor="verify-code"
              className="text-[11px] uppercase tracking-[0.12em] text-ink-faint"
            >
              Six-digit code
            </label>
            <input
              id="verify-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") verifyCode();
              }}
              disabled={pending !== null}
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-center font-mono text-[18px] tracking-[0.3em] text-ink outline-none transition-colors focus:border-ink-soft/40"
            />
          </div>
          {error ? (
            <div className="mt-3 text-[12px] text-rose-700">{error}</div>
          ) : null}
          <div className="mt-5 flex justify-between">
            <button
              type="button"
              onClick={() => {
                setStep("input");
                setError(null);
                setCode("");
              }}
              className="rounded-md px-3 py-1.5 text-[12.5px] text-ink-quiet transition-colors hover:text-ink"
            >
              Back
            </button>
            <button
              type="button"
              onClick={verifyCode}
              disabled={pending !== null || code.length !== 6}
              className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-ink-soft disabled:opacity-50"
            >
              {pending === "verify" ? "Checking…" : "Confirm"}
            </button>
          </div>
        </>
      ) : null}

      {step === "done" ? (
        <>
          <p className="mt-2 text-[13px] leading-[1.55] text-ink-soft">
            Sign-in codes now go to{" "}
            <strong className="text-ink">{newEmail}</strong>. Tell us if
            something looks wrong, the old address still works for password
            recovery for the next 24 hours.
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
        </>
      ) : null}
    </div>
  );
}

function extractClerkError(e: unknown): string | null {
  if (!e || typeof e !== "object") return null;
  const obj = e as { errors?: { longMessage?: string; message?: string }[] };
  const first = obj.errors?.[0];
  return first?.longMessage ?? first?.message ?? null;
}
