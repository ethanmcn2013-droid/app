"use client";

import { useEffect, useState } from "react";
import type { TOTPResource, UserResource } from "@clerk/shared/types";
// qrcode (~30KB) is lazy-loaded inside the TOTP setup flow — only the
// fraction of users who actually start 2FA enrollment pay for it,
// instead of every visitor to profile settings.
import { Dialog } from "@/components/primitives/dialog";
import { SettingsRow } from "@/components/settings/section";

type SetupStep = "qr" | "verify" | "recovery";

export function TwoFactorRow({ user }: { user: UserResource }) {
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const enabled = user.totpEnabled;

  return (
    <>
      <SettingsRow
        label="Two-factor sign-in"
        hint={
          enabled
            ? "On. We'll ask for a six-digit code from your authenticator app on every new device."
            : "Off. Add a second factor if you want sign-in to require your phone too."
        }
        control={
          <button
            type="button"
            onClick={() =>
              enabled ? setDisableOpen(true) : setSetupOpen(true)
            }
            className={
              "rounded-md border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors " +
              (enabled
                ? "border-line bg-white text-ink-soft hover:border-ink-soft/30 hover:text-ink"
                : "border-ink bg-ink text-white hover:bg-ink-soft")
            }
          >
            {enabled ? "Turn off" : "Turn on"}
          </button>
        }
      />
      <Dialog
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        labelledBy="totp-setup-title"
        width={460}
      >
        <TotpSetupFlow user={user} onClose={() => setSetupOpen(false)} />
      </Dialog>
      <Dialog
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        labelledBy="totp-disable-title"
      >
        <TotpDisableFlow user={user} onClose={() => setDisableOpen(false)} />
      </Dialog>
    </>
  );
}

function TotpSetupFlow({
  user,
  onClose,
}: {
  user: UserResource;
  onClose: () => void;
}) {
  const [step, setStep] = useState<SetupStep>("qr");
  const [totp, setTotp] = useState<TOTPResource | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setPending(true);
      try {
        const created = await user.createTOTP();
        if (cancelled) return;
        setTotp(created);
        if (created.uri) {
          const { default: QRCode } = await import("qrcode");
          const svg = await QRCode.toString(created.uri, {
            type: "svg",
            margin: 0,
            width: 200,
            color: { dark: "#18181b", light: "#ffffff" },
          });
          if (!cancelled) setQrSvg(svg);
        }
      } catch (e) {
        if (!cancelled) {
          setError(extractClerkError(e) ?? "Couldn't start 2FA setup");
        }
      } finally {
        if (!cancelled) setPending(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function verify() {
    if (!/^\d{6}$/.test(code)) {
      setError("Codes are six digits");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await user.verifyTOTP({ code });
      const backup = await user.createBackupCode();
      setRecoveryCodes(backup.codes);
      setStep("recovery");
    } catch (e) {
      setError(extractClerkError(e) ?? "That code didn't match");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="p-6">
      <h2
        id="totp-setup-title"
        className="text-[16px] font-semibold tracking-tight text-ink"
      >
        {step === "qr" && "Set up two-factor sign-in"}
        {step === "verify" && "Confirm your authenticator"}
        {step === "recovery" && "Save these recovery codes"}
      </h2>

      {step === "qr" ? (
        <>
          <p className="mt-2 text-[12.5px] leading-[1.55] text-ink-soft">
            Open your authenticator app (1Password, Authy, Google
            Authenticator) and scan this. Then come back for the code.
          </p>
          <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-line-soft bg-bg-sunken/40 p-5">
            {qrSvg ? (
              <div
                className="h-[200px] w-[200px] rounded bg-white p-2 shadow-sm"
                aria-label="QR code for two-factor setup"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <div className="h-[200px] w-[200px] animate-pulse rounded bg-bg-sunken" />
            )}
            {totp?.secret ? (
              <details className="w-full text-[12px]">
                <summary className="cursor-pointer text-ink-quiet transition-colors hover:text-ink">
                  Can't scan? Enter the key manually
                </summary>
                <div className="mt-2 select-all break-all rounded bg-white px-3 py-2 font-mono text-[12px] text-ink">
                  {totp.secret}
                </div>
              </details>
            ) : null}
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
              disabled={pending || !totp}
              onClick={() => setStep("verify")}
              className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-ink-soft disabled:opacity-50"
            >
              I've scanned it
            </button>
          </div>
        </>
      ) : null}

      {step === "verify" ? (
        <>
          <p className="mt-2 text-[12.5px] leading-[1.55] text-ink-soft">
            Enter the six-digit code from your authenticator.
          </p>
          <div className="mt-4">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") verify();
              }}
              disabled={pending}
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-center font-mono text-[20px] tracking-[0.3em] text-ink outline-none transition-colors focus:border-ink-soft/40"
            />
          </div>
          {error ? (
            <div className="mt-3 text-[12px] text-rose-700">{error}</div>
          ) : null}
          <div className="mt-5 flex justify-between">
            <button
              type="button"
              onClick={() => setStep("qr")}
              className="rounded-md px-3 py-1.5 text-[12.5px] text-ink-quiet transition-colors hover:text-ink"
            >
              Back
            </button>
            <button
              type="button"
              disabled={pending || code.length !== 6}
              onClick={verify}
              className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-ink-soft disabled:opacity-50"
            >
              {pending ? "Checking…" : "Confirm"}
            </button>
          </div>
        </>
      ) : null}

      {step === "recovery" ? (
        <>
          <p className="mt-2 text-[12.5px] leading-[1.55] text-ink-soft">
            If you lose your authenticator, these codes get you back in. Each
            one works once. Save them somewhere your future-self can find them.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-line-soft bg-bg-sunken/40 p-4">
            {recoveryCodes.map((rc) => (
              <code
                key={rc}
                className="select-all text-center font-mono text-[12.5px] text-ink"
              >
                {rc}
              </code>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(recoveryCodes.join("\n"));
            }}
            className="mt-3 text-[12px] text-ink-quiet transition-colors hover:text-ink"
          >
            Copy all to clipboard
          </button>
          <label className="mt-4 flex items-center gap-2 text-[12.5px] text-ink-soft">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
            />
            I've saved these.
          </label>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={!acknowledged}
              className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-ink-soft disabled:opacity-50"
            >
              Done
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function TotpDisableFlow({
  user,
  onClose,
}: {
  user: UserResource;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function turnOff() {
    setPending(true);
    setError(null);
    try {
      await user.disableTOTP();
      onClose();
    } catch (e) {
      setError(extractClerkError(e) ?? "Couldn't turn off 2FA");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="p-6">
      <h2
        id="totp-disable-title"
        className="text-[16px] font-semibold tracking-tight text-ink"
      >
        Turn off two-factor sign-in?
      </h2>
      <p className="mt-2 text-[12.5px] leading-[1.55] text-ink-soft">
        Sign-in will only need your email and a code. Your authenticator setup
        will be discarded — you'd start fresh if you turned it back on.
      </p>
      {error ? (
        <div className="mt-3 text-[12px] text-rose-700">{error}</div>
      ) : null}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-[12.5px] text-ink-quiet transition-colors hover:text-ink"
        >
          Keep it on
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={turnOff}
          className="rounded-md bg-rose-600 px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
        >
          {pending ? "Turning off…" : "Turn off"}
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
